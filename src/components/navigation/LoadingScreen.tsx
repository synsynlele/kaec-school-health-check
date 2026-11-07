/** Inline essentials paint before the stylesheet and client bundles arrive. */
export function LoadingScreen({ message = "Opening your workspace…" }: { message?: string }) {
  return (
    <div role="status" aria-live="polite" aria-busy="true" style={{ minHeight: "100svh", display: "grid", placeItems: "center", background: "#0f172a", color: "#fff", padding: "2rem", boxSizing: "border-box", fontFamily: "system-ui, sans-serif", textAlign: "center" }}>
      <div>
        <span aria-hidden="true" style={{ display: "inline-grid", placeItems: "center", width: 64, height: 64, borderRadius: 18, background: "#0f4fd8", color: "#fff", fontSize: 32, fontWeight: 900 }}>K</span>
        <p style={{ margin: "1rem 0 .5rem", fontSize: 22, fontWeight: 800 }}>KHP-OS</p>
        <p style={{ margin: 0, color: "#cbd5e1", fontSize: 15 }}>{message}</p>
        <span aria-hidden="true" className="motion-safe:animate-spin" style={{ display: "inline-block", marginTop: 24, width: 24, height: 24, border: "3px solid #334155", borderTopColor: "#6ee7b7", borderRadius: "50%" }} />
      </div>
    </div>
  );
}
