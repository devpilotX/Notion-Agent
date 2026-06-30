/** Fixed, non-interactive paper-grain overlay. Sits above the ambient layer. */
export function PaperGrain() {
  return (
    <div
      aria-hidden="true"
      className="paper-grain pointer-events-none fixed inset-0 z-[1]"
    />
  );
}
