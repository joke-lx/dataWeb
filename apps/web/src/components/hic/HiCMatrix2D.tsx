import { useCallback, useEffect, useRef, useState } from 'react';
import type { JSX } from 'react';

import { fetchHicMatrix, type HicMatrixResponse } from '../../api/client';
import { useViewport } from '../../store/viewport';
import vertexShader from '../../genomics/hic-shader/vertex.glsl?raw';
import fragmentShader from '../../genomics/hic-shader/fragment.glsl?raw';

interface HiCMatrix2DProps {
  sampleId: string;
  height?: number;
}

// Cap the on-screen matrix to a small enough texture that upload + shader stay cheap.
const MAX_MATRIX_DIM = 512;

export function HiCMatrix2D({ sampleId, height = 480 }: HiCMatrix2DProps): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const viewport = useViewport();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [colorMap] = useState<'rdbu' | 'viridis'>('rdbu');
  const [vmin, setVmin] = useState(0);
  const [vmax, setVmax] = useState(1);
  const dataRef = useRef<HicMatrixResponse | null>(null);
  const glRef = useRef<WebGL2RenderingContext | null>(null);
  const texRef = useRef<WebGLTexture | null>(null);
  const progRef = useRef<WebGLProgram | null>(null);
  const bufRef = useRef<WebGLBuffer | null>(null);

  // Choose bin so matrix is at most 512x512 to keep texture upload cheap.
  const width = viewport.end - viewport.start;
  const targetBins = Math.ceil(width / MAX_MATRIX_DIM);
  // Snap up to next "nice" bin step (1kb…1Mb). 1kb is the floor; never go below viewport.bin.
  const bin = Math.max(
    viewport.bin,
    Math.ceil(targetBins / 1000) * 1000,
  );

  // Fetch data whenever sample or viewport changes.
  useEffect(() => {
    const ctrl = new AbortController();
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchHicMatrix(sampleId, viewport.chr, viewport.start, viewport.end, bin)
      .then((data) => {
        if (cancelled) return;
        dataRef.current = data;
        setVmin(data.vmin);
        setVmax(data.vmax);
        setLoading(false);
        uploadTexture();
        render();
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        if (e instanceof DOMException && e.name === 'AbortError') return;
        const err = e instanceof Error ? e : new Error(String(e));
        setError(err);
        setLoading(false);
      });
    return () => {
      cancelled = true;
      ctrl.abort();
    };
  }, [sampleId, viewport.chr, viewport.start, viewport.end, bin]);

  // One-time GL setup.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext('webgl2');
    if (!gl) {
      setError(new Error('WebGL2 not supported'));
      return;
    }
    glRef.current = gl;

    // Compile + link shaders.
    const vs = compileShader(gl, gl.VERTEX_SHADER, vertexShader);
    const fs = compileShader(gl, gl.FRAGMENT_SHADER, fragmentShader);
    const prog = gl.createProgram();
    if (!prog) {
      setError(new Error('program create failed'));
      return;
    }
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      const log = gl.getProgramInfoLog(prog);
      gl.deleteProgram(prog);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      setError(new Error(`link failed: ${log}`));
      return;
    }
    progRef.current = prog;

    // Single full-screen quad.
    const positions = new Float32Array([
      -1, -1,
       1, -1,
      -1,  1,
      -1,  1,
       1, -1,
       1,  1,
    ]);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'a_position');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    bufRef.current = buf;

    // Texture (placeholder; will be re-uploaded on data arrival).
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    texRef.current = tex;

    return () => {
      gl.deleteTexture(tex);
      gl.deleteBuffer(buf);
      gl.deleteProgram(prog);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
    };
  }, []);

  function uploadTexture(): void {
    const gl = glRef.current;
    const tex = texRef.current;
    const data = dataRef.current;
    if (!gl || !tex || !data) return;
    const [h, w] = data.shape;
    if (h === 0 || w === 0) return;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.R32F,
      w,
      h,
      0,
      gl.RED,
      gl.FLOAT,
      data.matrix,
    );
  }

  const render = useCallback((): void => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    const gl = glRef.current;
    const prog = progRef.current;
    if (!canvas || !container || !gl || !prog) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = container.getBoundingClientRect();
    const cw = Math.max(1, Math.round(rect.width * dpr));
    const ch = Math.max(1, Math.round(height * dpr));
    if (canvas.width !== cw) canvas.width = cw;
    if (canvas.height !== ch) canvas.height = ch;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${height}px`;
    gl.viewport(0, 0, cw, ch);

    gl.useProgram(prog);
    gl.uniform1i(gl.getUniformLocation(prog, 'u_matrix'), 0);
    gl.uniform1f(gl.getUniformLocation(prog, 'u_vmin'), vmin);
    gl.uniform1f(gl.getUniformLocation(prog, 'u_vmax'), vmax);
    gl.uniform1i(
      gl.getUniformLocation(prog, 'u_colorMap'),
      colorMap === 'viridis' ? 1 : 0,
    );
    gl.uniform2f(
      gl.getUniformLocation(prog, 'u_canvasSize'),
      cw,
      ch,
    );
    gl.activeTexture(gl.TEXTURE0);
    if (texRef.current) gl.bindTexture(gl.TEXTURE_2D, texRef.current);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }, [colorMap, height, vmax, vmin]);

  // Re-render whenever colorMap or vmin/vmax changes (data uploaded separately).
  useEffect(() => {
    render();
  }, [render]);

  // Re-render on resize.
  useEffect(() => {
    const ro = new ResizeObserver(() => render());
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [render]);

  return (
    <div
      className="hic-matrix"
      ref={containerRef}
      style={{ height: `${height}px` }}
    >
      <canvas ref={canvasRef} />
      {loading && <span className="hic-loading">Loading matrix…</span>}
      {error && <span className="hic-error">{error.message}</span>}
      {!loading && !error && (
        <span className="hic-overlay-meta">
          {dataRef.current
            ? `${dataRef.current.shape[0]}×${dataRef.current.shape[1]} · bin ${bin.toLocaleString()} bp`
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
  const sh = gl.createShader(type);
  if (!sh) throw new Error('shader create failed');
  gl.shaderSource(sh, source);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(sh);
    gl.deleteShader(sh);
    throw new Error(`compile failed: ${log}`);
  }
  return sh;
}