/** In-page navigation for longer KHP-OS workspaces.
 * Static links never expose data or change which actions a role can perform.
 */
export function SectionJumpNav({
  sections,
  label = "On this page",
}: {
  sections: readonly { id: string; label: string }[];
  label?: string;
}) {
  if (sections.length < 2) return null;
  return (
    <nav aria-label={label} className="khpos-interface-card p-3 sm:p-4">
      <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-600">
        {label}
      </p>
      <div className="khpos-horizontal-nav mt-3" role="group" aria-label="Jump to section">
        {sections.map(section => (
          <a
            key={section.id}
            href={`#${section.id}`}
            className="inline-flex min-h-11 shrink-0 items-center rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-bold text-brand-800 transition hover:border-brand-300 hover:bg-brand-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
          >
            {section.label}
          </a>
        ))}
      </div>
    </nav>
  );
}
