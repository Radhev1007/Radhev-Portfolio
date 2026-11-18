"use client";

import { setter, type Updater } from "@/lib/admin/updaters";
import { TextAreaField, TextField } from "../fields";
import { ListEditor } from "../ListEditor";

/** A list of plain strings (tools, categories, paragraphs, decisions, bullet points). */
export function StringList({
  path,
  title,
  description,
  noun,
  items,
  update,
  multiline,
}: {
  path: string;
  title: string;
  description?: string;
  /** Singular, lower case: "tool". */
  noun: string;
  items: string[];
  update: Updater<string[]>;
  multiline?: boolean;
}) {
  const Label = noun[0].toUpperCase() + noun.slice(1);
  return (
    <ListEditor
      path={path}
      title={title}
      description={description}
      noun={noun}
      items={items}
      update={update}
      create={() => ""}
      itemLabel={(_it, i) => `${Label} ${i + 1}`}
      renderItem={(it, i, up, p) =>
        multiline ? (
          <TextAreaField path={p} label={`${Label} ${i + 1}`} rows={3} value={it} onChange={setter(up)} />
        ) : (
          <TextField path={p} label={`${Label} ${i + 1}`} value={it} onChange={setter(up)} />
        )
      }
    />
  );
}
