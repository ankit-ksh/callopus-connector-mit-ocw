import type { Lesson, LessonKind } from "@callopus/course-model";

/**
 * Constructs a Callopus Lesson conforming to the course model.
 */
export function lesson(
  id: string | number,
  title: string | undefined,
  kind: LessonKind,
  fields?: Partial<Lesson>,
): Lesson {
  return {
    id: String(id),
    title: String(title || ""),
    kind,
    graded: false,
    dueAt: null,
    ...fields,
  };
}
