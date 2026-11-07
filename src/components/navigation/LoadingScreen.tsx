/** Inline essentials paint before the stylesheet and client bundles arrive. */
export function LoadingScreen({ message = "Opening your workspace…", inline = false }: { message?: string; inline?: boolean }) {
  return (
    <div role="status" aria-live="polite" aria-busy="true" data-loading-scope={inline ? "section" : "page"} style={{ position: inline ? "relative" : "fixed", inset: inline ? undefined : 0, zIndex: inline ? undefined : 9998, minHeight: inline ? 160 : "100svh", display: "grid", placeItems: "center", background: "#0f172a", color: "#fff", padding: inline ? "1rem" : "2rem", borderRadius: inline ? 16 : undefined, boxSizing: "border-box", fontFamily: "system-ui, sans-serif", textAlign: "center" }}>
      <div>
        <span aria-hidden="true" style={{ display: "inline-grid", placeItems: "center", width: inline ? 36 : 64, height: inline ? 36 : 64, borderRadius: inline ? 10 : 18, background: "#0f4fd8", color: "#fff", fontSize: inline ? 20 : 32, fontWeight: 900 }}>K</span>
        <p style={{ margin: "1rem 0 .5rem", fontSize: inline ? 16 : 22, fontWeight: 800 }}>KHP-OS</p>
        <p style={{ margin: 0, color: "#cbd5e1", fontSize: 15 }}>{message}</p>
        <span aria-hidden="true" className="motion-safe:animate-spin" style={{ display: "inline-block", marginTop: 24, width: 24, height: 24, border: "3px solid #334155", borderTopColor: "#6ee7b7", borderRadius: "50%" }} />
      </div>
    </div>
  );
}
