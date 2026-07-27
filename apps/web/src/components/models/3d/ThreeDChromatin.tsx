import { useEffect, useRef } from 'react';
import type { JSX } from 'react';
import { useQuery } from '@tanstack/react-query';
import * as THREE from 'three';

import { fetchBed } from '../../../api/client';
import type { PeiRecord } from '../../../api/types';
import { useViewport } from '../../../store/viewport';
import './three-d-chromatin.css';

interface ThreeDChromatinProps {
  height?: number;
  /** Which organ panel this instance renders. Drives the path seed & marker set. */
  organ: 'liver' | 'muscle' | 'brain';
  sampleId?: string;
}

// ─────── per-organ geometry params (mirrors chromatin3d.html:114-124) ────────
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

const ENHANCER_LIMIT = 6;
const LOOP_TUBE_RADIUS = 0.008;

// ─────── deterministic PRNG / math (mirrors chromatin3d.html:29-51) ─────────
function mulberry32(seed: number) {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function rainbow(t: number): THREE.Color {
  // hsl2rgb(240 * (1-t), 0.72, 0.52)  → blue→cyan→green→yellow→red
  return new THREE.Color().setHSL(240 * (1 - t) / 360, 0.72, 0.52);
}

/** 3D random-walk path + Catmull-Rom + normalise → mirrors makePath() */
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

  // Catmull-Rom spline
  const curve = new THREE.CatmullRomCurve3(raw, false, 'catmullrom', 0.5);
  const totalLen = raw.length - 1;
  // The demo uses 10 segments between each pair of control points
  // We sample enough to smooth the tube.
  const ptsPerSeg = 10;
  const smooth: THREE.Vector3[] = [];
  for (let i = 0; i < totalLen; i += 1) {
    for (let s = 0; s < ptsPerSeg; s += 1) {
      const t = (i + s / ptsPerSeg) / totalLen;
      smooth.push(curve.getPoint(t));
    }
  }
  smooth.push(raw[raw.length - 1]);

  // Normalise to radius 1.25 (mirrors normalizePts)
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

/** Build a rainbow-coloured tube geometry and add it to the scene. */
function addTube(path: THREE.Vector3[], scene: THREE.Scene): void {
  const curve = new THREE.CatmullRomCurve3(path, false, 'catmullrom', 0);
  const tubeGeo = new THREE.TubeGeometry(curve, 200, 0.034, 10, false);
  const colors = new Float32Array(tubeGeo.attributes.position.count * 3);
  const pos = tubeGeo.attributes.position;
  const tmp = new THREE.Vector3();
  for (let i = 0; i < pos.count; i += 1) {
    tmp.fromBufferAttribute(pos, i);
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

/** Build a sphere at a position along the path. */
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

export function ThreeDChromatin({
  organ,
  height = 150,
  sampleId,
}: ThreeDChromatinProps): JSX.Element {
  const mountRef = useRef<HTMLDivElement>(null);
  const viewport = useViewport();

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

  const sceneHandleRef = useRef<{
    attachEnhancers: (records: PeiRecord[]) => void;
  } | null>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return undefined;

    const { seed, steps, markers } = ORGAN_PARAMS[organ];
    const path = makePath(seed, steps);
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
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    mount.appendChild(renderer.domElement);

    // Lights — matches the demo shader's uLight (0.45, 0.7, 0.8)
    scene.add(new THREE.AmbientLight(0xffffff, 0.5));
    const dl = new THREE.DirectionalLight(0xffffff, 0.7);
    dl.position.set(5, 7, 8);
    scene.add(dl);

    // ── Rainbow tube ───────────────────────────────────────────────────
    addTube(path, scene);

    // ── Path markers (sphere beads) ────────────────────────────────────
    // Store all spheres so PEI enhancers can attach near their positions.
    const sphereMeshes: THREE.Mesh[] = [];
    const spherePositions: THREE.Vector3[] = [];
    for (const m of markers) {
      const idx = Math.round(m.t * (path.length - 1));
      spherePositions.push(path[idx].clone());
      sphereMeshes.push(
        addSphere(path[idx], 0.11, m.color, scene),
      );
    }

    // ── Interaction group (PEI enhancer spheres + loop arcs) ───────────
    const interactionGroup = new THREE.Group();
    scene.add(interactionGroup);

    const enhancerRad = 0.09;
    const enhancerGeo = new THREE.SphereGeometry(enhancerRad, 16, 16);
    const enhancerMat = new THREE.MeshStandardMaterial({ color: 0x5ba854 });

    const attachEnhancers = (records: PeiRecord[]): void => {
      while (interactionGroup.children.length > 0) {
        const child = interactionGroup.children[0];
        interactionGroup.remove(child);
        if (child instanceof THREE.Mesh) child.geometry.dispose();
      }
      const enhancers = records.slice(0, ENHANCER_LIMIT);
      if (enhancers.length === 0) return;

      enhancers.forEach((record, index) => {
        const promoterPos =
          spherePositions[index % spherePositions.length];

        const distNorm = Math.min(1, record.distance_kb / 1000);
        const raid = 0.6 + 1.4 * distNorm;
        const phi = (index / Math.max(1, enhancers.length)) * Math.PI * 2;
        const enhancerPos = new THREE.Vector3(
          raid * Math.cos(phi),
          0.4 * Math.sin(phi * 1.5),
          raid * Math.sin(phi),
        );

        const enhancer = new THREE.Mesh(enhancerGeo, enhancerMat);
        enhancer.position.copy(enhancerPos);
        interactionGroup.add(enhancer);

        const spanBp = Math.max(0, record.end - record.start);
        const arcHeight = 0.4 + Math.min(1.2, spanBp / 100_000);
        const mid = new THREE.Vector3(
          (promoterPos.x + enhancerPos.x) / 2,
          (promoterPos.y + enhancerPos.y) / 2 + arcHeight,
          (promoterPos.z + enhancerPos.z) / 2,
        );
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

    // ── Orbit controls (drag + auto-rotate) ────────────────────────────
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

    const updateCamera = () => {
      camera.position.x = orbit.dist * Math.sin(orbit.phi) * Math.cos(orbit.theta);
      camera.position.y = orbit.dist * Math.cos(orbit.phi);
      camera.position.z = orbit.dist * Math.sin(orbit.phi) * Math.sin(orbit.theta);
      camera.lookAt(0, 0, 0);
    };
    updateCamera();

    const canvas = renderer.domElement;
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
      canvas.setPointerCapture(event.pointerId);
      canvas.style.cursor = 'grabbing';
    };
    const onPointerMove = (event: PointerEvent) => {
      if (!orbit.isDragging || event.pointerId !== orbit.pointerId) return;
      const dx = event.clientX - orbit.lastX;
      const dy = event.clientY - orbit.lastY;
      orbit.theta -= dx * 0.01;
      orbit.phi = Math.max(0.1, Math.min(Math.PI - 0.1, orbit.phi + dy * 0.01));
      orbit.lastX = event.clientX;
      orbit.lastY = event.clientY;
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
      // Prevent default to stop the surrounding `.route-content` from
      // scrolling while the user zooms this canvas. Stop propagation so
      // sibling canvases that share a parent don't see the event.
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

    // ── Animate ──────────────────────────────────────────────────────
    let frameId = 0;
    let lastTime = performance.now();
    const animate = (now: number) => {
      frameId = requestAnimationFrame(animate);
      const dt = now - lastTime;
      lastTime = now;
      if (!orbit.isDragging) {
        orbit.theta += dt * 0.00045 + orbit.vel;
        orbit.vel *= 0.94;
      }
      updateCamera();
      renderer.render(scene, camera);
    };
    animate(performance.now());

    // ResizeObserver — Three.js renderer's canvas size must match the host
    // container's CSS dimensions. Without this, the first frame paints at
    // 0×0 (mount.clientHeight is 0 before layout settles) and a hard
    // layout reflow after mount never triggers a renderer resize.
    const resize = () => {
      const w = Math.max(mount.clientWidth, 1);
      const h = Math.max(mount.clientHeight, 1);
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(mount);
    // Run once after the next paint so layout has settled.
    requestAnimationFrame(() => resize());

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
      renderer.forceContextLoss();
      interactionGroup.traverse((child) => {
        if (child instanceof THREE.Mesh) child.geometry.dispose();
      });
      sceneHandleRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organ, height, sampleId, viewport.chr, viewport.start, viewport.end]);

  // PEI effect
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