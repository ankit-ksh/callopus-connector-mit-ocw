// DOM helpers and fetching for MIT OCW scraping.
import type { ConnectorContext } from "@callopus/connector-sdk";
import { SITE_BASE } from "./constants";

/**
 * Normalizes text extracted from a DOM element, collapsing whitespace.
 */
export function cleanText(el: Element | Node | null | undefined): string {
  return el ? (el.textContent || "").trim().replace(/\s+/g, " ") : "";
}

/**
 * Extracts trimmed text from an element without internal whitespace collapsing.
 */
export function text(el: Element | Node | null | undefined): string {
  return el ? (el.textContent || "").trim() : "";
}

/**
 * Returns direct element children matching a tag name and optional CSS class.
 */
export function directChildElements(
  el: Element | null | undefined,
  tagName: string,
  className?: string,
): Element[] {
  if (!el) return [];
  const wanted = tagName.toUpperCase();
  const out: Element[] = [];
  for (const child of Array.from(el.children)) {
    if (child.tagName !== wanted) continue;
    if (className && !child.classList.contains(className)) continue;
    out.push(child);
  }
  return out;
}

/**
 * Rewrites root-relative link href and media src attributes to absolute URLs.
 */
export function absolutizeLinks(el: Element | null | undefined): Element | null | undefined {
  if (!el) return el;
  for (const a of Array.from(el.querySelectorAll("a[href]"))) {
    const href = a.getAttribute("href");
    if (href && href.charAt(0) === "/") a.setAttribute("href", SITE_BASE + href);
  }
  for (const media of Array.from(el.querySelectorAll("img[src], source[src]"))) {
    const src = media.getAttribute("src");
    if (src && src.charAt(0) === "/") media.setAttribute("src", SITE_BASE + src);
  }
  return el;
}

/**
 * Returns the inner HTML of an element after absolutizing relative links.
 */
export function innerHtml(el: Element | null | undefined): string {
  if (!el) return "";
  const absolutized = absolutizeLinks(el);
  return (absolutized?.innerHTML || "").trim();
}

/**
 * Parses an HTML string into a queryable Document using ctx.parseHtml or DOMParser.
 */
export function parseHtml(ctx: ConnectorContext, html: string): Document {
  if (typeof ctx.parseHtml === "function") {
    return ctx.parseHtml(html);
  }
  return new DOMParser().parseFromString(String(html), "text/html");
}

/**
 * Fetches an HTML page from MIT OCW and returns its text body.
 */
export async function fetchHtml(ctx: ConnectorContext, path: string): Promise<string> {
  const url = path.indexOf("http") === 0 ? path : SITE_BASE + path;
  const resp = await ctx.fetch(url);
  if (!resp.ok) throw new Error(`MIT OCW ${resp.status} (${path})`);
  return resp.text();
}
