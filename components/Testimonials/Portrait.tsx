import Image from "next/image";
import type { Testimonial } from "@/lib/content";

/**
 * The portrait card. Until a real photograph exists the slot is filled by the
 * client's initial on a raised surface rather than a stock face — a borrowed
 * stranger standing in for a named client would be a small lie in the middle
 * of a trust section.
 */
export function Portrait({ person }: { person: Testimonial }) {
  if (person.image) {
    return (
      <Image
        src={person.image}
        alt={person.imageAlt ?? `${person.name}, ${person.role} at ${person.company}`}
        fill
        sizes="(min-width: 768px) 30vw, 70vw"
        className="object-cover"
      />
    );
  }

  return (
    <div aria-hidden className="absolute inset-0 grid place-items-center bg-ink-3">
      <span className="font-medium leading-none tracking-[-0.04em] text-bone/15 text-[clamp(5rem,12vw,9rem)]">
        {person.name.trim().charAt(0).toUpperCase()}
      </span>
    </div>
  );
}
