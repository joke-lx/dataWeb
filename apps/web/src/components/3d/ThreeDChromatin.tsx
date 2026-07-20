import { useEffect, useRef } from 'react';
import * as THREE from 'three';

import './three-d-chromatin.css';

interface ThreeDChromatinProps {
  height?: number;
}

export function ThreeDChromatin({ height = 360 }: ThreeDChromatinProps) {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

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

    // Ribbon: a smooth curve through 8 control points
    const points: THREE.Vector3[] = [];
    const n = 8;
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      const angle = t * Math.PI * 2;
      const radius = 1.5 + 0.5 * Math.sin(angle * 3);
      points.push(
        new THREE.Vector3(
          radius * Math.cos(angle),
          Math.sin(angle * 2) * 0.5,
          radius * Math.sin(angle),
        ),
      );
    }
    const curve = new THREE.CatmullRomCurve3(points);
    const tubeGeometry = new THREE.TubeGeometry(curve, 64, 0.03, 8, false);
    const tubeMaterial = new THREE.MeshStandardMaterial({
      color: 0x4a4a4a,
      metalness: 0,
      roughness: 0.7,
    });
    const tube = new THREE.Mesh(tubeGeometry, tubeMaterial);
    scene.add(tube);

    // Anchor dots (green = promoter, grey = enhancer)
    const anchorGeo = new THREE.SphereGeometry(0.08, 16, 16);
    const anchorMatA = new THREE.MeshStandardMaterial({ color: 0x2e8b57, transparent: true, opacity: 0.85 });
    const anchorMatB = new THREE.MeshStandardMaterial({ color: 0x888888, transparent: true, opacity: 0.85 });

    const anchorA = new THREE.Mesh(anchorGeo, anchorMatA);
    anchorA.position.copy(points[0]);
    scene.add(anchorA);

    const anchorB = new THREE.Mesh(anchorGeo, anchorMatB);
    anchorB.position.copy(points[points.length - 1]);
    scene.add(anchorB);

    // Mouse orbit
    let isDragging = false;
    let lastX = 0;
    let lastY = 0;
    let theta = 0.5;
    let phi = 0.5;
    let dist = 6;
    const updateCamera = () => {
      camera.position.x = dist * Math.sin(phi) * Math.cos(theta);
      camera.position.y = dist * Math.cos(phi);
      camera.position.z = dist * Math.sin(phi) * Math.sin(theta);
      camera.lookAt(0, 0, 0);
    };
    updateCamera();

    const onDown = (event: MouseEvent) => {
      isDragging = true;
      lastX = event.clientX;
      lastY = event.clientY;
    };
    const onUp = () => {
      isDragging = false;
    };
    const onMove = (event: MouseEvent) => {
      if (!isDragging) return;
      const dx = event.clientX - lastX;
      const dy = event.clientY - lastY;
      theta -= dx * 0.01;
      phi = Math.max(0.1, Math.min(Math.PI - 0.1, phi + dy * 0.01));
      lastX = event.clientX;
      lastY = event.clientY;
      updateCamera();
    };
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      dist = Math.max(2, Math.min(15, dist + event.deltaY * 0.01));
      updateCamera();
    };

    renderer.domElement.addEventListener('mousedown', onDown);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('mousemove', onMove);
    renderer.domElement.addEventListener('wheel', onWheel, { passive: false });

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

    return () => {
      cancelAnimationFrame(frameId);
      renderer.domElement.removeEventListener('mousedown', onDown);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('mousemove', onMove);
      renderer.domElement.removeEventListener('wheel', onWheel);
      resizeObserver.disconnect();
      mount.removeChild(renderer.domElement);
      renderer.dispose();
      renderer.forceContextLoss();
      tubeGeometry.dispose();
      tubeMaterial.dispose();
      anchorGeo.dispose();
      anchorMatA.dispose();
      anchorMatB.dispose();
    };
  }, [height]);

  return (
    <div
      className="three-d-chromatin"
      ref={mountRef}
      role="img"
      aria-label="3D chromatin ribbon with promoter and enhancer anchors"
      style={{ height: `${height}px` }}
    />
  );
}
