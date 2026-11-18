"use client";

import type { Specialism } from "@/lib/content";
import { Row, SelectField, TextAreaField, TextField } from "../fields";
import { ListEditor } from "../ListEditor";
import { field, setter, type Updater } from "@/lib/admin/updaters";

/** The ids the Specialisms component draws a glyph for (components/Specialisms/Specialisms.tsx). */
const ICONS = [
  { value: "product", label: "Dashboard (product)" },
  { value: "systems", label: "Components (systems)" },
  { value: "strategy", label: "Research (strategy)" },
  { value: "visual", label: "Visual (visual)" },
  { value: "handoff", label: "Hand-off (handoff)" },
];

export function SpecialismsSection({ value, update }: { value: Specialism[]; update: Updater<Specialism[]> }) {
  return (
    <ListEditor
      path="specialisms"
      title="Specialisms"
      noun="specialism"
      items={value}
      update={update}
      create={() => ({ id: "product", title: "", blurb: "" })}
      itemLabel={(s, i) => s.title || `Specialism ${i + 1}`}
      renderItem={(s, _i, up, p) => (
        <div className="grid min-w-0 gap-4">
          <Row>
            <TextField path={`${p}.title`} label="Title" value={s.title} onChange={setter(field(up, "title"))} />
            <SelectField path={`${p}.id`} label="Icon" options={ICONS} value={s.id} onChange={setter(field(up, "id"))} />
          </Row>
          <TextAreaField path={`${p}.blurb`} label="Blurb" rows={3} value={s.blurb} onChange={setter(field(up, "blurb"))} />
        </div>
      )}
    />
  );
}
