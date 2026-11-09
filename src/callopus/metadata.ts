// Course and resource facts, in the course model's words.
import type { DetailFact } from "@callopus/course-model";
import { SITE_BASE } from "../api/constants";
import { cleanText, directChildElements } from "../api/dom";
import { extractCourseDrawerMetadata } from "../api/metadata";

/**
 * Extracts course details and instructor information from the main course page.
 */
export function extractCourseDetails(
  doc: Document,
  slug: string,
): { details: DetailFact[]; authors?: string; sourceUrl: string } {
  const details: DetailFact[] = [];
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
    authors: drawer.instructors.join(", ") || undefined,
    sourceUrl: courseUrl,
  };
}

/**
 * Extracts facts and provenance from an individual resource page.
 */
export function extractResourceFacts(
  doc: Document,
  resourceUrl?: string,
): { facts: DetailFact[]; authors?: string } {
  const facts: DetailFact[] = [];
  if (resourceUrl) facts.push({ label: "Original Resource", value: resourceUrl, href: resourceUrl });

  const hasFact = (lbl: string) => facts.some((f) => f.label.toLowerCase() === lbl.toLowerCase());

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

  const authors = itemInstructor || (drawer.instructors.length ? drawer.instructors.join(", ") : undefined);
  return { facts, authors };
}
