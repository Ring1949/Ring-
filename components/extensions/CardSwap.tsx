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
  const isAnimating = useRef(false);
  const wheelAccumulator = useRef(0);
  const wheelGestureTriggered = useRef(false);
  const userControlled = useRef(false);
  const timelineRef = useRef<gsap.core.Timeline | null>(null);
  const intervalRef = useRef<number | undefined>(undefined);
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const total = refs.length;
    order.current = Array.from({ length: total }, (_, index) => index);
    refs.forEach((ref, index) => placeNow(ref.current, makeSlot(index, cardDistance, verticalDistance, total), skewAmount));

    const duration = wheelToSwap ? 0.68 : config.durMove;
    const ease = wheelToSwap ? "power3.inOut" : config.ease;

    const normalizeOrder = (nextOrder = order.current) => {
      nextOrder.forEach((index, position) => {
        placeNow(refs[index].current, makeSlot(position, cardDistance, verticalDistance, total), skewAmount);
      });
    };

    const moveCards = (direction: "next" | "prev") => {
      if (isAnimating.current || order.current.length < 2) return false;
      const currentOrder = [...order.current];
      const nextOrder = direction === "prev"
        ? [currentOrder[currentOrder.length - 1], ...currentOrder.slice(0, -1)]
        : [...currentOrder.slice(1), currentOrder[0]];
      isAnimating.current = true;
      const timeline = gsap.timeline({
        onComplete: () => {
          order.current = nextOrder;
          normalizeOrder(nextOrder);
          wheelAccumulator.current = 0;
          isAnimating.current = false;
          timelineRef.current = null;
        }
      });
      timelineRef.current = timeline;
      nextOrder.forEach((index, slotIndex) => {
        const element = refs[index].current;
        if (!element) return;
        const slot = makeSlot(slotIndex, cardDistance, verticalDistance, total);
        timeline.to(element, {
          x: slot.x, y: slot.y, z: slot.z, skewY: skewAmount,
          duration, ease, force3D: true
        }, 0);
      });
      timeline.call(() => {
        nextOrder.forEach((index, slotIndex) => {
          const element = refs[index].current;
          if (element) gsap.set(element, { zIndex: makeSlot(slotIndex, cardDistance, verticalDistance, total).zIndex });
        });
      }, undefined, duration / 2);
      return true;
    };

    const start = () => {
      window.clearInterval(intervalRef.current);
      if (!userControlled.current) intervalRef.current = window.setInterval(() => moveCards("next"), delay);
    };
    start();
    const node = container.current;
    const pause = () => { window.clearInterval(intervalRef.current); };
    const resume = () => { if (!userControlled.current) start(); };
    let wheelReleaseTimer: number | undefined;
    const onWheel = (event: WheelEvent) => {
      if (!wheelToSwap || Math.abs(event.deltaY) < 0.5) return;
      event.preventDefault();
      window.clearTimeout(wheelReleaseTimer);
      wheelReleaseTimer = window.setTimeout(() => {
        wheelGestureTriggered.current = false;
        wheelAccumulator.current = 0;
      }, 420);
      if (isAnimating.current || wheelGestureTriggered.current) return;
      wheelAccumulator.current += event.deltaY;
      const threshold = 60;
      if (Math.abs(wheelAccumulator.current) < threshold) return;
      const direction = wheelAccumulator.current > 0 ? "next" : "prev";
      wheelAccumulator.current = 0;
      wheelGestureTriggered.current = true;
      userControlled.current = true;
      window.clearInterval(intervalRef.current);
      moveCards(direction);
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
      window.clearTimeout(wheelReleaseTimer);
      timelineRef.current?.kill();
      timelineRef.current = null;
      isAnimating.current = false;
      wheelAccumulator.current = 0;
      wheelGestureTriggered.current = false;
      refs.forEach((ref) => { if (ref.current) gsap.killTweensOf(ref.current); });
    };
  }, [cardDistance, verticalDistance, delay, pauseOnHover, wheelToSwap, skewAmount, easing, refs, config.durMove, config.ease]);

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
