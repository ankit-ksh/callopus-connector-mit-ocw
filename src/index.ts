// MIT OpenCourseWare connector entry point.
// Wires exported capabilities to implement the connector protocol.
import type { ConnectorModule } from "@callopus/connector-sdk";
import { fetchCourse } from "./callopus/course";
import { fetchLesson, resolveLink } from "./callopus/resource";
import { parseUrl, search } from "./callopus/search";

const connector: ConnectorModule = {
  search,
  parseUrl,
  fetchCourse,
  fetchLesson,
  resolveLink,
};

export default connector;
