# MIT OpenCourseWare connector

A Callopus course connector for [MIT OpenCourseWare](https://ocw.mit.edu),
providing access to openly published MIT courses, lecture videos, readings,
and assignments.

## Connection and authentication

- **What it connects to:** `https://ocw.mit.edu` and `https://open.mit.edu`
  (declared in manifest `network`).
- **Signing in:** None (`auth: { "kind": "none" }`). MIT OCW publishes its
  materials openly under Creative Commons BY-NC-SA 4.0. No accounts, API keys,
  or credentials are used.
- **Request concurrency:** When expanding lecture video galleries, requests to
  individual lecture resource pages are capped at `FETCH_CONCURRENCY = 5` to
  remain a polite client of a public service.

## Supported capabilities

Implements Protocol 2:
- `search(query, ctx)`: Queries MIT's public OpenSearch endpoint
  (`open.mit.edu/api/v0/search/`).
- `parseUrl(raw, ctx)`: Parses and extracts course slugs from pasted OCW URLs,
  supporting both course roots and deep resource links.
- `fetchCourse(courseId, ctx)`: Scrapes the course root and sidebar navigation,
  constructing sections and lessons.
- `fetchLesson(lessonId, ctx)`: Fetches full content on demand for deferred
  lesson stubs.
- `resolveLink(href, ctx)`: Says where a link goes. The manifest's `links`
  declare the course page and resource addresses
  (`https://ocw.mit.edu/courses/*/pages/*` and `…/resources/*`); one that has
  something to show is returned as a `page` (a lesson that belongs to no
  outline), a file or an empty page as `null`.

## How the data maps to the Callopus course model

- **Search & Catalog:**
  MIT's OpenSearch API returns hits containing `coursenum`, `title`, and
  `runs[0].slug`. The connector maps each hit to a `CatalogCourseEntry` with
  `code`, `name`, and `ocw_<slug>` identifier.
- **Navigation & Sections:**
  The course sidebar `<nav class="course-nav">` forms the section structure.
  Top-level nav items become Callopus `Section`s.
- **Lessons:**
  - Video galleries (`/video_galleries/`) are expanded into `video` lessons with
    YouTube IDs (`youtubeId`) and English transcript VTT links.
  - Resource pages with embedded PDF viewers become `pdf` lessons with `pdfUrl`.
  - Static HTML sections become `reading` lessons with a sanitized `body` (`{ html }`) and
    rewritten absolute asset links.
  - Sub-pages in navigation are listed as stubs without a `body`, prompting the
    host application to load them lazily via `fetchLesson`.
- **Metadata & Provenance:**
  Instructor names, departments, term, course number, and resource descriptions
  are extracted into Callopus `DetailFact` entries and `authors`.

## How to build and test

```sh
# Install dependencies
pnpm install --ignore-workspace

# Run regression tests against recorded fixtures
pnpm test

# Typecheck TypeScript modules
pnpm typecheck

# Build single ES module bundle
pnpm build

# Verify built bundle against manifest declaration
npx callopus-connector check
```

## Licence

MIT OCW content is published under Creative Commons BY-NC-SA 4.0. This
connector formats openly available pages on the user's machine at the user's
request and does not redistribute or re-host any content.
