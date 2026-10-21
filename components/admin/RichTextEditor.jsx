"use client";

import { useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import FileUpload from "./FileUpload.jsx";

function ToolButton({ editor, label, action, active }) {
  return (
    <button
      type="button"
      className={"tool" + (active ? " tool--on" : "")}
      aria-pressed={active}
      onClick={() => action(editor.chain().focus()).run()}
    >
      {label}
    </button>
  );
}

export default function RichTextEditor({ initialJson, onChange }) {
  const [linkUrl, setLinkUrl] = useState("");
  const [showImage, setShowImage] = useState(false);
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] }, codeBlock: false, code: false, horizontalRule: false, strike: false }),
      Link.configure({ openOnClick: false }),
      Image,
    ],
    content: initialJson ? JSON.parse(initialJson) : "",
    onUpdate: ({ editor: e }) => onChange({ json: JSON.stringify(e.getJSON()), html: e.getHTML() }),
  });
  if (!editor) return <div className="rte rte--loading">Loading editor…</div>;

  return (
    <div className="rte">
      <div className="rte__toolbar" role="toolbar" aria-label="Formatting">
        <ToolButton editor={editor} label="H2" active={editor.isActive("heading", { level: 2 })} action={(c) => c.toggleHeading({ level: 2 })} />
        <ToolButton editor={editor} label="H3" active={editor.isActive("heading", { level: 3 })} action={(c) => c.toggleHeading({ level: 3 })} />
        <ToolButton editor={editor} label="Bold" active={editor.isActive("bold")} action={(c) => c.toggleBold()} />
        <ToolButton editor={editor} label="Italic" active={editor.isActive("italic")} action={(c) => c.toggleItalic()} />
        <ToolButton editor={editor} label="• List" active={editor.isActive("bulletList")} action={(c) => c.toggleBulletList()} />
        <ToolButton editor={editor} label="1. List" active={editor.isActive("orderedList")} action={(c) => c.toggleOrderedList()} />
        <ToolButton editor={editor} label="Quote" active={editor.isActive("blockquote")} action={(c) => c.toggleBlockquote()} />
        <span className="rte__link">
          <input aria-label="Link URL" placeholder="https://…" value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} />
          <button type="button" className="tool" onClick={() => { if (linkUrl) editor.chain().focus().setLink({ href: linkUrl }).run(); setLinkUrl(""); }}>Link</button>
          <button type="button" className="tool" onClick={() => editor.chain().focus().unsetLink().run()}>Unlink</button>
        </span>
        <button type="button" className="tool" onClick={() => setShowImage(!showImage)}>Image</button>
      </div>
      {showImage && (
        <FileUpload
          accept="image/jpeg,image/png,image/webp"
          requireAlt
          label="Image to insert"
          onUploaded={({ url, alt }) => { editor.chain().focus().setImage({ src: url, alt }).run(); setShowImage(false); }}
        />
      )}
      <EditorContent editor={editor} className="rte__body article-body" />
    </div>
  );
}
