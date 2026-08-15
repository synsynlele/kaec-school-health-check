import type { Metadata } from "next";
import { AccountEntry } from "@/components/account/AccountEntry";

export const metadata: Metadata = {
  title: "Account | KAEC School Health Check",
  robots: { index: false, follow: false },
};

export default function AccountPage() {
  return <AccountEntry />;
}
