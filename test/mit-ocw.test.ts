import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { DOMParser } from "linkedom";
import { CatalogCourseEntry, Course, LinkTarget } from "@callopus/course-model";
import { matchesLinkPattern } from "@callopus/connector-sdk";
import { createTestContext, expectValid } from "@callopus/connector-sdk/testing";
import ocwConnector from "../src/index";
import expectedParseUrlRoot from "./expected/parseUrl-root.json";
import expectedParseUrlRootRequests from "./expected/parseUrl-root.requests.json";
import expectedParseUrlSubpage from "./expected/parseUrl-subpage.json";
import expectedParseUrlSubpageRequests from "./expected/parseUrl-subpage.requests.json";
import expectedParseUrlInvalid from "./expected/parseUrl-invalid.json";
import expectedParseUrlInvalidRequests from "./expected/parseUrl-invalid.requests.json";
import expectedSearch from "./expected/search.json";
import expectedSearchRequests from "./expected/search.requests.json";
import expectedCourse from "./expected/fetchCourse-6-0001.json";
import expectedCourseRequests from "./expected/fetchCourse-6-0001.requests.json";
import expectedLesson from "./expected/fetchLesson-lecture-1.json";
import expectedLessonRequests from "./expected/fetchLesson-lecture-1.requests.json";
import expectedResolved from "./expected/resolveExternalLink-lecture-1.json";
import expectedResolvedRequests from "./expected/resolveExternalLink-lecture-1.requests.json";

// Provide DOMParser for Node test environment
globalThis.DOMParser = DOMParser as unknown as typeof globalThis.DOMParser;

const fixturesDir = fileURLToPath(new URL("fixtures", import.meta.url));
const searchJson = JSON.parse(fs.readFileSync(path.join(fixturesDir, "search.json"), "utf-8"));
const rootHtml = fs.readFileSync(path.join(fixturesDir, "course-root.html"), "utf-8");
const galleryHtml = fs.readFileSync(path.join(fixturesDir, "lecture-videos.html"), "utf-8");
const lect1Html = fs.readFileSync(path.join(fixturesDir, "lecture-1.html"), "utf-8");
const readingsHtml = fs.readFileSync(path.join(fixturesDir, "readings.html"), "utf-8");
const assignHtml = fs.readFileSync(path.join(fixturesDir, "assignments.html"), "utf-8");

const routes = {
  "https://open.mit.edu/api/v0/search/": searchJson,
  "https://ocw.mit.edu/courses/6-0001-introduction-to-computer-science-and-programming-in-python-fall-2016/":
    rootHtml,
  "https://ocw.mit.edu/courses/6-0001-introduction-to-computer-science-and-programming-in-python-fall-2016/video_galleries/lecture-videos/":
    galleryHtml,
  "https://ocw.mit.edu/courses/6-0001-introduction-to-computer-science-and-programming-in-python-fall-2016/resources/lecture-1-what-is-computation/":
    lect1Html,
  "https://ocw.mit.edu/courses/6-0001-introduction-to-computer-science-and-programming-in-python-fall-2016/pages/readings/":
    readingsHtml,
  "https://ocw.mit.edu/courses/6-0001-introduction-to-computer-science-and-programming-in-python-fall-2016/pages/assignments/":
    assignHtml,
};

describe("mit-ocw connector", () => {
  it("parses valid and deep course URLs, as recorded", async () => {
    const ctx1 = createTestContext({ routes });
    const res1 = await ocwConnector.parseUrl!(
      "https://ocw.mit.edu/courses/6-0001-introduction-to-computer-science-and-programming-in-python-fall-2016/",
      ctx1,
    );
    expect(res1).toEqual(expectedParseUrlRoot);
    expect(ctx1.requests).toEqual(expectedParseUrlRootRequests);

    const ctx2 = createTestContext({ routes });
    const res2 = await ocwConnector.parseUrl!(
      "https://ocw.mit.edu/courses/6-0001-introduction-to-computer-science-and-programming-in-python-fall-2016/pages/readings/",
      ctx2,
    );
    expect(res2).toEqual(expectedParseUrlSubpage);
    expect(ctx2.requests).toEqual(expectedParseUrlSubpageRequests);

    const ctxInvalid = createTestContext({ routes });
    const invalid = await ocwConnector.parseUrl!("https://example.com/not-ocw", ctxInvalid);
    expect(invalid).toEqual(expectedParseUrlInvalid);
    expect(ctxInvalid.requests).toEqual(expectedParseUrlInvalidRequests);
  });

  it("searches courses, as recorded", async () => {
    const ctx = createTestContext({ routes });
    const hits = await ocwConnector.search!("python", ctx);
    expect(hits).toEqual(expectedSearch);
    expect(ctx.requests).toEqual(expectedSearchRequests);
    for (const hit of hits) {
      expectValid(CatalogCourseEntry, hit);
    }
  });

  it("fetches course outline, as recorded", async () => {
    const ctx = createTestContext({ routes });
    const course = await ocwConnector.fetchCourse(
      "ocw_6-0001-introduction-to-computer-science-and-programming-in-python-fall-2016",
      ctx,
    );
    expect(course).toEqual(expectedCourse);
    expect(ctx.requests).toEqual(expectedCourseRequests);
    expectValid(Course, course);
  });

  it("fetches deferred lesson content, as recorded", async () => {
    const ctx = createTestContext({ routes });
    const lesson = await ocwConnector.fetchLesson!(
      "/courses/6-0001-introduction-to-computer-science-and-programming-in-python-fall-2016/resources/lecture-1-what-is-computation/",
      ctx,
    );
    expect(lesson).toEqual(expectedLesson);
    expect(ctx.requests).toEqual(expectedLessonRequests);
  });

  it("resolves a deep link to its page, as recorded", async () => {
    const ctx = createTestContext({ routes });
    const resolved = await ocwConnector.resolveLink!(
      "https://ocw.mit.edu/courses/6-0001-introduction-to-computer-science-and-programming-in-python-fall-2016/resources/lecture-1-what-is-computation/",
      ctx,
    );
    expect(resolved).toEqual({ kind: "page", lesson: expectedResolved });
    expect(ctx.requests).toEqual(expectedResolvedRequests);
    expectValid(LinkTarget, resolved);
  });

  it("says a file goes nowhere it knows, without a request", async () => {
    const ctx = createTestContext({ routes });
    const resolved = await ocwConnector.resolveLink!(
      "https://ocw.mit.edu/courses/6-0001-introduction-to-computer-science-and-programming-in-python-fall-2016/resources/lecture-1-what-is-computation/slides.pdf",
      ctx,
    );
    expect(resolved).toBeNull();
    expect(ctx.requests).toEqual([]);
  });

  describe("the manifest's links", () => {
    const { links } = JSON.parse(
      fs.readFileSync(path.join(fixturesDir, "..", "..", "callopus-connector.json"), "utf-8"),
    ).connectors[0];
    const claimed = (href: string) =>
      links.some((pattern: string) => matchesLinkPattern(href, pattern));

    it("are the course pages and resources", () => {
      expect(claimed("https://ocw.mit.edu/courses/18-01/pages/syllabus/")).toBe(true);
      expect(claimed("https://ocw.mit.edu/courses/18-01/resources/lecture-1/")).toBe(true);
    });

    it("leave everything else to the app", () => {
      expect(claimed("https://ocw.mit.edu/search/?q=physics")).toBe(false);
      expect(claimed("https://ocw.mit.edu/courses/18-01/")).toBe(false);
      expect(claimed("https://example.com/courses/18-01/pages/syllabus/")).toBe(false);
      expect(claimed("http://ocw.mit.edu/courses/18-01/pages/syllabus/")).toBe(false);
    });
  });
});
