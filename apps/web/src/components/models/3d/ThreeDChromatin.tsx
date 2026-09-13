/**
 * ThreeDChromatin — 单块 3D 染色质面板（Three.js 实现）。
 *
 * 架构位置：
 * - models/3d/ 私有组件，被 ThreeDModel 渲染三次（liver/muscle/brain）
 * - 不放在 render-kit：每个 panel 需要 PEI 数据 + organ-specific 随机种子，属于业务侧
 *
 * 职责：
 * - 在挂载节点里建一个 Three.js scene：rainbow tube + 路径上的标记球 + PEI enhancer + loop 弧
 * - 提供自实现的 orbit controls（drag 旋转、wheel 缩放、自动慢速旋转）
 * - 监听 sample 变化时调 `attachEnhancers` 更新 PEI 几何
 *
 * 关键设计：
 * - effect 内一次性创建 scene + renderer + controls；cleanup 全部 dispose
 *   （dispose geometry / cancelAnimationFrame / removeEventListener / forceContextLoss）
 * - PEI 数据通过 ref + 第二个 effect 解耦——避免重建整个 scene 来更新 enhancer
 * - ResizeObserver 监听挂载容器尺寸：避免 mount 时 clientHeight=0 导致首帧黑屏
 *
 * 注意：
 * - 此实现刻意不用 OrbitControls 依赖——避免给 ctcf-motif/3d viewer 引入额外依赖
 * - PRNG 用 mulberry32 保证不同 seed 产生不同形状，但同一 seed 永远相同（可重现）
 */
import { useEffect, useRef } from 'react';
import type { JSX } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import * as THREE from 'three';

import { fetchBed, fetchDerivedThreeD } from '../../../api/client';
import type { DerivedThreeDResponse } from '../../../api/client';
import type { PeiRecord } from '../../../api/types';
import { useCursor } from '../../../store/cursor';
import { useViewport } from '../../../store/viewport';
import { ModelSourceBadge } from '../../feedback/ModelSourceBadge';
import './three-d-chromatin.css';

interface ThreeDChromatinProps {
  /** panel 高度（像素）；一般由父容器决定，传给 host div */
  height?: number;
  /** 决定使用哪一组 path 种子和标记点；驱动 path 的随机形状 */
  organ: 'liver' | 'muscle' | 'brain';
  /** 覆盖 sample；不传则 panel 不展示 PEI（liver/muscle 当前用法） */
  sampleId?: string;
}

// ─────── per-organ geometry params (mirrors chromatin3d.html:114-124) ────────
//
// seed 决定 PRNG 起点 → 决定 path 的随机形状
// steps 决定随机游走步数 → 影响 path 长度/复杂度
// markers 是路径上的"珠子"位置和颜色（t 是沿路径的归一化位置，0~1）
//
// 注意：seed 不同导致三个 panel 形状完全不同，视觉上"同物种不同组织"才有差异
const ORGAN_PARAMS: Record<
  ThreeDChromatinProps['organ'],
  { seed: number; steps: number; markers: Array<{ t: number; color: number }> }
> = {
  liver: {
    seed: 7,
    steps: 80,
    markers: [
      { t: 0.16, color: 0x459f52 },  // green (enhancer)
      { t: 0.26, color: 0x459f52 },
      { t: 0.37, color: 0x459f52 },
      { t: 0.52, color: 0x808080 },  // grey (promoter)
      { t: 0.72, color: 0x808080 },
    ],
  },
  muscle: {
    seed: 23,
    steps: 72,
    markers: [{ t: 0.55, color: 0x808080 }],
  },
  brain: {
    seed: 53,
    steps: 80,
    markers: [
      { t: 0.12, color: 0x459f52 },  // green (enhancer)
      { t: 0.27, color: 0x459f52 },
      { t: 0.42, color: 0x808080 },  // grey (promoter)
      { t: 0.63, color: 0x459f52 },
      { t: 0.78, color: 0x808080 },
    ],
  },
};

// 防止 enhancer 数量爆炸；超过即截断，避免 GPU 顶点数失控
const ENHANCER_LIMIT = 6;
// loop 弧的管半径：与主 tube 一致（0.034），形成统一的视觉层级
const LOOP_TUBE_RADIUS = 0.02;

// ─────── deterministic PRNG / math (mirrors chromatin3d.html:29-51) ─────────
//
// mulberry32：32-bit 状态空间的简单 PRNG；同 seed 永远产生同序列
// 这里用来"确定性生成 path"——同一个 organ 多次刷新页面看到的形状一致
function mulberry32(seed: number) {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * rainbow(t) → 颜色
 * 柔和彩虹：把 t∈[0,1] 映射成蓝→青→绿→黄→红的全谱渐变（HSL 色环绕一圈，
 * t=0 蓝色 240°，t=1 红色 0°），但饱和度降到 0.5~0.6、亮度提到 0.58~0.66：
 *  - 保留"彩色鲜活"的视觉层次（区别于单调单色系），在白底上不刺眼；
 *  - 相比最初的全饱和版（0.72/0.52），更通透柔和，细管（0.010）更精致；
 *  - 与锁定高亮黄球（0xffd43b）同属暖色端，联动时黄球在彩色纤维上依然醒目。
 * 同一函数被 tube / beads / loop 弧共用，改一处全模型配色统一。
 */
function rainbow(t: number): THREE.Color {
  const clamped = Math.min(1, Math.max(0, t));
  const hue = 240 * (1 - clamped);       // 240°→0°（蓝→青→绿→黄→红）
  const sat = 0.60 - 0.12 * clamped;     // 0.60→0.48
  const light = 0.58 + 0.08 * clamped;   // 0.58→0.66
  return new THREE.Color().setHSL(hue / 360, sat, light);
}

/**
 * 3D 随机游走 → Catmull-Rom 样条 → 归一化。
 * 三步走：
 *   1) 随机游走生成 steps 个控制点（方向向量加噪声后归一化）
 *   2) 用 Catmull-Rom 曲线插值，每对控制点间采 10 个点（保证 tube 足够光滑）
 *   3) 平移到原点 + 缩放到半径 1.25，便于不同 seed 的形状都能塞进 viewport
 *
 * 注意：归一化到固定半径意味着不同 organ 的"管子大小"在屏幕上看起来一致——只比较形状差异
 */
/**
 * 平滑值噪声 + 余弦插值：确定性、处处连续，无折角。
 */
function makeNoise(rng: () => number): (t: number) => number {
  const lattice: number[] = [];
  for (let i = 0; i < 64; i += 1) lattice.push(rng() * 2 - 1);
  return (t: number) => {
    const x = t * 8;
    const i = Math.floor(x);
    const f = x - i;
    const u = (1 - Math.cos(f * Math.PI)) / 2;
    const a = lattice[((i % 64) + 64) % 64];
    const b = lattice[(((i + 1) % 64) + 64) % 64];
    return a + (b - a) * u;
  };
}

/**
 * fBm（分形布朗运动）：3 个 octave 叠加，振幅递减（0.6 / 0.3 / 0.1）。
 * 生成 fractal-globule 风格的自然丝滑弯曲——比正弦更"有机"，无规则感。
 */
function makeFbm(rng: () => number): (t: number) => number {
  const n1 = makeNoise(rng);
  const n2 = makeNoise(rng);
  const n3 = makeNoise(rng);
  return (t: number) =>
    n1(t) * 0.6 + n2(t * 2.13) * 0.3 + n3(t * 4.7) * 0.1;
}

function makePath(seed: number, steps: number): THREE.Vector3[] {
  // fBm 噪声路径：每轴一条独立噪声曲线，低频主导 → 大尺度平滑弯曲，
  // 高频只是细微起伏；整条纤维没有折角，弯曲丝滑自然。
  const rng = mulberry32(seed);
  const fx = makeFbm(rng);
  const fy = makeFbm(rng);
  const fz = makeFbm(rng);
  const pts: THREE.Vector3[] = [];
  const N = Math.max(24, steps);
  for (let i = 0; i <= N; i += 1) {
    const t = i / N;
    pts.push(new THREE.Vector3(fx(t) * 1.15, fy(t) * 1.15, fz(t) * 1.15));
  }

  // Catmull-Rom 平滑（tension 0.5 最圆润），每段 20 个采样点
  const curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.5);
  const totalLen = pts.length - 1;
  const ptsPerSeg = 20;
  const smooth: THREE.Vector3[] = [];
  for (let i = 0; i < totalLen; i += 1) {
    for (let s = 0; s < ptsPerSeg; s += 1) {
      smooth.push(curve.getPoint((i + s / ptsPerSeg) / totalLen));
    }
  }
  smooth.push(pts[totalLen].clone());

  // 归一化到半径 1.25：中心化 → 找最大距离 R → 缩放到 1.25 / R
  const center = new THREE.Vector3(0, 0, 0);
  for (const pt of smooth) center.add(pt);
  center.divideScalar(smooth.length);
  let R = 0;
  const centred = smooth.map((pt) => {
    const q = pt.clone().sub(center);
    R = Math.max(R, q.length());
    return q;
  });
  const scale = 1.25 / (R || 1);
  return centred.map((q) => q.multiplyScalar(scale));
}

/**
 * 把 path 转成 rainbow 渐变的 tube 几何并加到 scene。
 * 颜色按"沿路径长度归一化"算 t → 用 rainbow(t) 着色，再写到 vertex color。
 * 这样整条管子从一端蓝渐变到另一端红。
 */
/**
 * 把 path 转成 rainbow 渐变的 tube 几何并加到 scene。
 * 半径参数化：细粒度建模下主纤维更细（0.028），让"每 bin 一颗珠子"成为视觉主体。
 * 分段数随 path 长度加密（每点 3 段起步，下限 200）——加密后的路径保证折角平滑。
 */
function addTube(
  path: THREE.Vector3[],
  scene: THREE.Scene,
  radius = 0.010,
): void {
  const curve = new THREE.CatmullRomCurve3(path, false, 'catmullrom', 0);
  const segments = Math.max(200, path.length * 3);
  const tubeGeo = new THREE.TubeGeometry(curve, segments, radius, 12, false);
  const colors = new Float32Array(tubeGeo.attributes.position.count * 3);
  const pos = tubeGeo.attributes.position;
  const tmp = new THREE.Vector3();
  for (let i = 0; i < pos.count; i += 1) {
    tmp.fromBufferAttribute(pos, i);
    // t 由"该点到原点的距离 + 1.25"反推（因为 path 已经归一化到半径 1.25）：
    // 中心点对应 t=0，边缘对应 t=1
    const t = Math.min(1, Math.max(0, (tmp.length() + 1.25) / 2.5));
    const c = rainbow(1 - t);
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  tubeGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    metalness: 0.04,
    roughness: 0.28,
  });
  scene.add(new THREE.Mesh(tubeGeo, mat));
}

/**
 * 在 path 上某点放一个 sphere marker，返回 mesh 以便后续查询位置。
 */
function addSphere(
  pos: THREE.Vector3,
  radius: number,
  color: number,
  scene: THREE.Scene,
): THREE.Mesh {
  const geo = new THREE.SphereGeometry(radius, 24, 24);
  const mat = new THREE.MeshPhysicalMaterial({
    color,
    roughness: 0.32,
    metalness: 0.08,
    clearcoat: 0.6,
    clearcoatRoughness: 0.3,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.copy(pos);
  scene.add(mesh);
  return mesh;
}

/**
 * 辉光 Sprite：canvas 径向渐变纹理 + AdditiveBlending，
 * 给 marker / enhancer / 高亮球加柔光光晕，提升 3D 质感。
 */
function makeGlowSprite(
  color: number,
  size = 0.4,
  opacity = 0.5,
): THREE.Sprite {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const ctx = c.getContext('2d') as CanvasRenderingContext2D;
  const g = ctx.createRadialGradient(64, 64, 4, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,0.95)');
  g.addColorStop(0.35, 'rgba(255,255,255,0.4)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  const mat = new THREE.SpriteMaterial({
    map: tex,
    color,
    transparent: true,
    opacity,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(size, size, 1);
  return sprite;
}

/**
 * Catmull-Rom 加密路径：真实 MDS 坐标每个 bin 只有一个点（如 1Mb 视口 / 50kb bin
 * → 约 20 个点），直接连管会有明显折角。加密后每对控制点间插 ptsPerSeg 个点，
 * 让染色质纤维在 3D 中平滑连续（mock 随机游走路径已足够密，不再二次加密）。
 */
function densify(path: THREE.Vector3[], ptsPerSeg = 8): THREE.Vector3[] {
  if (path.length < 3) return path;
  const curve = new THREE.CatmullRomCurve3(path, false, 'catmullrom', 0.5);
  const out: THREE.Vector3[] = [];
  const segs = path.length - 1;
  for (let i = 0; i < segs; i += 1) {
    for (let s = 0; s < ptsPerSeg; s += 1) {
      out.push(curve.getPoint((i + s / ptsPerSeg) / segs));
    }
  }
  out.push(path[segs].clone());
  return out;
}

interface BeadHandle {
  mesh: THREE.Mesh;
  /** 珠子沿路径的归一化位置 t∈[0,1]，用于锁定区间高亮判断。 */
  t: number;
  /** 恢复为 rainbow 本色。 */
  restore: () => void;
  /** 高亮为黄色自发光（锁定 bin 区间内的珠子）。 */
  highlight: () => void;
}

/**
 * 细粒度建模核心：beads-on-a-string。
 * 沿路径均匀放 count 颗半透明小珠（半径 0.05，略大于纤维管 0.028），
 * 每颗珠子对应一个基因组 bin，颜色用 rainbow(t) 与主纤维渐变一致。
 * 返回句柄供锁定联动：区间内的珠子切换为黄色自发光。
 */
function addBeads(
  path: THREE.Vector3[],
  count: number,
  scene: THREE.Scene,
): BeadHandle[] {
  const handles: BeadHandle[] = [];
  for (let i = 0; i < count; i += 1) {
    const t = count === 1 ? 0 : i / (count - 1);
    const idx = Math.max(0, Math.min(path.length - 1, Math.round(t * (path.length - 1))));
    const color = rainbow(t);
    const geo = new THREE.SphereGeometry(0.026, 20, 20);
    const mat = new THREE.MeshPhysicalMaterial({
      color,
      transparent: true,
      opacity: 0.7,
      roughness: 0.24,
      metalness: 0.05,
      clearcoat: 0.8,
      clearcoatRoughness: 0.25,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(path[idx]);
    scene.add(mesh);
    handles.push({
      mesh,
      t,
      restore: () => {
        mat.color.copy(color);
        mat.emissive.setHex(0x000000);
        mat.emissiveIntensity = 0;
      },
      highlight: () => {
        mat.color.setHex(0xffd43b);
        mat.emissive.setHex(0xffd43b);
        mat.emissiveIntensity = 0.9;
      },
    });
  }
  return handles;
}

/**
 * 3D chromatin panel：单块 Three.js canvas + 自实现 orbit controls。
 *
 * 副作用边界：
 * - 内部 effect 创建的所有 THREE 对象必须在 cleanup 中 dispose（否则 GPU 资源泄漏）
 * - PEI 数据通过 ref 暴露 attachEnhancers，避免随数据重建整个 scene
 */
export function ThreeDChromatin({
  organ,
  height = 150,
  sampleId,
}: ThreeDChromatinProps): JSX.Element {
  const mountRef = useRef<HTMLDivElement>(null);
  const viewport = useViewport();

  // PEI 数据查询：brain 面板启用（sampleId 存在时），其他 organ 跳过
  const peiQuery = useQuery<PeiRecord[]>({
    queryKey: [
      'pei-3d',
      organ,
      sampleId ?? 'default',
      viewport.chr,
      viewport.start,
      viewport.end,
    ],
    queryFn: () => {
      const id = sampleId ?? 'Brain_BF3';
      return fetchBed<'pei'>(id, 'pei', viewport.chr, viewport.start, viewport.end);
    },
    enabled: sampleId !== undefined,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });

  // 3D 坐标查询：真实 Hi-C 时后端返回已居中的 MDS 坐标（含 `source`）；
  // 不可用时返回空 coords + `source: "mock"`，前端降级为随机游走路径。
  const threeDQuery = useQuery<DerivedThreeDResponse>({
    queryKey: [
      'derived-three-d',
      sampleId ?? 'default',
      viewport.chr,
      viewport.start,
      viewport.end,
      viewport.bin,
    ],
    queryFn: () =>
      fetchDerivedThreeD(
        sampleId ?? 'Brain_BF3',
        viewport.chr,
        viewport.start,
        viewport.end,
        viewport.bin,
      ),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });

  // 用于让第二个 effect（PEI 数据 effect）能调到主 effect 里定义的 attachEnhancers
  // 避免重建整个 scene 来更新 enhancer 几何
  const sceneHandleRef = useRef<{
    attachEnhancers: (records: PeiRecord[]) => void;
    /** 锁定区域高亮：t0/t1 为 bin 区间沿路径的归一化范围；null 移除高亮。 */
    setHighlight: (t0: number | null, t1: number | null) => void;
  } | null>(null);

  // 主 effect：建 scene + renderer + controls + 几何；cleanup 全量释放
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return undefined;

    const { seed, steps, markers } = ORGAN_PARAMS[organ];
    // 真实数据优先：source === 'real' 且 coords ≥ 2 点时直接用后端归一化好的
    // MDS 坐标构建 TubeGeometry；否则回退到 makePath 随机游走（任何 source 下都有几何）。
    const coords = threeDQuery.data?.coords;
    const useRealCoords =
      threeDQuery.data?.source === 'real' &&
      coords !== undefined &&
      coords.length >= 2;
    // 原始坐标点：真实 MDS 每 bin 一个点；mock 是随机游走控制点
    const pathRaw = useRealCoords
      ? coords.map(([x, y, z]) => new THREE.Vector3(x, y, z))
      : makePath(seed, steps);
    // 细粒度：真实坐标加密（每段 8 点），mock 已密不重复加密
    const path = useRealCoords ? densify(pathRaw, 12) : pathRaw;
    // clientWidth/Height 在 mount 时可能为 0（layout 未就绪），用 max(.., 1) 兜底
    const panelW = Math.max(mount.clientWidth, 1);
    const panelH = Math.max(mount.clientHeight, 1);

    // ── Scene / Camera / Renderer ──────────────────────────────────────
    const scene = new THREE.Scene();
    // 白色背景：科研可视化页面基调，深色纤维与彩色珠子在白底上清晰
    scene.background = new THREE.Color(0xffffff);

    const camera = new THREE.PerspectiveCamera(42, panelW / panelH, 0.1, 100);
    camera.position.set(0, 0, 1.6);
    camera.lookAt(0, 0, 0);

    // preserveDrawingBuffer=true：详情页"导出 PDF"用 html2canvas 截图时
    // 需要读取绘制缓冲（连续 rAF 渲染默认会清空缓冲导致截图空白）。
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      preserveDrawingBuffer: true,
    });
    renderer.setSize(panelW, panelH);
    // 限到 2：4K 屏上 setPixelRatio(window.devicePixelRatio) 会让 fragment shader 跑爆
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    mount.appendChild(renderer.domElement);

    // 灯光——半球光 + 主光 + 冷补光 + 轮廓光，营造立体层次
    scene.add(new THREE.AmbientLight(0xffffff, 0.22));
    const hemi = new THREE.HemisphereLight(0xffffff, 0x22252e, 0.5);
    scene.add(hemi);
    const dl = new THREE.DirectionalLight(0xfff2dd, 1.05);
    dl.position.set(4, 6, 5);
    scene.add(dl);
    const fill = new THREE.DirectionalLight(0x6f9bff, 0.35);
    fill.position.set(-5, -3, -4);
    scene.add(fill);
    const rim = new THREE.DirectionalLight(0xffffff, 0.3);
    rim.position.set(0, -2, 6);
    scene.add(rim);

    // ── Rainbow tube（细管 0.028）─────────────────────────────────────
    addTube(path, scene);

    // 所有 marker 辉光 sprite：随 effect cleanup 统一 dispose
    const glowSprites: THREE.Sprite[] = [];

    // ── 路径标记球 ─────────────────────────────────────────────────────
    // 把球和位置都存下来——后面 attach enhancer 时要复用球位置（作为 promoter 锚点）
    const sphereMeshes: THREE.Mesh[] = [];
    const spherePositions: THREE.Vector3[] = [];
    for (const m of markers) {
      const idx = Math.round(m.t * (path.length - 1));
      spherePositions.push(path[idx].clone());
      sphereMeshes.push(addSphere(path[idx], 0.06, m.color, scene));
      const glow = makeGlowSprite(m.color, 0.42, 0.5);
      glow.position.copy(path[idx]);
      scene.add(glow);
      glowSprites.push(glow);
    }

    // ── 每 bin 一颗珠子（beads-on-a-string，细粒度主体）──────────────
    // 真实数据：珠子数 = bin 数（coords 长度）；mock：均匀取 20 颗
    const beadCount = useRealCoords ? coords.length : 20;
    const beads = addBeads(path, beadCount, scene);

    // ── 交互 group（PEI enhancer 球 + loop 弧）───────────────────────
    // 把 PEI 相关几何都放一个 Group，方便 attachEnhancers 时整体清掉再重建
    const interactionGroup = new THREE.Group();
    scene.add(interactionGroup);

    const enhancerRad = 0.06;
    const enhancerGeo = new THREE.SphereGeometry(enhancerRad, 16, 16);
    const enhancerMat = new THREE.MeshStandardMaterial({ color: 0x5ba854 });

    /**
     * 把 PEI 记录渲染成 enhancer 球 + 与最近 promoter 之间的 loop 弧。
     * 每次调用都清空 interactionGroup 的子节点再重建——简化同步逻辑，避免部分更新导致 bug。
     */
    const attachEnhancers = (records: PeiRecord[]): void => {
      while (interactionGroup.children.length > 0) {
        const child = interactionGroup.children[0];
        interactionGroup.remove(child);
        if (child instanceof THREE.Mesh) child.geometry.dispose();
        if (child instanceof THREE.Sprite) {
          child.material.map?.dispose();
          child.material.dispose();
        }
      }
      const enhancers = records.slice(0, ENHANCER_LIMIT);
      if (enhancers.length === 0) return;

      enhancers.forEach((record, index) => {
        // 锚定到最近的 marker 球（循环复用：enhancer 多于 marker 时回到起点）
        const promoterPos =
          spherePositions[index % spherePositions.length];

        // distance_kb 越大 → 弧半径越大（远距离 enhancer 视觉上更"扩散"）
        const distNorm = Math.min(1, record.distance_kb / 1000);
        const raid = 0.6 + 1.4 * distNorm;
        // 在水平面上均匀分布 enhancer（phi 等分）
        const phi = (index / Math.max(1, enhancers.length)) * Math.PI * 2;
        const enhancerPos = new THREE.Vector3(
          raid * Math.cos(phi),
          0.4 * Math.sin(phi * 1.5),
          raid * Math.sin(phi),
        );

        const enhancer = new THREE.Mesh(enhancerGeo, enhancerMat);
        enhancer.position.copy(enhancerPos);
        interactionGroup.add(enhancer);
        const glow = makeGlowSprite(0x7dffa8, 0.36, 0.45);
        glow.position.copy(enhancerPos);
        interactionGroup.add(glow);

        // spanBp（PEI 跨度）越大 → 弧越高
        const spanBp = Math.max(0, record.end - record.start);
        const arcHeight = 0.4 + Math.min(1.2, spanBp / 100_000);
        // 确定性抖动：使弧线在 3D 空间中扭曲，不再像平面抛物线
        const jitter = (pt: number, axis: number, mag: number) => {
          // 简单 hash，同 seed 永远同值
          const h = ((index * 7919 + pt * 137 + axis * 31) * 2654435761) >>> 0;
          return ((h / 4294967296) - 0.5) * mag;
        };
        const mid = new THREE.Vector3(
          (promoterPos.x + enhancerPos.x) / 2 + jitter(0, 0, 0.2),
          (promoterPos.y + enhancerPos.y) / 2 + arcHeight + jitter(0, 1, 0.2),
          (promoterPos.z + enhancerPos.z) / 2 + jitter(0, 2, 0.2),
        );
        // 5 个控制点 + 3D 抖动让弧线自然：promoter → q1 → mid → q3 → enhancer
        const q1 = new THREE.Vector3(
          (promoterPos.x * 3 + enhancerPos.x) / 4 + jitter(1, 0, 0.15),
          (promoterPos.y * 3 + enhancerPos.y) / 4 + arcHeight * 0.6 + jitter(1, 1, 0.15),
          (promoterPos.z * 3 + enhancerPos.z) / 4 + jitter(1, 2, 0.15),
        );
        const q3 = new THREE.Vector3(
          (promoterPos.x + enhancerPos.x * 3) / 4 + jitter(2, 0, 0.15),
          (promoterPos.y + enhancerPos.y * 3) / 4 + arcHeight * 0.6 + jitter(2, 1, 0.15),
          (promoterPos.z + enhancerPos.z * 3) / 4 + jitter(2, 2, 0.15),
        );
        const arcCurve = new THREE.CatmullRomCurve3(
          [promoterPos.clone(), q1, mid, q3, enhancerPos.clone()],
          false,
          'catmullrom',
          0.5,
        );
        const arcGeo = new THREE.TubeGeometry(arcCurve, 32, LOOP_TUBE_RADIUS, 6, false);

        // 采样 tube 彩虹渐变的颜色：用与 tube 着色一致的公式
        // 使弧线两端接到 tube 时颜色匹配，视觉上自然融合
        const tubeColorAt = (pos: THREE.Vector3): THREE.Color => {
          const t = Math.min(1, Math.max(0, (pos.length() + 1.25) / 2.5));
          return rainbow(1 - t);
        };
        const colStart = tubeColorAt(promoterPos);
        const colEnd = tubeColorAt(enhancerPos);
        const arcLenSq = promoterPos.distanceToSquared(enhancerPos) || 1;
        const colors = new Float32Array(arcGeo.attributes.position.count * 3);
        const posAttr = arcGeo.attributes.position;
        const sv = new THREE.Vector3();
        for (let i = 0; i < posAttr.count; i += 1) {
          sv.fromBufferAttribute(posAttr, i);
          const t = Math.max(0, Math.min(1,
            sv.clone().sub(promoterPos).dot(enhancerPos.clone().sub(promoterPos)) / arcLenSq,
          ));
          const c = colStart.clone().lerp(colEnd, t);
          colors[i * 3] = c.r;
          colors[i * 3 + 1] = c.g;
          colors[i * 3 + 2] = c.b;
        }
        arcGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

        const arcMat = new THREE.MeshStandardMaterial({
          vertexColors: true,
          metalness: 0,
          roughness: 0.7,
        });
        interactionGroup.add(new THREE.Mesh(arcGeo, arcMat));
      });
    };

    // ── 自实现 orbit controls ─────────────────────────────────────────
    // 没有用 OrbitControls 依赖，避免引入额外包；手写一个最小集够用
    // - isDragging/lastX/lastY/pointerId：拖拽状态
    // - theta/phi/dist：球坐标相机位置
    // - rot/vel：自动旋转 + 拖拽惯性
    const orbit = {
      isDragging: false,
      lastX: 0,
      lastY: 0,
      pointerId: -1,
      theta: 0.72,
      phi: Math.PI / 2 - 0.42,
      dist: 3.1,
      rot: 0,
      vel: 0,
    };

    // 球坐标 → 直角坐标，相机始终看向原点
    const updateCamera = () => {
      camera.position.x = orbit.dist * Math.sin(orbit.phi) * Math.cos(orbit.theta);
      camera.position.y = orbit.dist * Math.cos(orbit.phi);
      camera.position.z = orbit.dist * Math.sin(orbit.phi) * Math.sin(orbit.theta);
      camera.lookAt(0, 0, 0);
    };
    updateCamera();

    const canvas = renderer.domElement;
    // touchAction: none 阻止浏览器把单指拖拽解读为页面滚动
    canvas.style.touchAction = 'none';
    canvas.style.cursor = 'grab';
    canvas.style.display = 'block';

    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();
      orbit.isDragging = true;
      orbit.pointerId = event.pointerId;
      orbit.lastX = event.clientX;
      orbit.lastY = event.clientY;
      // pointer capture：保证拖拽出 canvas 也能继续收到 move 事件
      canvas.setPointerCapture(event.pointerId);
      canvas.style.cursor = 'grabbing';
    };
    const onPointerMove = (event: PointerEvent) => {
      if (!orbit.isDragging || event.pointerId !== orbit.pointerId) return;
      const dx = event.clientX - orbit.lastX;
      const dy = event.clientY - orbit.lastY;
      orbit.theta -= dx * 0.01;
      // phi 夹在 (0.1, π-0.1)，防止万向节翻转
      orbit.phi = Math.max(0.1, Math.min(Math.PI - 0.1, orbit.phi + dy * 0.01));
      orbit.lastX = event.clientX;
      orbit.lastY = event.clientY;
      // vel 累积 dx→松手后惯性旋转，0.94 是衰减系数
      orbit.vel = dx * 0.25;
      updateCamera();
    };
    const onPointerUp = (event: PointerEvent) => {
      if (event.pointerId !== orbit.pointerId) return;
      orbit.isDragging = false;
      if (canvas.hasPointerCapture(event.pointerId))
        canvas.releasePointerCapture(event.pointerId);
      canvas.style.cursor = 'grab';
    };
    const onWheel = (event: WheelEvent) => {
      // 阻止默认滚动 + 阻止冒泡：
      // 1) preventDefault：当前 route-content 的滚动不触发；
      // 2) stopPropagation：同 parent 的兄弟 canvas 不会同时缩放。
      event.preventDefault();
      event.stopPropagation();
      orbit.dist = Math.max(2, Math.min(15, orbit.dist + event.deltaY * 0.01));
      updateCamera();
    };
    const onContextMenu = (event: MouseEvent) => { event.preventDefault(); };

    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointercancel', onPointerUp);
    canvas.addEventListener('wheel', onWheel, { passive: false });
    canvas.addEventListener('contextmenu', onContextMenu);

    // ── 动画循环 ──────────────────────────────────────────────────────
    let frameId = 0;
    let lastTime = performance.now();
    const animate = (now: number) => {
      frameId = requestAnimationFrame(animate);
      const dt = now - lastTime;
      lastTime = now;
      if (!orbit.isDragging) {
        // 基础自动旋转 + 拖拽惯性 vel（vel 在每次 move 中累积，0.94 衰减）
        orbit.theta += dt * 0.00045 + orbit.vel;
        orbit.vel *= 0.94;
      }
      updateCamera();
      renderer.render(scene, camera);
    };
    animate(performance.now());

    // ResizeObserver——Three.js renderer 的 canvas 尺寸必须匹配 host 容器的 CSS 尺寸。
    // 没有 observer 时 mount 后 clientHeight=0，首帧会渲染成 0×0；后续 reflow 也不会触发 resize。
    const resize = () => {
      const w = Math.max(mount.clientWidth, 1);
      const h = Math.max(mount.clientHeight, 1);
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(mount);
    // 在下一帧再 resize 一次：layout 此时已经稳定，避免首帧画错比例
    requestAnimationFrame(() => resize());

    // ── 锁定区域高亮球 ────────────────────────────────────────────────
    // 点击锁定 Hi-C 后，把选定 bin 映射到路径 t∈[0,1]，在对应位置放一个
    // 黄色自发光球（3D 联动"该区域在染色质结构上的位置"）。
    // 中心标记球：尺寸 0.30、强自发光——标出锁定区间的几何中点
    const highlightGeo = new THREE.SphereGeometry(0.026, 20, 20);
    const highlightMat = new THREE.MeshStandardMaterial({
      color: 0xffd43b,
      emissive: 0xffd43b,
      emissiveIntensity: 1.2,
    });
    let highlightMesh: THREE.Mesh | null = null;
    let highlightGlow: THREE.Sprite | null = null;
    // 锁定区域 3D 联动（细粒度）：t0/t1 为 bin 区间沿路径的归一化范围
    const setHighlight = (t0: number | null, t1: number | null): void => {
      if (highlightMesh) {
        scene.remove(highlightMesh);
        highlightMesh = null;
      }
      if (highlightGlow) {
        scene.remove(highlightGlow);
        highlightGlow = null;
      }
      // 先把所有珠子还原为 rainbow 本色
      for (const bead of beads) bead.restore();
      if (t0 === null || t1 === null || path.length < 2) return;
      const lo = Math.min(t0, t1);
      const hi = Math.max(t0, t1);
      // 区间内的珠子整颗高亮为黄色——"该 bin 区间占据染色质的哪些珠子"
      for (const bead of beads) {
        if (bead.t >= lo && bead.t <= hi) bead.highlight();
      }
      // 中心标记球放在区间中点
      const midT = (lo + hi) / 2;
      const idx = Math.max(0, Math.min(path.length - 1, Math.round(midT * (path.length - 1))));
      highlightMesh = new THREE.Mesh(highlightGeo, highlightMat);
      highlightMesh.position.copy(path[idx]);
      scene.add(highlightMesh);
      highlightGlow = makeGlowSprite(0xffd43b, 0.3, 0.6);
      highlightGlow.position.copy(path[idx]);
      scene.add(highlightGlow);
    };

    // 把 attachEnhancers 暴露给第二个 effect；首次挂载时如果 PEI 数据已就绪，立即渲染
    sceneHandleRef.current = { attachEnhancers, setHighlight };
    if (peiQuery.data) attachEnhancers(peiQuery.data);

    return () => {
      cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointercancel', onPointerUp);
      canvas.removeEventListener('wheel', onWheel);
      canvas.removeEventListener('contextmenu', onContextMenu);
      mount.removeChild(renderer.domElement);
      renderer.dispose();
      // 强制丢 WebGL 上下文，避免在某些浏览器/显卡上挂起旧 panel 时上下文被锁
      renderer.forceContextLoss();
      interactionGroup.traverse((child) => {
        if (child instanceof THREE.Mesh) child.geometry.dispose();
      });
      if (highlightMesh) scene.remove(highlightMesh);
      if (highlightGlow) {
        scene.remove(highlightGlow);
        highlightGlow.material.map?.dispose();
        highlightGlow.material.dispose();
      }
      highlightGeo.dispose();
      highlightMat.dispose();
      for (const glow of glowSprites) {
        scene.remove(glow);
        glow.material.map?.dispose();
        glow.material.dispose();
      }
      for (const bead of beads) {
        scene.remove(bead.mesh);
        bead.mesh.geometry.dispose();
        (bead.mesh.material as THREE.Material).dispose();
      }
      sceneHandleRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organ, height, sampleId, viewport.chr, viewport.start, viewport.end, threeDQuery.data]);

  // PEI 数据 effect：仅在 peiQuery.data 变化时调 attachEnhancers，
  // 不重建整个 scene，节省 GPU/CPU 资源
  useEffect(() => {
    sceneHandleRef.current?.attachEnhancers(peiQuery.data ?? []);
  }, [peiQuery.data]);

  // 锁定区域 3D 联动：cursor store 锁定后，把 bin 中心映射到路径 t
  // （相对当前视口比例），驱动高亮球；解锁后自动移除。
  const cursorLocked = useCursor((state) => state.locked);
  const cursorBinStart = useCursor((state) => state.binStart);
  const cursorBinEnd = useCursor((state) => state.binEnd);
  // 锁定区间沿视口归一化为 [t0, t1]，驱动 3D 珠子高亮 + 中心标记球
  useEffect(() => {
    const handle = sceneHandleRef.current;
    if (!handle) return;
    if (!cursorLocked || cursorBinStart === null || cursorBinEnd === null) {
      handle.setHighlight(null, null);
      return;
    }
    const vw = viewport.end - viewport.start;
    if (vw <= 0) {
      handle.setHighlight(null, null);
      return;
    }
    const t0 = Math.max(0, Math.min(1, (cursorBinStart - viewport.start) / vw));
    const t1 = Math.max(0, Math.min(1, (cursorBinEnd - viewport.start) / vw));
    handle.setHighlight(t0, t1);
  }, [cursorLocked, cursorBinStart, cursorBinEnd, viewport.start, viewport.end]);

  return (
    <div
      className="three-d-chromatin"
      ref={mountRef}
      role="img"
      aria-label={`3D chromatin folding model for ${organ}`}
    >
      <ModelSourceBadge source={threeDQuery.data?.source} />
    </div>
  );
}