// MIT's OpenSearch API.
import type { ConnectorContext } from "@callopus/connector-sdk";
import { SEARCH_URL } from "./constants";

/** One hit of a search, as the API sends it. */
export interface SearchHit {
  _source?: { coursenum?: string; title?: string; runs?: Array<{ slug?: string }> };
}

export function buildSearchBody(query?: string, opts?: { from?: number; size?: number }): unknown {
  const from = opts?.from || 0;
  const size = opts?.size || 20;
  const trimmed = (query || "").trim();
  return {
    from,
    size,
    post_filter: {
      bool: {
        must: [
          { bool: { should: [{ term: { "object_type.keyword": "course" } }] } },
          { bool: { should: [{ term: { offered_by: "OCW" } }] } },
        ],
      },
    },
    query: trimmed
      ? {
          bool: {
            must: [
              { term: { object_type: "course" } },
              {
                multi_match: {
                  query: trimmed,
                  fields: [
                    "title.english^3",
                    "short_description.english^2",
                    "full_description.english",
                    "topics",
                    "platform",
                    "course_id",
                    "offered_by",
                    "department_name",
                    "course_feature_tags",
                  ],
                },
              },
            ],
          },
        }
      : { match_all: {} },
  };
}

/**
 * Executes a live query against MIT's OpenSearch API.
 */
export async function searchCourses(ctx: ConnectorContext, query: string): Promise<SearchHit[]> {
  const resp = await ctx.fetch(SEARCH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(buildSearchBody(query)),
  });
  if (!resp.ok) throw new Error(`MIT OCW search ${resp.status}`);
  const body = await resp.json<{ hits?: { hits?: unknown[] } }>();
  // The API's hits are untyped JSON; SearchHit lists the fields read from them.
  return (body?.hits?.hits || []) as SearchHit[];
}
