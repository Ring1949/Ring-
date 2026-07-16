import Script from "next/script";
import InspirationGalaxy from "./InspirationGalaxy";

export default function Page() {
  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link href="https://fonts.googleapis.com/css2?family=Manrope:wght@300;400;500;600;700;800&family=Noto+Sans+SC:wght@300;400;500;600;700;800&display=swap" rel="stylesheet" />
      <link rel="stylesheet" href="/styles.css?v=20260704-2" />
      
      <InspirationGalaxy />
      <Script src="/common.js?v=20260716-2" strategy="afterInteractive" />
    </>
  );
}
