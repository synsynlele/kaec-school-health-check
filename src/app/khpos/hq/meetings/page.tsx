import { HqMeetings } from "@/components/khpos/ops/HqMeetings";
import { UUID_RE } from "@/lib/http";
export const metadata = { title: "Meetings · KAEC HQ", robots: { index: false, follow: false } };
export default async function Page({ searchParams }: { searchParams: Promise<{ meeting?: string }> }) {
 const { meeting } = await searchParams;
 return <HqMeetings initialMeeting={meeting && UUID_RE.test(meeting) ? meeting : ""} />;
}
