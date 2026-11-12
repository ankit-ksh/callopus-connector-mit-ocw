// Resources of MIT OCW as lessons, and link resolution.
import type { Lesson, LessonContent, LinkTarget, Section } from "@callopus/course-model";
import type { ConnectorContext } from "@callopus/connector-sdk";
import { FILE_EXT_PATTERN, LINK_PATTERN, absoluteUrl, toSitePath } from "../api/constants";
import type { NavNode } from "../api/nav";
import { flattenNavDescendants } from "../api/nav";
import { fetchResourcePage } from "../api/resource";
import { lesson } from "./lesson";
import { extractResourceFacts } from "./metadata";

/**
 * Scrapes an individual resource page (video, reading, PDF) into a Callopus Lesson.
 */
export async function scrapeResourcePage(
  ctx: ConnectorContext,
  href: string,
  fallbackTitle?: string,
): Promise<Lesson> {
  const { doc, title, content } = await fetchResourcePage(ctx, href, fallbackTitle);
  const resourceUrl = absoluteUrl(href);
  const extracted = extractResourceFacts(doc, resourceUrl);
  const details = extracted.facts;
  const authors = extracted.authors;

  if (content.kind === "video") {
    const youtubeUrl = `https://www.youtube.com/watch?v=${content.videoId}`;
    const { downloadUrl, transcriptPdfUrl, captionsSrc } = content;

    const videoDetails = details.slice();
    videoDetails.push({ label: "YouTube Video", value: youtubeUrl, href: youtubeUrl });
    if (downloadUrl) videoDetails.push({ label: "Video Download", value: downloadUrl, href: downloadUrl });
    if (transcriptPdfUrl) {
      videoDetails.push({ label: "Transcript PDF", value: transcriptPdfUrl, href: transcriptPdfUrl });
    }

    return lesson(href, title, "video", {
      video: {
        youtubeId: content.videoId,
        transcripts: captionsSrc ? [{ lang: "eng", url: captionsSrc }] : undefined,
      },
      body: { html: content.descriptionHtml },
      details: videoDetails,
      authors,
      sourceUrl: resourceUrl,
    });
  }

  if (content.kind === "pdf") {
    const pdfDetails = details.concat([{ label: "PDF File", value: content.pdfUrl, href: content.pdfUrl }]);
    return lesson(href, title, "pdf", {
      pdfUrl: content.pdfUrl,
      details: pdfDetails,
      authors,
      sourceUrl: resourceUrl,
    });
  }

  return lesson(href, title, "reading", {
    body: { html: content.bodyHtml },
    details,
    authors,
    sourceUrl: resourceUrl,
  });
}

/**
 * Builds a Section from a top-level nav node, scraping the root and generating stubs for sub-items.
 */
export async function buildPageSection(
  ctx: ConnectorContext,
  node: NavNode,
  courseAuthors?: string,
): Promise<Section> {
  const rootItem = await scrapeResourcePage(ctx, node.href, node.title);
  const subItems = flattenNavDescendants(node).map((d) => {
    const itemUrl = absoluteUrl(d.href);
    return lesson(d.href, d.title, "reading", {
      authors: rootItem.authors || courseAuthors,
      sourceUrl: itemUrl,
      details: itemUrl ? [{ label: "Original Resource", value: itemUrl, href: itemUrl }] : undefined,
    });
  });
  return { id: node.href, title: node.title, lessons: [rootItem].concat(subItems) };
}

/**
 * Fetches content for a deferred lesson stub.
 */
export async function fetchLesson(lessonId: string, ctx: ConnectorContext): Promise<LessonContent> {
  return scrapeResourcePage(ctx, lessonId);
}

/**
 * Says where a link to an MIT OCW page goes: the page itself, shown as a
 * lesson that belongs to no outline. Files and pages with nothing to show go
 * nowhere the connector knows (`null`).
 */
export async function resolveLink(href: string, ctx: ConnectorContext): Promise<LinkTarget | null> {
  const path = toSitePath(href);
  if (!path || !LINK_PATTERN.test(path) || FILE_EXT_PATTERN.test(path)) return null;
  try {
    const item = await scrapeResourcePage(ctx, path);
    const text = item.body && "html" in item.body ? item.body.html : "";
    return item.video || text || item.pdfUrl ? { kind: "page", lesson: item } : null;
  } catch {
    return null;
  }
}
