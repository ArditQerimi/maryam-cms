'use client';

import { useCallback, useEffect, useState } from 'react';
import { EditorContent, useEditor, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import ImageExt from '@tiptap/extension-image';
import Highlight from '@tiptap/extension-highlight';
import { TextStyleKit } from '@tiptap/extension-text-style';
import {
  Bold,
  Code,
  Eraser,
  Image as ImageIcon,
  Italic,
  Link2,
  List,
  ListOrdered,
  Minus,
  Quote,
  Redo2,
  Strikethrough,
  Underline as UnderlineIcon,
  Undo2,
} from 'lucide-react';
import MediaPickerModal from '@/components/admin/MediaPickerModal';
import { cn } from '@/components/admin/ui';

type Props = {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: number;
  /** Hide the heading buttons when the editor is used for a short description. */
  compact?: boolean;
};

function ToolButton({
  active,
  disabled,
  onClick,
  title,
  children,
}: {
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      disabled={disabled}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      className={cn(
        'flex h-8 w-8 items-center justify-center rounded-md text-zinc-600 transition hover:bg-zinc-100 disabled:opacity-30',
        active && 'bg-[#6d6be8]/10 text-[#4f4dd6]',
      )}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <span className="mx-1 h-5 w-px bg-zinc-200" />;
}

export default function TiptapEditor({
  value,
  onChange,
  placeholder = 'Start writing…',
  minHeight = 320,
  compact = false,
}: Props) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState<string | null>(null);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: compact ? [2, 3, 4] : [1, 2, 3, 4] },
        link: { openOnClick: false, autolink: true },
      }),
      Placeholder.configure({ placeholder }),
      ImageExt.configure({ allowBase64: false }),
      Highlight.configure({ multicolor: false }),
      TextStyleKit,
    ],
    content: value || '',
    editorProps: {
      attributes: {
        class: 'rich-text focus:outline-none',
        style: `min-height:${minHeight}px`,
      },
    },
    onUpdate: ({ editor: instance }) => {
      onChange(instance.isEmpty ? '' : instance.getHTML());
    },
  });

  // Push external value changes (e.g. after loading another record) into the editor.
  useEffect(() => {
    if (!editor) return;
    const current = editor.isEmpty ? '' : editor.getHTML();
    if (value !== current && value !== undefined) {
      editor.commands.setContent(value || '', { emitUpdate: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, editor]);

  const setLink = useCallback(() => {
    if (!editor) return;
    const previous = editor.getAttributes('link').href as string | undefined;
    const url = window.prompt('Link URL', previous || 'https://');
    if (url === null) return;
    if (url === '' || url === 'https://') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
    setLinkUrl(url);
  }, [editor]);

  if (!editor) {
    return (
      <div
        className="animate-pulse rounded-lg border border-zinc-200 bg-zinc-50"
        style={{ minHeight }}
      />
    );
  }

  const headingLevel = ([1, 2, 3, 4] as const).find((level) =>
    editor.isActive('heading', { level }),
  );

  return (
    <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white">
      <div className="flex flex-wrap items-center gap-0.5 border-b border-zinc-100 bg-zinc-50/70 px-2 py-1.5">
        <ToolButton title="Bold" active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}>
          <Bold size={15} />
        </ToolButton>
        <ToolButton title="Italic" active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}>
          <Italic size={15} />
        </ToolButton>
        <ToolButton title="Underline" active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()}>
          <UnderlineIcon size={15} />
        </ToolButton>
        <ToolButton title="Strikethrough" active={editor.isActive('strike')} onClick={() => editor.chain().focus().toggleStrike().run()}>
          <Strikethrough size={15} />
        </ToolButton>

        <Divider />

        {!compact &&
          ([1, 2, 3, 4] as const).map((level) => (
            <ToolButton
              key={level}
              title={`Heading ${level}`}
              active={headingLevel === level}
              onClick={() => editor.chain().focus().toggleHeading({ level }).run()}
            >
              <span className="text-xs font-bold">H{level}</span>
            </ToolButton>
          ))}

        <ToolButton
          title="Paragraph"
          active={editor.isActive('paragraph') && !headingLevel}
          onClick={() => editor.chain().focus().setParagraph().run()}
        >
          <span className="text-xs font-semibold">P</span>
        </ToolButton>

        <Divider />

        <ToolButton title="Bullet list" active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()}>
          <List size={15} />
        </ToolButton>
        <ToolButton title="Numbered list" active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
          <ListOrdered size={15} />
        </ToolButton>
        <ToolButton title="Quote" active={editor.isActive('blockquote')} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
          <Quote size={15} />
        </ToolButton>
        <ToolButton title="Divider" onClick={() => editor.chain().focus().setHorizontalRule().run()}>
          <Minus size={15} />
        </ToolButton>

        <Divider />

        <ToolButton title="Link" active={editor.isActive('link')} onClick={setLink}>
          <Link2 size={15} />
        </ToolButton>
        <ToolButton title="Insert image" onClick={() => setPickerOpen(true)}>
          <ImageIcon size={15} />
        </ToolButton>
        <ToolButton title="Inline code" active={editor.isActive('code')} onClick={() => editor.chain().focus().toggleCode().run()}>
          <Code size={15} />
        </ToolButton>

        <Divider />

        <label
          className="flex h-8 cursor-pointer items-center gap-1 rounded-md px-1.5 text-zinc-600 transition hover:bg-zinc-100"
          title="Text colour"
        >
          <span className="text-xs font-semibold">A</span>
          <input
            type="color"
            className="h-5 w-5 cursor-pointer border-0 bg-transparent p-0"
            onChange={(event) => editor.chain().focus().setColor(event.target.value).run()}
          />
        </label>
        <ToolButton title="Clear formatting" onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}>
          <Eraser size={15} />
        </ToolButton>

        <Divider />

        <ToolButton title="Undo" disabled={!editor.can().undo()} onClick={() => editor.chain().focus().undo().run()}>
          <Undo2 size={15} />
        </ToolButton>
        <ToolButton title="Redo" disabled={!editor.can().redo()} onClick={() => editor.chain().focus().redo().run()}>
          <Redo2 size={15} />
        </ToolButton>

        <span className="ml-auto pr-1 text-[11px] text-zinc-400">
          {editor.state.doc.textContent.length} chars
        </span>
      </div>

      <EditorContent editor={editor} className="cms-rich-text px-4 py-3 [&_.ProseMirror]:outline-none" />

      <MediaPickerModal
        open={pickerOpen}
        mode="single"
        onClose={() => setPickerOpen(false)}
        onSelect={(items) => {
          const url = items[0]?.url;
          if (url) editor.chain().focus().setImage({ src: url, alt: items[0]?.alt || '' }).run();
        }}
      />

      {linkUrl ? (
        <div className="border-t border-zinc-100 bg-zinc-50 px-3 py-1.5 text-[11px] text-zinc-500">
          Link: <span className="text-[#4f4dd6]">{linkUrl}</span>
        </div>
      ) : null}
    </div>
  );
}

export function editorHasContent(editor: Editor | null) {
  return editor ? !editor.isEmpty : false;
}
