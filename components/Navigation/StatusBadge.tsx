import { site } from "@/lib/content";

/** "Available for work" chip with a softly pulsing live indicator. */
export function StatusBadge({ className = "flex" }: { className?: string }) {
  return (
    <span className={`${className} items-center gap-2 border border-line bg-ink/50 px-2 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-bone/80 backdrop-blur-md`}>
      <span className="relative flex size-1.5" aria-hidden>
        <span className="absolute inset-0 bg-accent [animation:pulse-ring_2s_var(--ease-out-expo)_infinite]" />
        <span className="relative size-1.5 bg-accent" />
      </span>
      {site.availabilityLabel}
    </span>
  );
}
