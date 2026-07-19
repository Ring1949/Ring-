"use client";

import { useFrame, useLoader } from "@react-three/fiber";
import { useEffect, useMemo, useRef, type MutableRefObject } from "react";
import * as THREE from "three";
import type { Media } from "@/lib/types";

type ArchiveControls = { targetX: number; targetY: number; targetZ: number };
type Props = { items: Media[]; controls: MutableRefObject<ArchiveControls>; onSelect: (item: Media) => void; reducedMotion?: boolean };
type Layout = { item: Media; x: number; y: number; z: number; rotation: number; width: number; height: number; anchor: boolean };

function seeded(seed: number) { let state = seed >>> 0; return () => { state += 0x6d2b79f5; let value = state; value = Math.imul(value ^ (value >>> 15), value | 1); value ^= value + Math.imul(value ^ (value >>> 7), value | 61); return ((value ^ (value >>> 14)) >>> 0) / 4294967296; }; }
function isImage(item: Media) { const kind = String(item.media_type || item.mime_type || item.file_type || "image").toLowerCase(); return !kind.includes("video") && !kind.includes("pdf") && !kind.includes("zip") && Boolean(item.file_path); }
function buildLayout(items: Media[]) {
  const usable = items.filter(isImage).slice(0, 56), random = seeded(260726);
  return usable.map((item, index) => {
    if (index === 0) return { item, x: 0, y: 0.85, z: -1.4, rotation: 0, width: 4.3, height: 3.15, anchor: true };
    const layer = Math.floor((index - 1) / 8), angle = index * 2.399963 + random() * 0.5;
    const radius = 7 + layer * 3.4 + random() * 5.5;
    return { item, x: Math.cos(angle) * radius, y: Math.sin(angle) * radius * 0.58 + (random() - .5) * 4.8, z: -8 - layer * 6.3 - random() * 11, rotation: (random() - .5) * .32, width: 1.8 + random() * 2.2, height: 1.25 + random() * 1.65, anchor: false };
  });
}

function ArchivePlane({ entry, texture, controls, onSelect, reducedMotion }: { entry: Layout; texture: THREE.Texture; controls: MutableRefObject<ArchiveControls>; onSelect: (item: Media) => void; reducedMotion: boolean }) {
  const textureImage = texture.image as { width?: number; height?: number };
  const ratio = textureImage?.width && textureImage?.height ? textureImage.width / textureImage.height : entry.width / entry.height;
  const height = entry.height;
  const width = Math.max(.9, Math.min(entry.width * 1.5, height * ratio));
  const mesh = useRef<THREE.Mesh>(null), material = useRef<THREE.MeshBasicMaterial>(null), baseZ = useRef(entry.z);
  useFrame(({ camera }, delta) => {
    const node = mesh.current, surface = material.current;
    if (!node || !surface) return;
    if (!entry.anchor && node.position.z > camera.position.z + 7) node.position.z -= 72;
    if (!entry.anchor && node.position.z < camera.position.z - 78) node.position.z += 72;
    const distance = camera.position.distanceTo(node.getWorldPosition(new THREE.Vector3()));
    const presence = entry.anchor ? 1 : THREE.MathUtils.clamp(1.08 - distance / 60, .13, .82);
    surface.opacity += (presence - surface.opacity) * Math.min(1, delta * 3.2);
    const scale = entry.anchor ? 1 : THREE.MathUtils.clamp(1.22 - distance / 95, .48, 1.05);
    node.scale.lerp(new THREE.Vector3(scale, scale, 1), Math.min(1, delta * 2.8));
    if (!reducedMotion && !entry.anchor) node.rotation.z = entry.rotation + Math.sin(performance.now() * .00025 + entry.x) * .014;
  });
  useEffect(() => { texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = 8; texture.minFilter = THREE.LinearMipmapLinearFilter; texture.magFilter = THREE.LinearFilter; texture.needsUpdate = true; }, [texture]);
  return <mesh ref={mesh} position={[entry.x, entry.y, baseZ.current]} rotation={[0, 0, entry.rotation]} onClick={(event) => { event.stopPropagation(); onSelect(entry.item); }}>
    <planeGeometry args={[width, height]} />
    <meshBasicMaterial ref={material} map={texture} color="#ffffff" transparent opacity={entry.anchor ? 1 : .9} depthWrite={false} toneMapped={false} />
  </mesh>;
}

export default function HumanityArchive({ items, controls, onSelect, reducedMotion = false }: Props) {
  const group = useRef<THREE.Group>(null), layout = useMemo(() => buildLayout(items), [items]);
  const urls = useMemo(() => layout.map((entry) => entry.item.file_path), [layout]);
  const loaded = useLoader(THREE.TextureLoader, urls) as THREE.Texture[];
  useFrame((state, delta) => {
    const node = group.current;
    if (!node) return;
    node.rotation.y += (controls.current.targetX - node.rotation.y) * Math.min(1, delta * 2.5);
    node.rotation.x += (controls.current.targetY - node.rotation.x) * Math.min(1, delta * 2.5);
    if (!reducedMotion) node.position.y = Math.sin(state.clock.elapsedTime * .12) * .045;
  });
  if (!layout.length) return null;
  return <group ref={group}>{layout.map((entry, index) => <ArchivePlane key={entry.item.id} entry={entry} texture={loaded[index]} controls={controls} onSelect={onSelect} reducedMotion={reducedMotion} />)}</group>;
}

