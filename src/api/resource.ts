// Individual resource pages on MIT OCW.
import type { ConnectorContext } from "@callopus/connector-sdk";
import { absoluteUrl } from "./constants";
import { cleanText, fetchHtml, innerHtml, parseHtml } from "./dom";
import { findWholePagePdfUrl } from "./metadata";

/** What a resource page holds, by its kind. */
export type ResourceContent =
  | {
      kind: "video";
      videoId: string;
      descriptionHtml: string;
      downloadUrl?: string;
      transcriptPdfUrl?: string;
      captionsSrc?: string;
    }
  | { kind: "pdf"; pdfUrl: string }
  | { kind: "reading"; bodyHtml: string };

/** A resource page: its title, its parsed document and its content. */
export interface ResourcePage {
  doc: Document;
  title?: string;
  content: ResourceContent;
}

/**
 * Fetches an individual resource page (video, reading, PDF) and reads its content.
 */
export async function fetchResourcePage(
  ctx: ConnectorContext,
  href: string,
  fallbackTitle?: string,
): Promise<ResourcePage> {
  const doc = parseHtml(ctx, await fetchHtml(ctx, href));
  const title = cleanText(doc.querySelector("#course-title h2")) || fallbackTitle;
  const videoPage = doc.querySelector(".video-page");
  const video = videoPage && videoPage.querySelector("video[data-setup]");

  if (video) {
    const setup = video.getAttribute("data-setup") || "";
    const videoMatch = /youtube\.com\/embed\/([A-Za-z0-9_-]{6,})/.exec(setup);
    if (videoMatch) {
      const captions = video.querySelector('track[kind="captions"]');
      return {
        doc,
        title,
        content: {
          kind: "video",
          videoId: videoMatch[1],
          descriptionHtml: innerHtml(videoPage.querySelector(".description")),
          downloadUrl: absoluteUrl(video.getAttribute("data-downloadlink")) || undefined,
          transcriptPdfUrl: absoluteUrl(video.getAttribute("data-transcriptlink")),
          captionsSrc: (captions && absoluteUrl(captions.getAttribute("src"))) || undefined,
        },
      };
    }
  }

  const pdfUrl = findWholePagePdfUrl(doc);
  if (pdfUrl) return { doc, title, content: { kind: "pdf", pdfUrl } };

  const body = doc.querySelector(".resource-page-container") || doc.querySelector("main#course-content-section");
  return { doc, title, content: { kind: "reading", bodyHtml: innerHtml(body) } };
}
