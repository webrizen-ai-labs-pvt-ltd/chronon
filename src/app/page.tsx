import Link from "next/link";
import { ChrononMark } from "@/components/brand";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { getCatalog } from "@/apis/menus/catalog";
import { MAX_ACTIVE_KEYS, tiers } from "@/lib/limits";
import { apiBase, site } from "@/lib/site";

const steps = [
  { title: "Sign in with Webrizen", body: "One Webrizen account works across every Webrizen product. No forms, no card." },
  { title: "Create a key", body: `Up to ${MAX_ACTIVE_KEYS} keys per account, one per project. Each key is shown once.` },
  { title: "Call /v1", body: "Send the key as a bearer token. JSON in, JSON out." },
];

export default function Home() {
  const { regions, dishes } = getCatalog();
  const standard = tiers.standard;

  return (
    <>
      <SiteHeader primary={false} />
      <main>
        {/* Hero */}
        <section className="overflow-hidden bg-night text-paper">
          <div className="mx-auto flex max-w-[1240px] flex-col gap-14 px-4 pt-14 pb-20 sm:px-[22px] md:pt-[72px] md:pb-24">
            <div className="label flex flex-wrap justify-between gap-4 text-mist-2">
              <span>Chronon / {site.org}</span>
              <span>Free · Open source · v1</span>
            </div>
            <div className="grid items-center gap-12 md:grid-cols-[1.1fr_1fr]">
              <div className="flex flex-col gap-7">
                <h1 className="text-[clamp(72px,12vw,184px)] leading-[0.85] font-bold tracking-[-0.03em]">chronon</h1>
                <p className="max-w-[460px] text-[22px] leading-[1.35] text-pretty text-mist sm:text-2xl">
                  Free utility APIs, built and hosted by Webrizen. Sign in, create a key and make your first request in
                  under a minute.
                </p>
                <div className="flex flex-wrap gap-3">
                  <Link href="/dashboard" className="btn btn-photon">
                    Get a free API key
                  </Link>
                  <Link href="/docs/quickstart" className="btn btn-outline-dark">
                    Read the quickstart
                  </Link>
                </div>
              </div>
              <div className="flex justify-center">
                <ChrononMark size={440} ink="var(--color-paper)" className="mark-turn h-auto w-[min(440px,80vw)]" />
              </div>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="border-b border-line-light">
          <div className="mx-auto grid max-w-[1240px] gap-12 px-4 py-20 sm:px-[22px] md:py-24 lg:grid-cols-2 lg:items-center">
            <div className="flex flex-col gap-5">
              <p className="label text-slate">01 · How it works</p>
              <h2 className="text-[40px] leading-none font-bold tracking-[-0.035em] sm:text-5xl">Three steps, no card.</h2>
              <ol className="mt-4 flex flex-col gap-6">
                {steps.map((s, i) => (
                  <li key={s.title} className="grid grid-cols-[36px_1fr] gap-x-3">
                    <span className="font-mono text-[13px] leading-[28px] text-slate">0{i + 1}</span>
                    <div>
                      <h3 className="text-[22px] font-bold tracking-[-0.02em]">{s.title}</h3>
                      <p className="mt-1 text-[19px] leading-normal text-ink-2">{s.body}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
            <div className="code-dark px-6 py-5">
              <div>
                <span className="text-photon">GET</span> <span className="text-paper">/v1/menus/dishes</span>?region=
                <span className="text-ion-soft">kerala</span>&amp;diet=<span className="text-ion-soft">vegan</span>
              </div>
              <div className="text-comment">{"// Authorization: Bearer chr_••••"}</div>
              <div className="text-comment">{"// 200 OK · application/json"}</div>
              <pre className="mt-1 font-mono whitespace-pre text-mist">
                {`{
  "data": [{
    "slug": `}
                <span className="text-ion-soft">&quot;appam&quot;</span>
                {`,
    "name": `}
                <span className="text-ion-soft">&quot;Appam&quot;</span>
                {`,
    "course": `}
                <span className="text-ion-soft">&quot;breakfast&quot;</span>
                {`,
    "spice_level": `}
                <span className="text-ion-soft">0</span>
                {`
  }, …],
  "next_cursor": `}
                <span className="text-ion-soft">null</span>
                {`
}`}
              </pre>
            </div>
          </div>
        </section>

        {/* APIs */}
        <section className="border-b border-line-light">
          <div className="mx-auto flex max-w-[1240px] flex-col gap-10 px-4 py-20 sm:px-[22px] md:py-24">
            <div className="flex flex-col gap-3">
              <p className="label text-slate">02 · APIs</p>
              <h2 className="text-[40px] leading-none font-bold tracking-[-0.035em] sm:text-5xl">What you can call today.</h2>
            </div>
            <div className="grid gap-4 md:grid-cols-[1.6fr_1fr]">
              <article className="flex flex-col gap-5 rounded-md border border-line-light bg-card p-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h3 className="text-[32px] leading-none font-bold tracking-[-0.03em]">Regional menus</h3>
                  <span className="label rounded border border-ion/30 px-2 py-0.5 text-ion">Live</span>
                </div>
                <p className="max-w-[560px] text-[19px] leading-normal text-ink-2">
                  {dishes.length} dishes from {regions.length} regions, from Punjab to Japan. Filter by course, diet and
                  spice level, search by ingredient, or pick something at random.
                </p>
                <ul className="flex flex-col gap-1 font-mono text-[13px]">
                  {["/menus/regions", "/menus/regions/{slug}", "/menus/dishes", "/menus/dishes/{slug}", "/menus/random"].map(
                    (p) => (
                      <li key={p}>
                        <span className="text-photon">GET</span> <span className="text-night">/v1{p}</span>
                      </li>
                    ),
                  )}
                </ul>
                <Link href="/docs/api/menus" className="mt-auto self-start text-[17px] text-night underline">
                  API reference
                </Link>
              </article>
              <div className="grid gap-4">
                {[
                  { title: "Structured data feeds", body: "Clean, versioned datasets behind one consistent API." },
                  { title: "Automation tools", body: "Small utilities you'd otherwise host yourself." },
                ].map((p) => (
                  <article key={p.title} className="flex flex-col gap-2 rounded-md border border-dashed border-line-light p-6">
                    <span className="label text-slate">Planned</span>
                    <h3 className="text-2xl font-bold tracking-[-0.025em]">{p.title}</h3>
                    <p className="text-[17px] leading-normal text-ink-2">{p.body}</p>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Fair use */}
        <section className="border-b border-line-light">
          <div className="mx-auto grid max-w-[1240px] gap-12 px-4 py-20 sm:px-[22px] md:py-24 lg:grid-cols-2">
            <div className="flex flex-col gap-5">
              <p className="label text-slate">03 · Fair use</p>
              <h2 className="text-[40px] leading-none font-bold tracking-[-0.035em] sm:text-5xl">Free for everyone, so it has limits.</h2>
              <p className="max-w-[520px] text-[19px] leading-normal text-pretty text-ink-2">
                Chronon runs on Webrizen&apos;s own servers. Keys aren&apos;t for billing. They give every developer a fair
                share and stop one runaway script from taking the service down for everyone else.
              </p>
              <Link href="/docs/limits" className="self-start text-[17px] underline">
                How limits work
              </Link>
            </div>
            <dl className="grid grid-cols-1 gap-4 self-center sm:grid-cols-3">
              {[
                { value: standard.perMinute, unit: "requests / minute" },
                { value: standard.perMonth.toLocaleString("en-US"), unit: "requests / month" },
                { value: MAX_ACTIVE_KEYS, unit: "keys / account" },
              ].map((s) => (
                <div key={s.unit} className="flex flex-col gap-2 rounded-md border border-line-light bg-card p-5">
                  <dt className="label order-2 text-slate">{s.unit}</dt>
                  <dd className="order-1 text-[44px] leading-none font-bold tracking-[-0.035em]">{s.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* Open source band, in the style of the social card */}
        <section className="relative overflow-hidden bg-ion text-white">
          <ChrononMark
            ink="var(--color-night)"
            size="100%"
            className="pointer-events-none absolute top-[-30%] right-[-14%] h-auto w-[min(78%,620px)]"
          />
          <div className="relative mx-auto flex max-w-[1240px] flex-col gap-6 px-4 py-20 sm:px-[22px] md:py-28">
            <span className="font-mono text-[12px] text-[#e4defb]">{apiBase.replace(/^https?:\/\//, "")}</span>
            <h2 className="max-w-[62%] text-[clamp(36px,5vw,56px)] leading-[0.95] font-bold tracking-[-0.045em] max-sm:max-w-full">
              Built in the open. Bring an API.
            </h2>
            <p className="max-w-[520px] text-[19px] leading-normal text-[#e4defb]">
              Every endpoint, dataset and limit is in the repository. Fix a dish, add a region, or propose a whole new API.
            </p>
            <div className="flex flex-wrap gap-3">
              <a href={site.repoUrl} target="_blank" rel="noreferrer" className="btn bg-night text-paper hover:bg-night-2">
                View on GitHub
              </a>
              <Link href="/docs/contributing" className="btn border border-white/40 text-white hover:border-white">
                Contributing guide
              </Link>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
