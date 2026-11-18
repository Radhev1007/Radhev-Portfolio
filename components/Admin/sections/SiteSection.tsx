"use client";

import type { SiteData } from "@/lib/content";
import { field, setter, type Updater } from "@/lib/admin/updaters";
import { CheckboxField, FieldGroup, Row, SelectField, TextAreaField, TextField } from "../fields";
import { ListEditor } from "../ListEditor";

const SOCIAL_ICONS = ["behance", "dribbble", "pinterest", "linkedin", "instagram"].map((v) => ({
  value: v,
  label: v[0].toUpperCase() + v.slice(1),
}));

const CTA_TARGETS = [
  { value: "work", label: "Work" },
  { value: "experience", label: "Experience" },
  { value: "contact", label: "Contact" },
  { value: "home", label: "Top of the page" },
];

export function SiteSection({ value, update }: { value: SiteData; update: Updater<SiteData> }) {
  const s = value;
  const set = <K extends keyof SiteData>(k: K) => setter(field(update, k));
  const name = field(update, "name");
  const hero = field(update, "heroTitle");
  const ctas = field(update, "heroCtas");
  const cta = field(ctas, "secondary");
  return (
    <div className="grid gap-6">
      <FieldGroup title="Name and role">
        <Row>
          <TextField path="site.name.first" label="First name" value={s.name.first} onChange={setter(field(name, "first"))} />
          <TextField path="site.name.last" label="Last name" value={s.name.last} onChange={setter(field(name, "last"))} />
        </Row>
        <Row>
          <TextField path="site.brand" label="Brand (wordmark and page titles)" value={s.brand} onChange={set("brand")} />
          <TextField path="site.role" label="Role" value={s.role} onChange={set("role")} />
        </Row>
        <TextField path="site.location" label="Location" value={s.location} onChange={set("location")} />
      </FieldGroup>

      <FieldGroup title="Hero headline" description="The headline is set as four parts; the accent part is highlighted.">
        <Row>
          <TextField path="site.heroTitle.lead" label="Lead" value={s.heroTitle.lead} onChange={setter(field(hero, "lead"))} />
          <TextField path="site.heroTitle.mid" label="Middle" value={s.heroTitle.mid} onChange={setter(field(hero, "mid"))} />
        </Row>
        <Row>
          <TextField path="site.heroTitle.tail" label="Tail" value={s.heroTitle.tail} onChange={setter(field(hero, "tail"))} />
          <TextField path="site.heroTitle.accent" label="Accent" value={s.heroTitle.accent} onChange={setter(field(hero, "accent"))} />
        </Row>
        <TextAreaField path="site.statement" label="Statement" value={s.statement} onChange={set("statement")} />
        <Row>
          <TextField
            path="site.heroCtas.secondary.label"
            label="Second button label"
            value={s.heroCtas.secondary.label}
            onChange={setter(field(cta, "label"))}
          />
          <SelectField
            path="site.heroCtas.secondary.target"
            label="Second button scrolls to"
            options={CTA_TARGETS}
            value={s.heroCtas.secondary.target}
            onChange={setter(field(cta, "target"))}
          />
        </Row>
      </FieldGroup>

      <FieldGroup title="Availability">
        <CheckboxField path="site.available" label="Available for work" checked={s.available} onChange={set("available")} />
        <TextField path="site.availabilityLabel" label="Availability label" value={s.availabilityLabel} onChange={set("availabilityLabel")} />
      </FieldGroup>

      <FieldGroup title="Contact and links">
        <Row>
          <TextField path="site.email" label="Email" type="email" value={s.email} onChange={set("email")} />
          <TextField path="site.phone" label="Phone" type="tel" value={s.phone} onChange={set("phone")} />
        </Row>
        <TextField path="site.whatsapp" label="WhatsApp link" type="url" hint="e.g. https://wa.me/91…" value={s.whatsapp} onChange={set("whatsapp")} />
        <TextField path="site.resume" label="CV / résumé link" type="url" value={s.resume} onChange={set("resume")} />
        <TextField path="site.url" label="Site address" type="url" hint="Used for search engines and share links." value={s.url} onChange={set("url")} />
      </FieldGroup>

      <FieldGroup title="Social profiles">
        <ListEditor
          path="site.socials"
          title="Profiles"
          description="Shown as icons in the hero, in this order."
          noun="profile"
          items={s.socials}
          update={field(update, "socials")}
          create={() => ({ label: "", href: "", icon: "linkedin" })}
          itemLabel={(it, i) => it.label || `Profile ${i + 1}`}
          renderItem={(it, _i, up, p) => (
            <Row>
              <TextField path={`${p}.label`} label="Name" value={it.label} onChange={setter(field(up, "label"))} />
              <SelectField path={`${p}.icon`} label="Icon" options={SOCIAL_ICONS} value={it.icon} onChange={setter(field(up, "icon"))} />
              <div className="sm:col-span-2">
                <TextField path={`${p}.href`} label="Link" type="url" value={it.href} onChange={setter(field(up, "href"))} />
              </div>
            </Row>
          )}
        />
      </FieldGroup>
    </div>
  );
}
