"use client";

import type { Role } from "@/lib/content";
import { Row, TextField } from "../fields";
import { ListEditor } from "../ListEditor";
import { field, setter, type Updater } from "@/lib/admin/updaters";
import { StringList } from "./StringList";

export function ExperienceSection({ value, update }: { value: Role[]; update: Updater<Role[]> }) {
  return (
    <ListEditor
      path="experience"
      title="Roles"
      description="Newest first, as listed on the site."
      noun="role"
      collapsible
      confirmRemove
      items={value}
      update={update}
      create={() => ({ company: "", location: "", title: "", from: "", to: "", points: [] })}
      itemLabel={(r, i) => (r.company ? `${r.company}${r.title ? ` · ${r.title}` : ""}` : `Role ${i + 1}`)}
      renderItem={(r, _i, up, p) => (
        <div className="grid min-w-0 gap-4">
          <Row>
            <TextField path={`${p}.company`} label="Company" value={r.company} onChange={setter(field(up, "company"))} />
            <TextField path={`${p}.title`} label="Job title" value={r.title} onChange={setter(field(up, "title"))} />
          </Row>
          <TextField path={`${p}.location`} label="Location" value={r.location} onChange={setter(field(up, "location"))} />
          <Row>
            <TextField path={`${p}.from`} label="From" hint="Format: Jan 2023 (three-letter month, then year)" value={r.from} onChange={setter(field(up, "from"))} />
            <TextField path={`${p}.to`} label="To" hint="Format: Jan 2023, or the word Present for a current role" value={r.to} onChange={setter(field(up, "to"))} />
          </Row>
          <StringList path={`${p}.points`} title="Highlights" noun="point" multiline items={r.points} update={field(up, "points")} />
        </div>
      )}
    />
  );
}
