import { useCallback, useEffect, useRef, useState } from 'react';
import type { JSX } from 'react';

import type { HicMatrixResponse } from '../../api/client';
import { pxToBp } from '../../genomics/coords';
import { useCursor } from '../../store/cursor';
import { useViewport } from '../../store/viewport';
import fragmentShader from '../../genomics/hic-shader/fragment.glsl?raw';
import vertexShader from '../../genomics/hic-shader/vertex.glsl?raw';

interface HiCMatrix2DStandardProps {
  variant?: 'standard';
  sampleId: string;
  data?: HicMatrixResponse;
  loading?: boolean;
  error?: Error | null;
  colorMap: 'rdbu' | 'viridis';
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
  const effectiveColorMapIndex: 0 | 1 | 2 =
    variant === 'differential' ? 2 : colorMap === 'viridis' ? 1 : 0;
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
    const canvasWidth = Math.max(1, Math.round(rect.width * dpr));
    const canvasHeight = Math.max(1, Math.round(height * dpr));
    if (canvas.width !== canvasWidth) canvas.width = canvasWidth;
    if (canvas.height !== canvasHeight) canvas.height = canvasHeight;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${height}px`;
    gl.viewport(0, 0, canvasWidth, canvasHeight);

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
      canvasWidth,
      canvasHeight,
    );
    gl.activeTexture(gl.TEXTURE0);
    if (textureRef.current) {
      gl.bindTexture(gl.TEXTURE_2D, textureRef.current);
    }
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }, [effectiveColorMapIndex, data, glReady, height, vmax, vmin]);

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

    // R32F + LINEAR sampling requires OES_texture_float_linear to be *enabled*
    // (not just supported). Without it, implementations silently return 0 for
    // float-texture samples and the canvas renders as a uniform flat color.
    // OES_texture_float is WebGL1-only; in WebGL2 R32F is core, but float
    // filtering still needs the linear-filter extension activated.
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
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
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
