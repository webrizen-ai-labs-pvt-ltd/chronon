import { ImageResponse } from "next/og";
import { markSvg } from "@/lib/brand/mark";
import { site } from "@/lib/site";

export const alt = "Chronon: free utility APIs by Webrizen";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Fetches a TTF subset from Google Fonts (Satori can't read woff2). */
async function loadFont(family: string, weight: number, text: string) {
  const css = await fetch(
    `https://fonts.googleapis.com/css2?family=${family.replace(/ /g, "+")}:wght@${weight}&text=${encodeURIComponent(text)}`,
  ).then((r) => r.text());
  const url = css.match(/src: url\((.+?)\) format\('(?:opentype|truetype)'\)/)?.[1];
  if (!url) throw new Error(`Font not found: ${family} ${weight}`);
  return fetch(url).then((r) => r.arrayBuffer());
}

/** Social card from the brand guide: Ion ground, oversized Night mark cropped top-right. */
export default async function OpengraphImage() {
  const headline = "Free utility APIs, built and hosted by Webrizen.";
  const host = site.url.replace(/^https?:\/\//, "");
  const [display, mono] = await Promise.all([
    loadFont("Averia Libre", 700, headline),
    loadFont("Martian Mono", 400, host),
  ]);
  const mark = `data:image/svg+xml;base64,${Buffer.from(markSvg({ ink: "#0F1220", core: "#DE6449", size: 936 })).toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#5B45C9",
          padding: 64,
          position: "relative",
          color: "#FFFFFF",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={mark} width={936} height={936} alt="" style={{ position: "absolute", right: -216, top: -139 }} />
        <span style={{ fontFamily: "Martian Mono", fontSize: 24, color: "#E4DEFB" }}>{host}</span>
        <span
          style={{
            fontFamily: "Averia Libre",
            fontSize: 76,
            fontWeight: 700,
            letterSpacing: "-0.045em",
            lineHeight: 0.95,
            maxWidth: "62%",
          }}
        >
          {headline}
        </span>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Averia Libre", data: display, weight: 700, style: "normal" },
        { name: "Martian Mono", data: mono, weight: 400, style: "normal" },
      ],
    },
  );
}
