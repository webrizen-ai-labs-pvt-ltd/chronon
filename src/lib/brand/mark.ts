/**
 * Geometry of the Chronon "Molecule" mark, ported from brand/reference.
 * viewBox 0 0 200 200, centre (100,100). Six arms start at −90° and step 60°
 * clockwise. Stems, branches and nodes are fused by the goo filter;
 * satellites and the core are not.
 */
const f = (n: number) => n.toFixed(2);

function dot(x: number, y: number, r: number) {
  return `M${f(x - r)} ${f(y)}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0Z`;
}

function pol(r: number, deg: number): [number, number] {
  const a = (deg * Math.PI) / 180;
  return [100 + r * Math.cos(a), 100 + r * Math.sin(a)];
}

function cap(a: [number, number], b: [number, number], w: number) {
  const h = w / 2;
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  const nx = (-(b[1] - a[1]) / L) * h;
  const ny = ((b[0] - a[0]) / L) * h;
  return `M${f(a[0] + nx)} ${f(a[1] + ny)}L${f(b[0] + nx)} ${f(b[1] + ny)}A${h} ${h} 0 0 0 ${f(b[0] - nx)} ${f(b[1] - ny)}L${f(a[0] - nx)} ${f(a[1] - ny)}A${h} ${h} 0 0 0 ${f(a[0] + nx)} ${f(a[1] + ny)}Z`;
}

function build() {
  const goo: string[] = [];
  const sats: string[] = [];
  for (let k = 0; k < 6; k++) {
    const t = k * 60 - 90;
    const s = pol(20, t);
    const m = pol(46, t);
    const a = pol(82, t + 22);
    const b = pol(64, t - 18);
    const sat = pol(49, t + 31);
    goo.push(cap(s, m, 12), cap(m, a, 11), cap(m, b, 11), dot(a[0], a[1], 11), dot(b[0], b[1], 9));
    sats.push(dot(sat[0], sat[1], 6.5));
  }
  // Kept as separate paths: merging them could cancel out overlaps with opposite winding.
  return { goo, sats, core: dot(100, 100, 7) };
}

export const markPaths = build();

/** Goo filter: blur, then sharpen alpha, which fuses touching shapes with smooth fillets. */
export const GOO_FILTER = { stdDeviation: 2.6, matrix: "1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 22 -9" };

const paths = (ds: string[]) => ds.map((d) => `<path d="${d}"/>`).join("");

/** Standalone SVG markup, e.g. for image generation. */
export function markSvg({ ink = "#0F1220", core = "#DE6449", size = 200 } = {}) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="${size}" height="${size}"><defs><filter id="cg" x="-15%" y="-15%" width="130%" height="130%"><feGaussianBlur in="SourceGraphic" stdDeviation="${GOO_FILTER.stdDeviation}"/><feColorMatrix mode="matrix" values="${GOO_FILTER.matrix}"/></filter></defs><g filter="url(#cg)" fill="${ink}">${paths(markPaths.goo)}</g><g fill="${ink}">${paths(markPaths.sats)}</g><path fill="${core}" d="${markPaths.core}"/></svg>`;
}
