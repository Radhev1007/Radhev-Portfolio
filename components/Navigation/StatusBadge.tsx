import { site } from "@/lib/content";

/** "Available for work" pill with a softly pulsing live indicator. */
export function StatusBadge({ className = "flex" }: { className?: string }) {
  return (
    <span className={`${className} items-center gap-2.5 rounded-full border border-line bg-ink/50 px-4 py-1.5 text-[13px] text-bone/80 backdrop-blur-md`}>
      <span className="relative flex size-2" aria-hidden>
        <span className="absolute inset-0 rounded-full bg-accent [animation:pulse-ring_2s_var(--ease-out-expo)_infinite]" />
        <span className="relative size-2 rounded-full bg-accent" />
      </span>
      {site.availabilityLabel}
    </span>
  );
}
