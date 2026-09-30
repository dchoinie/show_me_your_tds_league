import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * Themed Markdown renderer for repo content (the constitution).
 *
 * Runs on the server, so none of this ships to the browser. Every element is
 * mapped explicitly rather than relying on a prose plugin, so the document
 * wears the same tokens as the generated tables beside it.
 */
export function Markdown({ children }: { children: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        // The page supplies its own <h1>; demote the document's title.
        h1: ({ children }) => (
          <h2 className="mt-12 font-display text-3xl font-bold tracking-tight text-ink first:mt-0">
            {children}
          </h2>
        ),
        h2: ({ children }) => (
          <h3 className="mt-10 border-b border-line pb-2 font-display text-2xl font-bold tracking-tight text-ink">
            {children}
          </h3>
        ),
        h3: ({ children }) => (
          <h4 className="mt-6 font-display text-lg font-semibold text-accent">
            {children}
          </h4>
        ),
        p: ({ children }) => (
          <p className="mt-4 leading-relaxed text-ink-muted">{children}</p>
        ),
        ul: ({ children }) => (
          <ul className="mt-4 space-y-2 pl-5 text-ink-muted [&>li]:list-disc [&>li]:marker:text-ink-dim">
            {children}
          </ul>
        ),
        ol: ({ children }) => (
          <ol className="mt-4 space-y-2 pl-5 text-ink-muted [&>li]:list-decimal [&>li]:marker:text-ink-dim">
            {children}
          </ol>
        ),
        li: ({ children }) => <li className="leading-relaxed">{children}</li>,
        strong: ({ children }) => (
          <strong className="font-semibold text-ink">{children}</strong>
        ),
        em: ({ children }) => <em className="italic">{children}</em>,
        hr: () => <hr className="my-10 border-line" />,
        a: ({ href, children }) => (
          <a
            href={href}
            className="text-accent underline decoration-line underline-offset-4 transition-colors hover:decoration-accent"
          >
            {children}
          </a>
        ),
        table: ({ children }) => (
          <div className="mt-5 overflow-x-auto">
            <table className="w-full border-collapse text-sm">{children}</table>
          </div>
        ),
        thead: ({ children }) => (
          <thead className="border-b border-line">{children}</thead>
        ),
        th: ({ children }) => (
          <th className="eyebrow px-3 py-2 text-left text-[10px] text-ink-dim">
            {children}
          </th>
        ),
        td: ({ children }) => (
          <td className="border-b border-line/60 px-3 py-2 text-ink-muted">
            {children}
          </td>
        ),
        code: ({ children }) => (
          <code className="rounded bg-surface-2 px-1.5 py-0.5 text-[0.9em] text-ink">
            {children}
          </code>
        ),
        blockquote: ({ children }) => (
          <blockquote className="mt-4 border-l-2 border-accent/50 pl-4 text-ink-muted italic">
            {children}
          </blockquote>
        ),
      }}
    >
      {children}
    </ReactMarkdown>
  );
}
