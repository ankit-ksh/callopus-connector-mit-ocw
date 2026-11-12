// src/api/constants.ts
var SEARCH_URL = "https://open.mit.edu/api/v0/search/";
var SITE_BASE = "https://ocw.mit.edu";
var FETCH_CONCURRENCY = 5;
var LINK_PATTERN = /^\/courses\/[^/]+\/(pages|resources)\//;
var FILE_EXT_PATTERN = /\.(pdf|docx?|pptx?|xlsx?|zip|csv|txt|srt|vtt|mp4|mp3|jpe?g|png|gif)(?:[?#].*)?$/i;
function absoluteUrl(maybeRelative) {
  if (!maybeRelative) return void 0;
  return maybeRelative.indexOf("http") === 0 ? maybeRelative : SITE_BASE + maybeRelative;
}
function toSitePath(href) {
  if (!href) return null;
  if (href.indexOf(SITE_BASE) === 0) return href.slice(SITE_BASE.length) || "/";
  return href;
}

// src/api/dom.ts
function cleanText(el) {
  return el ? (el.textContent || "").trim().replace(/\s+/g, " ") : "";
}
function text(el) {
  return el ? (el.textContent || "").trim() : "";
}
function directChildElements(el, tagName, className) {
  if (!el) return [];
  const wanted = tagName.toUpperCase();
  const out = [];
  for (const child of Array.from(el.children)) {
    if (child.tagName !== wanted) continue;
    if (className && !child.classList.contains(className)) continue;
    out.push(child);
  }
  return out;
}
function absolutizeLinks(el) {
  if (!el) return el;
  for (const a of Array.from(el.querySelectorAll("a[href]"))) {
    const href = a.getAttribute("href");
    if (href && href.charAt(0) === "/") a.setAttribute("href", SITE_BASE + href);
  }
  for (const media of Array.from(el.querySelectorAll("img[src], source[src]"))) {
    const src = media.getAttribute("src");
    if (src && src.charAt(0) === "/") media.setAttribute("src", SITE_BASE + src);
  }
  return el;
}
function innerHtml(el) {
  if (!el) return "";
  const absolutized = absolutizeLinks(el);
  return (absolutized?.innerHTML || "").trim();
}
function parseHtml(ctx, html) {
  if (typeof ctx.parseHtml === "function") {
    return ctx.parseHtml(html);
  }
  return new DOMParser().parseFromString(String(html), "text/html");
}
async function fetchHtml(ctx, path) {
  const url = path.indexOf("http") === 0 ? path : SITE_BASE + path;
  const resp = await ctx.fetch(url);
  if (!resp.ok) throw new Error(`MIT OCW ${resp.status} (${path})`);
  return resp.text();
}

// src/api/nav.ts
function parseNavNode(li) {
  const parent = li.querySelector(".course-nav-parent") || li;
  const a = parent.querySelector("a[href]");
  const href = a && a.getAttribute("href");
  if (!href || href.charAt(0) !== "/") return null;
  const childUl = directChildElements(li, "ul", "course-nav-child-nav")[0];
  const children = childUl ? parseNavList(childUl) : [];
  return { href, title: text(a), children };
}
function parseNavList(ul) {
  const out = [];
  for (const li of directChildElements(ul, "li", "course-nav-list-item")) {
    const node = parseNavNode(li);
    if (node) out.push(node);
  }
  return out;
}
function parseCourseNav(doc) {
  const nav = doc.querySelector("nav.course-nav");
  const topUl = nav && directChildElements(nav, "ul")[0];
  return topUl ? parseNavList(topUl) : [];
}
function flattenNavDescendants(node) {
  const result = [];
  for (const child of node.children || []) {
    result.push(child);
    for (const deeper of flattenNavDescendants(child)) {
      result.push(deeper);
    }
  }
  return result;
}

// src/api/course.ts
async function fetchCoursePage(ctx, slug) {
  const doc = parseHtml(ctx, await fetchHtml(ctx, `/courses/${slug}/`));
  const title = text(doc.querySelector("title")).split("|")[0].trim() || slug;
  const nav = parseCourseNav(doc);
  if (nav.length === 0) {
    throw new Error(
      "Could not find this course's material list \u2014 MIT OCW's page layout may have changed."
    );
  }
  return { doc, title, nav };
}

// src/api/gallery.ts
function isGalleryHref(href) {
  return /\/video_galleries\//.test(href);
}
async function fetchGalleryCards(ctx, href) {
  const doc = parseHtml(ctx, await fetchHtml(ctx, href));
  const cards = [];
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

// src/callopus/concurrency.ts
async function mapWithLimit(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  async function worker() {
    while (true) {
      const index = next++;
      if (index >= items.length) return;
      results[index] = await fn(items[index], index);
    }
  }
  const workers = [];
  for (let i = 0; i < Math.min(limit, items.length); i++) workers.push(worker());
  await Promise.all(workers);
  return results;
}

// src/callopus/lesson.ts
function lesson(id, title, kind, fields) {
  return {
    id: String(id),
    title: String(title || ""),
    kind,
    graded: false,
    dueAt: null,
    ...fields
  };
}

// src/api/metadata.ts
function extractCourseDrawerMetadata(doc) {
  const scope = doc.querySelector("#course-info-drawer") || doc.querySelector(".course-info") || doc;
  const uniqueTexts = (sel) => {
    const seen = [];
    for (const el of Array.from(scope.querySelectorAll(sel))) {
      const value = cleanText(el);
      if (value && seen.indexOf(value) === -1) seen.push(value);
    }
    return seen;
  };
  const instructors = uniqueTexts(".course-info-instructor");
  const departments = uniqueTexts(".course-info-department");
  const topics = uniqueTexts(".course-info-topic");
  let asTaughtIn = "";
  let level = "";
  const infoBox = scope.querySelector(".course-info") || scope;
  for (const h3 of Array.from(infoBox.querySelectorAll("h3.course-info-section-label"))) {
    const lbl = cleanText(h3);
    const parent = h3.parentElement;
    const val = parent ? cleanText(parent.querySelector(".course-info-content")) : "";
    if (lbl === "As Taught In" && val && !asTaughtIn) asTaughtIn = val;
    if (lbl === "Level" && val && !level) level = val;
  }
  let resourceTypes = [];
  for (const h3 of Array.from(scope.querySelectorAll("h3.course-info-section-label"))) {
    if (cleanText(h3) === "Learning Resource Types" && h3.parentElement) {
      const seen = [];
      for (const span of Array.from(h3.parentElement.querySelectorAll(".panel-course-info-text span"))) {
        const value = cleanText(span);
        if (value && seen.indexOf(value) === -1) seen.push(value);
      }
      resourceTypes = seen;
      if (resourceTypes.length) break;
    }
  }
  return { instructors, departments, asTaughtIn, level, topics, resourceTypes };
}
function findWholePagePdfUrl(doc) {
  if (!doc.querySelector(".pdf-viewer")) return null;
  const link = doc.querySelector("a.download-file[href]") || doc.querySelector("a.resource-thumbnail[href]");
  const href = link && link.getAttribute("href");
  return href ? absoluteUrl(href) || null : null;
}

// src/api/resource.ts
async function fetchResourcePage(ctx, href, fallbackTitle) {
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
          downloadUrl: absoluteUrl(video.getAttribute("data-downloadlink")) || void 0,
          transcriptPdfUrl: absoluteUrl(video.getAttribute("data-transcriptlink")),
          captionsSrc: captions && absoluteUrl(captions.getAttribute("src")) || void 0
        }
      };
    }
  }
  const pdfUrl = findWholePagePdfUrl(doc);
  if (pdfUrl) return { doc, title, content: { kind: "pdf", pdfUrl } };
  const body = doc.querySelector(".resource-page-container") || doc.querySelector("main#course-content-section");
  return { doc, title, content: { kind: "reading", bodyHtml: innerHtml(body) } };
}

// src/callopus/metadata.ts
function extractCourseDetails(doc, slug) {
  const details = [];
  const courseUrl = `${SITE_BASE}/courses/${slug}/`;
  details.push({ label: "Original Course Page", value: courseUrl, href: courseUrl });
  const bannerDetail = cleanText(doc.querySelector(".course-number-term-detail"));
  const bannerParts = bannerDetail.split("|").map((s) => s.trim()).filter(Boolean);
  if (bannerParts[0]) details.push({ label: "Course Number", value: bannerParts[0] });
  const expDesc = doc.querySelector("#expanded-description") || doc.querySelector("#collapsed-description");
  if (expDesc) {
    const btnText = cleanText(expDesc.querySelector("button"));
    let desc = cleanText(expDesc);
    if (btnText && desc.slice(-btnText.length) === btnText) desc = desc.slice(0, -btnText.length).trim();
    desc = desc.replace(/…$/, "").trim();
    if (desc) details.push({ label: "Description", value: desc });
  }
  const drawer = extractCourseDrawerMetadata(doc);
  if (drawer.instructors.length) details.push({ label: "Instructors", value: drawer.instructors.join(", ") });
  if (drawer.departments.length) details.push({ label: "Departments", value: drawer.departments.join(", ") });
  const taughtIn = drawer.asTaughtIn || bannerParts[1] || "";
  if (taughtIn) details.push({ label: "As Taught In", value: taughtIn });
  const lvl = drawer.level || bannerParts[2] || "";
  if (lvl) details.push({ label: "Level", value: lvl });
  if (drawer.topics.length) details.push({ label: "Topics", value: drawer.topics.join(", ") });
  if (drawer.resourceTypes.length) details.push({ label: "Resource Types", value: drawer.resourceTypes.join(", ") });
  return {
    details,
    authors: drawer.instructors.join(", ") || void 0,
    sourceUrl: courseUrl
  };
}
function extractResourceFacts(doc, resourceUrl) {
  const facts = [];
  if (resourceUrl) facts.push({ label: "Original Resource", value: resourceUrl, href: resourceUrl });
  const hasFact = (lbl) => facts.some((f) => f.label.toLowerCase() === lbl.toLowerCase());
  const container = doc.querySelector(".resource-page-container");
  if (container) {
    for (const row of directChildElements(container, "div", "row")) {
      const label = cleanText(row.querySelector(".label")).replace(/:\s*$/, "");
      const value = cleanText(row.querySelector(".content"));
      if (label && value && !hasFact(label)) facts.push({ label, value });
    }
  }
  const videoPage = doc.querySelector(".video-page");
  if (videoPage) {
    for (const p of Array.from(videoPage.querySelectorAll(".description p"))) {
      const strongText = cleanText(p.querySelector("strong"));
      const fullText = cleanText(p);
      if (strongText && fullText.indexOf(strongText) === 0) {
        const label = strongText.replace(/:\s*$/, "").trim();
        const value = fullText.slice(strongText.length).replace(/^:\s*/, "").trim();
        if (label && value && !hasFact(label)) facts.push({ label, value });
      } else if (fullText && !hasFact("Description")) {
        facts.push({ label: "Description", value: fullText });
      }
    }
    if (!hasFact("Resource Type")) facts.push({ label: "Resource Type", value: "Lecture Video" });
  }
  const fileSize = cleanText(doc.querySelector(".resource-list-file-size"));
  if (fileSize && !hasFact("File Size")) facts.push({ label: "File Size", value: fileSize });
  const drawer = extractCourseDrawerMetadata(doc);
  const instructorFact = facts.find((f) => /^instructors?$/i.test(f.label));
  const itemInstructor = instructorFact && instructorFact.value;
  if (!itemInstructor && drawer.instructors.length) {
    facts.push({ label: "Instructors", value: drawer.instructors.join(", ") });
  }
  if (!hasFact("Departments") && drawer.departments.length) {
    facts.push({ label: "Departments", value: drawer.departments.join(", ") });
  }
  const authors = itemInstructor || (drawer.instructors.length ? drawer.instructors.join(", ") : void 0);
  return { facts, authors };
}

// src/callopus/resource.ts
async function scrapeResourcePage(ctx, href, fallbackTitle) {
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
        transcripts: captionsSrc ? [{ lang: "eng", url: captionsSrc }] : void 0
      },
      body: { html: content.descriptionHtml },
      details: videoDetails,
      authors,
      sourceUrl: resourceUrl
    });
  }
  if (content.kind === "pdf") {
    const pdfDetails = details.concat([{ label: "PDF File", value: content.pdfUrl, href: content.pdfUrl }]);
    return lesson(href, title, "pdf", {
      pdfUrl: content.pdfUrl,
      details: pdfDetails,
      authors,
      sourceUrl: resourceUrl
    });
  }
  return lesson(href, title, "reading", {
    body: { html: content.bodyHtml },
    details,
    authors,
    sourceUrl: resourceUrl
  });
}
async function buildPageSection(ctx, node, courseAuthors) {
  const rootItem = await scrapeResourcePage(ctx, node.href, node.title);
  const subItems = flattenNavDescendants(node).map((d) => {
    const itemUrl = absoluteUrl(d.href);
    return lesson(d.href, d.title, "reading", {
      authors: rootItem.authors || courseAuthors,
      sourceUrl: itemUrl,
      details: itemUrl ? [{ label: "Original Resource", value: itemUrl, href: itemUrl }] : void 0
    });
  });
  return { id: node.href, title: node.title, lessons: [rootItem].concat(subItems) };
}
async function fetchLesson(lessonId, ctx) {
  return scrapeResourcePage(ctx, lessonId);
}
async function resolveLink(href, ctx) {
  const path = toSitePath(href);
  if (!path || !LINK_PATTERN.test(path) || FILE_EXT_PATTERN.test(path)) return null;
  try {
    const item = await scrapeResourcePage(ctx, path);
    const text2 = item.body && "html" in item.body ? item.body.html : "";
    return item.video || text2 || item.pdfUrl ? { kind: "page", lesson: item } : null;
  } catch {
    return null;
  }
}

// src/callopus/gallery.ts
async function expandGallery(ctx, href, courseAuthors) {
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
        details
      });
    }
  });
}

// src/callopus/ids.ts
var NAMESPACE_PREFIX = "ocw_";

// src/callopus/course.ts
async function fetchCourse(courseId, ctx) {
  const slug = courseId.slice(NAMESPACE_PREFIX.length);
  const { doc, title: courseTitle, nav: navNodes } = await fetchCoursePage(ctx, slug);
  const meta = extractCourseDetails(doc, slug);
  const outline = [];
  for (const node of navNodes) {
    try {
      if (isGalleryHref(node.href)) {
        outline.push({
          id: node.href,
          title: node.title,
          lessons: await expandGallery(ctx, node.href, meta.authors)
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
    sourceUrl: meta.sourceUrl
  };
}

// src/api/search.ts
function buildSearchBody(query, opts) {
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
          { bool: { should: [{ term: { offered_by: "OCW" } }] } }
        ]
      }
    },
    query: trimmed ? {
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
                "course_feature_tags"
              ]
            }
          }
        ]
      }
    } : { match_all: {} }
  };
}
async function searchCourses(ctx, query) {
  const resp = await ctx.fetch(SEARCH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(buildSearchBody(query))
  });
  if (!resp.ok) throw new Error(`MIT OCW search ${resp.status}`);
  const body = await resp.json();
  return body?.hits?.hits || [];
}

// src/callopus/search.ts
function toCatalogEntry(hit) {
  const src = hit._source || {};
  const runs = src.runs || [];
  const run = runs[0] || {};
  const slug = (run.slug || "").replace(/^courses\//, "");
  if (!slug) return null;
  return {
    code: src.coursenum || slug,
    name: src.title || slug,
    courseId: NAMESPACE_PREFIX + slug
  };
}
async function search(query, ctx) {
  const hits = await searchCourses(ctx, query);
  const out = [];
  for (const hit of hits) {
    const entry = toCatalogEntry(hit);
    if (entry) out.push(entry);
  }
  return out;
}
function parseUrl(raw) {
  const input = String(raw || "").trim();
  if (!input) return { ok: false, error: "Enter an MIT OpenCourseWare course URL." };
  const match = /ocw\.mit\.edu\/courses\/([^/?#\s]+)/i.exec(input);
  if (!match) {
    return {
      ok: false,
      error: "Enter a full ocw.mit.edu course URL, e.g. https://ocw.mit.edu/courses/6-0001-introduction-to-computer-science-and-programming-in-python-fall-2016/."
    };
  }
  const slug = match[1].toLowerCase();
  return { ok: true, courseId: NAMESPACE_PREFIX + slug, label: slug };
}

// src/index.ts
var connector = {
  search,
  parseUrl,
  fetchCourse,
  fetchLesson,
  resolveLink
};
var index_default = connector;
export {
  index_default as default
};
