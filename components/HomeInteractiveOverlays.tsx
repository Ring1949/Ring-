"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

// These experiences are only visible after user interaction. Keep their large
// 3D and animation dependencies out of the homepage's initial JavaScript chunk.
const ContactLanyardOverlay = dynamic(() => import("@/components/contact/ContactLanyardOverlay"), { ssr: false });

export default function HomeInteractiveOverlays() {
  const [contactReady, setContactReady] = useState(false);

  useEffect(() => {
    const onContactClick = (event: MouseEvent) => {
      if (contactReady || !(event.target as HTMLElement | null)?.closest("#contact-link")) return;
      event.preventDefault();
      event.stopPropagation();
      setContactReady(true);
    };
    document.addEventListener("click", onContactClick, true);
    return () => {
      document.removeEventListener("click", onContactClick, true);
    };
  }, [contactReady]);

  return contactReady ? <ContactLanyardOverlay initialOpen /> : null;
}
