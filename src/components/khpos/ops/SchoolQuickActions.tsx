import Link from "next/link";
import { ArrowUpRight, BookOpenCheck, ClipboardCheck, DoorOpen, School } from "lucide-react";

/**
 * Four common school-day actions with existing, permission-checked destinations.
 * No parallel attendance or leave workflow is created here.
 */
export function SchoolQuickActions({ organisationId }: { organisationId: string }) {
  const base = `/khpos/${organisationId}`;
  const actions = [
    { label: "School attendance", description: "Arrive or leave school", href: `${base}/teaching-presence?tab=day`, icon: School },
    { label: "My lessons", description: "Timetable and check-ins", href: `${base}/teaching-presence?tab=lessons`, icon: BookOpenCheck },
    { label: "Movement permission", description: "Request a short outing", href: `${base}/availability?request=outing`, icon: DoorOpen },
    { label: "Assigned work", description: "See tasks and follow-ups", href: "#today-tasks", icon: ClipboardCheck },
  ] as const;

  return (
    <nav aria-label="Quick school actions" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.15em] text-brand-700">Quick actions</p>
          <h2 className="mt-1 text-lg font-extrabold text-slate-950 sm:text-xl">What would you like to do?</h2>
        </div>
        <p className="text-xs text-slate-500">Common tasks, one tap away</p>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {actions.map(({ label, description, href, icon: Icon }) => (
          <Link key={label} href={href} className="khpos-quick-card group flex min-h-36 flex-col justify-between gap-3 p-4 sm:min-h-40 sm:p-5">
            <span className="flex items-start justify-between gap-2">
              <span className="grid size-11 place-items-center rounded-2xl bg-brand-50 text-brand-700 transition-colors group-hover:bg-brand-700 group-hover:text-white">
                <Icon className="size-5" aria-hidden="true" />
              </span>
              <ArrowUpRight className="size-4 text-slate-400 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-brand-700" aria-hidden="true" />
            </span>
            <span className="block">
              <span className="block text-sm font-extrabold text-slate-950">{label}</span>
              <span className="mt-1 block text-xs leading-5 text-slate-600">{description}</span>
            </span>
          </Link>
        ))}
      </div>
    </nav>
  );
}
