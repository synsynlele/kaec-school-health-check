import type { Metadata } from "next";
import { UUID_RE } from "@/lib/http";
import { HqMeetings } from "@/components/khpos/ops/HqMeetings";
import { IdeasBoard } from "@/components/khpos/ops/IdeasBoard";
import { SchoolSectionTabs } from "@/components/khpos/SchoolSectionTabs";

export const metadata: Metadata = {
  title: "Meetings & discussions · KAEC HQ",
  robots: { index: false, follow: false },
};

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const selected = query.view === "ideas" ? "ideas" : "";
  const meetingId = typeof query.meeting === "string" ? query.meeting : "";
  const initialMeeting = UUID_RE.test(meetingId) ? meetingId : "";
  return (
    <>
      <SchoolSectionTabs
        base="/khpos/hq/meetings"
        title="KAEC HQ collaboration"
        selected={selected}
        theme="hq"
        tabs={[{ view: "", label: "Private meetings" }, { view: "ideas", label: "Ideas & discussions" }]}
      />
      <div id="khpos-section-content" tabIndex={-1}>
        {selected === "ideas"
          ? <IdeasBoard scope="hq" />
          : <HqMeetings initialMeeting={initialMeeting} />}
      </div>
    </>
  );
}
