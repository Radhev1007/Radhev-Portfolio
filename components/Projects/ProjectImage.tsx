import Image from "next/image";

type Props = { src: string; alt: string; priority?: boolean };

/**
 * A project cover at its own proportions (808×632), rounded 4px as in the reference.
 *
 * The covers are the full-size originals from Behance (1400-1841px wide), cropped to the same frame as
 * Behance's own thumbnail and saved as quality-92 JPEG. The optimiser re-serves them as webp at quality 90 in
 * sizes that suit the screen. Nothing scales them beyond the frame, so the only motion is a 2% ease on hover.
 */
export function ProjectImage({ src, alt, priority }: Props) {
  return (
    <div className="group relative aspect-[808/632] overflow-hidden rounded-card bg-ink-2">
      <Image
        src={src}
        alt={alt}
        fill
        quality={90}
        preload={priority}
        sizes="(min-width: 1024px) 70vw, 100vw"
        className="object-cover transition-transform duration-[1200ms] ease-[var(--ease-out-expo)] group-hover:scale-[1.02]"
      />
    </div>
  );
}
