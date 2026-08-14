"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import PortfolioLibrary from "@/components/portfolio/PortfolioLibrary";
import HomeExtensions from "@/components/extensions/HomeExtensions";

// These experiences are only visible after user interaction. Keep their large
// 3D and animation dependencies out of the homepage's initial JavaScript chunk.
const ContactLanyardOverlay = dynamic(() => import("@/components/contact/ContactLanyardOverlay"), { ssr: false });

export default function HomeInteractiveOverlays() {
  const [contactReady, setContactReady] = useState(false);
  const [libraryHost, setLibraryHost] = useState<HTMLElement | null>(null);
  const [extensionsHost, setExtensionsHost] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const openGraphFromHash = () => {
      if (window.location.hash === "#contact") setContactReady(true);
    };
    openGraphFromHash();
    window.addEventListener("hashchange", openGraphFromHash);
    return () => window.removeEventListener("hashchange", openGraphFromHash);
  }, []);

  useEffect(() => {
    const legacyLibrary = document.querySelector<HTMLElement>("#works-library");
    if (legacyLibrary) {
      const legacyChildren = [...legacyLibrary.children] as HTMLElement[];
      legacyChildren.forEach((child) => { child.hidden = true; });
      legacyLibrary.classList.add("portfolio-library-mounted");
      const host = document.createElement("div");
      host.id = "portfolio-library-react";
      legacyLibrary.appendChild(host);
      setLibraryHost(host);
      return () => {
        host.remove();
        legacyLibrary.classList.remove("portfolio-library-mounted");
        legacyChildren.forEach((child) => { child.hidden = false; });
      };
    }
  }, []);

  useEffect(() => {
    const legacyExtensions = document.querySelector<HTMLElement>("#extensions");
    if (!legacyExtensions) return;
    const legacyChildren = [...legacyExtensions.children] as HTMLElement[];
    legacyChildren.forEach((child) => { child.hidden = true; });
    legacyExtensions.classList.add("home-extensions-mounted");
    const host = document.createElement("div");
    host.id = "home-extensions-react";
    legacyExtensions.appendChild(host);
    setExtensionsHost(host);
    return () => {
      host.remove();
      legacyExtensions.classList.remove("home-extensions-mounted");
      legacyChildren.forEach((child) => { child.hidden = false; });
    };
  }, []);

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

  return <>{libraryHost && createPortal(<PortfolioLibrary />, libraryHost)}{extensionsHost && createPortal(<HomeExtensions />, extensionsHost)}{contactReady && <ContactLanyardOverlay initialOpen />}</>;
}
