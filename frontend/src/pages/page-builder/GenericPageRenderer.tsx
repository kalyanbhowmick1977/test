import { useRef, useState } from 'react';
import type { Control, PageDefinition } from './pageBuilderApi';

export function ControlPreview({ control: c, design = false }: { control: Control; design?: boolean }) {
  if (c.type === 'Grid') return <section className="pb-grid-preview" aria-label={c.label}>
    <div className="pb-grid-caption">{c.label}<small>{c.columns.length} columns</small></div>
    <div className="pb-table-scroll"><table><thead><tr>{c.columns.filter(col=>col.visible!==false).map((col, i) => <th key={i} style={{ minWidth: col.width }}>{col.label || col.field}{col.required ? ' *' : ''}</th>)}</tr></thead>
      <tbody><tr><td colSpan={Math.max(c.columns.length, 1)} className="pb-grid-empty">{design ? 'Configure grid columns and entity in Properties' : 'No records in design preview'}</td></tr></tbody></table></div>
    <div className="pb-grid-footer">0 records</div>
  </section>;
  if (c.type === 'Checkbox') return <label className="pb-check"><input type="checkbox" disabled={design || c.readOnly} defaultChecked={c.defaultValue==='1' || c.defaultValue==='true'} />{c.label}</label>;
  if (c.type === 'Label') return <div className="pb-label-preview">{c.label}</div>;
  if (c.type === 'Button') return <button type="button" className="pb-action-preview" tabIndex={design ? -1 : undefined}>{c.label}</button>;
  return <label className="pb-preview-field" style={{ maxWidth: c.width }}>
    <span>{c.label}{c.required && <b> *</b>}</span>
    {c.type === 'Combobox' ? <select defaultValue="" disabled={design || c.readOnly} tabIndex={design ? -1 : undefined} aria-label={c.label}>
      <option value="">{c.placeholder || 'Select an option'}</option>
      {c.defaultValue && <option value={c.defaultValue}>{c.defaultValue}</option>}
    </select> : <input tabIndex={design ? -1 : undefined} aria-label={c.label} readOnly={design || c.readOnly} defaultValue={c.defaultValue} placeholder={c.placeholder || 'Enter value'} />}
  </label>;
}

export default function GenericPageRenderer({ page }: { page: PageDefinition }) {
  const form = useRef<HTMLFormElement>(null);
  const [message, setMessage] = useState('');
  const [generation, setGeneration] = useState(0);
  const [values, setValues] = useState<Record<string, string>>({});
  const content = page.controls.filter(c => c.visible && c.type !== 'Button').sort((a, b) => (a.type === 'Grid' ? a.gridIsTop ? 1 : 2 : 0) - (b.type === 'Grid' ? b.gridIsTop ? 1 : 2 : 0));
  const buttons = (placement: string) => page.controls.filter(c => c.type === 'Button' && c.visible && (c.placement || 'Toolbar') === placement);
  const toolbar = (placement: string) => buttons(placement).length > 0 && <div className="pb-preview-toolbar" aria-label={placement === 'Toolbar' ? 'Top toolbar' : 'Bottom toolbar'}>
    {buttons(placement).map(c => <button key={c.code} type="button" className="pb-action-preview" disabled={c.readOnly} onClick={() => action(c)}>{c.label}</button>)}
  </div>;
  const action = (c: Control) => {
    if(['SaveEdit','SaveClose','Close','AddRow','RemoveRow'].includes(c.action)) { setMessage('This button uses the saved page action. Open the page to use it with live records.'); return; }
    if (c.action === 'Reset' || c.action === 'Refresh') { form.current?.reset(); setValues({}); setGeneration(v => v + 1); setMessage(c.action === 'Reset' ? 'Preview values reset.' : 'Preview refreshed.'); }
    else if (c.action === 'StoredProcedure') setMessage('This button has a saved procedure mapping. Procedure execution is not part of design preview.');
    else if (form.current?.reportValidity()) setMessage('Form validation passed. Preview values are not saved as business records.');
  };
  return <div className="pb-rendered-page">
    <h2>{page.screenName || 'Untitled page'}</h2>
    {page.description && <p className="pb-hint">{page.description}</p>}
    <p className="pb-preview-notice">Design preview · form values are temporary; database queries and business actions are not executed.</p>
    {message && <div className="pb-message" role="status">{message}</div>}
    {toolbar('Toolbar')}
    <form ref={form} key={generation} className="pb-layout" onSubmit={e => { e.preventDefault(); setMessage('Form validation passed.'); }}>
      {content.map(c => <div key={c.code} style={{ gridColumn: `span ${c.span}` }}>
        {c.type === 'Button' ? <button type="button" className="pb-action-preview" onClick={() => action(c)}>{c.label}</button>
          : c.type === 'Textbox' || c.type === 'Combobox' ? <label className="pb-preview-field" style={{ maxWidth: c.width }}>
            <span>{c.label}{c.required && <b> *</b>}</span>
            {c.type === 'Combobox' ? <select aria-label={c.label} defaultValue={c.defaultValue} required={c.required} disabled={c.readOnly} onChange={e => setValues(v => ({ ...v, [c.field]: e.target.value }))}>
              <option value="">{c.placeholder || 'Select an option'}</option>{c.defaultValue && <option value={c.defaultValue}>{c.defaultValue}</option>}
            </select> : <input aria-label={c.label} type={c.dataType === 'numeric' ? 'number' : c.dataType === 'date' ? 'date' : 'text'} step={c.dataType === 'numeric' ? 'any' : undefined} required={c.required} readOnly={c.readOnly} defaultValue={c.defaultValue} placeholder={c.placeholder} onChange={e => setValues(v => ({ ...v, [c.field]: e.target.value }))} />}
          </label> : c.type === 'Label' && c.field ? <div className="pb-label-preview">{values[c.field] ?? page.controls.find(other => other.field === c.field && other.type !== 'Label')?.defaultValue ?? c.label}</div> : <ControlPreview control={c} />}
      </div>)}
      {!page.controls.some(c => c.visible) && <p className="pb-hint">This page has no visible controls.</p>}
    </form>
    {toolbar('Footer')}
  </div>;
}
