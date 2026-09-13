/**
 * render-kit 中可复用的 Hi-C 二维矩阵渲染基件，统一处理 WebGL 生命周期、纹理上传、色图选择与光标映射。
 * 它同时服务标准矩阵和差异矩阵，只接收已解析的数据；这种边界使模型层决定"画什么"，本文件专注"如何高效绘制"。
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { JSX } from 'react';

import type { HicMatrixResponse } from '../../../api/client';
import { pxToBp } from '../../../genomics/coords';
import { useCursor } from '../../../store/cursor';
import { usePanelViewport } from '../../../hooks/usePanelViewport';
import fragmentShader from '../../../genomics/hic-shader/fragment.glsl?raw';
import vertexShader from '../../../genomics/hic-shader/vertex.glsl?raw';

interface HiCMatrix2DStandardProps {
  variant?: 'standard';
  sampleId: string;
  data?: HicMatrixResponse;
  loading?: boolean;
  error?: Error | null;
  colorMap: 'rdbu' | 'viridis' | 'ref' | 'reds';
  vmin?: number;
  vmax?: number;
  bin: number;
  height?: number;
  /** Triangle Mode：只显示对角线上方的上三角（下半部分裁掉）。 */
  triangle?: boolean;
}

interface HiCMatrix2DDifferentialProps {
  variant: 'differential';
  sampleA: string;
  sampleB: string;
  data?: HicMatrixResponse;
  loading?: boolean;
  error?: Error | null;
  /** 差异矩阵色图固定（diffRdBu）；保留此 prop 仅为 API 对称，实际会被忽略。 */
  colorMap?: 'rdbu' | 'viridis';
  vmin?: number;
  vmax?: number;
  bin: number;
  height?: number;
}

type HiCMatrix2DProps = HiCMatrix2DStandardProps | HiCMatrix2DDifferentialProps;

/**
 * 按差异矩阵接口约定请求并解码紧凑的 float32 二进制响应。
 *
 * @param sampleA - 差异计算的基准样本。
 * @param sampleB - 与基准样本比较的目标样本。
 * @param chr - 查询染色体。
 * @param start - 视口起点；发送前向下取整以覆盖左边界。
 * @param end - 视口终点；发送前向上取整以覆盖右边界。
 * @param bin - 期望分辨率，规范为至少 1 bp 的整数。
 * @returns 解码后的行优先矩阵、二维形状与服务端计算的颜色范围。
 * @throws 响应失败或服务端返回非 float32 数据时抛出错误。
 */
async function fetchDifferentialHic(
  sampleA: string,
  sampleB: string,
  chr: string,
  start: number,
  end: number,
  bin: number,
): Promise<HicMatrixResponse> {
  const params = new URLSearchParams({
    sample_a: sampleA,
    sample_b: sampleB,
    chr,
    start: String(Math.floor(start)),
    end: String(Math.ceil(end)),
    bin: String(Math.max(1, Math.round(bin))),
  });
  const r = await fetch(`/api/differential/matrix?${params}`);
  if (!r.ok) throw new Error(`differential: ${r.status}`);
  const buf = await r.arrayBuffer();
  const dtype = r.headers.get('X-Genomics-Dtype') ?? 'float32';
  if (dtype !== 'float32') throw new Error(`unexpected dtype: ${dtype}`);
  const shapeStr = r.headers.get('X-Genomics-Shape') ?? '0,0';
  const [h, w] = shapeStr.split(',').map(Number);
  const vmin = parseFloat(r.headers.get('X-Genomics-Vmin') ?? '0');
  const vmax = parseFloat(r.headers.get('X-Genomics-Vmax') ?? '1');
  return { matrix: new Float32Array(buf), shape: [h, w], vmin, vmax };
}

export { fetchDifferentialHic };

/**
 * 使用 WebGL2 绘制标准或差异 Hi-C 矩阵，并把鼠标位置投影到全局基因组光标。
 *
 * @param props - 判别联合配置：标准模式提供单样本，差异模式提供样本对；两者共享矩阵、范围、bin 与高度。
 * @returns 管理 canvas、加载元信息及可见错误状态的矩阵宿主元素。
 */
export function HiCMatrix2D(props: HiCMatrix2DProps): JSX.Element {
  const {
    variant = 'standard',
    data,
    loading = false,
    error = null,
    colorMap,
    vmin = data?.vmin ?? 0,
    vmax = data?.vmax ?? 1,
    bin,
    height = 480,
  } = props;
  const triangle = variant === 'standard' ? Boolean((props as HiCMatrix2DStandardProps).triangle) : false;
  // 差异模式强制使用白色中心发散色图（shader index 2）。
  const effectiveColorMapIndex: 0 | 1 | 2 | 3 | 4 =
    variant === 'differential' ? 2 : colorMap === 'viridis' ? 1 : colorMap === 'ref' ? 3 : colorMap === 'reds' ? 4 : 0;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const viewport = usePanelViewport();
  const glRef = useRef<WebGL2RenderingContext | null>(null);
  const textureRef = useRef<WebGLTexture | null>(null);
  const programRef = useRef<WebGLProgram | null>(null);
  const bufferRef = useRef<WebGLBuffer | null>(null);
  const [glError, setGlError] = useState<Error | null>(null);
  const [glReady, setGlReady] = useState(false);

  const render = useCallback((): void => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    const gl = glRef.current;
    const program = programRef.current;
    if (!canvas || !container || !gl || !program) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = container.getBoundingClientRect();
    // Hi-C 矩阵本质上是方形的——取 min(width, height) 保证渲染的四边形
    // 无论 lane 宽高比如何都保持正方形。
    const side = Math.max(1, Math.min(rect.width, rect.height));
    const drawingSide = Math.max(1, Math.round(side * dpr));
    if (canvas.width !== drawingSide) canvas.width = drawingSide;
    if (canvas.height !== drawingSide) canvas.height = drawingSide;
    canvas.style.width = `${side}px`;
    canvas.style.height = `${side}px`;
    gl.viewport(0, 0, drawingSide, drawingSide);

    gl.useProgram(program);
    gl.uniform1i(gl.getUniformLocation(program, 'u_matrix'), 0);
    gl.uniform1f(gl.getUniformLocation(program, 'u_vmin'), vmin);
    gl.uniform1f(gl.getUniformLocation(program, 'u_vmax'), vmax);
    gl.uniform1i(
      gl.getUniformLocation(program, 'u_colorMap'),
      effectiveColorMapIndex,
    );
    gl.uniform1i(gl.getUniformLocation(program, 'u_triangle'), triangle ? 1 : 0);
    gl.uniform2f(
      gl.getUniformLocation(program, 'u_canvasSize'),
      drawingSide,
      drawingSide,
    );
    gl.activeTexture(gl.TEXTURE0);
    if (textureRef.current) {
      gl.bindTexture(gl.TEXTURE_2D, textureRef.current);
    }
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }, [effectiveColorMapIndex, data, glReady, triangle, vmax, vmin]);

  const uploadTexture = useCallback((): void => {
    const gl = glRef.current;
    const texture = textureRef.current;
    if (!gl || !texture || !data) return;

    const [matrixHeight, matrixWidth] = data.shape;
    if (matrixHeight === 0 || matrixWidth === 0) return;
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.R32F,
      matrixWidth,
      matrixHeight,
      0,
      gl.RED,
      gl.FLOAT,
      data.matrix,
    );
    render();
  }, [data, render]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    // WebGL2 默认 preserveDrawingBuffer=false —— 绘制缓冲在浏览器 present 后被清空。
    // 本组件的绘制只在 effect 里触发（视口变化 / 数据到达时才重画），发生在浏览器
    // 提交帧之后；不保留缓冲时，合成器可能在后续合成或截图时读到已清空的缓冲，
    // 屏幕上表现为矩阵空白。preserve=true 让上一次绘制结果保留到下一次绘制，
    // 是"静态矩阵 + 按需重绘"场景的标准兜底，与 3D 视图的连续 rAF 渲染等效。
    const gl = canvas.getContext('webgl2', { preserveDrawingBuffer: true });
    if (!gl) {
      setGlError(new Error('WebGL2 not supported'));
      return;
    }

    // 数据纹理使用 NEAREST 过滤以保持清晰的 bin 级像素。
    // LINEAR 会模糊相邻 bin，使矩阵看起来模糊不清。
    // 参考 hic.html 对矩阵纹理也采用 NEAREST（只有 LUT 使用 LINEAR 插值）。
    gl.getExtension('OES_texture_float_linear');

    let vertex: WebGLShader | null = null;
    let fragment: WebGLShader | null = null;
    let program: WebGLProgram | null = null;
    try {
      vertex = compileShader(gl, gl.VERTEX_SHADER, vertexShader);
      fragment = compileShader(gl, gl.FRAGMENT_SHADER, fragmentShader);
      program = gl.createProgram();
      if (!program) throw new Error('program create failed');
      gl.attachShader(program, vertex);
      gl.attachShader(program, fragment);
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        throw new Error(`link failed: ${gl.getProgramInfoLog(program)}`);
      }
    } catch (caught) {
      if (program) gl.deleteProgram(program);
      if (vertex) gl.deleteShader(vertex);
      if (fragment) gl.deleteShader(fragment);
      setGlError(caught instanceof Error ? caught : new Error(String(caught)));
      return;
    }

    glRef.current = gl;
    programRef.current = program;

    const positions = new Float32Array([
      // 两个三角形覆盖完整裁剪空间，矩阵采样和色图转换全部留给 fragment shader。
      -1, -1, 1, -1, -1, 1,
      -1, 1, 1, -1, 1, 1,
    ]);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
    const positionLocation = gl.getAttribLocation(program, 'a_position');
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);
    bufferRef.current = buffer;

    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    textureRef.current = texture;
    setGlReady(true);

    return () => {
      gl.deleteTexture(texture);
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
      gl.deleteShader(vertex);
      gl.deleteShader(fragment);
      glRef.current = null;
      textureRef.current = null;
      programRef.current = null;
      bufferRef.current = null;
      setGlReady(false);
    };
  }, []);

  useEffect(() => {
    if (glReady) uploadTexture();
  }, [glReady, uploadTexture]);

  useEffect(() => {
    render();
  }, [render]);

  // 视口变化（缩放/平移）时重新渲染。Lane 的 query refetch 负责更新纹理，
  // 但我们还需要用当前的 vmin/vmax 重绘四边形并在新数据到达后重新计算正方形边长。
  useEffect(() => {
    render();
  }, [
    viewport.chr,
    viewport.start,
    viewport.end,
    viewport.bin,
    vmin,
    vmax,
    render,
  ]);

  useEffect(() => {
    const observer = new ResizeObserver(render);
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [render]);

  const displayedError = error ?? glError;

  const dataAttribute: Record<string, string> =
    variant === 'differential'
      ? {
          'data-sample-a': (props as HiCMatrix2DDifferentialProps).sampleA,
          'data-sample-b': (props as HiCMatrix2DDifferentialProps).sampleB,
          'data-variant': 'differential',
        }
      : {
          'data-sample-id': (props as HiCMatrix2DStandardProps).sampleId,
        };

  return (
    <div
      className="hic-matrix"
      ref={containerRef}
      {...dataAttribute}
      style={{ height: `${height}px` }}
      onMouseMove={(event) => {
        // 已点击锁定：十字线 / 说明 / 高亮带固定，不再跟随鼠标。
        if (useCursor.getState().locked) return;
        const rect = event.currentTarget.getBoundingClientRect();
        if (rect.width <= 0) return;
        const localX = event.clientX - rect.left;
        const localY = event.clientY - rect.top;

        // 三角形模式：canvas 是正方形，上三角（y < x）被 discard 透明。
        // 鼠标落在透明区域时不画十字线，否则空白处也会跟随。
        const canvasEl = canvasRef.current;
        if (canvasEl) {
          const cr = canvasEl.getBoundingClientRect();
          const cx = event.clientX - cr.left;
          const cy = event.clientY - cr.top;
          // 鼠标在 canvas 外：清除十字线
          if (cx < 0 || cy < 0 || cx > cr.width || cy > cr.height) {
            useCursor.getState().clearCursor();
            return;
          }
          // triangle 模式：上三角（cy/cr.height < cx/cr.width）被 discard，不响应
          if (triangle && cy / cr.height < cx / cr.width) {
            useCursor.getState().clearCursor();
            return;
          }
        }
        // 热图方块（canvas）在 .hic-matrix 容器内水平居中：
        // bp 映射必须基于方块区域，容器左右有留白 + colormap 条，
        // 用全宽映射会让鼠标位置与碱基坐标错位。
        const canvasEl0 = canvasRef.current;
        const canvasLeftInContainer = canvasEl0
          ? canvasEl0.getBoundingClientRect().left - rect.left
          : 0;
        const canvasW0 = canvasEl0
          ? Math.max(1, canvasEl0.getBoundingClientRect().width)
          : rect.width;
        const bp = pxToBp(
          localX - canvasLeftInContainer,
          viewport,
          canvasW0,
        );

        // 十字线宿主容器（Hi-C 区块）：横线 / 竖线都相对它定位，
        // 这样竖线能贯穿 Hi-C 下方的全部轨道，实现"轨道同步此区域"。
        const host = event.currentTarget.closest('[data-crosshair-host]');
        const hostRect = host?.getBoundingClientRect();
        const hostX = event.clientX - (hostRect?.left ?? rect.left);
        const hostY = event.clientY - (hostRect?.top ?? rect.top);
        // Compare 工作区多面板：宿主带 data-crosshair-id，CrosshairLayer 据此
        // 只在自己的面板内渲染十字线；单样本页无该属性 → null。
        const hostId = host?.getAttribute('data-crosshair-id') ?? null;

        // bin 级说明：鼠标所在列的 bin 区间（基因组坐标）与 Hi-C 强度值。
        let binStart: number | null = null;
        let binEnd: number | null = null;
        let binIndex: number | null = null;
        let value: number | null = null;
        let binX0: number | null = null;
        let binX1: number | null = null;
        if (data && data.shape[1] > 0 && data.shape[0] > 0) {
          // 热图方块（canvas）在容器内居中：bin→像素必须基于方块区域，
          // 否则高亮带与轨道指示列（同以方块为基准）错位。
          const canvasEl = canvasRef.current;
          // localX 相对 .hic-matrix 容器（event.currentTarget），因此
          // 鼠标在方块内的偏移要减 canvas 相对容器的 left（不是相对宿主）。
          const canvasLeftInRect = canvasEl
            ? canvasEl.getBoundingClientRect().left - rect.left
            : 0;
          const canvasLeftInHost = canvasEl
            ? canvasEl.getBoundingClientRect().left - (hostRect?.left ?? rect.left)
            : 0;
          const canvasWidth = canvasEl
            ? Math.max(1, canvasEl.getBoundingClientRect().width)
            : rect.width;
          const localInCanvas = localX - canvasLeftInRect;
          const colWidth = canvasWidth / data.shape[1];
          const rowHeight = rect.height / data.shape[0];
          const i = Math.min(
            data.shape[1] - 1,
            Math.max(0, Math.floor(localInCanvas / colWidth)),
          );
          const j = Math.min(data.shape[0] - 1, Math.max(0, Math.floor(localY / rowHeight)));
          binIndex = i;
          binStart = viewport.start + i * bin;
          binEnd = viewport.start + (i + 1) * bin;
          const raw = data.matrix[j * data.shape[1] + i];
          value = Number.isFinite(raw) ? raw : null;
          // 高亮带左右像素（相对宿主容器）：按 bin 在视口内的比例映射到热图方块，
          // 与轨道内 TrackBinIndicator（同样基于方块）像素级对齐。
          const viewportWidth = viewport.end - viewport.start;
          if (viewportWidth > 0) {
            binX0 =
              canvasLeftInHost + ((binStart - viewport.start) / viewportWidth) * canvasWidth;
            binX1 =
              canvasLeftInHost + ((binEnd - viewport.start) / viewportWidth) * canvasWidth;
          }
        }

        useCursor.getState().setCursor({
          x: hostX,
          y: hostY,
          bp,
          binStart,
          binEnd,
          binIndex,
          value,
          binX0,
          binX1,
          track: 'hic',
          hostId,
        });
      }}
      onClick={() => {
        // 点击锁定 / 再次点击解锁：锁定后十字线固定，轨道高亮带常驻。
        const store = useCursor.getState();
        if (store.locked) {
          store.unlock();
        } else if (store.x !== null && store.bp !== null) {
          store.lock();
        }
      }}
      onMouseLeave={() => {
        // 锁定时保留十字线与高亮带（固定展示）；未锁定才清空。
        if (useCursor.getState().locked) return;
        useCursor.getState().clearCursor();
      }}
    >
      <canvas ref={canvasRef} />
      {loading && <span className="hic-loading">Loading matrix…</span>}
      {displayedError && (
        <span className="hic-error">{displayedError.message}</span>
      )}
      {!loading && !displayedError && (
        <span className="hic-overlay-meta">
          {data
            ? `${data.shape[0]}×${data.shape[1]} · bin ${bin.toLocaleString()} bp`
            : ''}
        </span>
      )}
    </div>
  );
}

function compileShader(
  gl: WebGL2RenderingContext,
  type: number,
  source: string,
): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error('shader create failed');
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`compile failed: ${log}`);
  }
  return shader;
}
