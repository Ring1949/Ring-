"use client";

import Link from "next/link";
import type { ComponentProps, MouseEvent } from "react";

const HOME_HISTORY_KEY = "ring:home-history-entry";
const MAX_SNAPSHOT_AGE = 30 * 60 * 1000;

type HomeHistoryEntry = {
  historyLength: number;
  href: string;
  createdAt: number;
};

export function rememberHomeHistoryEntry() {
  try {
    const entry: HomeHistoryEntry = {
      historyLength: window.history.length,
      href: window.location.href,
      createdAt: Date.now()
    };
    window.sessionStorage.setItem(HOME_HISTORY_KEY, JSON.stringify(entry));
  } catch {
    // Navigation still works normally when session storage is unavailable.
  }
}

function readHomeHistoryEntry() {
  try {
    const entry = JSON.parse(window.sessionStorage.getItem(HOME_HISTORY_KEY) || "null") as HomeHistoryEntry | null;
    if (!entry || Date.now() - entry.createdAt > MAX_SNAPSHOT_AGE) return null;
    const source = new URL(entry.href);
    if (source.origin !== window.location.origin || source.pathname !== "/") return null;
    return entry;
  } catch {
    return null;
  }
}

type Props = Omit<ComponentProps<typeof Link>, "href">;

export default function HomeReturnLink({ onClick, ...props }: Props) {
  const returnToExistingHome = (event: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event);
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const entry = readHomeHistoryEntry();
    const distance = entry ? entry.historyLength - window.history.length : 0;
    if (!entry || distance >= 0) return;
    event.preventDefault();
    window.sessionStorage.removeItem(HOME_HISTORY_KEY);
    window.sessionStorage.setItem("ring:home-returning", "1");
    window.history.go(distance);
  };

  return <Link {...props} href="/" onClick={returnToExistingHome} />;
}
