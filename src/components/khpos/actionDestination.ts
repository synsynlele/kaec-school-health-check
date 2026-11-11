/** Move to a revealed section without opening a mobile keyboard. */
export function focusActionDestination(element: HTMLElement | null) {
  if (!element) return;
  element.focus({ preventScroll: true });
  element.scrollIntoView({ block: "start", inline: "nearest" });
}

export const actionDestination = {
  tabIndex: -1,
  "data-khpos-destination": "",
  ref(element: HTMLElement | null) {
    if (!element) return;
    // Wait for the rest of the update to lay out, including opened disclosures.
    const frame = requestAnimationFrame(() => focusActionDestination(element));
    return () => cancelAnimationFrame(frame);
  },
} as const;
