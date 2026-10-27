"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

// Keep below-the-fold and interaction-only experiences out of the initial
// homepage chunk. They are requested shortly before the user reaches them.
const PortfolioLibrary = dynamic(() => import("@/components/portfolio/PortfolioLibrary"), { ssr: false });
const HomeExtensions = dynamic(() => import("@/components/extensions/HomeExtensions"), { ssr: false });
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
    const mounts = [
      { selector: "#works-library", hostId: "portfolio-library-react", className: "portfolio-library-mounted", setHost: setLibraryHost },
      { selector: "#extensions", hostId: "home-extensions-react", className: "home-extensions-mounted", setHost: setExtensionsHost }
    ];
    const cleanups: Array<() => void> = [];
    const mountBySelector = new Map<string, () => void>();

    mounts.forEach(({ selector, hostId, className, setHost }) => {
      const section = document.querySelector<HTMLElement>(selector);
      if (!section) return;
      let mounted = false;
      const mount = () => {
        if (mounted) return;
        mounted = true;
        const legacyChildren = [...section.children] as HTMLElement[];
        legacyChildren.forEach((child) => { child.hidden = true; });
        section.classList.add(className);
        const host = document.createElement("div");
        host.id = hostId;
        section.appendChild(host);
        setHost(host);
        cleanups.push(() => {
          host.remove();
          section.classList.remove(className);
          legacyChildren.forEach((child) => { child.hidden = false; });
        });
      };
      mountBySelector.set(selector, mount);
      const observer = new IntersectionObserver((entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          observer.disconnect();
          mount();
        }
      }, { rootMargin: "800px 0px" });
      observer.observe(section);
      cleanups.push(() => observer.disconnect());
    });

    const mountBeforeAnchorNavigation = (event: MouseEvent) => {
      const link = (event.target as HTMLElement | null)?.closest<HTMLAnchorElement>('a[href^="#"]');
      const selector = link?.getAttribute("href") || "";
      mountBySelector.get(selector)?.();
    };
    document.addEventListener("click", mountBeforeAnchorNavigation, true);
    cleanups.push(() => document.removeEventListener("click", mountBeforeAnchorNavigation, true));

    mountBySelector.get(window.location.hash)?.();

    return () => cleanups.reverse().forEach((cleanup) => cleanup());
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
