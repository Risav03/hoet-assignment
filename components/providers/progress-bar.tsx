"use client";

import NProgress from "nprogress";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect } from "react";

NProgress.configure({ showSpinner: false, trickleSpeed: 200 });

export function ProgressBar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    NProgress.done();
  }, [pathname, searchParams]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = (e.target as HTMLElement).closest("a");
      if (!target) return;

      const href = target.getAttribute("href");
      if (!href) return;

      const isSameOrigin =
        href.startsWith("/") ||
        href.startsWith(window.location.origin);
      const isExternal =
        target.getAttribute("target") === "_blank";
      const isHashOnly = href.startsWith("#");
      const isDownload = target.hasAttribute("download");

      if (isSameOrigin && !isExternal && !isHashOnly && !isDownload) {
        NProgress.start();
      }
    };

    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, []);

  return null;
}
