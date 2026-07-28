/**
 * render-kit 中可复用的 Hi-C 二维矩阵渲染基件，统一处理 WebGL 生命周期、纹理上传、色图选择与光标映射。
 * 它同时服务标准矩阵和差异矩阵，只接收已解析的数据；这种边界使模型层决定“画什么”，本文件专注“如何高效绘制”。
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { JSX } from 'react';

import type { HicMatrixResponse } from '../../../api/client';
import { pxToBp } from '../../../genomics/coords';
import { useCursor } from '../../../store/cursor';
import { useViewport } from '../../../store/viewport';
import fragmentShader from '../../../genomics/hic-shader/fragment.glsl?raw';
import vertexShader from '../../../genomics/hic-shader/vertex.glsl?raw';

interface HiCMatrix2DStandardProps {
  variant?: 'standard';
  sampleId: string;
  data?: HicMatrixResponse;
  loading?: boolean;
  error?: Error | null;
  colorMap: 'rdbu' | 'viridis' | 'ref';
  vmin?: number;
  vmax?: number;
  bin: number;
  height?: number;
}

interface HiCMatrix2DDifferentialProps {
  variant: 'differential';
  sampleA: string;
  sampleB: string;
  data?: HicMatrixResponse;
  loading?: boolean;
  error?: Error | null;
  /** Differential colormap is fixed (diffRdBu); this prop is ignored but accepted for API symmetry. */
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
  // Differential mode forces the white-centered diverging colormap (shader index 2).
  const effectiveColorMapIndex: 0 | 1 | 2 | 3 =
    variant === 'differential' ? 2 : colorMap === 'viridis' ? 1 : colorMap === 'ref' ? 3 : 0;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const viewport = useViewport();
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
    // Hi-C matrices are intrinsically square — use min(width, height) so
    // the rendered quad stays square regardless of lane width vs. height.
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
  }, [effectiveColorMapIndex, data, glReady, vmax, vmin]);

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
    const gl = canvas.getContext('webgl2');
    if (!gl) {
      setGlError(new Error('WebGL2 not supported'));
      return;
    }

    // Use NEAREST filtering for the data texture to preserve crisp bin-level
    // pixels. LINEAR would blur adjacent bins, making the matrix look muddy.
    // The reference hic.html uses the same NEAREST approach for the matrix
    // texture (only the LUT gets LINEAR interpolation).
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

  // Re-render when viewport changes (zoom/pan). The Lane's query refetch handles
  // texture updates, but we also need to redraw the quad with the current
  // vmin/vmax and recompute the square side after the new data lands.
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
        const rect = event.currentTarget.getBoundingClientRect();
        if (rect.width <= 0) return;
        const localX = event.clientX - rect.left;
        const stageContent = event.currentTarget.closest('.stage-content');
        const stageRect = stageContent?.getBoundingClientRect();
        // bp 使用矩阵局部坐标，而十字线 x 使用舞台坐标；二者分离才能同时对齐数据与跨轨道覆盖层。
        const stageX = event.clientX - (stageRect?.left ?? rect.left);
        const bp = pxToBp(localX, viewport, rect.width);
        useCursor.getState().setCursor(stageX, bp, 'hic');
      }}
      onMouseLeave={() => useCursor.getState().setCursor(null, null, null)}
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
