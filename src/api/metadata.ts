// Reading the facts MIT OCW's pages carry about a course.
import { absoluteUrl } from "./constants";
import { cleanText } from "./dom";

export interface DrawerMetadata {
  instructors: string[];
  departments: string[];
  asTaughtIn: string;
  level: string;
  topics: string[];
  resourceTypes: string[];
}

export function extractCourseDrawerMetadata(doc: Document): DrawerMetadata {
  const scope = doc.querySelector("#course-info-drawer") || doc.querySelector(".course-info") || doc;
  const uniqueTexts = (sel: string) => {
    const seen: string[] = [];
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

  let resourceTypes: string[] = [];
  for (const h3 of Array.from(scope.querySelectorAll("h3.course-info-section-label"))) {
    if (cleanText(h3) === "Learning Resource Types" && h3.parentElement) {
      const seen: string[] = [];
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

export function findWholePagePdfUrl(doc: Document): string | null {
  if (!doc.querySelector(".pdf-viewer")) return null;
  const link = doc.querySelector("a.download-file[href]") || doc.querySelector("a.resource-thumbnail[href]");
  const href = link && link.getAttribute("href");
  return href ? absoluteUrl(href) || null : null;
}
