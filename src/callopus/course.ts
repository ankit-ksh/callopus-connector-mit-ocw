// Main course scraper for MIT OCW.
import type { Course, Section } from "@callopus/course-model";
import type { ConnectorContext } from "@callopus/connector-sdk";
import { fetchCoursePage } from "../api/course";
import { isGalleryHref } from "../api/gallery";
import { expandGallery } from "./gallery";
import { NAMESPACE_PREFIX } from "./ids";
import { extractCourseDetails } from "./metadata";
import { buildPageSection } from "./resource";

/**
 * Builds a Course by scraping a course's static pages on MIT OCW.
 */
export async function fetchCourse(courseId: string, ctx: ConnectorContext): Promise<Course> {
  const slug = courseId.slice(NAMESPACE_PREFIX.length);
  const { doc, title: courseTitle, nav: navNodes } = await fetchCoursePage(ctx, slug);
  const meta = extractCourseDetails(doc, slug);

  const outline: Section[] = [];
  for (const node of navNodes) {
    try {
      if (isGalleryHref(node.href)) {
        outline.push({
          id: node.href,
          title: node.title,
          lessons: await expandGallery(ctx, node.href, meta.authors),
        });
      } else {
        outline.push(await buildPageSection(ctx, node, meta.authors));
      }
    } catch (err) {
      ctx.log(`MIT OCW: skipping section ${node.href} (${node.title})`, String(err));
    }
  }

  return {
    id: courseId,
    title: courseTitle,
    sections: outline.filter((section) => section.lessons.length > 0),
    details: meta.details,
    authors: meta.authors,
    sourceUrl: meta.sourceUrl,
  };
}
