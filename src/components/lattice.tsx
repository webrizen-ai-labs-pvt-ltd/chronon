import { cx } from "@/utils/cx";

/**
 * A full-bleed band on the hairline lattice: the content column is framed by
 * two rails, the band is closed by a rule, and "+" marks sit at the crossings.
 * `dark` switches the band (and every Untitled UI component in it) to Night.
 */
export function Band({
  dark,
  id,
  className,
  railsClassName,
  children,
}: {
  dark?: boolean;
  id?: string;
  className?: string;
  railsClassName?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className={cx("lattice", dark ? "dark-mode bg-night text-paper" : "bg-paper", className)}>
      <div className={cx("rails", railsClassName)}>{children}</div>
    </section>
  );
}

/** "01 · How it works" style heading row, ruled off from the content below. */
export function BandHead({
  index,
  kicker,
  title,
  lead,
  aside,
}: {
  index: string;
  kicker: string;
  title: React.ReactNode;
  lead?: React.ReactNode;
  aside?: React.ReactNode;
}) {
  return (
    <header className="section-head grid gap-6 px-5 py-14 sm:px-8 md:grid-cols-[1fr_auto] md:items-end md:py-20" data-reveal>
      <div className="flex max-w-[720px] flex-col gap-4">
        <p className="label text-slate dark:text-mist-2">
          {index} · {kicker}
        </p>
        <h2 className="text-[40px] leading-[0.98] font-bold tracking-[-0.035em] text-balance sm:text-[52px]">{title}</h2>
        {lead && <p className="max-w-[600px] text-[19px] leading-normal text-pretty text-ink-2 dark:text-mist">{lead}</p>}
      </div>
      {aside}
    </header>
  );
}
