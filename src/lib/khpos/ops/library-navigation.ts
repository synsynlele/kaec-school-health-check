import type { KhposOpsProcess, KhposOpsToolTemplate } from "./library";
export function relatedToolProcesses(
  tool: Pick<KhposOpsToolTemplate, "code">,
  processes: KhposOpsProcess[],
) {
  return processes
    .filter((process) =>
      process.operatingMap?.controlledRecords.some(
        (record) => record.toolCode === tool.code,
      ),
    )
    .sort((a, b) => a.code.localeCompare(b.code));
}
export function processDocumentHref(organisationId: string, processId: string) {
  return `/khpos/${organisationId}/library?${new URLSearchParams({ tab: "processes", process: processId })}`;
}
// Same-path App Router navigation must reset local tab/search state to the requested view.
export function libraryNavigationKey(
  organisationId: string,
  tab: string,
  query: string,
  critical: boolean,
  edit: string,
  process: string,
) {
  return JSON.stringify([organisationId, tab, query, critical, edit, process]);
}
