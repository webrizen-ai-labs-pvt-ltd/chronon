/** "Dishes" → "dish", "Regions" → "region", "Cities" → "city". Good enough for English labels. */
export function singular(name: string) {
  const w = name.toLowerCase();
  if (/ies$/.test(w)) return w.replace(/ies$/, "y");
  if (/(ss|sh|ch|x|z)es$/.test(w)) return w.replace(/es$/, "");
  if (/s$/.test(w) && !/ss$/.test(w)) return w.slice(0, -1);
  return w;
}

/** "Crème Brûlée & Co." → "creme-brulee-and-co". Record slugs from free text. */
export function slugify(text: string, max = 48) {
  return text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, max)
    .replace(/-+$/, "");
}

/** "Country Code" → "country_code". Field keys from column headers. */
export function toKey(text: string, max = 40) {
  const k = text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, max)
    .replace(/_+$/, "");
  if (!k) return "";
  return /^[a-z]/.test(k) ? k : `f_${k}`.slice(0, max);
}
