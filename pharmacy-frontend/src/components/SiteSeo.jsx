import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { PHARMACY_DISPLAY_NAME } from "../config/appBranding";
import { resolveRouteSeo, siteAbsoluteOrigin, SITE_KEYWORDS, SITE_OG_DESCRIPTION } from "../config/siteSeo";

function upsertMeta(selector, create) {
  let el = document.querySelector(selector);
  if (!el) {
    el = create();
    document.head.appendChild(el);
  }
  return el;
}

export default function SiteSeo() {
  const { pathname } = useLocation();

  useEffect(() => {
    const { title, description } = resolveRouteSeo(pathname);
    document.title = title;

    upsertMeta('meta[name="description"]', () => {
      const m = document.createElement("meta");
      m.setAttribute("name", "description");
      return m;
    }).setAttribute("content", description);

    upsertMeta('meta[name="keywords"]', () => {
      const m = document.createElement("meta");
      m.setAttribute("name", "keywords");
      return m;
    }).setAttribute("content", SITE_KEYWORDS);

    upsertMeta('meta[name="author"]', () => {
      const m = document.createElement("meta");
      m.setAttribute("name", "author");
      return m;
    }).setAttribute("content", PHARMACY_DISPLAY_NAME);

    const og = (prop, content) => {
      upsertMeta(`meta[property="${prop}"]`, () => {
        const m = document.createElement("meta");
        m.setAttribute("property", prop);
        return m;
      }).setAttribute("content", content);
    };

    const origin = siteAbsoluteOrigin();
    const url = origin ? `${origin}${pathname}` : pathname;
    const image = origin ? `${origin}/pharmacy-favicon.svg` : "/pharmacy-favicon.svg";

    og("og:site_name", PHARMACY_DISPLAY_NAME);
    og("og:title", title);
    og("og:description", description || SITE_OG_DESCRIPTION);
    og("og:type", "website");
    og("og:locale", "ar");
    og("og:url", url);
    og("og:image", image);
    og("og:image:alt", PHARMACY_DISPLAY_NAME);

    upsertMeta('meta[name="twitter:card"]', () => {
      const m = document.createElement("meta");
      m.setAttribute("name", "twitter:card");
      return m;
    }).setAttribute("content", "summary_large_image");

    upsertMeta('meta[name="twitter:title"]', () => {
      const m = document.createElement("meta");
      m.setAttribute("name", "twitter:title");
      return m;
    }).setAttribute("content", title);

    upsertMeta('meta[name="twitter:description"]', () => {
      const m = document.createElement("meta");
      m.setAttribute("name", "twitter:description");
      return m;
    }).setAttribute("content", description || SITE_OG_DESCRIPTION);

    let canonical = document.querySelector('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.setAttribute("rel", "canonical");
      document.head.appendChild(canonical);
    }
    canonical.setAttribute("href", url);
  }, [pathname]);

  return null;
}
