"use client";

import React, { Children, cloneElement, forwardRef, isValidElement, useEffect, useMemo, useRef } from "react";
import gsap from "gsap";
import styles from "./card-swap.module.css";

type CardProps = React.HTMLAttributes<HTMLDivElement> & { customClass?: string };

export const Card = forwardRef<HTMLDivElement, CardProps>(({ customClass, className, ...rest }, ref) => (
  <div ref={ref} {...rest} className={`${styles.card} ${customClass ?? ""} ${className ?? ""}`.trim()} />
));
Card.displayName = "Card";

type Slot = { x: number; y: number; z: number; zIndex: number };
const makeSlot = (index: number, distanceX: number, distanceY: number, total: number): Slot => ({
  x: index * distanceX,
  y: -index * distanceY,
  z: -index * distanceX * 1.5,
  zIndex: total - index
});

const placeNow = (element: HTMLDivElement | null, slot: Slot, skew: number) => {
  if (!element) return;
  gsap.set(element, {
    x: slot.x, y: slot.y, z: slot.z, xPercent: -50, yPercent: -50,
    skewY: skew, transformOrigin: "center center", zIndex: slot.zIndex, force3D: true
  });
};

type CardSwapProps = {
  width?: number;
  height?: number;
  cardDistance?: number;
  verticalDistance?: number;
  delay?: number;
  pauseOnHover?: boolean;
  wheelToSwap?: boolean;
  onCardClick?: (index: number) => void;
  skewAmount?: number;
  easing?: "elastic" | "smooth";
  children: React.ReactNode;
};

export default function CardSwap({
  width = 500, height = 400, cardDistance = 60, verticalDistance = 70,
  delay = 5000, pauseOnHover = false, wheelToSwap = false, onCardClick, skewAmount = 6,
  easing = "elastic", children
}: CardSwapProps) {
  const config = easing === "elastic"
    ? { ease: "elastic.out(0.6,0.9)", durDrop: 2, durMove: 2, durReturn: 2, promoteOverlap: 0.9, returnDelay: 0.05 }
    : { ease: "power1.inOut", durDrop: 0.8, durMove: 0.8, durReturn: 0.8, promoteOverlap: 0.45, returnDelay: 0.2 };
  const childArr = useMemo(() => Children.toArray(children), [children]);
  const refs = useMemo(() => childArr.map(() => React.createRef<HTMLDivElement>()), [childArr]);
  const order = useRef(Array.from({ length: childArr.length }, (_, index) => index));
  const timelineRef = useRef<gsap.core.Timeline | null>(null);
  const intervalRef = useRef<number | undefined>(undefined);
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const total = refs.length;
    order.current = Array.from({ length: total }, (_, index) => index);
    refs.forEach((ref, index) => placeNow(ref.current, makeSlot(index, cardDistance, verticalDistance, total), skewAmount));

    const swap = (direction: 1 | -1 = 1) => {
      if (order.current.length < 2) return;
      if (direction === -1) {
        const back = order.current[order.current.length - 1];
        const rest = order.current.slice(0, -1);
        const backElement = refs[back].current;
        if (!backElement) return;
        timelineRef.current?.kill();
        const timeline = gsap.timeline();
        timelineRef.current = timeline;
        timeline.set(backElement, { zIndex: total + 1 });
        rest.forEach((index, position) => {
          const element = refs[index].current;
          if (!element) return;
          const slot = makeSlot(position + 1, cardDistance, verticalDistance, total);
          timeline.to(element, { x: slot.x, y: slot.y, z: slot.z, duration: config.durMove, ease: config.ease }, position * 0.08);
          timeline.set(element, { zIndex: slot.zIndex }, position * 0.08);
        });
        const frontSlot = makeSlot(0, cardDistance, verticalDistance, total);
        timeline.to(backElement, { x: frontSlot.x, y: frontSlot.y, z: frontSlot.z, duration: config.durReturn, ease: config.ease }, 0);
        timeline.call(() => { order.current = [back, ...rest]; });
        return;
      }
      const [front, ...rest] = order.current;
      const frontElement = refs[front].current;
      if (!frontElement) return;
      timelineRef.current?.kill();
      const timeline = gsap.timeline();
      timelineRef.current = timeline;
      timeline.to(frontElement, { y: "+=500", duration: config.durDrop, ease: config.ease });
      timeline.addLabel("promote", `-=${config.durDrop * config.promoteOverlap}`);
      rest.forEach((index, position) => {
        const element = refs[index].current;
        if (!element) return;
        const slot = makeSlot(position, cardDistance, verticalDistance, total);
        timeline.set(element, { zIndex: slot.zIndex }, "promote");
        timeline.to(element, { x: slot.x, y: slot.y, z: slot.z, duration: config.durMove, ease: config.ease }, `promote+=${position * 0.15}`);
      });
      const backSlot = makeSlot(total - 1, cardDistance, verticalDistance, total);
      timeline.addLabel("return", `promote+=${config.durMove * config.returnDelay}`);
      timeline.call(() => gsap.set(frontElement, { zIndex: backSlot.zIndex }), undefined, "return");
      timeline.to(frontElement, { x: backSlot.x, y: backSlot.y, z: backSlot.z, duration: config.durReturn, ease: config.ease }, "return");
      timeline.call(() => { order.current = [...rest, front]; });
    };

    const start = () => { intervalRef.current = window.setInterval(() => swap(1), delay); };
    swap(1);
    start();
    const node = container.current;
    const pause = () => { timelineRef.current?.pause(); window.clearInterval(intervalRef.current); };
    const resume = () => { timelineRef.current?.play(); window.clearInterval(intervalRef.current); start(); };
    let lastWheelAt = 0;
    const onWheel = (event: WheelEvent) => {
      if (!wheelToSwap || Math.abs(event.deltaY) < 4) return;
      event.preventDefault();
      const now = performance.now();
      if (now - lastWheelAt < 520) return;
      lastWheelAt = now;
      timelineRef.current?.play();
      swap(event.deltaY < 0 ? -1 : 1);
    };
    if (pauseOnHover && node) {
      node.addEventListener("mouseenter", pause);
      node.addEventListener("mouseleave", resume);
      node.addEventListener("focusin", pause);
      node.addEventListener("focusout", resume);
    }
    if (wheelToSwap && node) node.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      if (node) {
        node.removeEventListener("mouseenter", pause);
        node.removeEventListener("mouseleave", resume);
        node.removeEventListener("focusin", pause);
        node.removeEventListener("focusout", resume);
        node.removeEventListener("wheel", onWheel);
      }
      window.clearInterval(intervalRef.current);
      timelineRef.current?.kill();
      refs.forEach((ref) => { if (ref.current) gsap.killTweensOf(ref.current); });
    };
  }, [cardDistance, verticalDistance, delay, pauseOnHover, wheelToSwap, skewAmount, easing, refs, config.durDrop, config.durMove, config.durReturn, config.ease, config.promoteOverlap, config.returnDelay]);

  const rendered = childArr.map((child, index) => isValidElement<CardProps>(child)
    ? cloneElement(child, {
        key: index,
        ref: refs[index],
        style: { width, height, ...(child.props.style ?? {}) },
        onClick: (event: React.MouseEvent<HTMLDivElement>) => { child.props.onClick?.(event); onCardClick?.(index); }
      } as CardProps & { ref: React.Ref<HTMLDivElement> })
    : child);

  return <div ref={container} className={styles.container} style={{ width, height }}>{rendered}</div>;
}
