'use client';

import { useCallback, useEffect, useRef } from 'react';
import { EditorContent, useEditor, type Editor as TipTapEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Placeholder from '@tiptap/extension-placeholder';

/**
 * The WYSIWYG surface.
 *
 * TipTap holds an HTML document; the bridge converts to markdown only on save.
 * Images are inserted by the caller once they have been compressed and
 * uploaded, so this component never touches the network.
 */

interface Props {
  initialHtml: string;
  onChange: (html: string) => void;
  onUploadFiles: (files: File[]) => void;
  onReady?: (editor: TipTapEditor) => void;
}

export function Editor({ initialHtml, onChange, onUploadFiles, onReady }: Props) {
  const uploadRef = useRef(onUploadFiles);
  uploadRef.current = onUploadFiles;

  const editor = useEditor({
    // Rendering on the server would produce markup React then disagrees with.
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        link: { openOnClick: false, autolink: true, HTMLAttributes: { rel: 'noopener noreferrer' } },
        codeBlock: { HTMLAttributes: { class: 'language-ts' } },
      }),
      Image.configure({ inline: false, allowBase64: false }),
      Placeholder.configure({ placeholder: 'Write the post. Paste or drop an image to upload it.' }),
    ],
    content: initialHtml,
    editorProps: {
      attributes: {
        class: 'focus:outline-none',
        spellcheck: 'true',
      },
      // Paste and drop are the two ways an image ever arrives in practice.
      handlePaste(_view, event) {
        const files = imageFilesFrom(event.clipboardData);
        if (!files.length) return false;
        event.preventDefault();
        uploadRef.current(files);
        return true;
      },
      handleDrop(_view, event) {
        const files = imageFilesFrom((event as DragEvent).dataTransfer);
        if (!files.length) return false;
        event.preventDefault();
        uploadRef.current(files);
        return true;
      },
    },
    onUpdate: ({ editor: instance }) => onChange(instance.getHTML()),
  });

  useEffect(() => {
    if (editor && onReady) onReady(editor);
  }, [editor, onReady]);

  // Replacing the document when a different post is selected.
  const lastLoaded = useRef(initialHtml);
  useEffect(() => {
    if (!editor || initialHtml === lastLoaded.current) return;
    lastLoaded.current = initialHtml;
    editor.commands.setContent(initialHtml, { emitUpdate: false });
  }, [editor, initialHtml]);

  if (!editor) {
    return <div className="p-6 text-[color:var(--ctp-overlay1)]">loading editor…</div>;
  }

  return (
    <div className="editor-surface">
      <Toolbar editor={editor} onUploadFiles={onUploadFiles} />
      <div className="scroll-themed max-h-[calc(100dvh-19rem)] overflow-y-auto px-5 py-4">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}

function imageFilesFrom(source: DataTransfer | null): File[] {
  if (!source) return [];
  return [...source.files].filter((file) => file.type.startsWith('image/'));
}

function Toolbar({
  editor,
  onUploadFiles,
}: {
  editor: TipTapEditor;
  onUploadFiles: (files: File[]) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);

  const setLink = useCallback(() => {
    const previous = editor.getAttributes('link').href as string | undefined;
    const href = window.prompt('Link URL', previous ?? 'https://');
    if (href === null) return;
    if (href === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href }).run();
  }, [editor]);

  const buttons: { label: string; title: string; active?: boolean; run: () => void }[] = [
    { label: 'H2', title: 'Heading 2', active: editor.isActive('heading', { level: 2 }), run: () => editor.chain().focus().toggleHeading({ level: 2 }).run() },
    { label: 'H3', title: 'Heading 3', active: editor.isActive('heading', { level: 3 }), run: () => editor.chain().focus().toggleHeading({ level: 3 }).run() },
    { label: 'B', title: 'Bold', active: editor.isActive('bold'), run: () => editor.chain().focus().toggleBold().run() },
    { label: 'i', title: 'Italic', active: editor.isActive('italic'), run: () => editor.chain().focus().toggleItalic().run() },
    { label: '</>', title: 'Inline code', active: editor.isActive('code'), run: () => editor.chain().focus().toggleCode().run() },
    { label: '{ }', title: 'Code block', active: editor.isActive('codeBlock'), run: () => editor.chain().focus().toggleCodeBlock().run() },
    { label: '“”', title: 'Blockquote', active: editor.isActive('blockquote'), run: () => editor.chain().focus().toggleBlockquote().run() },
    { label: '•', title: 'Bullet list', active: editor.isActive('bulletList'), run: () => editor.chain().focus().toggleBulletList().run() },
    { label: '1.', title: 'Numbered list', active: editor.isActive('orderedList'), run: () => editor.chain().focus().toggleOrderedList().run() },
    { label: '—', title: 'Horizontal rule', run: () => editor.chain().focus().setHorizontalRule().run() },
    { label: '🔗', title: 'Link', active: editor.isActive('link'), run: setLink },
    { label: '🖼', title: 'Upload an image', run: () => fileRef.current?.click() },
  ];

  return (
    <div className="flex flex-wrap items-center gap-1 border-b border-[color:var(--ctp-surface0)] bg-[color:var(--ctp-mantle)] px-3 py-2">
      {buttons.map((button) => (
        <button
          key={button.title}
          type="button"
          title={button.title}
          aria-label={button.title}
          aria-pressed={button.active ?? false}
          onClick={button.run}
          className="min-w-[2rem] rounded px-2 py-1 font-mono text-[13px]"
          style={{
            background: button.active ? 'var(--ctp-surface2)' : 'var(--ctp-surface0)',
            color: button.active ? 'var(--ctp-text)' : 'var(--ctp-subtext0)',
          }}
        >
          {button.label}
        </button>
      ))}

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(event) => {
          const files = [...(event.target.files ?? [])];
          event.target.value = '';
          if (files.length) onUploadFiles(files);
        }}
      />
    </div>
  );
}
