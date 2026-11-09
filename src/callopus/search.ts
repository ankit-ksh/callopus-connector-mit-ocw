// What Callopus asks of MIT OCW: a search and a pasted address.
import type { CatalogCourseEntry, ParsedUrlInput } from "@callopus/course-model";
import type { ConnectorContext } from "@callopus/connector-sdk";
import { searchCourses } from "../api/search";
import type { SearchHit } from "../api/search";
import { NAMESPACE_PREFIX } from "./ids";

export function toCatalogEntry(hit: SearchHit): CatalogCourseEntry | null {
  const src = hit._source || {};
  const runs = src.runs || [];
  const run = runs[0] || {};
  const slug = (run.slug || "").replace(/^courses\//, "");
  if (!slug) return null;
  return {
    code: src.coursenum || slug,
    name: src.title || slug,
    courseId: NAMESPACE_PREFIX + slug,
  };
}

/**
 * Searches MIT's courses and returns them as catalog entries.
 */
export async function search(query: string, ctx: ConnectorContext): Promise<CatalogCourseEntry[]> {
  const hits = await searchCourses(ctx, query);
  const out: CatalogCourseEntry[] = [];
  for (const hit of hits) {
    const entry = toCatalogEntry(hit);
    if (entry) out.push(entry);
  }
  return out;
}

/**
 * Validates and extracts the course slug from an ocw.mit.edu URL.
 */
export function parseUrl(raw: unknown): ParsedUrlInput {
  const input = String(raw || "").trim();
  if (!input) return { ok: false, error: "Enter an MIT OpenCourseWare course URL." };

  const match = /ocw\.mit\.edu\/courses\/([^/?#\s]+)/i.exec(input);
  if (!match) {
    return {
      ok: false,
      error:
        "Enter a full ocw.mit.edu course URL, e.g. https://ocw.mit.edu/courses/6-0001-introduction-to-computer-science-and-programming-in-python-fall-2016/.",
    };
  }

  const slug = match[1].toLowerCase();
  return { ok: true, courseId: NAMESPACE_PREFIX + slug, label: slug };
}
