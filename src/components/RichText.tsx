/**
 * Renders plain text, turning `backtick` spans into inline <code>.
 * Lets question JSON show CSS/HTML fragments without any HTML injection.
 */
export function RichText({ text }: { text: string }) {
  if (!text.includes('`')) return <>{text}</>;
  const parts = text.split(/(`[^`]+`)/g);
  return (
    <>
      {parts.map((part, i) =>
        part.length > 2 && part.startsWith('`') && part.endsWith('`') ? (
          <code key={i} className="inline-code">
            {part.slice(1, -1)}
          </code>
        ) : (
          part
        ),
      )}
    </>
  );
}
