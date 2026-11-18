"use client";

import type { Project, VisualKind } from "@/lib/content";
import { field, setter, type Updater } from "@/lib/admin/updaters";
import { ColorField } from "../ColorField";
import { CheckboxField, FieldGroup, Row, SelectField, TextAreaField, TextField } from "../fields";
import { ImageField } from "../ImageField";
import { ListEditor } from "../ListEditor";
import { StringList } from "./StringList";

const VISUALS: { value: VisualKind; label: string }[] = [
  { value: "dashboard", label: "Dashboard" },
  { value: "analytics", label: "Analytics" },
  { value: "web", label: "Web" },
  { value: "tablet", label: "Tablet" },
  { value: "system", label: "Design system" },
];

/**
 * One project: its card on the home page, then its case-study page (/work/slug). Every write goes through
 * `update`, a functional updater keyed to this project, so a late write (an upload) only touches its field.
 */
export function ProjectEditor({
  value,
  update,
  path,
  alive,
}: {
  value: Project;
  update: Updater<Project>;
  path: string;
  /** Whether this project still exists (it may be removed while an upload is in flight). */
  alive: () => boolean;
}) {
  const p = value;
  const set = <K extends keyof Project>(k: K) => setter(field(update, k));
  const story = field(update, "story");
  const setStory = <K extends keyof Project["story"]>(k: K) => setter(field(story, k));
  const palette = field(update, "palette");
  const sp = `${path}.story`;

  return (
    <div className="grid min-w-0 gap-6">
      <FieldGroup title="Card">
        <Row>
          <TextField path={`${path}.title`} label="Title" value={p.title} onChange={set("title")} />
          <TextField path={`${path}.number`} label="Number" hint="Shown on the card, e.g. 01." value={p.number} onChange={set("number")} />
        </Row>
        <TextField
          path={`${path}.slug`}
          label="Slug"
          hint={`The page address: /work/${p.slug || "…"}. Lowercase letters, digits and hyphens; must be unique.`}
          value={p.slug}
          onChange={set("slug")}
        />
        <TextAreaField path={`${path}.description`} label="Description" rows={3} value={p.description} onChange={set("description")} />
        <Row>
          <TextField path={`${path}.role`} label="Your role" value={p.role} onChange={set("role")} />
          <SelectField
            path={`${path}.visual`}
            label="Placeholder artwork"
            hint="Drawn when there is no image."
            options={VISUALS}
            value={p.visual}
            onChange={(v) => set("visual")(v as VisualKind)}
          />
        </Row>
        <TextField path={`${path}.href`} label="External link (e.g. Behance)" type="url" value={p.href} onChange={set("href")} />
        <CheckboxField
          path={`${path}.status`}
          label="Mark as a concept"
          hint="Adds a “Concept” tag to the card."
          checked={p.status === "Concept"}
          onChange={(v) => set("status")(v ? "Concept" : undefined)}
        />
        <StringList path={`${path}.categories`} title="Categories" noun="category" items={p.categories} update={field(update, "categories")} />
      </FieldGroup>

      <FieldGroup title="Cover image">
        <ImageField
          path={`${path}.image`}
          altPath={`${path}.imageAlt`}
          label="Cover image"
          image={p.image}
          alt={p.imageAlt}
          setImage={set("image")}
          setAlt={set("imageAlt")}
          alive={alive}
        />
      </FieldGroup>

      <FieldGroup title="Palette" description="Colours of the card's placeholder artwork and accents.">
        <div className="grid min-w-0 gap-4 sm:grid-cols-3">
          <ColorField path={`${path}.palette.from`} label="Gradient start" value={p.palette.from} onChange={setter(field(palette, "from"))} />
          <ColorField path={`${path}.palette.to`} label="Gradient end" value={p.palette.to} onChange={setter(field(palette, "to"))} />
          <ColorField path={`${path}.palette.ink`} label="Ink" value={p.palette.ink} onChange={setter(field(palette, "ink"))} />
        </div>
      </FieldGroup>

      <FieldGroup title="Case study page">
        <TextField path={`${sp}.seoTitle`} label="Search title" hint="The page title in search results." value={p.story.seoTitle} onChange={setStory("seoTitle")} />
        <TextAreaField path={`${sp}.seoDescription`} label="Search description" rows={3} value={p.story.seoDescription} onChange={setStory("seoDescription")} />
        <Row>
          <TextField path={`${sp}.published`} label="Published" hint="e.g. Oct 2026" value={p.story.published} onChange={setStory("published")} />
          <TextField path={`${sp}.year`} label="Year" value={p.story.year} onChange={setStory("year")} />
        </Row>
        <StringList path={`${sp}.tools`} title="Tools" noun="tool" items={p.story.tools} update={field(story, "tools")} />
        <StringList path={`${sp}.overview`} title="Overview paragraphs" noun="paragraph" multiline items={p.story.overview} update={field(story, "overview")} />
        <ListEditor
          path={`${sp}.screens`}
          title="Screens"
          noun="screen"
          items={p.story.screens}
          update={field(story, "screens")}
          create={() => ({ title: "", body: "" })}
          itemLabel={(it, i) => it.title || `Screen ${i + 1}`}
          renderItem={(it, _i, up, ip) => (
            <div className="grid min-w-0 gap-3">
              <TextField path={`${ip}.title`} label="Screen title" value={it.title} onChange={setter(field(up, "title"))} />
              <TextAreaField path={`${ip}.body`} label="Description" rows={3} value={it.body} onChange={setter(field(up, "body"))} />
            </div>
          )}
        />
        <StringList path={`${sp}.decisions`} title="Design decisions" noun="decision" multiline items={p.story.decisions} update={field(story, "decisions")} />
        <TextAreaField path={`${sp}.scope`} label="Scope note" rows={2} value={p.story.scope} onChange={setStory("scope")} />
      </FieldGroup>
    </div>
  );
}
