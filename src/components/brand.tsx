import { useId } from "react";
import { cn } from "@/lib/cn";
import { GOO_FILTER, markPaths } from "@/lib/brand/mark";

type MarkProps = {
  size?: number | string;
  /** Ink colour of the arms and satellites. Defaults to currentColor. */
  ink?: string;
  /** Core particle colour. Photon by default; use the ink for one-colour use. */
  core?: string;
  /** Accessible name. Omit for decorative marks. */
  title?: string;
  className?: string;
};

/** The Chronon "Molecule" mark. */
export function ChrononMark({ size = 32, ink = "currentColor", core = "var(--color-photon)", title, className }: MarkProps) {
  const filterId = `cg-${useId().replace(/:/g, "")}`;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 200 200"
      className={cn("shrink-0", className)}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      <defs>
        <filter id={filterId} x="-15%" y="-15%" width="130%" height="130%">
          <feGaussianBlur in="SourceGraphic" stdDeviation={GOO_FILTER.stdDeviation} />
          <feColorMatrix mode="matrix" values={GOO_FILTER.matrix} />
        </filter>
      </defs>
      <g filter={`url(#${filterId})`} fill={ink}>
        {markPaths.goo.map((d, i) => (
          <path key={i} d={d} />
        ))}
      </g>
      <g fill={ink}>
        {markPaths.sats.map((d, i) => (
          <path key={i} d={d} />
        ))}
      </g>
      <path d={markPaths.core} fill={core} />
    </svg>
  );
}

/** Horizontal lockup: mark + lowercase wordmark (+ optional mono tag such as "docs"). */
export function Logo({ tag, size = 26, className }: { tag?: string; size?: number; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <ChrononMark size={size} />
      <span className="font-display font-bold tracking-tighter" style={{ fontSize: size * 0.85, lineHeight: 1 }}>
        chronon
      </span>
      {tag && (
        <span className="rounded-full border border-line-dark px-1.5 py-0.5 font-mono text-[10px] text-mist-2">{tag}</span>
      )}
    </span>
  );
}
