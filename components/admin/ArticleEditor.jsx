"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import RichTextEditor from "./RichTextEditor.jsx";
import FileUpload from "./FileUpload.jsx";
import GooglePreview from "./GooglePreview.jsx";
import { CATEGORIES, CATEGORY_LABELS } from "@/lib/content/validation.js";
import { saveArticleAction, publishArticleAction, unpublishArticleAction } from "@/app/admin/articles/actions.js";

const blank = { title: "", slug: "", metaDescription: "", targetKeyword: "", category: "community", bodyJson: "", bodyHtml: "", coverUrl: "", coverAlt: "", authorId: "", projectId: "" };

export default function ArticleEditor({ article, authors, projects, planKeywords, prefill = {} }) {
  const router = useRouter();
  const [form, setForm] = useState(() => (article ? { ...blank, ...strip(article) } : { ...blank, ...prefill }));
  const [meta, setMeta] = useState(article ? { id: article.id, slug: article.slug, updatedAt: article.updatedAt, status: article.status, locked: Boolean(article.publishedAt) } : null);
  const [errors, setErrors] = useState([]);
  const [notice, setNotice] = useState(null);
  const [dirty, setDirty] = useState(false);
  const [pending, start] = useTransition();

  useEffect(() => {
    const warn = (e) => { if (dirty) { e.preventDefault(); e.returnValue = ""; } };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const set = (key) => (e) => { setForm((f) => ({ ...f, [key]: e.target.value })); setDirty(true); };

  // Applies a store result to the editor. Navigation for a new article happens
  // only after the whole save (and publish) sequence, so the edit page loads
  // the final state.
  function apply(r, message) {
    if (!r.ok) { setErrors(r.errors); setNotice(null); return false; }
    setErrors([]);
    setNotice(message);
    setDirty(false);
    setMeta({ id: r.article.id, slug: r.article.slug, updatedAt: r.article.updatedAt, status: r.article.status, locked: Boolean(r.article.publishedAt) });
    return true;
  }

  const run = (steps) => start(async () => {
    try {
      const last = await steps();
      if (last?.ok && !article && !meta) router.replace(`/admin/articles/${last.article.id}`);
    } catch (e) {
      setErrors([`Couldn't save (${e.message}). Your text is still here — check your connection and try again.`]);
      setNotice(null);
    }
  });

  const payload = () => ({ ...form, id: meta?.id, expectedUpdatedAt: meta?.updatedAt });
  const save = () => run(async () => {
    const r = await saveArticleAction(payload());
    apply(r, "Saved.");
    return r;
  });
  const publish = () => run(async () => {
    const saved = await saveArticleAction(payload());
    if (!apply(saved, null)) return saved;
    if (saved.article.status === "published") { setNotice("Updated — live now."); return saved; }
    const r = await publishArticleAction(saved.article.id, saved.article.updatedAt);
    apply(r, "Published — live now.");
    return r;
  });
  const unpublish = () => run(async () => {
    const r = await unpublishArticleAction(meta.id);
    apply(r, "Unpublished — no longer public.");
    return r;
  });

  return (
    <div className="editor">
      <div>
        <input className="title-input" aria-label="Title" placeholder="Article title" value={form.title} onChange={set("title")} />
        {errors.length > 0 && (
          <div className="form-errors" role="alert"><ul>{errors.map((e) => <li key={e}>{e}</li>)}</ul></div>
        )}
        {notice && <p className="form-ok" role="status">{notice}</p>}
        <RichTextEditor
          initialJson={article?.bodyJson ?? null}
          onChange={({ json, html }) => { setForm((f) => ({ ...f, bodyJson: json, bodyHtml: html })); setDirty(true); }}
        />
      </div>
      <aside className="editor__side">
        <div className="actions">
          {meta?.status !== "published" && <button type="button" className="btn btn--ghost" disabled={pending} onClick={save}>Save draft</button>}
          <button type="button" className="btn" disabled={pending} onClick={publish}>{meta?.status === "published" ? "Update" : "Publish"}</button>
          {meta?.status === "published" && <button type="button" className="btn btn--ghost" disabled={pending} onClick={unpublish}>Unpublish</button>}
          {meta && <a href={`/admin/articles/${meta.id}/preview`} target="_blank" rel="noreferrer">Preview</a>}
        </div>
        <div className="field">
          <label htmlFor="slug">Address</label>
          <input
            id="slug"
            value={meta?.locked ? meta.slug : form.slug}
            onChange={set("slug")}
            readOnly={meta?.locked}
            placeholder={meta?.slug && !meta.slug.startsWith("untitled-") ? meta.slug : "made from the title"}
            aria-describedby="slug-help"
          />
          <span id="slug-help" className="count">
            {meta?.locked ? "Locked after first publish so links never break." : "Leave empty to use the title."}
          </span>
        </div>
        <div className="field">
          <label htmlFor="kw">Target keyword</label>
          <input id="kw" list="plan-keywords" value={form.targetKeyword} onChange={set("targetKeyword")} />
          <datalist id="plan-keywords">{planKeywords.map((k) => <option key={k} value={k} />)}</datalist>
        </div>
        <div className="field">
          <label htmlFor="meta">Meta description</label>
          <textarea id="meta" rows={4} value={form.metaDescription} onChange={set("metaDescription")} />
          <span className={"count" + (form.metaDescription.length > 160 ? " count--over" : "")}>{form.metaDescription.length}/160</span>
        </div>
        <GooglePreview title={form.title} slug={form.slug} description={form.metaDescription} basePath="/articles" />
        <div className="field">
          <label htmlFor="cat">Category</label>
          <select id="cat" value={form.category} onChange={set("category")}>
            {CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="author">Author</label>
          <select id="author" value={form.authorId ?? ""} onChange={set("authorId")}>
            <option value="">JCI Roxas Halaran</option>
            {authors.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="proj">Related project</label>
          <select id="proj" value={form.projectId ?? ""} onChange={set("projectId")}>
            <option value="">None</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
          </select>
        </div>
        {form.coverUrl ? (
          <div className="field">
            <label>Cover image</label>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={form.coverUrl} alt={form.coverAlt} />
            <input aria-label="Cover alt text" value={form.coverAlt} onChange={set("coverAlt")} />
            <button type="button" className="tool" onClick={() => { setForm((f) => ({ ...f, coverUrl: "", coverAlt: "" })); setDirty(true); }}>Remove cover</button>
          </div>
        ) : (
          <FileUpload accept="image/jpeg,image/png,image/webp" requireAlt label="Cover image" onUploaded={({ url, alt }) => { setForm((f) => ({ ...f, coverUrl: url, coverAlt: alt })); setDirty(true); }} />
        )}
      </aside>
    </div>
  );
}

function strip(a) {
  return {
    title: a.title ?? "", slug: "", metaDescription: a.metaDescription ?? "", targetKeyword: a.targetKeyword ?? "",
    category: a.category, bodyJson: a.bodyJson ?? "", bodyHtml: a.bodyHtml ?? "", coverUrl: a.coverUrl ?? "", coverAlt: a.coverAlt ?? "",
    authorId: a.authorId ?? "", projectId: a.projectId ?? "",
  };
}
