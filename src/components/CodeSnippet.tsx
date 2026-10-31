/** A read-only code block. Long lines scroll inside the block, never the page. */
export function CodeSnippet({ code, className }: { code: string; className?: string }) {
  return (
    // tabIndex lets keyboard users scroll the block sideways.
    <pre className={`code-snippet ${className ?? ''}`} tabIndex={0} aria-label="Code snippet">
      <code>{code}</code>
    </pre>
  );
}
