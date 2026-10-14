"use client";

import { useEffect, useRef } from "react";
import { cx } from "@/utils/cx";

/**
 * Prelude prepended to every fragment shader:
 *   u_res    canvas size in pixels
 *   u_time   seconds since start (frozen under reduced motion)
 *   u_mouse  pointer over the canvas, 0..1 (smoothed, 0.5 when away)
 *   u_scroll reserved (always 0; scroll is not tracked so scrolling stays cheap)
 *   u_energy pointer activity, 0..1: jumps with fast movement, then settles
 *   u_flow   a clock that runs faster while u_energy is high (use it for motion
 *            that should speed up without jumping)
 * plus small noise helpers shared by all the scenes.
 */
const PRELUDE = /* glsl */ `
precision highp float;
uniform vec2 u_res;
uniform float u_time;
uniform vec2 u_mouse;
uniform float u_scroll;
uniform float u_energy;
uniform float u_flow;

float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  mat2 r = mat2(0.8, 0.6, -0.6, 0.8);
  for (int i = 0; i < 4; i++) { v += a * noise(p); p = r * p * 2.02; a *= 0.5; }
  return v;
}
float grain(vec2 frag, float t) { return hash(frag + fract(t * 7.0) * 113.0) - 0.5; }
`;

const VERT = "attribute vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }";

type Props = {
  /** Fragment shader body (must define main). The prelude above is prepended. */
  frag: string;
  className?: string;
  /** Max device-pixel ratio. Heavy scenes use less. */
  maxDpr?: number;
  /** Seconds of time to show when motion is reduced. */
  stillTime?: number;
  /**
   * Render resolution relative to the device-pixel size (after maxDpr). Soft,
   * glowing scenes look identical at 0.5–0.75 and cost a fraction of the GPU.
   */
  scale?: number;
};

/**
 * A full-bleed WebGL fragment-shader canvas. It renders only while on screen,
 * caps resolution, freezes into a still frame under prefers-reduced-motion,
 * and leaves its parent's CSS background visible if WebGL is unavailable.
 */
export function ShaderCanvas({ frag, className, maxDpr = 1.5, stillTime = 8, scale = 1 }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const gl = canvas.getContext("webgl", { alpha: true, antialias: false, premultipliedAlpha: false, powerPreference: "low-power" });
    if (!gl) return;

    const compile = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        console.warn("[chronon] shader compile failed", gl.getShaderInfoLog(s));
        return null;
      }
      return s;
    };
    const vs = compile(gl.VERTEX_SHADER, VERT);
    const fs = compile(gl.FRAGMENT_SHADER, PRELUDE + frag);
    if (!vs || !fs) return;
    const prog = gl.createProgram()!;
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.warn("[chronon] shader link failed", gl.getProgramInfoLog(prog));
      return;
    }
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, "p");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    const uRes = gl.getUniformLocation(prog, "u_res");
    const uTime = gl.getUniformLocation(prog, "u_time");
    const uMouse = gl.getUniformLocation(prog, "u_mouse");
    const uScroll = gl.getUniformLocation(prog, "u_scroll");
    const uEnergy = gl.getUniformLocation(prog, "u_energy");
    const uFlow = gl.getUniformLocation(prog, "u_flow");

    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const mouse = { x: 0.5, y: 0.5, tx: 0.5, ty: 0.5 };
    // Pointer energy: fast movement pushes it up, it decays back to calm.
    const motion = { lastX: 0, lastY: 0, lastT: 0, target: 0, energy: 0, flow: 0 };
    // Canvas box in document coordinates, kept fresh by ResizeObserver, so the
    // render loop and pointer handler never force a layout.
    const box = { left: 0, top: 0, width: 1, height: 1 };
    let visible = false;
    let frame = 0;
    let prev = performance.now();
    const start = prev;

    const measure = () => {
      const r = canvas.getBoundingClientRect();
      box.left = r.left + scrollX;
      box.top = r.top + scrollY;
      box.width = r.width || 1;
      box.height = r.height || 1;
      const dpr = Math.min(devicePixelRatio || 1, innerWidth < 768 ? 1 : maxDpr) * scale;
      const w = Math.max(1, Math.round(box.width * dpr));
      const h = Math.max(1, Math.round(box.height * dpr));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      // Always (re)send: a fresh program (e.g. React re-running this effect in dev
      // on a canvas that already has its size) starts with u_res = 0,0, which
      // renders black until the next resize.
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform2f(uRes, canvas.width, canvas.height);
    };
    measure();
    gl.uniform1f(uScroll, 0);

    const draw = () => {
      const now = performance.now();
      const dt = Math.min(0.05, (now - prev) / 1000);
      prev = now;
      mouse.x += (mouse.tx - mouse.x) * 0.06;
      mouse.y += (mouse.ty - mouse.y) * 0.06;
      motion.target *= 0.94;
      motion.energy += (motion.target - motion.energy) * 0.08;
      motion.flow += dt * (1 + motion.energy * 3.5);
      gl.uniform1f(uTime, reduce ? stillTime : (now - start) / 1000);
      gl.uniform2f(uMouse, mouse.x, mouse.y);
      gl.uniform1f(uEnergy, reduce ? 0 : motion.energy);
      gl.uniform1f(uFlow, reduce ? stillTime : motion.flow);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };

    const loop = () => {
      draw();
      if (visible && !reduce && !document.hidden) frame = requestAnimationFrame(loop);
    };
    const restart = () => {
      cancelAnimationFrame(frame);
      if (visible && !document.hidden) loop();
    };

    const io = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting;
        if (visible) measure();
        restart();
      },
      { rootMargin: "120px" },
    );
    io.observe(canvas);
    const ro = new ResizeObserver(() => {
      measure();
      if (reduce && visible) draw();
    });
    ro.observe(canvas);

    const onPointer = (e: PointerEvent) => {
      if (!visible || e.pointerType === "touch") return;
      const x = e.pageX - box.left;
      const y = e.pageY - box.top;
      const inside = x >= 0 && x <= box.width && y >= 0 && y <= box.height;
      mouse.tx = inside ? x / box.width : 0.5;
      mouse.ty = inside ? 1 - y / box.height : 0.5;
      if (inside) {
        const dtMs = Math.max(1, e.timeStamp - motion.lastT);
        const speed = Math.hypot(e.clientX - motion.lastX, e.clientY - motion.lastY) / dtMs; // px per ms
        motion.target = Math.min(1, Math.max(motion.target, speed / 2.5));
        motion.lastX = e.clientX;
        motion.lastY = e.clientY;
        motion.lastT = e.timeStamp;
      }
    };
    addEventListener("pointermove", onPointer, { passive: true });
    document.addEventListener("visibilitychange", restart);
    canvas.dataset.ready = "";

    return () => {
      cancelAnimationFrame(frame);
      io.disconnect();
      ro.disconnect();
      removeEventListener("pointermove", onPointer);
      document.removeEventListener("visibilitychange", restart);
      gl.deleteProgram(prog);
      gl.deleteBuffer(buf);
    };
  }, [frag, maxDpr, stillTime, scale]);

  return (
    <canvas
      ref={ref}
      aria-hidden
      className={cx("pointer-events-none absolute inset-0 h-full w-full opacity-0 transition-opacity duration-1000 data-ready:opacity-100", className)}
    />
  );
}
