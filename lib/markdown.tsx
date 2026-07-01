"use client";

import * as React from "react";

/* ------------------------------------------------------------------
   Minimal markdown for chat replies. Dependency-free and safe: output
   is built as React nodes, never injected as HTML. Covers the shapes
   models actually produce: paragraphs, headings, lists, blockquotes,
   fenced code, inline code, bold, italic, strikethrough, and links.
   ------------------------------------------------------------------ */

type Block =
  | { kind: "p"; text: string }
  | { kind: "h"; level: number; text: string }
  | { kind: "ul"; items: string[] }
  | { kind: "ol"; items: string[]; start: number }
  | { kind: "quote"; text: string }
  | { kind: "code"; lang: string; code: string }
  | { kind: "hr" };

export function parseBlocks(text: string): Block[] {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const blocks: Block[] = [];
  let i = 0;

  const flushParagraph = (buf: string[]) => {
    const t = buf.join("\n").trim();
    if (t) blocks.push({ kind: "p", text: t });
    buf.length = 0;
  };

  const para: string[] = [];
  while (i < lines.length) {
    const line = lines[i];

    // fenced code: ``` or ~~~, optionally with a language tag
    const fence = line.match(/^\s*(`{3,}|~{3,})\s*(\S+)?\s*$/);
    if (fence) {
      flushParagraph(para);
      const marker = fence[1][0];
      const lang = fence[2] ?? "";
      const code: string[] = [];
      i++;
      while (i < lines.length && !new RegExp(`^\\s*${marker}{3,}\\s*$`).test(lines[i])) {
        code.push(lines[i]);
        i++;
      }
      i++; // skip the closing fence (or run past the end while streaming)
      blocks.push({ kind: "code", lang, code: code.join("\n") });
      continue;
    }

    // heading
    const h = line.match(/^\s*(#{1,6})\s+(.+?)\s*#*\s*$/);
    if (h) {
      flushParagraph(para);
      blocks.push({ kind: "h", level: h[1].length, text: h[2] });
      i++;
      continue;
    }

    // horizontal rule
    if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      flushParagraph(para);
      blocks.push({ kind: "hr" });
      i++;
      continue;
    }

    // blockquote: consecutive "> " lines
    if (/^\s*>\s?/.test(line)) {
      flushParagraph(para);
      const quote: string[] = [];
      while (i < lines.length && /^\s*>\s?/.test(lines[i])) {
        quote.push(lines[i].replace(/^\s*>\s?/, ""));
        i++;
      }
      blocks.push({ kind: "quote", text: quote.join("\n").trim() });
      continue;
    }

    // unordered list: consecutive -/*/+ items (a following indented line joins its item)
    if (/^\s*[-*+]\s+/.test(line)) {
      flushParagraph(para);
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i])) {
        let item = lines[i].replace(/^\s*[-*+]\s+/, "");
        i++;
        while (i < lines.length && /^\s{2,}\S/.test(lines[i]) && !/^\s*[-*+]\s+/.test(lines[i])) {
          item += ` ${lines[i].trim()}`;
          i++;
        }
        items.push(item);
      }
      blocks.push({ kind: "ul", items });
      continue;
    }

    // ordered list: consecutive "1." items
    const ol = line.match(/^\s*(\d+)\.\s+/);
    if (ol) {
      flushParagraph(para);
      const start = parseInt(ol[1], 10) || 1;
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        let item = lines[i].replace(/^\s*\d+\.\s+/, "");
        i++;
        while (i < lines.length && /^\s{2,}\S/.test(lines[i]) && !/^\s*\d+\.\s+/.test(lines[i])) {
          item += ` ${lines[i].trim()}`;
          i++;
        }
        items.push(item);
      }
      blocks.push({ kind: "ol", items, start });
      continue;
    }

    // blank line ends a paragraph
    if (/^\s*$/.test(line)) {
      flushParagraph(para);
      i++;
      continue;
    }

    para.push(line);
    i++;
  }
  flushParagraph(para);
  return blocks;
}

/* ---------------------------------- inline ---------------------------------- */

type InlinePattern = {
  re: RegExp;
  render: (m: RegExpMatchArray, key: number) => React.ReactNode;
};

// Ordered by priority when two patterns match at the same index.
const INLINE: InlinePattern[] = [
  {
    re: /`([^`\n]+)`/,
    render: (m, key) => (
      <code
        key={key}
        className="rounded-[6px] border border-line bg-mist/70 px-1 py-0.5 font-mono text-[0.85em]"
      >
        {m[1]}
      </code>
    ),
  },
  {
    re: /\*\*([^*\n](?:[^*\n]|\*(?!\*))*?)\*\*/,
    render: (m, key) => (
      <strong key={key} className="font-semibold">
        {renderInline(m[1])}
      </strong>
    ),
  },
  {
    re: /\*([^*\s](?:[^*\n]*?[^*\s])?)\*/,
    render: (m, key) => <em key={key}>{renderInline(m[1])}</em>,
  },
  {
    re: /~~([^~\n]+)~~/,
    render: (m, key) => <del key={key}>{renderInline(m[1])}</del>,
  },
  {
    re: /\[([^\]\n]+)\]\((https?:\/\/[^)\s]+)\)/,
    render: (m, key) => (
      <a
        key={key}
        href={m[2]}
        target="_blank"
        rel="noopener noreferrer"
        className="text-canopy underline decoration-moss/60 underline-offset-2 hover:decoration-canopy"
      >
        {m[1]}
      </a>
    ),
  },
];

export function renderInline(text: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  let rest = text;
  let key = 0;
  while (rest.length > 0) {
    let best: { index: number; pattern: InlinePattern; match: RegExpMatchArray } | null = null;
    for (const pattern of INLINE) {
      const match = rest.match(pattern.re);
      if (match?.index === undefined) continue;
      if (!best || match.index < best.index) {
        best = { index: match.index, pattern, match };
      }
    }
    if (!best) {
      nodes.push(rest);
      break;
    }
    if (best.index > 0) nodes.push(rest.slice(0, best.index));
    nodes.push(best.pattern.render(best.match, key++));
    rest = rest.slice(best.index + best.match[0].length);
  }
  return nodes;
}

/* ---------------------------------- render ---------------------------------- */

function CodeBlock({ lang, code }: { lang: string; code: string }) {
  const [copied, setCopied] = React.useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  };
  return (
    <div className="group/code relative my-2 first:mt-0 last:mb-0">
      {lang && (
        <span className="absolute right-10 top-1.5 rounded px-1 text-[10px] uppercase tracking-wide text-stone/70">
          {lang}
        </span>
      )}
      <button
        type="button"
        onClick={copy}
        aria-label="Copy code"
        className="absolute right-1.5 top-1.5 rounded-[8px] border border-line bg-paper px-1.5 py-0.5 text-[10px] font-medium text-stone opacity-0 transition-opacity focus:opacity-100 group-hover/code:opacity-100"
      >
        {copied ? "Copied" : "Copy"}
      </button>
      <pre className="verdant-scroll overflow-x-auto rounded-[12px] border border-line bg-mist/60 p-3 font-mono text-xs leading-relaxed text-bark">
        <code>{code}</code>
      </pre>
    </div>
  );
}

const HEADING_CLASS: Record<number, string> = {
  1: "text-lg font-semibold",
  2: "text-base font-semibold",
  3: "text-[15px] font-semibold",
  4: "text-sm font-semibold",
  5: "text-sm font-medium",
  6: "text-sm font-medium",
};

/** Render markdown text as styled React nodes. */
export function Markdown({ text }: { text: string }) {
  const blocks = React.useMemo(() => parseBlocks(text), [text]);
  return (
    <div className="text-sm leading-relaxed text-bark [&>*+*]:mt-2">
      {blocks.map((b, i) => {
        switch (b.kind) {
          case "code":
            return <CodeBlock key={i} lang={b.lang} code={b.code} />;
          case "h":
            return (
              <p key={i} className={HEADING_CLASS[b.level]}>
                {renderInline(b.text)}
              </p>
            );
          case "ul":
            return (
              <ul key={i} className="list-disc space-y-1 pl-5 marker:text-moss">
                {b.items.map((item, j) => (
                  <li key={j}>{renderInline(item)}</li>
                ))}
              </ul>
            );
          case "ol":
            return (
              <ol key={i} start={b.start} className="list-decimal space-y-1 pl-5 marker:text-moss">
                {b.items.map((item, j) => (
                  <li key={j}>{renderInline(item)}</li>
                ))}
              </ol>
            );
          case "quote":
            return (
              <blockquote
                key={i}
                className="border-l-2 border-moss/50 pl-3 text-stone [&>*+*]:mt-2"
              >
                {b.text.split(/\n{2,}/).map((p, j) => (
                  <p key={j} className="whitespace-pre-wrap">
                    {renderInline(p)}
                  </p>
                ))}
              </blockquote>
            );
          case "hr":
            return <hr key={i} className="border-line" />;
          default:
            return (
              <p key={i} className="whitespace-pre-wrap">
                {renderInline(b.text)}
              </p>
            );
        }
      })}
    </div>
  );
}
