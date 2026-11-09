// Constants, URLs, and path helpers for the MIT OCW connector.

export const SEARCH_URL = "https://open.mit.edu/api/v0/search/";
export const SITE_BASE = "https://ocw.mit.edu";

/**
 * Concurrency limit when fetching resource pages in lecture video galleries.
 */
export const FETCH_CONCURRENCY = 5;

export const LINK_PATTERN = /^\/courses\/[^/]+\/(pages|resources)\//;

export const FILE_EXT_PATTERN =
  /\.(pdf|docx?|pptx?|xlsx?|zip|csv|txt|srt|vtt|mp4|mp3|jpe?g|png|gif)(?:[?#].*)?$/i;

/**
 * Converts a relative or root-relative path to an absolute MIT OCW URL.
 */
export function absoluteUrl(maybeRelative?: string | null): string | undefined {
  if (!maybeRelative) return undefined;
  return maybeRelative.indexOf("http") === 0 ? maybeRelative : SITE_BASE + maybeRelative;
}

/**
 * Strips the MIT OCW origin prefix from a URL to get the root-relative path.
 */
export function toSitePath(href?: string | null): string | null {
  if (!href) return null;
  if (href.indexOf(SITE_BASE) === 0) return href.slice(SITE_BASE.length) || "/";
  return href;
}
