import { highlightCode } from "@/lib/editor/highlight";
import {
  numberedLabel,
  parseMarkdownToBlocks,
  sequentialIds,
  type EditorBlock,
} from "@/lib/editor/blocks";

export function MarkdownPreview({ markdown }: { markdown: string }) {
  const blocks = parseMarkdownToBlocks(markdown, sequentialIds());
  if (blocks.length === 0) {
    return <p className="text-sm text-ctp-overlay0">Nothing to preview.</p>;
  }
  return (
    <div className="markdown preview-doc min-h-0 flex-1 space-y-3 overflow-y-auto pb-16">
      {blocks.map((block, index) => (
        <PreviewBlock key={block.id} block={block} index={index} blocks={blocks} />
      ))}
    </div>
  );
}

function PreviewBlock({
  block,
  index,
  blocks,
}: {
  block: EditorBlock;
  index: number;
  blocks: EditorBlock[];
}) {
  if (block.type === "divider") return <hr className="border-ctp-surface1" />;
  if (block.type === "code") {
    return (
      <pre className="overflow-x-auto rounded-md bg-ctp-mantle/80 p-3 font-mono text-sm leading-6">
        <code
          dangerouslySetInnerHTML={{
            __html: highlightCode(block.text, block.language ?? "") || " ",
          }}
        />
      </pre>
    );
  }
  if (block.type === "heading1") return <h1 className="block-h1 text-3xl font-bold">{block.text}</h1>;
  if (block.type === "heading2") return <h2 className="block-h2 text-2xl font-semibold">{block.text}</h2>;
  if (block.type === "heading3") return <h3 className="block-h3 text-xl font-semibold">{block.text}</h3>;
  if (block.type === "quote") {
    return (
      <blockquote className="block-quote border-l-2 border-ctp-overlay0 pl-3 text-ctp-subtext1">
        {block.text}
      </blockquote>
    );
  }
  if (block.type === "todo") {
    return (
      <label className="flex items-start gap-2 text-ctp-text">
        <input type="checkbox" checked={Boolean(block.checked)} readOnly className="mt-1" />
        <span>{block.text}</span>
      </label>
    );
  }
  if (block.type === "bullet") {
    return (
      <div className="flex gap-2">
        <span className="text-ctp-overlay1">•</span>
        <span>{block.text}</span>
      </div>
    );
  }
  if (block.type === "numbered") {
    return (
      <div className="flex gap-2">
        <span className="w-6 text-right font-mono text-sm text-ctp-overlay1">
          {numberedLabel(blocks, index)}.
        </span>
        <span>{block.text}</span>
      </div>
    );
  }
  if (!block.text.trim()) return <div className="h-6" />;
  return <p className="block-paragraph whitespace-pre-wrap">{block.text}</p>;
}
