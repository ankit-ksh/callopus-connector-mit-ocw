// Video galleries on MIT OCW.
import type { ConnectorContext } from "@callopus/connector-sdk";
import { fetchHtml, parseHtml, text } from "./dom";

/**
 * Checks whether an href points to an MIT OCW video gallery.
 */
export function isGalleryHref(href: string): boolean {
  return /\/video_galleries\//.test(href);
}

/** One video card of a gallery. */
export interface GalleryCard {
  href: string;
  videoId: string;
  title: string;
}

/**
 * Reads the video cards of a gallery page.
 */
export async function fetchGalleryCards(ctx: ConnectorContext, href: string): Promise<GalleryCard[]> {
  const doc = parseHtml(ctx, await fetchHtml(ctx, href));
  const cards: GalleryCard[] = [];

  for (const card of Array.from(doc.querySelectorAll(".video-gallery-card"))) {
    const link = card.querySelector("a.video-link");
    const thumb = card.querySelector("img.thumbnail");
    const titleEl = card.querySelector("h5.video-title");
    const cardHref = link && link.getAttribute("href");
    const thumbSrc = thumb && thumb.getAttribute("src");
    const videoIdMatch = thumbSrc && /img\.youtube\.com\/vi\/([A-Za-z0-9_-]+)\//.exec(thumbSrc);
    if (!cardHref || !videoIdMatch) continue;
    cards.push({ href: cardHref, videoId: videoIdMatch[1], title: text(titleEl) });
  }
  return cards;
}
