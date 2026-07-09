"use client";

import { PointerEvent, useRef, useState } from "react";
import styles from "./Lanyard.module.css";

type DragState = {
  pointerId: number;
  startX: number;
  startY: number;
  originX: number;
  originY: number;
};

export default function Lanyard() {
  const badgeRef = useRef<HTMLDivElement | null>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    setDrag({ pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, originX: offset.x, originY: offset.y });
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!drag || drag.pointerId !== event.pointerId) return;
    const nextX = Math.max(-82, Math.min(82, drag.originX + event.clientX - drag.startX));
    const nextY = Math.max(-34, Math.min(74, drag.originY + event.clientY - drag.startY));
    setOffset({ x: nextX, y: nextY });
  };

  const release = (event: PointerEvent<HTMLDivElement>) => {
    if (!drag || drag.pointerId !== event.pointerId) return;
    event.currentTarget.releasePointerCapture(event.pointerId);
    setDrag(null);
    setOffset({ x: 0, y: 0 });
  };

  const rotate = offset.x * 0.045;
  const tiltX = offset.y * -0.026;
  const tiltY = offset.x * 0.032;

  return (
    <div className={styles.stage} style={{ "--drag-x": `${offset.x}px`, "--drag-y": `${offset.y}px`, "--swing": `${rotate}deg` } as React.CSSProperties}>
      <div className={styles.anchor} />
      <div className={styles.cord} aria-hidden="true">
        <span className={styles.cordLeft} />
        <span className={styles.cordRight} />
        <span className={styles.cordCrossA} />
        <span className={styles.cordCrossB} />
      </div>
      <div className={styles.shadow} />
      <div
        ref={badgeRef}
        className={`${styles.badgeRig} ${drag ? styles.dragging : ""}`}
        style={{ transform: `translate3d(${offset.x}px, ${offset.y}px, 0) rotateZ(${rotate}deg) rotateX(${tiltX}deg) rotateY(${tiltY}deg)` }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={release}
        onPointerCancel={release}
      >
        <div className={styles.clipTop}>
          <span />
        </div>
        <article className={styles.badge}>
          <div className={styles.badgeHole} />
          <div className={styles.badgeGlass} />
          <div className={styles.photoWrap}>
            <img src="/assets/ring-profile-lanyard.jpg" alt="RING" draggable={false} />
          </div>
          <div className={styles.cardBody}>
            <div className={styles.logoRow}>
              <img src="/assets/ring-logo-transparent.png" alt="Ring logo" draggable={false} />
              <span>ID CARD</span>
            </div>
            <p>VISUAL CREATOR</p>
            <h3>RING</h3>
            <dl>
              <div><dt>TEL</dt><dd>18569569185</dd></div>
              <div><dt>TYPE</dt><dd>CONTACT PASS</dd></div>
            </dl>
          </div>
        </article>
      </div>
    </div>
  );
}
