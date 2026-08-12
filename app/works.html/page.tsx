import Script from "next/script";
import { readLegacyBody } from "@/lib/legacy-html";

export default function WorksPage() {
  const bodyHtml = readLegacyBody("works.html");
  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link href="https://fonts.googleapis.com/css2?family=Manrope:wght@300;400;500;600;700&family=Noto+Sans+SC:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
      <link rel="stylesheet" href="/works.css?v=20260624-2" />
      <link rel="stylesheet" href="/works-enhancements.css?v=20260811-skill-library-1" />
      <link rel="stylesheet" href="/site-nav.css?v=20260812-unified-1" />
      <div dangerouslySetInnerHTML={{ __html: bodyHtml }} />
      <Script src="/common.js?v=20260812-unified-nav-1" strategy="afterInteractive" />
      <Script src="/works.js?v=20260811-skill-library-1" strategy="afterInteractive" />
    </>
  );
}

