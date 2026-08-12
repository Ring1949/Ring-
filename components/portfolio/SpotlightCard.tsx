"use client";

import type { CSSProperties, MouseEvent, ReactNode } from "react";

type SpotlightCardProps = {
  children: ReactNode;
  className?: string;
  spotlightColor?: string;
};

export default function SpotlightCard({ children, className = "", spotlightColor = "rgba(0, 229, 255, 0.2)" }: SpotlightCardProps) {
  const moveSpotlight = (event: MouseEvent<HTMLElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    event.currentTarget.style.setProperty("--mouse-x", `${event.clientX - rect.left}px`);
    event.currentTarget.style.setProperty("--mouse-y", `${event.clientY - rect.top}px`);
  };

  return (
    <article
      className={`spotlight-card ${className}`.trim()}
      onMouseMove={moveSpotlight}
      style={{ "--spotlight-color": spotlightColor } as CSSProperties}
    >
      {children}
    </article>
  );
}
