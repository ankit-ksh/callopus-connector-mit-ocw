// The main page of a course on MIT OCW.
import type { ConnectorContext } from "@callopus/connector-sdk";
import { fetchHtml, parseHtml, text } from "./dom";
import { parseCourseNav } from "./nav";
import type { NavNode } from "./nav";

/** A course's main page: its parsed document, title and material list. */
export interface CoursePage {
  doc: Document;
  title: string;
  nav: NavNode[];
}

/**
 * Fetches a course's main page and reads its title and material list.
 */
export async function fetchCoursePage(ctx: ConnectorContext, slug: string): Promise<CoursePage> {
  const doc = parseHtml(ctx, await fetchHtml(ctx, `/courses/${slug}/`));
  const title = text(doc.querySelector("title")).split("|")[0].trim() || slug;

  const nav = parseCourseNav(doc);
  if (nav.length === 0) {
    throw new Error(
      "Could not find this course's material list — MIT OCW's page layout may have changed.",
    );
  }
  return { doc, title, nav };
}
