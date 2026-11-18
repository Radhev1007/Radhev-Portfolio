"use client";

import type { ProcessStep } from "@/lib/content";
import { Row, TextAreaField, TextField } from "../fields";
import { ListEditor } from "../ListEditor";
import { field, setter, type Updater } from "@/lib/admin/updaters";

export function ProcessSection({ value, update }: { value: ProcessStep[]; update: Updater<ProcessStep[]> }) {
  return (
    <ListEditor
      path="processSteps"
      title="Process steps"
      description="The step number is typed, so renumber steps after moving them."
      noun="step"
      items={value}
      update={update}
      create={() => ({ n: String(value.length + 1).padStart(2, "0"), title: "", body: "" })}
      itemLabel={(s, i) => (s.title ? `${s.n} · ${s.title}` : `Step ${i + 1}`)}
      renderItem={(s, _i, up, p) => (
        <div className="grid min-w-0 gap-4">
          <Row>
            <TextField path={`${p}.n`} label="Number" value={s.n} onChange={setter(field(up, "n"))} />
            <TextField path={`${p}.title`} label="Title" value={s.title} onChange={setter(field(up, "title"))} />
          </Row>
          <TextAreaField path={`${p}.body`} label="Description" rows={3} value={s.body} onChange={setter(field(up, "body"))} />
        </div>
      )}
    />
  );
}
