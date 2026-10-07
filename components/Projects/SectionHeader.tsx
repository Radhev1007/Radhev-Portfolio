/**
 * Opens each section: index, label, optional count.
 *
 * This used to draw an animated rule beneath itself, which put seven
 * hairlines down the page. The index and label carry the job on their own,
 * so the rule is gone and the header no longer needs to be a client
 * component or animate anything.
 */
export function SectionHeader({
  index,
  label,
  count,
  countNoun = "Projects",
}: {
  index: string;
  label: string;
  count?: number;
  /** Noun shown beside `count` — the header is not only used by Projects. */
  countNoun?: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="label">
        <span className="text-bone">({index})</span>&nbsp;&nbsp;{label}
      </span>
      {count !== undefined && (
        <span className="label">
          {String(count).padStart(2, "0")} {countNoun}
        </span>
      )}
    </div>
  );
}
