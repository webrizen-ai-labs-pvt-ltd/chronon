import { ArrowRight, BookOpen01, Code02 } from "@untitledui/icons";
import Image from "next/image";
import Link from "next/link";
import { encodeCursor, filterDishes, getCatalog } from "@/apis/menus/catalog";
import { normalize } from "@/apis/menus/match";
import { Button } from "@/components/base/buttons/button";
import { ChrononMark } from "@/components/brand";
import { CopyButton } from "@/components/copy-button";
import { CodeTabs } from "@/components/landing/code-tabs";
import { Explorer, type ExplorerDish } from "@/components/landing/explorer";
import { LandingNav } from "@/components/landing/landing-nav";
import { SiteFooter } from "@/components/site-footer";
import { COLONNADE, CONVERGENCE, PORTAL } from "@/components/vfx/scenes";
import { ShaderCanvas } from "@/components/vfx/shader-canvas";
import { MAX_ACTIVE_KEYS, tiers } from "@/lib/limits";
import { landingImages } from "@/lib/landing";
import { apiBase, site } from "@/lib/site";
import { cx } from "@/utils/cx";

const features = [
  {
    title: "Keys you control",
    body: `Up to ${MAX_ACTIVE_KEYS} per account. We keep a SHA-256 hash, never the key. Revoking lands within a minute.`,
  },
  { title: "Limits you can see", body: "X-RateLimit and X-Quota headers on every response, so you can slow down before you're told to." },
  { title: "One error shape", body: "Every failure is the same JSON: a stable code, a readable message and a link to the fix." },
  { title: "Servers or browsers", body: "Plain HTTPS and JSON, CORS open everywhere. No SDK to install, nothing to learn." },
  { title: "/v1 never moves", body: "Breaking changes ship as /v2. What you build today keeps working tomorrow." },
  { title: "Open, all the way down", body: "Code, data and limits are MIT-licensed. Fix a dish, add a region, propose an API." },
];

const steps = [
  { title: "Sign in with Webrizen", body: "The account you already use across Webrizen products. No new password." },
  { title: "Create a key", body: "Name it after your project and copy it. It's shown once, stored as a hash." },
  { title: "Call /v1", body: "Send it as a bearer token. That's the whole integration." },
];

const faqs = [
  { q: "Is it really free?", a: "Yes. There's no paid plan and nothing to upgrade to. Webrizen builds and hosts the APIs and covers the servers." },
  {
    q: "Then why do I need a key?",
    a: "Keys aren't for billing. They tell us which account a request belongs to, so limits stay fair and one runaway script can't take the service down for everyone.",
  },
  {
    q: "What happens when I hit a limit?",
    a: "You get a 429 with a Retry-After header and a JSON body naming the limit. The headers on every response let you back off before that.",
  },
  {
    q: "How accurate is the menu data?",
    a: "Curated by hand and reviewed in pull requests. Diet labels describe the traditional recipe; check with the kitchen when it matters for allergies or faith.",
  },
  {
    q: "Can I get higher limits?",
    a: "Open-source, educational and non-profit projects can ask for the Elevated tier (300 a minute, 500,000 a month) by opening an issue.",
  },
];

function Kicker({ index, children, className }: { index: string; children: React.ReactNode; className?: string }) {
  return (
    <p className={cx("caption flex items-center gap-3", className)}>
      <span className="opacity-60">{index}</span>
      <span className="h-px w-8 bg-current opacity-30" />
      {children}
    </p>
  );
}

const reveal = (i: number) => ({ "--reveal-delay": `${i * 90}ms` }) as React.CSSProperties;

export default function Home() {
  const { regions, dishes } = getCatalog();
  const standard = tiers.standard;
  const countries = [...new Map(regions.map((r) => [r.country_code, { code: r.country_code, name: r.country }])).values()];
  const host = apiBase.replace(/^https?:\/\//, "");

  const explorerDishes: ExplorerDish[] = dishes.map((d) => ({
    slug: d.slug,
    name: d.name,
    local_name: d.local_name,
    description: d.description,
    course: d.course,
    diet: d.diet,
    spice_level: d.spice_level,
    region: d.region.name,
    country: d.region.country_code,
    search: normalize([d.name, d.local_name ?? "", d.region.name, ...d.ingredients, ...d.tags].join(" ")),
  }));

  const samples = [
    { id: "curl", label: "cURL", code: `curl "${apiBase}/menus/dishes?region=kerala&diet=vegan&limit=1" \\\n  -H "Authorization: Bearer $CHRONON_KEY"` },
    {
      id: "js",
      label: "JavaScript",
      code: `const res = await fetch("${apiBase}/menus/dishes?region=kerala&diet=vegan&limit=1", {
  headers: { Authorization: \`Bearer \${process.env.CHRONON_KEY}\` },
});
const { data, next_cursor } = await res.json();`,
    },
    {
      id: "python",
      label: "Python",
      code: `import os, requests

res = requests.get(
    "${apiBase}/menus/dishes",
    params={"region": "kerala", "diet": "vegan", "limit": 1},
    headers={"Authorization": f"Bearer {os.environ['CHRONON_KEY']}"},
)
print(res.json()["data"])`,
    },
  ];
  // The sample response is computed from the real data, so it never drifts.
  const sample = filterDishes(getCatalog(), { region: "kerala", diet: "vegan" });
  const response = JSON.stringify(
    {
      data: sample.slice(0, 1).map((d) => ({ slug: d.slug, name: d.name, course: d.course, diet: d.diet, spice_level: d.spice_level })),
      total: sample.length,
      next_cursor: sample.length > 1 ? encodeCursor(1) : null,
    },
    null,
    2,
  );

  return (
    <div className="dark-mode bg-night text-paper">
      <main className="overflow-x-clip">
        {/* ============================================================ hero: convergence */}
        <section className="relative isolate flex min-h-[760px] flex-col bg-[radial-gradient(ellipse_at_65%_40%,#1b3a7a_0%,#0b1230_35%,#06080f_70%)] pt-[260px] sm:h-[100svh] sm:pt-0">
          <ShaderCanvas frag={CONVERGENCE} maxDpr={1.5} scale={0.75} className="-z-10" />
          <LandingNav />

          <span className="caption absolute top-[46%] right-6 hidden -translate-y-1/2 rotate-90 text-mist-2/70 lg:block">
            Fig. 01 · Convergence
          </span>

          <div className="container mt-auto w-full pb-10 sm:pb-14">
            <h1 className="max-w-[1040px] text-[clamp(44px,6.4vw,96px)] leading-[0.96] tracking-[-0.04em]" data-reveal>
              <span className="block font-bold text-paper">Free APIs, distilled.</span>
              <span className="block font-light text-mist-2">Sign in, take a key, call /v1.</span>
            </h1>
            <div className="mt-10 h-px w-full bg-gradient-to-r from-white/25 via-white/12 to-transparent" />
            <div className="mt-6 grid gap-8 md:grid-cols-[1fr_minmax(0,460px)]" data-reveal style={reveal(1)}>
              <p className="caption max-w-[300px] leading-relaxed text-mist-2">
                A free API platform by {site.org}. Built around the smallest unit of time.
              </p>
              <div className="flex min-w-0 flex-col gap-5">
                <p className="text-[16px] leading-relaxed text-mist">
                  Utility APIs built and hosted by Webrizen, free for every developer. One Webrizen sign-in, one key, plain JSON.
                  No card, no trial, no catch.
                </p>
                <div className="flex flex-wrap items-center gap-3">
                  <Button href="/dashboard" size="lg" color="primary" iconTrailing={<ArrowRight data-icon="trailing" />}>
                    Get a free API key
                  </Button>
                  <Button
                    href="/docs/quickstart"
                    size="lg"
                    color="tertiary"
                    iconLeading={<BookOpen01 data-icon="leading" />}
                    className="text-mist hover:bg-white/8 hover:text-paper"
                  >
                    Read the docs
                  </Button>
                </div>
                <div className="flex max-w-full items-center justify-between gap-3 rounded-full border border-white/10 bg-black/45 py-1.5 pr-1.5 pl-4 font-mono text-[12px]">
                  <span className="truncate text-mist">
                    <span className="text-comment">$ </span>curl {host}/ping
                  </span>
                  <CopyButton text={`curl ${apiBase}/ping -H "Authorization: Bearer $CHRONON_KEY"`} className="rounded-full" />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ============================================================ the idea: dunes */}
        <section className="relative isolate overflow-hidden bg-[linear-gradient(180deg,#c9d1d7_0%,#b3bfc7_45%,#0b1a22_60%,#03070a_100%)] text-night">
          {landingImages.idea && (
            // next/image: AVIF/WebP and a size per screen width, loaded only as the section approaches.
            <Image src={landingImages.idea} alt="" fill sizes="100vw" quality={80} className="-z-20 object-cover" />
          )}
          {/* Keeps the headline (top) and the stats (bottom) legible over any photo. */}
          <div aria-hidden className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgb(247_247_255/0.55)_0%,transparent_38%,transparent_55%,rgb(3_7_10/0.75)_100%)]" />
          <div className="container flex min-h-[880px] flex-col pt-24 pb-14 sm:min-h-[980px] sm:pt-32">
            <Kicker index="02" className="text-night/70">
              The idea
            </Kicker>
            <h2 className="mt-6 max-w-[820px] text-[clamp(40px,5.2vw,80px)] leading-[0.98] font-bold tracking-[-0.04em]" data-reveal>
              Built around the smallest unit of time.
            </h2>
            <p className="mt-6 max-w-[560px] text-[clamp(20px,1.8vw,26px)] leading-[1.35] font-light text-night/60" data-reveal style={reveal(1)}>
              A chronon is the shortest possible moment. Our APIs aim to cost you about that much.
            </p>

            <dl className="mt-auto grid grid-cols-2 gap-x-6 gap-y-8 border-t border-white/15 pt-8 text-paper lg:grid-cols-4">
              {[
                { value: dishes.length, label: "dishes, hand-curated" },
                { value: regions.length, label: `regions in ${countries.length} countries` },
                { value: standard.perMinute, label: "requests a minute, free" },
                { value: "0", label: "cards, trials or upsells" },
              ].map((s, i) => (
                <div key={s.label} className="flex flex-col gap-2" data-reveal style={reveal(i)}>
                  <dd className="text-[52px] leading-none font-bold tracking-[-0.04em] sm:text-[64px]">{s.value}</dd>
                  <dt className="caption text-mist/70">{s.label}</dt>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* ============================================================ features: light leaks */}
        <section className="container py-28 sm:py-40">
          <div className="grid gap-8 md:grid-cols-[1fr_minmax(0,420px)] md:items-end">
            <div>
              <Kicker index="03" className="text-mist-2">
                Why Chronon
              </Kicker>
              <h2 className="mt-6 text-[clamp(36px,4.2vw,62px)] leading-[0.98] tracking-[-0.04em] text-balance" data-reveal>
                <span className="block font-bold">Everything an API should&nbsp;be.</span>
                <span className="block font-light text-mist-2">Nothing you pay for.</span>
              </h2>
            </div>
            <p className="text-[17px] leading-relaxed text-mist" data-reveal style={reveal(1)}>
              Chronon runs on Webrizen&apos;s own servers. Keys and limits exist to share them fairly, never to sell you
              something.
            </p>
          </div>

          <div className="mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f, i) => (
              <article key={f.title} data-track className="leak-card flex min-h-[260px] flex-col justify-end p-6 sm:min-h-[340px] sm:p-7" data-reveal style={reveal(i % 3)}>
                <div aria-hidden className={`leak leak-${i + 1}`} />
                <span className="caption mb-auto text-mist/60">0{i + 1}</span>
                <h3 className="text-[26px] leading-tight font-bold tracking-[-0.025em]">{f.title}</h3>
                <p className="mt-3 text-[16px] leading-relaxed text-mist">{f.body}</p>
              </article>
            ))}
          </div>
        </section>

        {/* ============================================================ how it works */}
        <section className="relative border-y border-white/8 bg-[radial-gradient(ellipse_at_80%_50%,rgb(91_69_201/0.16),transparent_60%)]">
          <div className="container grid gap-16 py-28 sm:py-36 lg:grid-cols-[minmax(0,440px)_1fr] lg:items-center">
            <div>
              <Kicker index="04" className="text-mist-2">
                How it works
              </Kicker>
              <h2 className="mt-6 text-[clamp(36px,4vw,60px)] leading-[0.98] tracking-[-0.04em]" data-reveal>
                <span className="block font-bold">Sign in to 200 OK</span>
                <span className="block font-light text-mist-2">in about a minute.</span>
              </h2>
              <ol className="mt-12 flex flex-col">
                {steps.map((s, i) => (
                  <li key={s.title} className="grid grid-cols-[36px_1fr] gap-4 border-t border-white/10 py-6 last:border-b sm:grid-cols-[52px_1fr]" data-reveal style={reveal(i)}>
                    <span className="font-mono text-[13px] text-ion-soft">0{i + 1}</span>
                    <div>
                      <h3 className="text-[21px] font-bold tracking-[-0.015em]">{s.title}</h3>
                      <p className="mt-1.5 text-[16px] leading-relaxed text-mist">{s.body}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
            <div className="relative min-w-0" data-reveal style={reveal(1)}>
              <div aria-hidden className="absolute -inset-16 -z-10 bg-[radial-gradient(ellipse_at_center,rgb(91_69_201/0.3),transparent_62%)]" />
              <CodeTabs samples={samples} response={response} />
            </div>
          </div>
        </section>

        {/* ============================================================ explorer */}
        <section id="explore" className="container scroll-mt-8 py-28 sm:py-40">
          <div className="grid gap-8 md:grid-cols-[1fr_minmax(0,420px)] md:items-end">
            <div>
              <Kicker index="05" className="text-mist-2">
                Try it live
              </Kicker>
              <h2 className="mt-6 text-[clamp(38px,4.6vw,68px)] leading-[0.98] tracking-[-0.04em]" data-reveal>
                <span className="block font-bold">Taste the data</span>
                <span className="block font-light text-mist-2">before you sign up.</span>
              </h2>
            </div>
            <p className="text-[17px] leading-relaxed text-mist" data-reveal style={reveal(1)}>
              The real dataset: {dishes.length} dishes from {regions.length} regions, Punjab to Japan. Filter it and see the exact
              request that returns the same thing.
            </p>
          </div>
          <div className="mt-14" data-reveal style={reveal(2)}>
            <Explorer dishes={explorerDishes} countries={countries} />
          </div>
        </section>

        {/* ============================================================ open source: colonnade */}
        <section className="bg-[#eef0f6] text-night">
          <div className="container grid items-center gap-6 py-24 sm:py-32 lg:grid-cols-[minmax(0,480px)_1fr]">
            <div className="relative z-10">
              <Kicker index="06" className="text-night/60">
                Open source
              </Kicker>
              <h2 className="mt-6 text-[clamp(38px,4.6vw,68px)] leading-[0.98] tracking-[-0.04em]" data-reveal>
                <span className="block font-bold">A public good,</span>
                <span className="block font-light text-night/55">built in the open.</span>
              </h2>
              <p className="mt-6 max-w-[440px] text-[17px] leading-relaxed text-ink-2" data-reveal style={reveal(1)}>
                Every endpoint, every dataset and every limit lives in one MIT-licensed repository. Fix a dish, add a region, or
                propose a whole new API. Review happens in public.
              </p>
              <dl className="mt-10 grid grid-cols-3 gap-6 border-t border-night/12 pt-6" data-reveal style={reveal(2)}>
                {[
                  { v: "MIT", l: "licence" },
                  { v: regions.length, l: "region files" },
                  { v: "100%", l: "in the open" },
                ].map((x) => (
                  <div key={x.l}>
                    <dd className="text-[32px] leading-none font-bold tracking-[-0.03em]">{x.v}</dd>
                    <dt className="caption mt-2 text-night/55">{x.l}</dt>
                  </div>
                ))}
              </dl>
              <div className="mt-10 flex flex-wrap items-center gap-4" data-reveal style={reveal(3)}>
                <a
                  href={site.repoUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-full bg-night px-5 py-3 text-[15px] font-semibold text-paper no-underline transition hover:bg-night-2"
                >
                  <Code02 className="size-4" /> View on GitHub
                </a>
                <Link href="/docs/contributing" className="inline-flex items-center gap-1.5 text-[15px] font-semibold text-night underline decoration-photon underline-offset-4">
                  Contributing guide <ArrowRight className="size-4" />
                </Link>
              </div>
            </div>
            <div className="relative aspect-[5/4] w-full overflow-hidden bg-[radial-gradient(ellipse_at_50%_70%,#ffd2c2,transparent_55%),radial-gradient(ellipse_at_50%_30%,#cfd4ff,transparent_60%)] [mask-image:radial-gradient(ellipse_70%_70%_at_50%_52%,#000_55%,transparent_100%)]">
              <ShaderCanvas frag={COLONNADE} maxDpr={1} />
            </div>
          </div>
        </section>

        {/* ============================================================ fair use + faq */}
        <section className="container grid gap-16 py-28 sm:py-40 lg:grid-cols-2">
          <div>
            <Kicker index="07" className="text-mist-2">
              Fair use
            </Kicker>
            <h2 className="mt-6 text-[clamp(36px,4vw,60px)] leading-[0.98] tracking-[-0.04em]" data-reveal>
              <span className="block font-bold">Generous limits,</span>
              <span className="block font-light text-mist-2">counted per account.</span>
            </h2>
            <dl className="mt-12 grid grid-cols-3 border-y border-white/10" data-reveal style={reveal(1)}>
              {[
                { value: standard.perMinute, unit: "per minute" },
                { value: `${standard.perMonth / 1000}k`, unit: "per month" },
                { value: MAX_ACTIVE_KEYS, unit: "active keys" },
              ].map((s, i) => (
                <div key={s.unit} className={cx("py-7", i > 0 && "border-l border-white/10 pl-6")}>
                  <dd className="text-[48px] leading-none font-bold tracking-[-0.04em]">{s.value}</dd>
                  <dt className="caption mt-3 text-mist-2">{s.unit}</dt>
                </div>
              ))}
            </dl>
            <p className="mt-8 max-w-[480px] text-[16px] leading-relaxed text-mist">
              Extra keys never add capacity, and requests turned away by the per-minute window don&apos;t count toward your month.
              Open-source and education projects can ask for more.
            </p>
            <Button href="/docs/limits" color="link-color" size="lg" iconTrailing={<ArrowRight data-icon="trailing" />} className="mt-6">
              How limits work
            </Button>
          </div>
          <div>
            <Kicker index="08" className="text-mist-2">
              Questions
            </Kicker>
            <div className="mt-8 border-t border-white/10">
              {faqs.map((f) => (
                <details key={f.q} className="group border-b border-white/10 py-6" data-reveal>
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-6 text-[20px] font-bold tracking-[-0.015em] transition hover:text-ion-soft">
                    {f.q}
                    <span className="grid size-8 shrink-0 place-items-center rounded-full border border-white/12 font-mono text-[14px] text-mist-2 transition group-open:rotate-45 group-open:border-ion-soft/50 group-open:text-ion-soft">
                      +
                    </span>
                  </summary>
                  <p className="mt-4 max-w-[560px] text-[16px] leading-relaxed text-mist">{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* ============================================================ closing: portal */}
        <section className="relative isolate flex min-h-220 flex-col items-center justify-between overflow-hidden bg-[radial-gradient(circle_at_50%_50%,#123047_0%,#06080f_45%)] px-5 py-20 text-center">
          <ShaderCanvas frag={PORTAL} maxDpr={1.25} scale={0.75} className="-z-10" />
          <div data-reveal>
            <Kicker index="09" className="justify-center text-mist-2">
              Step through
            </Kicker>
            <h2 className="mt-6 text-[clamp(38px,5vw,72px)] leading-[0.98] tracking-[-0.04em]">
              <span className="block font-bold">Your first request</span>
              <span className="block font-light text-mist-2">is a minute away.</span>
            </h2>
          </div>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" aria-hidden>
            <ChrononMark size={292} ink="var(--color-paper)" className="mark-turn mark-glow" />
          </div>
          <div className="flex flex-col items-center gap-4" data-reveal>
            <div className="flex flex-wrap justify-center gap-3">
              <Button href="/dashboard" size="xl" color="primary" iconTrailing={<ArrowRight data-icon="trailing" />}>
                Get a free API key
              </Button>
              <Button href="/docs/quickstart" size="xl" color="secondary" iconLeading={<BookOpen01 data-icon="leading" />}>
                Quickstart
              </Button>
            </div>
            <p className="caption text-mist-2">Free for everyone · Signed in with Webrizen</p>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
