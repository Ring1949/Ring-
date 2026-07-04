import Script from "next/script";
import { readLegacyBody } from "@/lib/legacy-html";

export default function HomePage() {
  const bodyHtml = readLegacyBody("index.html");
  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link href="https://fonts.googleapis.com/css2?family=Manrope:wght@300;400;500;600;700;800&family=Noto+Sans+SC:wght@300;400;500;600;700;800&display=swap" rel="stylesheet" />
      <link rel="stylesheet" href="/styles.css?v=20260624-1" />
      <link rel="stylesheet" href="/glass-surface.css?v=20260704-1" />
      <div dangerouslySetInnerHTML={{ __html: bodyHtml }} />
      <Script src="/glass-surface.js?v=20260702-1" strategy="afterInteractive" />
      <Script src="/common.js?v=20260623-1" strategy="afterInteractive" />
      <Script src="/script.js?v=20260624-2" strategy="afterInteractive" />
    </>
  );
}
