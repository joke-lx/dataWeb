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
import { Loading } from '../../feedback/Loading';
import './three-d-chromatin.css';

interface ThreeDChromatinProps {
  /** panel 高度（像素）；一般由父容器决定，传给 host div */
  height?: number;
  /** 决定使用哪一组 path 种子和标记点；驱动 path 的随机形状 */
  organ: 'liver' | 'muscle' | 'brain';
  /** 覆盖 sample；不传则 panel 不展示 PEI（liver/muscle 当前用法） */
  sampleId?: string;
}

// 防止 enhancer 数量爆炸；超过即截断，避免 GPU 顶点数失控
const ENHANCER_LIMIT = 6;
// loop 弧的管半径：与主 tube 一致（0.034），形成统一的视觉层级
const LOOP_TUBE_RADIUS = 0.02;

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
  radius = 0.016,
): void {
  const curve = new THREE.CatmullRomCurve3(path, false, 'catmullrom', 0);
  const segments = Math.max(200, path.length * 3);
  const radialSegments = 12;
  const tubeGeo = new THREE.TubeGeometry(curve, segments, radius, radialSegments, false);
  const colors = new Float32Array(tubeGeo.attributes.position.count * 3);
  const pos = tubeGeo.attributes.position;
  const ringSize = radialSegments + 1; // 每环顶点数（含闭合重复点）
  for (let i = 0; i < pos.count; i += 1) {
    // 按顶点在 TubeGeometry 中的环号反推曲线参数 t，沿路径连续渐变
    const ring = Math.floor(i / ringSize);
    const t = ring / segments;
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
    const geo = new THREE.SphereGeometry(0.04, 20, 20);
    const mat = new THREE.MeshPhysicalMaterial({
      color,
      transparent: true,
      opacity: 0.95,
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

    // 真实数据优先：source === 'real' 且 coords ≥ 2 点时直接用后端归一化好的
    // MDS 坐标构建 TubeGeometry；否则显示空状态，不再生成假的随机游走纤维。
    const coords = threeDQuery.data?.coords;
    const useRealCoords =
      threeDQuery.data?.source === 'real' &&
      coords !== undefined &&
      coords.length >= 2;

    if (!useRealCoords) {
      // 无真实 Hi-C 矩阵：显示空状态，不创建 WebGL scene
      mount.innerHTML =
        '<div style="display:flex;align-items:center;justify-content:center;height:100%;' +
        'color:#8a919c;font-size:13px;font-family:system-ui;">无真实 Hi-C 数据，无法重建 3D 结构</div>';
      return () => { mount.innerHTML = ''; };
    }

    const pathRaw = coords.map(([x, y, z]) => new THREE.Vector3(x, y, z));
    // 真实坐标必须和 mock 一样做中心化+缩放到半径 1.25，
    // 否则 addTube 的颜色公式 (len+1.25)/2.5 会错乱（质心偏移→颜色按到原点距离而非沿路径渐变）
    let normalizedRaw = pathRaw;
    if (useRealCoords && pathRaw.length > 1) {
      const center = new THREE.Vector3();
      for (const p of pathRaw) center.add(p);
      center.divideScalar(pathRaw.length);
      let R = 0;
      const centered = pathRaw.map((p) => {
        const q = p.clone().sub(center);
        R = Math.max(R, q.length());
        return q;
      });
      const scale = 1.25 / (R || 1);
      normalizedRaw = centered.map((q) => q.multiplyScalar(scale));
    }
    // 真实坐标每 bin 一个点，TubeGeometry 自己会 Catmull-Rom 平滑，
    // 前端不要再 densify（tension=0.5 的 Catmull-Rom 会在大间距点间过冲扭曲形状）
    const path = normalizedRaw;
    // clientWidth/Height 在 mount 时可能为 0（layout 未就绪），用 max(.., 1) 兜底
    const panelW = Math.max(mount.clientWidth, 1);
    const panelH = Math.max(mount.clientHeight, 1);

    // ── Scene / Camera / Renderer ──────────────────────────────────────
    const scene = new THREE.Scene();
    // 白色背景：科研可视化页面基调，深色纤维与彩色珠子在白底上清晰
    scene.background = new THREE.Color(0xfafbfc);

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

    // ── 每 bin 一颗珠子（beads-on-a-string，细粒度主体）──────────────
    const beadCount = coords.length;
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
        // 把基因组位置映射到 path 索引：path[i] 对应 viewport.start + i * viewport.bin
        const posToPathIdx = (bp: number): number => {
          const frac = (bp - viewport.start) / (viewport.bin || 1);
          return Math.max(0, Math.min(path.length - 1, Math.round(frac)));
        };
        // enhancer 取区间中点，promoter 取 start - distance_kb（向 5' 端回退）
        const enhancerMid = (record.start + record.end) / 2;
        const promoterBp = record.start - (record.distance_kb || 0) * 1000;
        const promoterIdx = posToPathIdx(promoterBp);
        const promoterPos = path[promoterIdx] ?? path[Math.floor(path.length / 2)];
        const enhancerPos = path[posToPathIdx(enhancerMid)] ?? promoterPos.clone();

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
      dist: 2.3,
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
      orbit.dist = Math.max(1.2, Math.min(15, orbit.dist + event.deltaY * 0.01));
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
    const animate = () => {
      frameId = requestAnimationFrame(animate);
      if (!orbit.isDragging) {
        // 仅保留拖拽松手后的惯性衰减；不再自动旋转
        orbit.theta += orbit.vel;
        orbit.vel *= 0.94;
      }
      updateCamera();
      renderer.render(scene, camera);
    };
    animate();

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
    const highlightGeo = new THREE.SphereGeometry(0.04, 20, 20);
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

    // ── Hover tooltip：鼠标移到纤维上显示对应基因组位置 ──────────────
    // 用不可见的小球挂在 path 每个点上，Raycaster 命中后映射到 bp
    const raycaster = new THREE.Raycaster();
    const mouseNdc = new THREE.Vector2();
    const hitGroup = new THREE.Group();
    const hitGeo = new THREE.SphereGeometry(0.025, 6, 6);
    const hitMat = new THREE.MeshBasicMaterial({ visible: false });
    path.forEach((p, i) => {
      const m = new THREE.Mesh(hitGeo, hitMat);
      m.position.copy(p);
      m.userData.pathIdx = i;
      hitGroup.add(m);
    });
    scene.add(hitGroup);

    const tooltip = document.createElement('div');
    tooltip.style.cssText =
      'position:absolute;pointer-events:none;background:rgba(20,22,30,0.92);color:#e8ecf1;' +
      'padding:4px 8px;border-radius:6px;font-size:12px;font-family:ui-monospace,monospace;' +
      'z-index:10;display:none;white-space:nowrap;box-shadow:0 2px 8px rgba(0,0,0,0.3);';
    mount.style.position = 'relative';
    mount.appendChild(tooltip);

    const fmtBp = (bp: number): string => {
      if (bp >= 1e6) return `${(bp / 1e6).toFixed(2)} Mb`;
      if (bp >= 1e3) return `${(bp / 1e3).toFixed(1)} kb`;
      return `${bp} bp`;
    };

    const onHover = (event: PointerEvent) => {
      if (orbit.isDragging) { tooltip.style.display = 'none'; return; }
      const rect = canvas.getBoundingClientRect();
      mouseNdc.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouseNdc.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouseNdc, camera);
      const hits = raycaster.intersectObjects(hitGroup.children, false);
      if (hits.length === 0) {
        tooltip.style.display = 'none';
        return;
      }
      const idx = hits[0].object.userData.pathIdx as number;
      const bp = viewport.start + idx * viewport.bin;
      const bpEnd = bp + viewport.bin;
      tooltip.textContent = `${viewport.chr}:${fmtBp(bp)} – ${fmtBp(bpEnd)}`;
      tooltip.style.left = `${event.clientX - rect.left + 12}px`;
      tooltip.style.top = `${event.clientY - rect.top - 28}px`;
      tooltip.style.display = 'block';
    };
    canvas.addEventListener('pointermove', onHover);

    return () => {
      cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointercancel', onPointerUp);
      canvas.removeEventListener('wheel', onWheel);
      canvas.removeEventListener('contextmenu', onContextMenu);
      canvas.removeEventListener('pointermove', onHover);
      mount.removeChild(renderer.domElement);
      mount.removeChild(tooltip);
      hitGeo.dispose();
      hitMat.dispose();
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
    <div className="three-d-chromatin">
      {/* stage 是 Three.js 手动挂载点（effect 里 appendChild / innerHTML / removeChild），
          必须与 React 管理的子组件（ModelSourceBadge / Loading）隔离——
          否则 React 更新子节点时会与手动 DOM 操作冲突（removeChild 失败）。 */}
      <div
        className="three-d-chromatin__stage"
        ref={mountRef}
        role="img"
        aria-label={`3D chromatin folding model for ${organ}`}
      />
      <ModelSourceBadge source={threeDQuery.data?.source} />
      {(threeDQuery.isLoading || peiQuery.isLoading) && (
        <Loading variant="overlay" size="small" />
      )}
    </div>
  );
}