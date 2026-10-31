import Script from "next/script";
import { readLegacyBody } from "@/lib/legacy-html";
import HomeInteractiveOverlays from "@/components/HomeInteractiveOverlays";
import { fallbackHomePayload } from "@/lib/fallback-data";

export default function HomePage() {
  const bodyHtml = readLegacyBody("index.html");
  const initialHome = JSON.stringify({ ...fallbackHomePayload, database_preview: [] }).replace(/</g, "\\u003c");
  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link href="https://fonts.googleapis.com/css2?family=Manrope:wght@300;400;500;600;700;800&display=swap" rel="stylesheet" />
      <link rel="stylesheet" href="/styles.css?v=20260812-spotlight-library-2" />
      <div dangerouslySetInnerHTML={{ __html: bodyHtml }} />
      <script id="home-bootstrap" type="application/json" dangerouslySetInnerHTML={{ __html: initialHome }} />
      <HomeInteractiveOverlays />
      <Script src="/common.js?v=20260812-nav-sync-1" strategy="afterInteractive" />
      <Script src="/script.js?v=20261031-fast-series-3" strategy="afterInteractive" />
    </>
  );
}
