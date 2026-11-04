"use client";
import { MeetingsWorkspace } from "./MeetingsWorkspace";
export function HqMeetings({ initialMeeting = "" }: { initialMeeting?: string }) {
 return <MeetingsWorkspace organisationId="hq" initialMeeting={initialMeeting} />;
}
