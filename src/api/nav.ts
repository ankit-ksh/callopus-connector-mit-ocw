// Navigation structure parsing for MIT OCW course sidebars.
import { directChildElements, text } from "./dom";

export interface NavNode {
  href: string;
  title: string;
  children?: NavNode[];
}

function parseNavNode(li: Element): NavNode | null {
  const parent = li.querySelector(".course-nav-parent") || li;
  const a = parent.querySelector("a[href]");
  const href = a && a.getAttribute("href");
  if (!href || href.charAt(0) !== "/") return null;

  const childUl = directChildElements(li, "ul", "course-nav-child-nav")[0];
  const children = childUl ? parseNavList(childUl) : [];
  return { href, title: text(a), children };
}

function parseNavList(ul: Element): NavNode[] {
  const out: NavNode[] = [];
  for (const li of directChildElements(ul, "li", "course-nav-list-item")) {
    const node = parseNavNode(li);
    if (node) out.push(node);
  }
  return out;
}

/**
 * Parses the hierarchical sidebar navigation tree from an MIT OCW course page.
 */
export function parseCourseNav(doc: Document): NavNode[] {
  const nav = doc.querySelector("nav.course-nav");
  const topUl = nav && directChildElements(nav, "ul")[0];
  return topUl ? parseNavList(topUl) : [];
}

/**
 * Flattens all nested descendants of a top-level nav node into document order.
 */
export function flattenNavDescendants(node: NavNode): NavNode[] {
  const result: NavNode[] = [];
  for (const child of node.children || []) {
    result.push(child);
    for (const deeper of flattenNavDescendants(child)) {
      result.push(deeper);
    }
  }
  return result;
}
