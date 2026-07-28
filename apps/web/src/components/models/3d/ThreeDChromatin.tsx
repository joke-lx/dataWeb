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
import { useQuery } from '@tanstack/react-query';
import * as THREE from 'three';

import { fetchBed } from '../../../api/client';
import type { PeiRecord } from '../../../api/types';
import { useViewport } from '../../../store/viewport';
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
    seed: 41,
    steps: 74,
    markers: [{ t: 0.5, color: 0x808080 }],
  },
};

// 防止 enhancer 数量爆炸；超过即截断，避免 GPU 顶点数失控
const ENHANCER_LIMIT = 6;
// loop 弧的管半径：比主 tube 细很多（0.034 vs 0.008），形成视觉层级
const LOOP_TUBE_RADIUS = 0.008;

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
 * 把 t∈[0,1] 映射成蓝→青→绿→黄→红的彩虹渐变（HSL 色环绕一圈）。
 * 通过 `(240 * (1-t) / 360)` 让 t=0 对应蓝色 240°，t=1 对应红色 0°——形成"路径端点=冷色 → 中间=暖色"的视觉。
 */
function rainbow(t: number): THREE.Color {
  // hsl2rgb(240 * (1-t), 0.72, 0.52)  → blue→cyan→green→yellow→red
  return new THREE.Color().setHSL(240 * (1 - t) / 360, 0.72, 0.52);
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
function makePath(seed: number, steps: number): THREE.Vector3[] {
  const rng = mulberry32(seed);
  let d = new THREE.Vector3(rng() - 0.5, rng() - 0.5, rng() - 0.5).normalize();
  let p = new THREE.Vector3(0, 0, 0);
  const raw: THREE.Vector3[] = [p.clone()];
  for (let i = 0; i < steps; i += 1) {
    d = new THREE.Vector3(
      d.x + (rng() - 0.5) * 1.85,
      d.y + (rng() - 0.5) * 1.85,
      d.z + (rng() - 0.5) * 1.85,
    ).normalize();
    p = p.clone().add(d.clone().multiplyScalar(0.42));
    raw.push(p.clone());
  }

  // Catmull-Rom 样条：用控制点 raw 插值生成密集的"曲线点"
  const curve = new THREE.CatmullRomCurve3(raw, false, 'catmullrom', 0.5);
  const totalLen = raw.length - 1;
  // 原 demo 每对控制点间采 10 个点——已经够密，TubeGeometry 自身也会再分段
  const ptsPerSeg = 10;
  const smooth: THREE.Vector3[] = [];
  for (let i = 0; i < totalLen; i += 1) {
    for (let s = 0; s < ptsPerSeg; s += 1) {
      const t = (i + s / ptsPerSeg) / totalLen;
      smooth.push(curve.getPoint(t));
    }
  }
  smooth.push(raw[raw.length - 1]);

  // 归一化到半径 1.25（与原 demo 的 normalizePts 等价）：
  // 1) 中心化到原点；2) 找最大距离 R；3) 缩放到 1.25 / R
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
function addTube(path: THREE.Vector3[], scene: THREE.Scene): void {
  const curve = new THREE.CatmullRomCurve3(path, false, 'catmullrom', 0);
  const tubeGeo = new THREE.TubeGeometry(curve, 200, 0.034, 10, false);
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
    metalness: 0,
    roughness: 0.7,
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
  const geo = new THREE.SphereGeometry(radius, 16, 20);
  const mat = new THREE.MeshStandardMaterial({ color });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.copy(pos);
  scene.add(mesh);
  return mesh;
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
    staleTime: 30_000,
  });

  // 用于让第二个 effect（PEI 数据 effect）能调到主 effect 里定义的 attachEnhancers
  // 避免重建整个 scene 来更新 enhancer 几何
  const sceneHandleRef = useRef<{
    attachEnhancers: (records: PeiRecord[]) => void;
  } | null>(null);

  // 主 effect：建 scene + renderer + controls + 几何；cleanup 全量释放
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return undefined;

    const { seed, steps, markers } = ORGAN_PARAMS[organ];
    const path = makePath(seed, steps);
    // clientWidth/Height 在 mount 时可能为 0（layout 未就绪），用 max(.., 1) 兜底
    const panelW = Math.max(mount.clientWidth, 1);
    const panelH = Math.max(mount.clientHeight, 1);

    // ── Scene / Camera / Renderer ──────────────────────────────────────
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xffffff);

    const camera = new THREE.PerspectiveCamera(42, panelW / panelH, 0.1, 100);
    camera.position.set(0, 0, 3.5);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(panelW, panelH);
    // 限到 2：4K 屏上 setPixelRatio(window.devicePixelRatio) 会让 fragment shader 跑爆
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    mount.appendChild(renderer.domElement);

    // 灯光——匹配原 demo 的 uLight 参数：环境光 + 一个方向光
    scene.add(new THREE.AmbientLight(0xffffff, 0.5));
    const dl = new THREE.DirectionalLight(0xffffff, 0.7);
    dl.position.set(5, 7, 8);
    scene.add(dl);

    // ── Rainbow tube ───────────────────────────────────────────────────
    addTube(path, scene);

    // ── 路径标记球 ─────────────────────────────────────────────────────
    // 把球和位置都存下来——后面 attach enhancer 时要复用球位置（作为 promoter 锚点）
    const sphereMeshes: THREE.Mesh[] = [];
    const spherePositions: THREE.Vector3[] = [];
    for (const m of markers) {
      const idx = Math.round(m.t * (path.length - 1));
      spherePositions.push(path[idx].clone());
      sphereMeshes.push(
        addSphere(path[idx], 0.11, m.color, scene),
      );
    }

    // ── 交互 group（PEI enhancer 球 + loop 弧）───────────────────────
    // 把 PEI 相关几何都放一个 Group，方便 attachEnhancers 时整体清掉再重建
    const interactionGroup = new THREE.Group();
    scene.add(interactionGroup);

    const enhancerRad = 0.09;
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

        // spanBp（PEI 跨度）越大 → 弧越高（更长的连接在视觉上更"拱起"）
        const spanBp = Math.max(0, record.end - record.start);
        const arcHeight = 0.4 + Math.min(1.2, spanBp / 100_000);
        const mid = new THREE.Vector3(
          (promoterPos.x + enhancerPos.x) / 2,
          (promoterPos.y + enhancerPos.y) / 2 + arcHeight,
          (promoterPos.z + enhancerPos.z) / 2,
        );
        // 用 promoter → mid → enhancer 三点构造 Catmull-Rom 弧
        const arcCurve = new THREE.CatmullRomCurve3(
          [promoterPos.clone(), mid, enhancerPos.clone()],
          false,
          'catmullrom',
          0.5,
        );
        const arcGeo = new THREE.TubeGeometry(arcCurve, 32, LOOP_TUBE_RADIUS, 6, false);
        const arcMat = new THREE.MeshStandardMaterial({
          color: 0xb8b8b8,
          metalness: 0,
          roughness: 0.8,
          transparent: true,
          opacity: 0.45,
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
      theta: Math.random() * Math.PI * 2,
      phi: Math.PI / 2 - 0.32,
      dist: 3.5,
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

    // 把 attachEnhancers 暴露给第二个 effect；首次挂载时如果 PEI 数据已就绪，立即渲染
    sceneHandleRef.current = { attachEnhancers };
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
      sceneHandleRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organ, height, sampleId, viewport.chr, viewport.start, viewport.end]);

  // PEI 数据 effect：仅在 peiQuery.data 变化时调 attachEnhancers，
  // 不重建整个 scene，节省 GPU/CPU 资源
  useEffect(() => {
    sceneHandleRef.current?.attachEnhancers(peiQuery.data ?? []);
  }, [peiQuery.data]);

  return (
    <div
      className="three-d-chromatin"
      ref={mountRef}
      role="img"
      aria-label={`3D chromatin folding model for ${organ}`}
    />
  );
}