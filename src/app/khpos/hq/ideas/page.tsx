import { IdeasBoard } from "@/components/khpos/ops/IdeasBoard";

export const metadata = { title: "HQ ideas & discussions · KHP-OS", robots: { index: false, follow: false } };
export default function Page() {
  return <IdeasBoard scope="hq" />;
}
