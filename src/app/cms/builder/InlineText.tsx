'use client';

import { useEffect, useRef, type CSSProperties, type ElementType } from 'react';

/**
 * Click-to-edit text on the builder canvas (Beaver Builder / Elementor style):
 * the selected module's text becomes editable in place and is committed when
 * the field loses focus. Enter finishes a single-line field, Escape reverts.
 *
 * Uncontrolled on purpose — React must not re-render the text while the
 * caret is inside it, so the DOM is only synced from `value` when not focused.
 */
export default function InlineText({
  as: Tag = 'span',
  value,
  html = false,
  multiline = false,
  placeholder,
  className,
  style,
  onCommit,
}: {
  as?: ElementType;
  value: string;
  /** Rich text (paragraphs): keeps the markup instead of plain text. */
  html?: boolean;
  /** Allow line breaks (Enter inserts one instead of finishing). */
  multiline?: boolean;
  placeholder?: string;
  className?: string;
  style?: CSSProperties;
  onCommit: (value: string) => void;
}) {
  const ref = useRef<HTMLElement | null>(null);
  const original = useRef(value);

  useEffect(() => {
    const node = ref.current;
    if (!node || document.activeElement === node) return;
    if (html) node.innerHTML = value;
    else node.textContent = value;
    original.current = value;
  }, [value, html]);

  const read = () => {
    const node = ref.current;
    if (!node) return '';
    return html ? node.innerHTML.trim() : (node.textContent || '').replace(/\s+/g, ' ').trim();
  };

  return (
    <Tag
      ref={ref}
      className={className}
      style={{ outline: 'none', cursor: 'text', minWidth: '1ch', ...style }}
      contentEditable
      suppressContentEditableWarning
      spellCheck
      data-placeholder={placeholder}
      role="textbox"
      aria-multiline={multiline || html ? true : undefined}
      // Keep the canvas from treating a click inside the text as "deselect".
      onClick={(event: React.MouseEvent) => event.stopPropagation()}
      onPointerDown={(event: React.PointerEvent) => event.stopPropagation()}
      onKeyDown={(event: React.KeyboardEvent<HTMLElement>) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          const node = ref.current;
          if (node) {
            if (html) node.innerHTML = original.current;
            else node.textContent = original.current;
            node.blur();
          }
          return;
        }
        if (event.key === 'Enter' && !multiline && !html) {
          event.preventDefault();
          ref.current?.blur();
        }
      }}
      onPaste={(event: React.ClipboardEvent) => {
        // Paste as plain text so foreign markup never lands in the page.
        event.preventDefault();
        const text = event.clipboardData.getData('text/plain');
        document.execCommand('insertText', false, text);
      }}
      onBlur={() => {
        const next = read();
        if (next !== original.current) {
          original.current = next;
          onCommit(next);
        }
      }}
    />
  );
}
