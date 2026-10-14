/**
 * Fragment shaders for the landing page. Each one is a hand-written scene in
 * Chronon's palette: Night grounds, Photon (#DE6449) heat, Ion (#5B45C9) cool.
 * See shader-canvas.tsx for the shared uniforms and noise helpers.
 */

/**
 * Hero: light converging into a single line, a chronon. A wide funnel of
 * blue → cyan → white light with streaks flowing toward a throat, which
 * leaves as one thin Photon line.
 */
export const CONVERGENCE = /* glsl */ `
void main() {
  vec2 uv = gl_FragCoord.xy / u_res;
  float a = u_res.x / u_res.y;
  bool narrow = a < 1.0;
  vec2 p = vec2(uv.x * a, uv.y - 0.5);

  // Throat: where the light becomes a line. It stays put; pointer energy only
  // speeds up and brightens the flow (u_flow, u_energy).
  float x0 = a * (narrow ? 0.72 : 0.64);
  p.y -= narrow ? 0.33 : 0.11;
  float boost = 1.0 + u_energy * 0.55;
  float d = x0 - p.x;

  vec3 col = vec3(0.022, 0.028, 0.05);

  vec3 deep = vec3(0.04, 0.09, 0.32);
  vec3 cyan = vec3(0.30, 0.74, 0.96);
  vec3 white = vec3(0.93, 0.97, 1.0);
  vec3 ion = vec3(0.36, 0.27, 0.79);

  if (d > 0.0) {
    float t = clamp(d / x0, 0.0, 1.4);
    float w = 0.003 + 0.6 * pow(t, 1.75);
    float ay = abs(p.y);
    float v = p.y / max(w, 1e-3);
    float inside = 1.0 - smoothstep(w * 0.45, w, ay);
    float rim = exp(-pow((ay - w * 0.94) / (w * 0.07 + 0.0015), 2.0));

    // Streaks travel toward the throat and narrow with the funnel.
    float s1 = fbm(vec2(d * 2.0 - u_flow * 0.32, v * 2.6 + 1.7));
    float s2 = fbm(vec2(d * 5.5 - u_flow * 0.65, v * 8.0 - 3.1));
    float streak = pow(s1, 2.2) * 1.5 + pow(s2, 4.0) * 1.6;
    float near = exp(-t * 3.2);

    vec3 c = mix(deep, cyan, smoothstep(1.0, 0.15, t));
    c = mix(c, white, near * 0.9);
    c = mix(c, ion, smoothstep(0.45, 1.0, abs(v)) * 0.65 * clamp(t * 1.4, 0.0, 1.0));

    float core = exp(-abs(v) * 1.6);
    float body = inside * (0.34 + core * 0.42 + streak * 0.55) * (0.42 + 0.58 * (1.0 - t * 0.55));
    col += c * body * boost;
    col += mix(ion * 1.3, cyan, near) * rim * 0.32 * (1.0 - t * 0.45) * boost;
  } else {
    // The line: one bright thread, warming from white to Photon as it leaves.
    float L = -d;
    float core = exp(-abs(p.y) / (0.0013 + L * 0.0006));
    float halo = exp(-abs(p.y) * 48.0) * 0.22;
    vec3 photon = vec3(0.87, 0.39, 0.29);
    vec3 magenta = vec3(0.86, 0.27, 0.62);
    vec3 lc = mix(white, mix(magenta, photon, smoothstep(0.1, 1.4, L)), smoothstep(0.0, 0.3, L));
    // A faint pulse travels along the line, quicker when the flow is energised.
    float pulse = 0.85 + 0.15 * sin(L * 9.0 - u_flow * 4.0);
    col += lc * (core * 1.2 + halo) * (0.3 + 0.7 * exp(-L * 0.7)) * pulse * (1.0 + u_energy * 0.4);
  }

  // The throat itself, white-hot.
  float g = exp(-length(vec2(d * 1.4, p.y)) * 10.0);
  col += vec3(0.88, 0.93, 1.0) * g * (1.0 + u_energy * 0.5);

  // Vignette and film grain.
  col *= 1.0 - 0.45 * pow(length((uv - vec2(0.55, 0.55)) * vec2(1.0, 1.1)), 2.2);
  col += grain(gl_FragCoord.xy, u_time) * 0.04;
  gl_FragColor = vec4(col, 1.0);
}
`;

/**
 * A stippled colonnade on a light ground, dissolving upward into particles:
 * Ion at the top, Photon at the base. Open source as a public building.
 */
export const COLONNADE = /* glsl */ `
float box(vec2 q, vec2 lo, vec2 hi) { return step(lo.x, q.x) * step(q.x, hi.x) * step(lo.y, q.y) * step(q.y, hi.y); }

void main() {
  vec2 q = (gl_FragCoord.xy - 0.5 * u_res) / u_res.y;
  q.x += (u_mouse.x - 0.5) * 0.02;
  q.y += 0.06;
  float W = 0.42;

  // Structure: steps, eight columns, entablature, pediment.
  float steps = box(q, vec2(-W - 0.03, -0.36), vec2(W + 0.03, -0.3));
  float cw = (2.0 * (W - 0.03)) / 8.0;
  float cx = fract((q.x + W - 0.03) / cw);
  float cols = box(q, vec2(-W + 0.03, -0.3), vec2(W - 0.03, 0.05)) * step(0.2, cx) * step(cx, 0.8);
  float ent = box(q, vec2(-W, 0.05), vec2(W, 0.11));
  float ped = step(0.11, q.y) * step(q.y, 0.11 + 0.13 * (1.0 - abs(q.x) / W)) * step(abs(q.x), W);
  float solid = max(max(steps, cols), max(ent, ped));
  float roof = abs(q.x) < W ? 0.11 + 0.13 * (1.0 - abs(q.x) / W) : -1.0;

  vec3 paper = vec3(0.935, 0.94, 0.965);
  vec3 col = paper;
  // Warm glow pooling under the base, cool haze above.
  col = mix(col, vec3(1.0, 0.62, 0.45), exp(-length((q - vec2(0.0, -0.38)) * vec2(0.9, 4.0)) * 3.0) * 0.55);
  col = mix(col, vec3(0.78, 0.8, 0.98), exp(-length(q - vec2(0.0, 0.12)) * 2.4) * 0.35);

  vec3 blue = vec3(0.24, 0.27, 0.78);
  vec3 orange = vec3(1.0, 0.42, 0.24);
  vec3 tint = mix(orange, blue, smoothstep(-0.32, 0.18, q.y));

  // Dots on a 3px grid; particles above the roof drift upward.
  float above = roof > 0.0 && q.y > roof ? 1.0 : 0.0;
  float lane = floor(gl_FragCoord.x / 3.0);
  float speed = 6.0 + hash(vec2(lane, 3.1)) * 22.0;
  vec2 cell = floor((gl_FragCoord.xy - vec2(0.0, above * u_time * speed)) / 3.0);
  float r = hash(cell);
  float density = solid * (0.55 + 0.4 * smoothstep(-0.36, 0.2, q.y));
  float rise = above * exp(-(q.y - roof) * (6.0 + hash(vec2(lane, 9.0)) * 18.0)) * 0.75;
  density = max(density, rise);
  // Columns fade into light at their feet.
  density *= mix(0.35, 1.0, smoothstep(-0.36, -0.12, q.y));
  float dotMask = step(r, density) * smoothstep(0.62, 0.2, length(fract((gl_FragCoord.xy - vec2(0.0, above * u_time * speed)) / 3.0) - 0.5));

  // Fine vertical streaks inside the solid, like the long-exposure columns in the reference.
  float streak = solid * step(0.55, hash(vec2(lane, 1.0))) * 0.35 * smoothstep(-0.36, 0.1, q.y);

  col = mix(col, tint, clamp(dotMask * 0.92 + streak, 0.0, 1.0));
  col += grain(gl_FragCoord.xy, u_time) * 0.03;
  gl_FragColor = vec4(col, 1.0);
}
`;

/**
 * A swirling ring of light, domain-warped noise in polar space, cyan and
 * Ion-soft with white-hot filaments. Frames the mark in the closing call to action.
 */
export const PORTAL = /* glsl */ `
void main() {
  vec2 p = (gl_FragCoord.xy - 0.5 * u_res) / u_res.y;
  p += (u_mouse - 0.5) * 0.03;
  float r = length(p);
  float ang = atan(p.y, p.x);
  float t = u_time * 0.22;

  vec2 q = vec2(cos(ang), sin(ang)) * (1.0 + r * 2.0);
  vec2 w = vec2(fbm(q * 1.4 + vec2(t, 0.0)), fbm(q * 1.4 + vec2(5.2, -t)));
  float n = fbm(q * 1.7 + w * 2.6 + vec2(t * 0.6, -t * 0.4));

  float R = 0.27;
  float band = (r - R - (n - 0.5) * 0.14) / 0.085;
  float ring = exp(-band * band);
  float fil = pow(abs(sin(n * 9.0 + ang * 3.0 + t * 3.0)), 14.0);
  float energy = ring * (0.18 + 1.7 * pow(n, 2.6)) + fil * ring * 0.9;

  vec3 deep = vec3(0.07, 0.16, 0.32);
  vec3 cyan = vec3(0.45, 0.95, 0.92);
  vec3 ionSoft = vec3(0.71, 0.64, 0.95);
  vec3 c = mix(deep, mix(ionSoft, cyan, smoothstep(0.35, 0.75, n)), clamp(energy, 0.0, 1.0));
  vec3 col = vec3(0.022, 0.028, 0.05) + c * energy;
  col += vec3(0.95, 1.0, 1.0) * pow(clamp(energy - 0.85, 0.0, 1.0), 1.5) * 1.4;
  col += cyan * exp(-r * 4.0) * 0.06;
  col += grain(gl_FragCoord.xy, u_time) * 0.035;
  gl_FragColor = vec4(col, 1.0);
}
`;

/**
 * Light, grainy pastel dunes for the footer: soft colour hills under a white
 * haze, heavy film grain.
 */
export const PASTEL = /* glsl */ `
void main() {
  vec2 uv = gl_FragCoord.xy / u_res;
  float a = u_res.x / u_res.y;
  float x = uv.x * a;
  float t = u_time * 0.025;

  vec3 col = vec3(0.965, 0.965, 0.985);
  col = mix(col, vec3(1.0, 0.86, 0.85), smoothstep(0.85, 0.35, uv.y) * 0.65);

  vec3 pal[5];
  pal[0] = vec3(0.62, 0.55, 0.98);
  pal[1] = vec3(0.36, 0.40, 0.92);
  pal[2] = vec3(1.0, 0.36, 0.52);
  pal[3] = vec3(0.98, 0.52, 0.30);
  pal[4] = vec3(0.86, 0.22, 0.24);

  for (int i = 0; i < 5; i++) {
    float fi = float(i);
    float h = 0.4 - fi * 0.07
      + 0.07 * sin(x * (1.1 + fi * 0.25) + fi * 1.9 + t * 2.0)
      + 0.08 * (fbm(vec2(x * 1.1 + fi * 3.3, t + fi)) - 0.5);
    float m = smoothstep(h + 0.07, h - 0.05, uv.y);
    vec3 c = pal[0];
    if (i == 1) c = pal[1];
    if (i == 2) c = pal[2];
    if (i == 3) c = pal[3];
    if (i == 4) c = pal[4];
    // A yellow-green sheen where layers overlap, like the reference.
    c = mix(c, vec3(0.85, 0.9, 0.55), exp(-abs(uv.y - h) * 40.0) * 0.25);
    col = mix(col, c, m * 0.82);
  }
  col += grain(gl_FragCoord.xy, u_time) * 0.14;
  gl_FragColor = vec4(col, 1.0);
}
`;
