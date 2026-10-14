const dateFmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

export function formatDate(d: Date) {
  return dateFmt.format(d);
}

/** "just now", "5 min ago", "3 h ago", or a date. */
export function timeAgo(d: Date | null, now = Date.now()) {
  if (!d) return "Never";
  const s = Math.round((now - d.getTime()) / 1000);
  if (s < 60) return "Just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  if (s < 7 * 86400) return `${Math.floor(s / 86400)} d ago`;
  return formatDate(d);
}

export function formatNumber(n: number) {
  return n.toLocaleString("en-US");
}
