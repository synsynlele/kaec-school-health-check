import type { Metadata } from "next";
import { AccountAccess } from "@/components/account/AccountAccess";

export const metadata: Metadata = {
  title: "Account | KAEC School Health Check",
  robots: { index: false, follow: false },
};

export default function AccountPage() {
  return <AccountAccess />;
}
