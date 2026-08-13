"use client";

import Link from "next/link";
import Script from "next/script";
import { useEffect } from "react";

type SiteHeaderProps = { active?: "extensions" };

export default function SiteHeader({ active }: SiteHeaderProps) {
  useEffect(() => {
    const button = document.querySelector<HTMLButtonElement>(".site-nav .menu-button");
    const links = document.querySelector<HTMLElement>(".site-nav .nav-links");
    if (!button || !links) return;
    const toggle = () => {
      const open = !links.classList.contains("open");
      links.classList.toggle("open", open);
      button.setAttribute("aria-expanded", String(open));
    };
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") { links.classList.remove("open"); button.setAttribute("aria-expanded", "false"); } };
    button.setAttribute("aria-expanded", "false");
    button.addEventListener("click", toggle);
    document.addEventListener("keydown", close);
    return () => { button.removeEventListener("click", toggle); document.removeEventListener("keydown", close); };
  }, []);
  return <>
    <header className="nav nav-scrolled site-nav">
      <Link className="logo" href="/" aria-label="返回首页" />
      <nav className="nav-links" aria-label="主导航">
        <Link href="/">首页</Link>
        <Link href="/series.html">系列作品</Link>
        <Link href="/works.html?category=all">作品库</Link>
        <Link className={active === "extensions" ? "active" : ""} aria-current={active === "extensions" ? "page" : undefined} href="/extensions">扩展</Link>
        <Link href="/#about">关于</Link>
      </nav>
      <div className="nav-actions">
        <button className="avatar admin-login-trigger" type="button" aria-label="进入后台" />
        <button className="menu-button" type="button" aria-label="菜单"><i /><i /></button>
      </div>
    </header>
    <Script src="/common.js?v=20260813-extensions-1" strategy="afterInteractive" />
  </>;
}
