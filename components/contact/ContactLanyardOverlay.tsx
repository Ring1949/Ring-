"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import styles from "./ContactLanyardOverlay.module.css";

const Lanyard = dynamic(() => import("./Lanyard"), {
  ssr: false,
  loading: () => <div className={styles.lanyardLoading}>LANYARD</div>
});

const contactMethods = [
  { label: "PHONE", value: "18569569185", href: "tel:18569569185" },
  { label: "NAME", value: "RING" },
  { label: "ROLE", value: "Visual Creator / Designer" }
];

export default function ContactLanyardOverlay() {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState("");

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const trigger = target?.closest("#contact-link");
      if (!trigger) return;
      event.preventDefault();
      event.stopPropagation();
      setOpen(true);
    };

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.documentElement.classList.add("contact-lanyard-open");
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.documentElement.classList.remove("contact-lanyard-open");
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  if (!open) return null;

  const copyValue = async (value: string) => {
    await navigator.clipboard.writeText(value);
    setCopied("已复制到剪贴板");
    window.setTimeout(() => setCopied(""), 1600);
  };

  return (
    <section className={styles.overlay} aria-label="Contact RING">
      <button className={styles.close} type="button" onClick={() => setOpen(false)} aria-label="关闭联系方式">
        ×
      </button>
      <div className={styles.left}>
        <div className={styles.ceiling} />
        <Lanyard
          position={[0, 0, 24]}
          gravity={[0, -42, 0]}
          fov={18}
          frontImage="/assets/lanyard/ring-card-front.svg"
          backImage="/assets/lanyard/ring-card-back.svg"
          lanyardImage="/assets/lanyard/lanyard-band.svg"
          lanyardWidth={1.08}
        />
      </div>
      <aside className={styles.info}>
        <p>CONTACT CARD</p>
        <h2>一起做点什么</h2>
        <span>这里是 RING 的联系入口。左侧吊牌可以被鼠标拖拽，松开后会根据物理绳索自然回弹。</span>
        <div className={styles.methods}>
          {contactMethods.map((item) =>
            item.href ? (
              <a key={item.label} href={item.href}>
                <b>{item.label}</b>
                <span>{item.value}</span>
                <i>↗</i>
              </a>
            ) : (
              <button key={item.label} type="button" onClick={() => copyValue(item.value)}>
                <b>{item.label}</b>
                <span>{item.value}</span>
                <i>复制</i>
              </button>
            )
          )}
        </div>
        <small>{copied || "Press ESC to close"}</small>
      </aside>
    </section>
  );
}
