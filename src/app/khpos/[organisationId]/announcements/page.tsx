import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { UUID_RE } from "@/lib/http";
import { SchoolSectionTabs } from "@/components/khpos/SchoolSectionTabs";
import { AnnouncementsWorkspace } from "@/components/khpos/AnnouncementsWorkspace";
import { MeetingsWorkspace } from "@/components/khpos/ops/MeetingsWorkspace";
import { IdeasBoard } from "@/components/khpos/ops/IdeasBoard";

export const metadata: Metadata = {
  title: "Meetings & updates · KHP-OS",
  robots: { index: false, follow: false },
};

export default async function Page({
  params, searchParams,
}: {
  params: Promise<{ organisationId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { organisationId } = await params;
  if (!UUID_RE.test(organisationId)) notFound();
  const query = await searchParams;
  const requested = typeof query.view === "string" ? query.view : "";
  const selected = ["meetings", "ideas"].includes(requested) ? requested : "";
  const meetingId = typeof query.meeting === "string" ? query.meeting : "";
  const initialMeeting = UUID_RE.test(meetingId) ? meetingId : "";
  return (
    <>
      <SchoolSectionTabs
        base={"/khpos/" + organisationId + "/announcements"}
        title="Meetings & updates"
        selected={selected}
        tabs={[{"view":"","label":"Announcements"},{"view":"meetings","label":"Private meetings"},{"view":"ideas","label":"Discussions"}]}
      />
      <div id="khpos-section-content" tabIndex={-1}>
        {selected === "meetings" ? (<MeetingsWorkspace organisationId={organisationId} initialMeeting={initialMeeting} />) : (selected === "ideas" ? (<IdeasBoard scope={organisationId} />) : (<AnnouncementsWorkspace key={organisationId} organisationId={organisationId} />))}
      </div>
    </>
  );
}
