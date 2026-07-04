import Script from "next/script";
import { readLegacyBody } from "@/lib/legacy-html";

type LegacyPageProps = {
  html: string;
  styles?: string[];
  scripts?: string[];
};

export function LegacyPage({ html, styles = [], scripts = [] }: LegacyPageProps) {
  const bodyHtml = readLegacyBody(html);
  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link href="https://fonts.googleapis.com/css2?family=Manrope:wght@300;400;500;600;700;800&family=Noto+Sans+SC:wght@300;400;500;600;700;800&display=swap" rel="stylesheet" />
      {styles.map((href) => <link key={href} rel="stylesheet" href={href} />)}
      <link rel="stylesheet" href="/glass-surface.css?v=20260704-1" />
      <div dangerouslySetInnerHTML={{ __html: bodyHtml }} />
      <Script src="/glass-surface.js?v=20260702-1" strategy="afterInteractive" />
      {scripts.map((src) => <Script key={src} src={src} strategy="afterInteractive" />)}
    </>
  );
}
