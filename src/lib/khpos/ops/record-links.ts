export type KhposRecordKind = "work" | "verification" | "issue" | "decision";

export function khposRecordAnchor(kind: KhposRecordKind, id: string) {
  return `${kind}-${id}`;
}

export function khposRecordHref(organisationId: string, kind: KhposRecordKind, id: string) {
  const page = kind === "issue" ? "issues" : kind === "decision" ? "decisions" : "work";
  return `/khpos/${organisationId}/${page}#${khposRecordAnchor(kind, id)}`;
}

/** Fragment navigation selects an already-authorised DOM record; it never fetches by ID. */
export function focusKhposRecord(hash: string, documentRoot: Document) {
  const anchor = hash.replace(/^#/, "");
  if (!/^(work|verification|issue|decision)-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(anchor)) return false;
  const target = documentRoot.getElementById(anchor);
  if (!target) return false;
  target.scrollIntoView({ behavior: "smooth", block: "start" });
  target.focus({ preventScroll: true });
  return true;
}
