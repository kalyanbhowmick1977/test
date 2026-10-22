import { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, ChevronLeft, Copy, Eye, GripVertical, LayoutTemplate, MousePointer2, Plus, Redo2, Save, Table2, TextCursorInput, Trash2, Type, Undo2, X, ListFilter, Pencil } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { emptyPage, newControl, pageBuilderApi, type Control, type ControlType, type PageDefinition, type PageSummary, type MenuLocation } from './pageBuilderApi';
import PageBuilderProperties from './PageBuilderProperties';
import GenericPageRenderer, { ControlPreview } from './GenericPageRenderer';

import './page-builder.css';

const palette = [
  { type: 'Textbox' as ControlType, icon: TextCursorInput, hint: 'Single field input' },
  { type: 'Grid' as ControlType, icon: Table2, hint: 'Tabular records' },
  { type: 'Combobox' as ControlType, icon: ListFilter, hint: 'Query or procedure options' },
  { type: 'Checkbox' as ControlType, icon: MousePointer2, hint: 'Yes or no value' },
  { type: 'Label' as ControlType, icon: Type, hint: 'Caption or bound text' },
  { type: 'Button' as ControlType, icon: MousePointer2, hint: 'Page action' },
];
const snapshot = (page: PageDefinition) => JSON.stringify(page);

export default function PageBuilderPage({ savedPreview = false }: { savedPreview?: boolean }) {
  const navigate = useNavigate();
  const { screenCode } = useParams();
  const [page, setPage] = useState<PageDefinition>(emptyPage);
  const [baseline, setBaseline] = useState(snapshot(emptyPage()));
  const [pages, setPages] = useState<PageSummary[]>([]);
  const [menus, setMenus] = useState<MenuLocation[]>([]);
  const [selected, setSelected] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [preview, setPreview] = useState(false);
  const [dragOver, setDragOver] = useState<number | null>(null);
  const [history, setHistory] = useState<string[]>([]);
  const [future, setFuture] = useState<string[]>([]);
  const nameEditedCode = useRef(false);
  const request = useRef(0);
  const previewTrigger = useRef<HTMLButtonElement>(null);
  const dirty = snapshot(page) !== baseline;
  const selectedControl = page.controls.find(c => c.code === selected);

  useEffect(() => {
    let active = true;
    setBusy(true); setError('');
    Promise.all([pageBuilderApi.list(), savedPreview && screenCode ? pageBuilderApi.get(screenCode) : Promise.resolve(null), pageBuilderApi.menus()])
      .then(([items, loaded, locations]) => {
        if (!active) return;
        setPages(items);
        setMenus(locations || []);
        if (loaded) { setPage(loaded); setBaseline(snapshot(loaded)); }
      }).catch(e => { if (active) setError(e.message); }).finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, [savedPreview, screenCode]);
  useEffect(() => {
    if (!dirty || savedPreview) return;
    const handler = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty, savedPreview]);

  function change(next: PageDefinition) {
    setHistory(h => [...h.slice(-39), snapshot(page)]); setFuture([]); setPage(next); setNotice('');
  }
  function patchPage(patch: Partial<PageDefinition>) {
    if ('screenCode' in patch) nameEditedCode.current = true;
    if ('screenName' in patch && !page.revision && !nameEditedCode.current) {
      const suggestion = patch.screenName!.replace(/[^A-Za-z0-9_]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 32);
      patch.screenCode = /^[A-Za-z_]/.test(suggestion) ? suggestion : suggestion ? 'P_' + suggestion.slice(0, 30) : '';
    }
    change({ ...page, ...patch });
  }
  function patchControl(patch: Partial<Control>) {
    if (!selectedControl) return;
    // Keep parameter references consistent when the user renames a control.
    change({ ...page, controls: page.controls.map(c => ({ ...(c === selectedControl ? { ...c, ...patch } : c),
      parameters: (c === selectedControl ? patch.parameters ?? c.parameters : c.parameters).map(p => patch.code && p.source === selected ? { ...p, source: patch.code } : p),
    })) });
    if (patch.code !== undefined) setSelected(patch.code);
  }
  function add(type: ControlType, at = page.controls.length) {
    const control = newControl(type, page.controls);
    const controls = [...page.controls]; controls.splice(at, 0, control);
    change({ ...page, controls }); setSelected(control.code);
  }
  function move(from: number, to: number) {
    if (from === to || from < 0 || from >= page.controls.length) return;
    const controls = [...page.controls]; const [control] = controls.splice(from, 1);
    controls.splice(Math.max(0, Math.min(to, controls.length)), 0, control);
    change({ ...page, controls });
  }
  function drop(event: React.DragEvent, at: number) {
    event.preventDefault(); event.stopPropagation(); setDragOver(null);
    if (busy) return;
    const type = event.dataTransfer.getData('application/pagebuilder-type') as ControlType;
    if (palette.some(p => p.type === type)) add(type, at);
    else {
      const code = event.dataTransfer.getData('application/pagebuilder-control');
      const from = page.controls.findIndex(c => c.code === code);
      move(from, from < at ? at - 1 : at);
    }
  }
  function discard() { return !dirty || window.confirm('Discard your unsaved page changes?'); }
  function create() {
    if (!discard()) return;
    const blank = emptyPage(); setPage(blank); setBaseline(snapshot(blank)); setSelected(''); setError(''); setNotice('');
    setHistory([]); setFuture([]); nameEditedCode.current = false;
  }
  async function open(code: string) {
    if (!code || !discard()) return;
    const version = ++request.current; setBusy(true); setError(''); setNotice('');
    try {
      const loaded = await pageBuilderApi.get(code);
      if (version !== request.current) return;
      setPage(loaded); setBaseline(snapshot(loaded)); setSelected(''); setHistory([]); setFuture([]); nameEditedCode.current = true;
    } catch (e) { setError(e.message); } finally { if (version === request.current) setBusy(false); }
  }
  async function save() {
    if (!page.screenName.trim()) { setSelected(''); setError('Enter a page name before saving.'); return; }
    if (!/^[A-Za-z_][A-Za-z0-9_]{0,31}$/.test(page.screenCode)) { setSelected(''); setError('Enter a page code of up to 32 letters, digits or underscores, starting with a letter or underscore.'); return; }
    const incomplete = page.controls.find(control => control.type === 'Button' && ['SaveEdit', 'SaveClose', 'StoredProcedure'].includes(control.action) && (!control.procedureSchema?.trim() || !control.procedureName?.trim()));
    if (incomplete) {
      setSelected(incomplete.code);
      setError(`Configure the procedure mapping for "${incomplete.label}" before saving, or choose a preview action such as Validate form. Procedure mappings are configuration only in this standalone designer.`);
      return;
    }
    setBusy(true); setError(''); setNotice('');
    try {
      const saved = await pageBuilderApi.save(page);
      setPage(saved); setBaseline(snapshot(saved)); setHistory([]); setFuture([]);
      setPages(items => [...items.filter(p => p.screenCode.toLowerCase() !== saved.screenCode.toLowerCase()), { screenCode: saved.screenCode, screenName: saved.screenName, controlCount: saved.controls.length, menuId: saved.menuId }].sort((a, b) => a.screenName.localeCompare(b.screenName)));
      setNotice(`“${saved.screenName}” saved in the database. Menu: ${menus.find(m => m.menuId === saved.menuId)?.caption || 'Saved pages only'}.`);
      window.dispatchEvent(new Event('ht:pages-saved'));
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  async function deletePage() {
    if (!page.revision || !window.confirm(`Delete page "${page.screenName || page.screenCode}" and all its PageBuilder metadata? This cannot be undone. Sample business records will remain.`)) return;
    setBusy(true); setError(''); setNotice('');
    try {
      await pageBuilderApi.delete(page.screenCode, page.revision);
      const code = page.screenCode;
      const blank = emptyPage(); setPage(blank); setBaseline(snapshot(blank));
      setSelected(''); setHistory([]); setFuture([]); nameEditedCode.current = false;
      setPages(items => items.filter(item => item.screenCode !== code));
      setNotice(`Page ${code} deleted. You can create it again with the same code.`);
      window.dispatchEvent(new Event('ht:pages-saved'));
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  function undo() {
    if (!history.length) return;
    setFuture(f => [snapshot(page), ...f]); setPage(JSON.parse(history[history.length - 1])); setHistory(h => h.slice(0, -1)); setSelected('');
  }
  function redo() {
    if (!future.length) return;
    setHistory(h => [...h, snapshot(page)]); setPage(JSON.parse(future[0])); setFuture(f => f.slice(1)); setSelected('');
  }
  function duplicate(index: number) {
    const original = page.controls[index]; const fresh = newControl(original.type, page.controls);
    const copy: Control = JSON.parse(JSON.stringify(original)); copy.code = fresh.code; if (copy.field) copy.field = fresh.code; copy.label = `${copy.label.slice(0, 90)} copy`;
    copy.metadataTabCode = '';
    if (copy.metadata) copy.metadata = { ...copy.metadata, controlId: 0, controlCode: fresh.code };
    copy.entity.entityCode = '';
    copy.columns = copy.columns.map(column => ({ ...column, metadata: column.metadata ? { ...column.metadata, controlId: 0 } : undefined }));
    const controls = [...page.controls]; controls.splice(index + 1, 0, copy); change({ ...page, controls }); setSelected(copy.code);
  }
  function closePreview() { setPreview(false); requestAnimationFrame(() => previewTrigger.current?.focus()); }
  function previewKeys(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') { event.preventDefault(); closePreview(); }
    if (event.key !== 'Tab') return;
    const elements = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]'));
    const first = elements[0], last = elements[elements.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  }


  if (savedPreview) return <div className="pb-root">
    <div className="pb-toolbar"><button type="button" onClick={() => navigate('/page-builder')}><ChevronLeft size={16} />Page Builder</button><span className="pb-hint">Saved page preview</span></div>
    {error ? <div className="pb-error" role="alert">{error}</div> : busy ? <p role="status">Loading page…</p> : <GenericPageRenderer page={page} />}
  </div>;

  return <div className="pb-root" aria-busy={busy}>
    <header className="pb-header">
      <div className="pb-title"><span className="pb-title-icon"><LayoutTemplate size={23} /></span><div><h1>Page Builder</h1><p>Design a page. Configure its controls. Save and reuse.</p></div></div>
      <div className="pb-header-actions"><span className={`pb-save-state ${dirty ? 'dirty' : ''}`}>{busy ? 'Working…' : dirty ? 'Unsaved changes' : page.revision ? 'Saved' : 'New page'}</span>
        <button type="button" ref={previewTrigger} disabled={busy} onClick={() => setPreview(true)}><Eye size={16} />Preview</button>
        <button type="button" className="pb-primary" disabled={busy} onClick={save}><Save size={16} />{busy ? 'Please wait…' : 'Save page'}</button>
        <button type="button" data-page-close disabled={busy} onClick={() => { if (discard()) navigate(page.menuId ? '/menu/'+page.menuId : '/general'); }}><X size={16} />Close</button>
      </div>
    </header>
    {error && <div className="pb-error" role="alert">{error}<button type="button" aria-label="Dismiss error" onClick={() => setError('')}><X size={15} /></button></div>}
    {notice && <div className="pb-message" role="status">{notice}</div>}
    <div className="pb-toolbar">
      <button type="button" disabled={busy} onClick={create}><Plus size={16} />New page</button>
      <select aria-label="Open saved page" disabled={busy} value={page.revision ? page.screenCode : ''} onChange={e => open(e.target.value)}><option value="">Open saved page…</option>{pages.map(item => <option key={item.screenCode} value={item.screenCode}>{item.screenName} ({item.controlCount})</option>)}</select>
      {page.revision && <button type="button" disabled={busy} onClick={() => { if (discard()) navigate('/pages/' + encodeURIComponent(page.screenCode)); }}><Eye size={15} />{page.metadataLayout ? 'Open page' : 'Saved preview'}</button>}
      {page.revision && page.menuId > 0 && <button type="button" disabled={busy} onClick={() => { if (discard()) navigate('/menu/' + page.menuId); }}>Open selected menu</button>}
      {page.revision && <button type="button" disabled={busy} onClick={deletePage}><Trash2 size={15} />Delete page</button>}
      <div className="pb-toolbar-spacer" />
      <button type="button" title="Undo" aria-label="Undo" disabled={busy || !history.length} onClick={undo}><Undo2 size={16} /></button>
      <button type="button" title="Redo" aria-label="Redo" disabled={busy || !future.length} onClick={redo}><Redo2 size={16} /></button>
    </div>
    <fieldset className="pb-workspace" disabled={busy}>
      <aside className="pb-palette"><div className="pb-panel-heading">Controls<span>{palette.length} available</span></div><p className="pb-hint">Drag onto the canvas, or click to add.</p>
        {palette.map(({ type, icon: Icon, hint }) => <button key={type} type="button" className="pb-palette-item" draggable={!busy}
          onDragStart={e => { e.dataTransfer.setData('application/pagebuilder-type', type); e.dataTransfer.effectAllowed = 'copy'; }} onClick={() => add(type)}>
          <span className="pb-palette-icon"><Icon size={19} /></span><span><strong>{type}</strong><small>{hint}</small></span><Plus size={14} />
        </button>)}
        <div className="pb-palette-note"><LayoutTemplate size={20} /><strong>Your page, your structure</strong><p>Start with a blank canvas. Select any control to edit its caption, binding and behavior.</p></div>
      </aside>
      <main className="pb-canvas-panel">
        <div className="pb-canvas-top"><span><span className="pb-dot" />DESIGN CANVAS</span><button type="button" className="pb-text-button" onClick={() => setSelected('')}><Pencil size={13} />Page settings</button></div>
        <div className="pb-page-heading"><input aria-label="Page name" value={page.screenName} maxLength={150} placeholder="Name your page" onChange={e => patchPage({ screenName: e.target.value })} /><span>{page.screenCode || 'Page code is generated from the name'}</span></div>
        <div className={`pb-canvas ${!page.controls.length ? 'empty' : ''} ${dragOver === page.controls.length ? 'pb-drop-end' : ''}`}
          onDragOver={e => { e.preventDefault(); if (e.target === e.currentTarget) setDragOver(page.controls.length); }} onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(null); }} onDrop={e => drop(e, page.controls.length)}>
          {!page.controls.length ? <div className="pb-empty"><div className="pb-empty-icon"><LayoutTemplate size={35} /></div><h2>Build something useful</h2><p>Drag your first control here.<br />You can also choose a control from the left panel.</p><button type="button" onClick={() => add('Textbox')}><Plus size={16} />Add a textbox</button></div>
            : <div className="pb-layout">{page.controls.map((c, index) => <section key={index} className={`pb-control-card ${selected === c.code ? 'selected' : ''} ${!c.visible ? 'pb-hidden-control' : ''} ${dragOver === index ? 'pb-drop-before' : ''}`}
              style={{ gridColumn: `span ${c.span}` }} onClick={() => setSelected(c.code)} onDragOver={e => { e.preventDefault(); e.stopPropagation(); setDragOver(index); }} onDrop={e => drop(e, index)}>
              <div className="pb-control-bar"><button type="button" draggable={!busy} className="pb-drag-handle" title={`Drag ${c.label} to reorder`} aria-label={`Drag ${c.label} to reorder`} onDragStart={e => { e.dataTransfer.setData('application/pagebuilder-control', c.code); e.dataTransfer.effectAllowed = 'move'; }} onDragEnd={() => setDragOver(null)}><GripVertical size={14} /></button>
                <button type="button" className="pb-control-select" aria-label={`Configure ${c.label}`} onClick={() => setSelected(c.code)}>{c.type}<small>{c.code}</small></button>
                <div className="pb-control-tools">
                  <button type="button" aria-label={`Move ${c.label} up`} disabled={!index} onClick={e => { e.stopPropagation(); move(index, index - 1); }}><ArrowUp size={13} /></button>
                  <button type="button" aria-label={`Move ${c.label} down`} disabled={index === page.controls.length - 1} onClick={e => { e.stopPropagation(); move(index, index + 1); }}><ArrowDown size={13} /></button>
                  <button type="button" aria-label={`Duplicate ${c.label}`} onClick={e => { e.stopPropagation(); duplicate(index); }}><Copy size={13} /></button>
                  <button type="button" aria-label={`Remove ${c.label}`} onClick={e => { e.stopPropagation(); change({ ...page, controls: page.controls.filter((_, i) => i !== index) }); if (selected === c.code) setSelected(''); }}><Trash2 size={13} /></button>
                </div>
              </div><div className="pb-control-content"><ControlPreview control={c} design /></div>
            </section>)}</div>}
        </div>
        <footer className="pb-canvas-footer"><span>{page.controls.length} controls · 12-column layout</span><span>Drag to arrange · click to configure</span></footer>
      </main>
      <aside className="pb-properties"><div className="pb-panel-heading">Properties<button type="button" className="pb-text-button" onClick={() => setSelected('')}>{selectedControl ? 'Page settings' : 'Page'}</button></div>
        <PageBuilderProperties page={page} control={selectedControl} updatePage={patchPage} updateControl={patchControl} menus={menus} />
      </aside>
    </fieldset>
    {preview && <div className="pb-modal-backdrop" onKeyDown={previewKeys}><section className="pb-modal" role="dialog" aria-modal="true" aria-label="Page design preview">
      <div className="pb-toolbar"><strong><Eye size={17} />Page preview</strong><div className="pb-toolbar-spacer" /><button type="button" autoFocus aria-label="Close preview" onClick={closePreview}><X size={18} /></button></div>
      <GenericPageRenderer page={page} />
    </section></div>}
  </div>;
}
