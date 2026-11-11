import { redirect } from "next/navigation";
export const metadata = { title: "HQ discussions · KHP-OS", robots: { index: false, follow: false } };
export default function Page() {
  redirect("/khpos/hq/meetings?view=ideas");
}
