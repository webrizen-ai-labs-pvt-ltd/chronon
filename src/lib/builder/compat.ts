import type { Collection, DatasetDefinition, Field } from "./definition";

/**
 * Lists the changes from `before` to `after` that would break existing
 * clients. Published versions only accept changes with no breaking entries;
 * anything else goes into a new major version (/v2, /v3…).
 */
export function breakingChanges(before: DatasetDefinition, after: DatasetDefinition): string[] {
  const out: string[] = [];
  const next = new Map(after.collections.map((c) => [c.slug, c]));

  for (const old of before.collections) {
    const c = next.get(old.slug);
    if (!c) {
      out.push(`Collection "${old.slug}" was removed.`);
      continue;
    }
    collectionChanges(old, c, out);
  }
  if (before.randomAlias && before.randomAlias !== after.randomAlias) out.push("The /random shortcut was changed or removed.");
  return out;
}

function collectionChanges(old: Collection, c: Collection, out: string[]) {
  const at = (s: string) => out.push(`${old.slug}: ${s}`);
  const fields = new Map(c.fields.map((f) => [f.key, f]));
  for (const of of old.fields) {
    const f = fields.get(of.key);
    if (!f) at(`field "${of.key}" was removed.`);
    else fieldChanges(of, f, (s) => at(`field "${of.key}" ${s}`));
  }
  for (const f of c.fields) {
    if (!old.fields.some((x) => x.key === f.key) && f.required) at(`new field "${f.key}" is required (add it as optional first).`);
  }

  if (old.list.enabled && !c.list.enabled) at("the list endpoint was turned off.");
  if (old.list.enabled && c.list.enabled) {
    if (old.list.paginate !== c.list.paginate) at("pagination was switched on or off.");
    if (c.list.maxLimit < old.list.maxLimit) at("the maximum page size went down.");
    if (c.list.defaultLimit !== old.list.defaultLimit) at("the default page size changed.");
  }
  if (old.detail.enabled && !c.detail.enabled) at("the detail endpoint was turned off.");
  for (const inc of old.detail.include) {
    if (!c.detail.include.some((x) => x.as === inc.as && x.collection === inc.collection && x.via === inc.via && x.omitVia === inc.omitVia)) {
      at(`related list "${inc.as}" was removed or changed.`);
    }
  }
  if (old.random.enabled && !c.random.enabled) at("the random endpoint was turned off.");
  if (old.random.enabled && c.random.enabled && c.random.maxCount < old.random.maxCount) at("the random count limit went down.");

  for (const fl of old.filters) {
    const n = c.filters.find((x) => x.param === fl.param);
    if (!n) at(`filter "${fl.param}" was removed.`);
    else if (n.path !== fl.path || n.op !== fl.op || n.caseInsensitive !== fl.caseInsensitive || JSON.stringify(n.implies ?? null) !== JSON.stringify(fl.implies ?? null)) {
      at(`filter "${fl.param}" now behaves differently.`);
    }
  }
  if (old.search.enabled) {
    if (!c.search.enabled) at("search was turned off.");
    else if (c.search.param !== old.search.param) at(`the search parameter was renamed from "${old.search.param}".`);
  }
  for (const n of old.counts) if (!c.counts.some((x) => x.key === n.key)) at(`count "${n.key}" was removed.`);
}

function fieldChanges(of: Field, f: Field, at: (s: string) => void) {
  if (of.type !== f.type) return at(`changed type from ${of.type} to ${f.type}.`);
  if (!of.required && f.required) at("became required.");
  if (f.maxLength !== undefined && (of.maxLength === undefined || f.maxLength < of.maxLength)) at("got a shorter maximum length.");
  if (f.pattern !== undefined && f.pattern !== of.pattern) at("got a new pattern.");
  if (f.min !== undefined && (of.min === undefined || f.min > of.min)) at("got a higher minimum.");
  if (f.max !== undefined && (of.max === undefined || f.max < of.max)) at("got a lower maximum.");
  if (of.itemType !== f.itemType) at("changed its item type.");
  const removed = (of.values ?? []).filter((v) => !(f.values ?? []).includes(v));
  if (removed.length) at(`lost allowed values: ${removed.join(", ")}.`);
  if (of.target !== f.target) at("points at a different collection.");
  const lostEmbed = (of.embed ?? []).filter((e) => !(f.embed ?? []).includes(e));
  if (lostEmbed.length || (of.embed?.length && !f.embed?.length)) at("embeds fewer fields.");
  if (!of.embed?.length && f.embed?.length) at("switched from a slug to an embedded object.");
}
