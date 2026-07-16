import Script from "next/script";
import { readLegacyBody } from "@/lib/legacy-html";
import ContactLanyardOverlay from "@/components/contact/ContactLanyardOverlay";
import InspirationCloudOverlay from "@/components/InspirationCloudOverlay";

export default function HomePage() {
  const bodyHtml = readLegacyBody("index.html");
  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link href="https://fonts.googleapis.com/css2?family=Manrope:wght@300;400;500;600;700;800&family=Noto+Sans+SC:wght@300;400;500;600;700;800&display=swap" rel="stylesheet" />
      <link rel="stylesheet" href="/styles.css?v=20260716-6" />
      <div dangerouslySetInnerHTML={{ __html: bodyHtml }} />
      <ContactLanyardOverlay />
      <InspirationCloudOverlay />
      <Script src="/common.js?v=20260716-7" strategy="afterInteractive" />
      <Script src="/script.js?v=20260716-4" strategy="afterInteractive" />
    </>
  );
}
