import { Fragment, type ReactNode } from 'react';

// A small Markdown subset rendered as React elements, so message text never reaches innerHTML.

export function Markdown({ text }: { text: string }) {
  const blocks = text.replace(/\r\n/g, '\n').split(/\n{2,}/);
  return (
    <>
      {blocks.map((block, i) => (
        <Block key={i} block={block} />
      ))}
    </>
  );
}

function Block({ block }: { block: string }) {
  if (block.startsWith('```')) {
    return <pre>{block.replace(/^```\w*\n?/, '').replace(/\n?```$/, '')}</pre>;
  }
  const lines = block.split('\n');
  const heading = block.match(/^(#{1,4})\s+(.*)$/);
  if (heading && lines.length === 1) return <h4>{inline(heading[2])}</h4>;
  if (lines.every((l) => /^\s*[-*]\s+/.test(l))) {
    return <ul>{lines.map((l, i) => <li key={i}>{inline(l.replace(/^\s*[-*]\s+/, ''))}</li>)}</ul>;
  }
  if (lines.every((l) => /^\s*\d+[.)]\s+/.test(l))) {
    return <ol>{lines.map((l, i) => <li key={i}>{inline(l.replace(/^\s*\d+[.)]\s+/, ''))}</li>)}</ol>;
  }
  if (lines.every((l) => l.startsWith('>'))) {
    return <blockquote>{inline(lines.map((l) => l.replace(/^>\s?/, '')).join('\n'))}</blockquote>;
  }
  return <p>{inline(block)}</p>;
}

function inline(text: string): ReactNode[] {
  return text.split(/(`[^`]+`|\*\*[^*]+\*\*|\*[^*\s][^*]*\*|_[^_\s][^_]*_)/g).map((part, i) => {
    if (/^`.+`$/.test(part)) return <code key={i}>{part.slice(1, -1)}</code>;
    if (/^\*\*.+\*\*$/.test(part)) return <strong key={i}>{part.slice(2, -2)}</strong>;
    if (/^(\*.+\*|_.+_)$/.test(part)) return <em key={i}>{part.slice(1, -1)}</em>;
    return <Fragment key={i}>{part}</Fragment>;
  });
}
