import { Fragment } from "react";

/**
 * A deliberately tiny highlighter for the landing-page samples, in the brand's
 * code colours: verbs/keywords Photon, strings and numbers Ion soft, comments
 * muted, everything else Mist. Not a general-purpose tokenizer.
 */
const TOKEN =
  /(\/\/[^\n]*|#[^\n]*)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)|\b(GET|curl|const|await|for|of|import|from|print|def|return|let|null|true|false)\b|(\b\d+(?:\.\d+)?\b)/g;

export function Highlight({ code }: { code: string }) {
  const parts: React.ReactNode[] = [];
  let last = 0;
  for (const m of code.matchAll(TOKEN)) {
    if (m.index > last) parts.push(code.slice(last, m.index));
    const [text, comment, string, keyword] = m;
    const cls = comment ? "text-comment" : string ? "text-ion-soft" : keyword ? "text-photon" : "text-ion-soft";
    parts.push(
      <span key={m.index} className={cls}>
        {text}
      </span>,
    );
    last = m.index + text.length;
  }
  parts.push(code.slice(last));
  return (
    <>
      {parts.map((p, i) => (
        <Fragment key={i}>{p}</Fragment>
      ))}
    </>
  );
}
