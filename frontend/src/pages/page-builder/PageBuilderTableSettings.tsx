import { useId, useState } from 'react';
import type { MetadataColumn, PageDefinition } from './pageBuilderApi';

const settingLabels: Record<string,string> = { IsActive:'Active',IsMultipleTab:'Show tabs',IsParentChild:'Parent-child layout',
  IsVisible:'Visible',IsRequired:'Required',IsReadOnly:'Read only',IsSave:'Save value',AllowInsert:'Allow adding records',
  AllowUpdate:'Allow editing records',AllowDelete:'Allow deleting records',Allignment:'Alignment',IsPrimaryKey:'Primary key',
  IsIdentity:'Generated identity',IsInsertable:'Include on insert',IsUpdatable:'Include on update',IsParentKey:'Parent key' };
const settingLabel=(name:string)=>settingLabels[name] || name.replace(/([a-z0-9])([A-Z])/g,'$1 $2');

export default function PageBuilderTableSettings({ page, onChange }: { page: PageDefinition; onChange: (patch: Partial<PageDefinition>) => void }) {
  const [tableName, setTableName] = useState('');
  const [rowIndex, setRowIndex] = useState(0);
  const [search,setSearch]=useState('');
  const [showManaged,setShowManaged]=useState(false);
  const id = useId();
  const tables = page.tableDefinitions || [];
  const table = tables.find(item => item.name === tableName) || tables[0];
  const row = table?.rows[rowIndex] || table?.rows[0];
  const activeIndex = table?.rows[rowIndex] ? rowIndex : 0;
  function edit(column: MetadataColumn, value: string | boolean | number | null) {
    if (!table || column.editor === 'managed') return;
    onChange({ tableDefinitions: tables.map(item => item !== table ? item : { ...item,
      rows: item.rows.map((record, index) => index === activeIndex ? { ...record, [column.name]: value } : record) }) });
  }
  const columns=table?.columns.filter(column=>(showManaged || column.editor!=='managed') && `${column.name} ${settingLabel(column.name)}`.toLowerCase().includes(search.toLowerCase())) || [];
  return <details className="pb-details" open>
    <summary>Table settings <span className="pb-setting-count">{tables.length}</span></summary>
    <div className="pb-property-body">
      {!tables.length ? <p className="pb-hint">Save and reopen the page to load its table definitions.</p> : <>
        <p className="pb-hint">Configure metadata for this page. Generated fields can be shown for reference.</p>
        <label className="pb-field"><span>PageBuilder table</span><select value={table.name} onChange={event => { setTableName(event.target.value); setRowIndex(0); }}>
          {tables.map(item => <option key={item.name}>{item.name}</option>)}
        </select></label>
        {table.rows.length > 0 && <label className="pb-field"><span>Metadata record</span><select value={activeIndex} onChange={event => setRowIndex(Number(event.target.value))}>
          {table.rows.map((record, index) => <option key={index} value={index}>{index + 1}: {['CtrlName', 'ControlCode', 'ColumnName', 'EntityCode', 'TabCode', 'ScreenCode', 'ValidationId'].filter(key => record[key] != null).map(key => String(record[key])).join(' / ')}</option>)}
        </select></label>}
        {!row && <p className="pb-hint">No records for this page. Column definitions are listed below. Controls and mappings are created through the designer.</p>}
        <label className="pb-field"><span>Find a setting</span><input type="search" value={search} placeholder="Search by name" onChange={event=>setSearch(event.target.value)}/></label>
        <label className="pb-check"><input type="checkbox" checked={showManaged} onChange={event=>setShowManaged(event.target.checked)}/>Show generated fields</label>
        {!columns.length && <p className="pb-hint">No matching editable settings. Try another search or show generated fields.</p>}
        {columns.map(column => {
          const value = row?.[column.name];
          const disabled = !row || column.editor === 'managed' || value == null;
          const inputId = `${id}-${table.name}-${column.name}`;
          const maxLength = column.maxLength < 0 ? undefined : ['nvarchar', 'nchar'].includes(column.dataType) ? column.maxLength / 2 : column.maxLength;
          return <div key={column.name} className="pb-column-editor">
            <label htmlFor={inputId} className="pb-metadata-setting-name">{settingLabel(column.name)}<code>{column.name}</code></label>
            {column.editor === 'checkbox' || column.dataType === 'bit' || column.dataType === 'tinyint' && (/^Is/.test(column.name) || ['AutoPostBack','SaveValue'].includes(column.name)) && [0,1,null,undefined].includes(value as any) ? <label className="pb-check"><input id={inputId} type="checkbox" disabled={disabled} checked={value === true || value === 1}
              onChange={event => edit(column, column.dataType === 'bit' ? event.target.checked : event.target.checked ? 1 : 0)} />Yes</label>
              : column.editor === 'select' ? <select id={inputId} disabled={disabled} value={String(value ?? '')} onChange={event => edit(column, Number(event.target.value))}>
                {value == null && <option value="">Not set</option>}
                {column.choices.map(choice => <option key={choice} value={choice}>{column.name === 'Allignment' ? ({ '0': 'Automatic', '1': 'First layout column', '2': 'Second layout column' }[choice] || choice) : choice}</option>)}
                {value != null && !column.choices.includes(String(value)) && <option>{String(value)}</option>}
              </select> : column.editor === 'textarea' || column.name === 'Script' ? <textarea id={inputId} rows={3} disabled={disabled} maxLength={maxLength} value={String(value ?? '')} onChange={event => edit(column, event.target.value)} />
                : <input id={inputId} type={column.editor === 'number' ? 'number' : 'text'} disabled={disabled} maxLength={maxLength} value={String(value ?? '')}
                  onChange={event => edit(column, column.editor === 'number' && event.target.value !== '' ? Number(event.target.value) : event.target.value)} />}
            {column.editor === 'managed' ? <small className="pb-managed-label">Managed by the designer</small>
              : column.nullable && row && <label className="pb-check"><input type="checkbox" checked={value == null}
                onChange={event => edit(column, event.target.checked ? null : column.editor === 'checkbox' ? column.dataType === 'bit' ? false : 0 : column.editor === 'number' || column.editor === 'select' ? 0 : '')} />Not set (NULL)</label>}
          </div>;
        })}
        {table.name === 'PageBuilder_UI_ControlValidation' && <p className="pb-hint">Validation metadata is stored here. The current runtime does not evaluate these rules.</p>}
      </>}
    </div>
  </details>;
}
