"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import styles from "./ContactLanyardOverlay.module.css";

const Lanyard = dynamic(() => import("./Lanyard"), { ssr: false, loading: () => <div className={styles.lanyardLoading}>LANYARD</div> });
type ContactSettings = Record<string, string>;
const defaults: ContactSettings = { contact_title: "\u4e00\u8d77\u505a\u70b9\u4ec0\u4e48", contact_intro: "\u5982\u679c\u60f3\u804a\u804a\u5408\u4f5c\u3001\u6444\u5f71\u6216\u8bbe\u8ba1\uff0c\u53ef\u4ee5\u4ece\u8fd9\u91cc\u8054\u7cfb\u6211\u3002", contact_location: "\u6b66\u6c49 / \u53ef\u8fdc\u7a0b\u5408\u4f5c", contact_name: "RING", contact_phone: "18569569185", contact_role: "Visual Creator / Designer" };

export default function ContactLanyardOverlay() {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState("");
  const [settings, setSettings] = useState<ContactSettings>(defaults);
  useEffect(() => { const onClick = (event: MouseEvent) => { const target = event.target as HTMLElement | null; if (!target?.closest("#contact-link")) return; event.preventDefault(); event.stopPropagation(); setOpen(true); }; document.addEventListener("click", onClick, true); return () => document.removeEventListener("click", onClick, true); }, []);
  useEffect(() => { if (!open) return; let active = true; fetch("/api/settings").then((response) => response.ok ? response.json() : {}).then((data) => { if (active && data) setSettings((current) => ({ ...current, ...data })); }).catch(() => undefined); const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); }; document.documentElement.classList.add("contact-lanyard-open"); window.addEventListener("keydown", onKeyDown); return () => { active = false; document.documentElement.classList.remove("contact-lanyard-open"); window.removeEventListener("keydown", onKeyDown); }; }, [open]);
  const methods = useMemo(() => [{ label: "PHONE", value: settings.contact_phone || defaults.contact_phone, href: `tel:${settings.contact_phone || defaults.contact_phone}` }, { label: "NAME", value: settings.contact_name || defaults.contact_name }, { label: "ROLE", value: settings.contact_role || defaults.contact_role }], [settings]);
  if (!open) return null;
  const copyValue = async (value: string) => { await navigator.clipboard.writeText(value); setCopied("\u5df2\u590d\u5236\u5230\u526a\u8d34\u677f"); window.setTimeout(() => setCopied(""), 1600); };
  return <section className={styles.overlay} aria-label="Contact RING"><button className={styles.close} type="button" onClick={() => setOpen(false)} aria-label="\u5173\u95ed\u8054\u7cfb\u65b9\u5f0f">?</button><div className={styles.left}><div className={styles.ceiling} /><Lanyard position={[0, 0, 24]} gravity={[0, -40, 0]} frontImage="/assets/lanyard/ring-contact-front.svg" backImage="/assets/lanyard/ring-contact-back.svg" lanyardImage="/assets/lanyard/lanyard-band.svg" /></div><aside className={styles.info}><p>CONTACT CARD</p><h2>{settings.contact_title || defaults.contact_title}</h2><span>{settings.contact_intro || defaults.contact_intro}</span>{settings.contact_location ? <small>{settings.contact_location}</small> : null}<div className={styles.methods}>{methods.map((item) => item.href ? <a key={item.label} href={item.href}><b>{item.label}</b><span>{item.value}</span><i>?</i></a> : <button key={item.label} type="button" onClick={() => copyValue(item.value)}><b>{item.label}</b><span>{item.value}</span><i>\u590d\u5236</i></button>)}</div><small>{copied || "Press ESC to close"}</small></aside></section>;
}
