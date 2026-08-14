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
    skewY: skew, rotationZ: 0, transformOrigin: "center center", zIndex: slot.zIndex, force3D: true
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

    const extractDuration = 0.38;
    const promoteDuration = 0.48;
    const insertDuration = 0.5;
    const stagger = 0.06;
    const insertEase = easing === "smooth" ? "power3.out" : "expo.out";

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
      const movingIndex = direction === "next" ? currentOrder[0] : currentOrder[currentOrder.length - 1];
      const movingElement = refs[movingIndex].current;
      if (!movingElement) return false;
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

      if (direction === "next") {
        const [, ...rest] = currentOrder;
        const backSlot = makeSlot(total - 1, cardDistance, verticalDistance, total);
        timeline.to(movingElement, {
          x: "-=28", y: "+=400", rotationZ: -3,
          duration: extractDuration, ease: "power3.in", force3D: true
        }, 0);
        rest.forEach((index, slotIndex) => {
          const element = refs[index].current;
          if (!element) return;
          const target = makeSlot(slotIndex, cardDistance, verticalDistance, total);
          const startAt = 0.12 + slotIndex * stagger;
          timeline.to(element, {
            x: target.x, y: target.y, z: target.z,
            duration: promoteDuration, ease: "power3.inOut", force3D: true
          }, startAt);
        });
        timeline.call(() => {
          gsap.set(movingElement, { zIndex: backSlot.zIndex });
        }, undefined, 0.39);
        timeline.call(() => {
          rest.forEach((index, slotIndex) => {
            const element = refs[index].current;
            if (element) gsap.set(element, { zIndex: makeSlot(slotIndex, cardDistance, verticalDistance, total).zIndex });
          });
        }, undefined, 0.42);
        timeline.to(movingElement, {
          x: backSlot.x, y: backSlot.y, z: backSlot.z, rotationZ: 0,
          duration: insertDuration, ease: insertEase, force3D: true
        }, 0.43);
      } else {
        const rest = currentOrder.slice(0, -1);
        const frontSlot = makeSlot(0, cardDistance, verticalDistance, total);
        timeline.to(movingElement, {
          x: "+=30", y: "+=360", z: "+=80", rotationZ: 3,
          duration: extractDuration, ease: "power3.in", force3D: true
        }, 0);
        rest.forEach((index, position) => {
          const element = refs[index].current;
          if (!element) return;
          const target = makeSlot(position + 1, cardDistance, verticalDistance, total);
          const startAt = 0.12 + position * stagger;
          timeline.to(element, {
            x: target.x, y: target.y, z: target.z,
            duration: promoteDuration, ease: "power3.inOut", force3D: true
          }, startAt);
        });
        timeline.call(() => {
          rest.forEach((index, position) => {
            const element = refs[index].current;
            if (element) gsap.set(element, { zIndex: makeSlot(position + 1, cardDistance, verticalDistance, total).zIndex });
          });
        }, undefined, 0.39);
        timeline.call(() => {
          gsap.set(movingElement, { zIndex: frontSlot.zIndex });
        }, undefined, 0.41);
        timeline.to(movingElement, {
          x: frontSlot.x, y: frontSlot.y, z: frontSlot.z, rotationZ: 0,
          duration: 0.52, ease: insertEase, force3D: true
        }, 0.41);
      }
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
  }, [cardDistance, verticalDistance, delay, pauseOnHover, wheelToSwap, skewAmount, easing, refs]);

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
