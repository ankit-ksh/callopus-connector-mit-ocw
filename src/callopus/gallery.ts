// Lecture gallery expansion.
import type { Lesson } from "@callopus/course-model";
import type { ConnectorContext } from "@callopus/connector-sdk";
import { FETCH_CONCURRENCY, absoluteUrl } from "../api/constants";
import { fetchGalleryCards } from "../api/gallery";
import { mapWithLimit } from "./concurrency";
import { lesson } from "./lesson";
import { scrapeResourcePage } from "./resource";

/**
 * Expands a video gallery page into full Lesson items, fetching each in parallel up to FETCH_CONCURRENCY.
 */
export async function expandGallery(
  ctx: ConnectorContext,
  href: string,
  courseAuthors?: string,
): Promise<Lesson[]> {
  const cards = await fetchGalleryCards(ctx, href);

  return mapWithLimit(cards, FETCH_CONCURRENCY, async (card) => {
    try {
      return await scrapeResourcePage(ctx, card.href, card.title);
    } catch (err) {
      ctx.log(`MIT OCW: falling back to gallery card data for ${card.href}`, String(err));
      const cardResourceUrl = absoluteUrl(card.href);
      const ytUrl = `https://www.youtube.com/watch?v=${card.videoId}`;
      const details = [];
      if (cardResourceUrl) details.push({ label: "Original Resource", value: cardResourceUrl, href: cardResourceUrl });
      details.push({ label: "YouTube Video", value: ytUrl, href: ytUrl });
      return lesson(card.href, card.title, "video", {
        video: { youtubeId: card.videoId },
        sourceUrl: cardResourceUrl,
        authors: courseAuthors,
        details,
      });
    }
  });
}
