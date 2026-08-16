"use client";

import type { ReactNode } from "react";
import { highlightCode } from "@/lib/editor/highlight";
import { parseChatMarkdown, type ChatMdNode } from "@/lib/chat-markdown";

function ChatInline({ text }: { text: string }) {
  const nodes: ReactNode[] = [];
  const pattern =
    /`([^`]+)`|\*\*([^*]+)\*\*|\*(?!\*)([^*]+)\*|\[([^\]]+)\]\(([^)]+)\)/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let key = 0;
  while ((match = pattern.exec(text))) {
    if (match.index > last) nodes.push(text.slice(last, match.index));
    if (match[1] != null) {
      nodes.push(
        <code
          key={key}
          className="rounded-md bg-ctp-surface0 px-1 py-0.5 font-mono text-[12.5px] text-ctp-peach"
        >
          {match[1]}
        </code>,
      );
    } else if (match[2] != null) {
      nodes.push(
        <strong key={key} className="font-semibold text-ctp-text">
          {match[2]}
        </strong>,
      );
    } else if (match[3] != null) {
      nodes.push(
        <em key={key} className="italic text-ctp-subtext1">
          {match[3]}
        </em>,
      );
    } else {
      nodes.push(
        <a
          key={key}
          href={match[5]}
          className="text-ctp-blue underline-offset-2 hover:underline"
          target="_blank"
          rel="noreferrer"
        >
          {match[4]}
        </a>,
      );
    }
    key += 1;
    last = match.index + match[0].length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return <>{nodes}</>;
}

function ChatNode({ node }: { node: ChatMdNode }) {
  if (node.type === "heading") {
    const Tag = node.level === 1 ? "h3" : node.level === 2 ? "h4" : "h5";
    const size =
      node.level === 1
        ? "text-base"
        : node.level === 2
          ? "text-[15px]"
          : "text-sm";
    return (
      <Tag className={`${size} font-semibold tracking-tight text-ctp-text`}>
        <ChatInline text={node.text} />
      </Tag>
    );
  }
  if (node.type === "paragraph") {
    return (
      <p className="text-sm leading-relaxed text-ctp-text">
        <ChatInline text={node.text} />
      </p>
    );
  }
  if (node.type === "quote") {
    return (
      <blockquote className="border-l-2 border-ctp-overlay0 pl-3 text-sm leading-relaxed text-ctp-subtext1">
        <ChatInline text={node.text} />
      </blockquote>
    );
  }
  if (node.type === "divider") return <hr className="border-ctp-surface1" />;
  if (node.type === "list") {
    const Tag = node.ordered ? "ol" : "ul";
    return (
      <Tag
        className={`space-y-1 pl-5 text-sm leading-relaxed text-ctp-text ${
          node.ordered ? "list-decimal" : "list-disc"
        }`}
      >
        {node.items.map((item, index) => (
          <li key={`${item}-${index}`}>
            <ChatInline text={item} />
          </li>
        ))}
      </Tag>
    );
  }
  if (node.type === "table") {
    return (
      <div className="overflow-x-auto rounded-xl border border-ctp-surface1">
        <table className="w-full min-w-[16rem] border-collapse text-left text-sm">
          <thead className="bg-ctp-surface0/80">
            <tr>
              {node.headers.map((header) => (
                <th
                  key={header}
                  className="border-b border-ctp-surface1 px-3 py-2 font-medium text-ctp-subtext1"
                >
                  <ChatInline text={header} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {node.rows.map((row, rowIndex) => (
              <tr key={rowIndex} className="odd:bg-ctp-crust/40">
                {row.map((cell, cellIndex) => (
                  <td
                    key={`${rowIndex}-${cellIndex}`}
                    className="border-b border-ctp-surface0 px-3 py-2 align-top text-ctp-text"
                  >
                    <ChatInline text={cell} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  return (
    <pre className="overflow-x-auto rounded-xl bg-ctp-crust p-3 font-mono text-[13px] leading-6">
      <code
        dangerouslySetInnerHTML={{
          __html: highlightCode(node.text, node.language) || " ",
        }}
      />
    </pre>
  );
}

export function ChatMarkdown({ markdown }: { markdown: string }) {
  const nodes = parseChatMarkdown(markdown);
  if (nodes.length === 0) {
    return <p className="text-sm text-ctp-overlay0">…</p>;
  }
  return (
    <div className="space-y-3">
      {nodes.map((node, index) => (
        <ChatNode key={`${node.type}-${index}`} node={node} />
      ))}
    </div>
  );
}
