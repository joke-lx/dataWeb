import { useEffect, useRef } from 'react';
import type { JSX } from 'react';
import { useQuery } from '@tanstack/react-query';
import * as THREE from 'three';

import { fetchBed } from '../../api/client';
import type { PeiRecord } from '../../api/types';
import { useViewport } from '../../store/viewport';
import './three-d-chromatin.css';

interface ThreeDChromatinProps {
  height?: number;
  /**
   * Active sample id. When provided, the geometry is anchored to the
   * promoter's mock PEI records for the current viewport so enhancer
   * positions reflect the same `(sample, chr, start, end)` window. When
   * omitted, a generic decorative ribbon is rendered.
   */
  sampleId?: string;
}

// Visual DNA (matches docx/refrences/demo7.png): a grey chromatin
// backbone, grey promoter beads along it, green enhancer beads pulled off
// the curve, and light-grey interaction arcs linking each promoter to its
// paired enhancer.
const COLOR_BACKBONE = 0x6b6b6b;
const COLOR_PROMOTER = 0x6b6b6b;
const COLOR_ENHANCER = 0x5ba854;
const COLOR_LOOP = 0xb8b8b8;

const PROMOTER_BEAD_COUNT = 10;
const ENHANCER_LIMIT = 6;
const BACKBONE_TUBE_RADIUS = 0.018;
const PROMOTER_BEAD_RADIUS = 0.06;
const ENHANCER_BEAD_RADIUS = 0.08;
const LOOP_TUBE_RADIUS = 0.008;

export function ThreeDChromatin({
  height = 360,
  sampleId,
}: ThreeDChromatinProps): JSX.Element {
  const mountRef = useRef<HTMLDivElement>(null);
  const viewport = useViewport();

  const peiQuery = useQuery<PeiRecord[]>({
    queryKey: [
      'pei-3d',
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

  // Mutable handle into the live scene so the PEI effect can attach
  // enhancers / loops without rebuilding the rest of the scene. Set on
  // mount, cleared on unmount or when the structural deps change.
  const sceneHandleRef = useRef<{
    promoterPositions: THREE.Vector3[];
    attachEnhancers: (records: PeiRecord[]) => void;
  } | null>(null);

  // -----------------------------------------------------------------
  // Structural effect: builds the renderer, camera, lights, backbone,
  // promoter beads and pointer controls. Re-runs only when the
  // structural identity of the view changes (height / sample / viewport
  // window). PEI data does NOT trigger this effect — that lives in the
  // effect below and mutates the existing scene in place.
  // -----------------------------------------------------------------
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return undefined;

    const width = Math.max(mount.clientWidth, 1);

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xffffff);

    // Camera
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(3, 2, 5);

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    mount.appendChild(renderer.domElement);

    // Lights
    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const directional = new THREE.DirectionalLight(0xffffff, 0.6);
    directional.position.set(5, 5, 5);
    scene.add(directional);

    // Backbone
    const backbonePoints: THREE.Vector3[] = [];
    const backboneN = 20;
    for (let i = 0; i < backboneN; i += 1) {
      const t = i / (backboneN - 1);
      const angle = t * Math.PI * 2.5;
      const radius = 1.4 + 0.4 * Math.sin(angle * 2);
      backbonePoints.push(
        new THREE.Vector3(
          radius * Math.cos(angle),
          Math.sin(angle * 1.7) * 0.6,
          radius * Math.sin(angle),
        ),
      );
    }
    const backboneCurve = new THREE.CatmullRomCurve3(backbonePoints, false, 'catmullrom', 0.5);
    const backboneGeometry = new THREE.TubeGeometry(
      backboneCurve,
      200,
      BACKBONE_TUBE_RADIUS,
      8,
      false,
    );
    const backboneMaterial = new THREE.MeshStandardMaterial({
      color: COLOR_BACKBONE,
      metalness: 0,
      roughness: 0.7,
    });
    const backbone = new THREE.Mesh(backboneGeometry, backboneMaterial);
    scene.add(backbone);

    // Promoter beads
    const promoterGeo = new THREE.SphereGeometry(PROMOTER_BEAD_RADIUS, 16, 16);
    const promoterMat = new THREE.MeshStandardMaterial({ color: COLOR_PROMOTER });
    const promoterMeshes: THREE.Mesh[] = [];
    const promoterPositions: THREE.Vector3[] = [];
    for (let i = 0; i < PROMOTER_BEAD_COUNT; i += 1) {
      const t = (i + 1) / (PROMOTER_BEAD_COUNT + 1);
      const point = backboneCurve.getPoint(t);
      const mesh = new THREE.Mesh(promoterGeo, promoterMat);
      mesh.position.copy(point);
      scene.add(mesh);
      promoterMeshes.push(mesh);
      promoterPositions.push(point.clone());
    }

    // Container group for enhancer beads + interaction arcs. Replaced
    // wholesale whenever PEI data changes, without touching the rest of
    // the scene.
    const interactionGroup = new THREE.Group();
    scene.add(interactionGroup);

    const enhancerGeo = new THREE.SphereGeometry(ENHANCER_BEAD_RADIUS, 16, 16);
    const enhancerMat = new THREE.MeshStandardMaterial({ color: COLOR_ENHANCER });

    const attachEnhancers = (records: PeiRecord[]): void => {
      // Dispose previous group contents.
      while (interactionGroup.children.length > 0) {
        const child = interactionGroup.children[0];
        interactionGroup.remove(child);
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
        }
      }
      const enhancers = records.slice(0, ENHANCER_LIMIT);
      if (enhancers.length === 0) return;

      enhancers.forEach((record, index) => {
        const promoterPos =
          promoterPositions[index % promoterPositions.length];

        const distNorm = Math.min(1, record.distance_kb / 1000);
        const enhancerRadius = 0.6 + 1.4 * distNorm;
        const phi = (index / Math.max(1, enhancers.length)) * Math.PI * 2;
        const enhancerPos = new THREE.Vector3(
          enhancerRadius * Math.cos(phi),
          0.4 * Math.sin(phi * 1.5),
          enhancerRadius * Math.sin(phi),
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
        const loopCurve = new THREE.CatmullRomCurve3(
          [promoterPos.clone(), mid, enhancerPos.clone()],
          false,
          'catmullrom',
          0.5,
        );
        const loopGeometry = new THREE.TubeGeometry(
          loopCurve,
          32,
          LOOP_TUBE_RADIUS,
          6,
          false,
        );
        const loopMaterial = new THREE.MeshStandardMaterial({
          color: COLOR_LOOP,
          metalness: 0,
          roughness: 0.8,
          transparent: true,
          opacity: 0.45,
        });
        const loopMesh = new THREE.Mesh(loopGeometry, loopMaterial);
        interactionGroup.add(loopMesh);
      });
    };

    // Camera orbit using pointer capture — only the canvas that
    // captured the pointer receives move/up events, so adjacent panels
    // in the /3d grid can't steal the drag.
    const orbit = {
      isDragging: false,
      lastX: 0,
      lastY: 0,
      pointerId: -1,
      theta: 0.5,
      phi: 0.5,
      dist: 6,
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

    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0) return; // primary button only
      event.preventDefault();
      orbit.isDragging = true;
      orbit.pointerId = event.pointerId;
      orbit.lastX = event.clientX;
      orbit.lastY = event.clientY;
      canvas.setPointerCapture(event.pointerId);
    };
    const onPointerMove = (event: PointerEvent) => {
      if (!orbit.isDragging || event.pointerId !== orbit.pointerId) return;
      const dx = event.clientX - orbit.lastX;
      const dy = event.clientY - orbit.lastY;
      orbit.theta -= dx * 0.01;
      orbit.phi = Math.max(0.1, Math.min(Math.PI - 0.1, orbit.phi + dy * 0.01));
      orbit.lastX = event.clientX;
      orbit.lastY = event.clientY;
      updateCamera();
    };
    const onPointerUp = (event: PointerEvent) => {
      if (event.pointerId !== orbit.pointerId) return;
      orbit.isDragging = false;
      if (canvas.hasPointerCapture(event.pointerId)) {
        canvas.releasePointerCapture(event.pointerId);
      }
    };
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      orbit.dist = Math.max(2, Math.min(15, orbit.dist + event.deltaY * 0.01));
      updateCamera();
    };
    const onContextMenu = (event: MouseEvent) => {
      event.preventDefault();
    };

    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointercancel', onPointerUp);
    canvas.addEventListener('wheel', onWheel, { passive: false });
    canvas.addEventListener('contextmenu', onContextMenu);

    // Animate
    let frameId = 0;
    const animate = () => {
      frameId = requestAnimationFrame(animate);
      renderer.render(scene, camera);
    };
    animate();

    // Resize handler
    const onResize = () => {
      const resizedWidth = Math.max(mount.clientWidth, 1);
      camera.aspect = resizedWidth / height;
      camera.updateProjectionMatrix();
      renderer.setSize(resizedWidth, height);
    };
    const resizeObserver = new ResizeObserver(onResize);
    resizeObserver.observe(mount);

    // Expose handle for the PEI effect to attach data.
    sceneHandleRef.current = { promoterPositions, attachEnhancers };

    // Paint any PEI records that were already fetched before this effect
    // ran (e.g. from a previous sample / window). Without this the
    // panels would render empty until the next PEI refetch.
    if (peiQuery.data) attachEnhancers(peiQuery.data);

    return () => {
      cancelAnimationFrame(frameId);
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointercancel', onPointerUp);
      canvas.removeEventListener('wheel', onWheel);
      canvas.removeEventListener('contextmenu', onContextMenu);
      resizeObserver.disconnect();
      mount.removeChild(renderer.domElement);
      renderer.dispose();
      renderer.forceContextLoss();
      backboneGeometry.dispose();
      backboneMaterial.dispose();
      promoterGeo.dispose();
      promoterMat.dispose();
      enhancerGeo.dispose();
      enhancerMat.dispose();
      interactionGroup.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
        }
      });
      sceneHandleRef.current = null;
      void promoterMeshes;
    };
    // peiQuery.data intentionally omitted — handled in the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [height, sampleId, viewport.chr, viewport.start, viewport.end]);

  // -----------------------------------------------------------------
  // PEI effect: when PEI data arrives (or changes), ask the live scene
  // to attach enhancers/loops in place. The backbone, promoter beads
  // and orbit controls are NOT torn down, so there is no flash and the
  // user's drag state is preserved.
  // -----------------------------------------------------------------
  useEffect(() => {
    const handle = sceneHandleRef.current;
    if (!handle) return;
    handle.attachEnhancers(peiQuery.data ?? []);
  }, [peiQuery.data]);

  return (
    <div
      className="three-d-chromatin"
      ref={mountRef}
      role="img"
      aria-label={
        sampleId
          ? `3D chromatin folding model for sample ${sampleId}, showing promoter backbone with enhancer anchors and interaction loops`
          : '3D chromatin folding model with promoter backbone and enhancer anchors'
      }
      style={{ height: `${height}px` }}
    />
  );
}
