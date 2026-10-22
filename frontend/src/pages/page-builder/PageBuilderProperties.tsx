import { useEffect, useId, useState } from 'react';
import PageBuilderTableSettings from './PageBuilderTableSettings';
import PropertyPanel, { PropertySection } from './PropertyPanel';
import GridColumnsEditor from './GridColumnsEditor';
import { pageBuilderApi, type BusinessLayout, type Control, type Entity, type PageDefinition, type MenuLocation } from './pageBuilderApi';

const dataTypes = ['string', 'numeric', 'date', 'bit'];
export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="pb-field"><span>{label}</span>{children}</label>;
}
function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return <label className="pb-check"><input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} />{label}</label>;
}
type Choice = { value: string; label: string };
function Combo({ value, options, onChange, placeholder, maxLength }: { value: string; options: string[]; onChange: (value: string) => void; placeholder?: string; maxLength?: number }) {
  const id = useId();
  return <><input list={id} value={value} placeholder={placeholder} maxLength={maxLength} onChange={e => onChange(e.target.value)} />
    <datalist id={id}>{[...new Set(options.filter(Boolean))].map(option => <option key={option} value={option} />)}</datalist></>;
}
function MappingChoice({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  const [custom, setCustom] = useState(false);
  if (custom) return <input aria-label={label} autoFocus value={value} maxLength={128} onChange={event => onChange(event.target.value)} onBlur={() => setCustom(false)} />;
  return <select aria-label={label} value={value} onChange={event => event.target.value === '__custom__' ? setCustom(true) : onChange(event.target.value)}>
    <option value="">Not set</option>
    {[...new Set([...options, value].filter(Boolean))].map(option => <option key={option} value={option}>{option}</option>)}
    <option value="__custom__">Enter custom value...</option>
  </select>;
}
function ValueEditor({ value, onChange, dataType = 'string', options }: { value: string; onChange: (value: string) => void; dataType?: string; options?: Choice[] }) {
  const choices = options || (dataType.toLowerCase() === 'bit' ? [{ value: '0', label: '0 - No / False' }, { value: '1', label: '1 - Yes / True' }] : undefined);
  if (choices) return <select value={value} onChange={e => onChange(e.target.value)}>
    <option value="">Not set</option>
    {choices.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
    {value && !choices.some(option => option.value === value) && <option value={value}>{value}</option>}
  </select>;
  return <input value={value} maxLength={200} onChange={e => onChange(e.target.value)} />;
}
function entityFields(entity: Entity, fields: string[]) {
  // Suggest simple SELECT columns only; complex SQL remains editable as entered.
  const projection = entity.rowsSql?.match(/^\s*select\s+([\s\S]*?)\s+from\s/i)?.[1] || '';
  const selected = projection.split(',').flatMap(expression => {
    const match = expression.trim().match(/^(?:[\w]+\.)?\[?(\w+)\]?(?:\s+(?:as\s+)?\[?(\w+)\]?)?$/i);
    return match ? [match[2] || match[1]] : [];
  });
  return [...new Set([...fields, ...selected, ...entity.keys, ...entity.parentFilters.map(filter => filter.target), entity.rowReadOnlyColumn || ''].filter(Boolean))];
}
export function EntityEditor({ entity, onChange, fields = [], bitFields = [], sources = [] }: { entity: Entity; onChange: (entity: Entity) => void; fields?: string[]; bitFields?: string[]; sources?: string[] }) {
  const [layout, setLayout] = useState<BusinessLayout | null>(null);
  const [layoutError, setLayoutError] = useState('');
  useEffect(() => {
    let active = true;
    setLayout(null); setLayoutError('');
    const timer = window.setTimeout(() => {
      pageBuilderApi.tableLayout(entity.schema || 'dbo', entity.table || '', entity.rowReadOnlyColumn || '')
        .then(result => { if (active) setLayout(result); })
        .catch(() => { if (active) setLayoutError('Table layout is unavailable. You can enter custom mappings.'); });
    }, 250);
    return () => { active = false; window.clearTimeout(timer); };
  }, [entity.schema, entity.table, entity.rowReadOnlyColumn]);
  const databaseFields = layout?.columns?.map(column => column.name) || [];
  const availableFields = databaseFields.length ? [...new Set([...databaseFields, ...entityFields({ ...entity, parentFilters: [], keys: [], rowReadOnlyColumn: '' }, fields)])] : entityFields(entity, fields);
  const rowColumn = layout?.columns?.find(column => column.name === entity.rowReadOnlyColumn);
  const booleanRow = rowColumn?.dataType === 'bit' || bitFields.includes(entity.rowReadOnlyColumn || '') || entity.rowReadOnlyColumn?.trim().toLowerCase() === 'isglobal';
  const set = (patch: Partial<Entity>) => onChange({ ...entity, ...patch });
  return <details className="pb-details"><summary>Entity & record mapping</summary>
    <div className="pb-property-body">
      <Field label="Table schema"><MappingChoice label="Table schema" value={entity.schema} options={layout?.schemas || ['dbo']} onChange={schema => set({ schema })} /></Field>
      <Field label="Business table"><MappingChoice label="Business table" value={entity.table} options={layout?.tables || []} onChange={table => set({ table })} /></Field>
      <Field label="Rows query (optional)"><textarea className="pb-code" rows={7} value={entity.rowsSql || ''} maxLength={32000} placeholder="SELECT columns FROM dbo.Table WHERE AcctId=@AcctId" onChange={e=>set({rowsSql:e.target.value})} /></Field>
      <Field label="Read only row column"><MappingChoice label="Read only row column" value={entity.rowReadOnlyColumn || ''} options={availableFields} onChange={rowReadOnlyColumn => set({ rowReadOnlyColumn })} /></Field>
      {entity.rowReadOnlyColumn?.toLowerCase() === 'isglobal' && entity.table.toLowerCase() === 'fxsrcmstr' && <p className="pb-hint">IsGlobal is a column in dbo.FxSrcMstr: 0 = fund-specific, 1 = global. Select 0 below to lock fund-specific rows and allow global rows to be edited.</p>}
      <Field label="Read only row value">{!booleanRow && (layout?.values?.length || 0) > 0 ? <MappingChoice label="Read only row value" value={entity.rowReadOnlyValue || ''} options={layout!.values} onChange={rowReadOnlyValue => set({ rowReadOnlyValue })} /> : <ValueEditor value={entity.rowReadOnlyValue || ''} dataType={booleanRow ? 'bit' : 'string'}
        options={entity.rowReadOnlyColumn?.trim().toLowerCase() === 'isglobal' ? [{ value: '0', label: '0 - Fund-specific' }, { value: '1', label: '1 - Global' }] : undefined}
        onChange={rowReadOnlyValue => set({ rowReadOnlyValue })} />}</Field>
      <Field label="Primary keys (comma separated)"><input key={entity.keys.join(',')} defaultValue={entity.keys.join(', ')} onBlur={e => set({ keys: e.target.value.split(',').map(k => k.trim()).filter(Boolean) })} /></Field>
      {layout?.columns?.some(column => column.isPrimaryKey) && <button type="button" className="pb-text-button" onClick={() => set({ keys: layout.columns.filter(column => column.isPrimaryKey).map(column => column.name) })}>Use table primary key</button>}
      {layoutError && <p className="pb-hint">{layoutError}</p>}
      {availableFields.length > 0 && <div role="group" aria-label="Primary key fields" className="pb-checks">
        {availableFields.map(field => <Check key={field} label={`Key: ${field}`} checked={entity.keys.includes(field)}
          onChange={checked => set({ keys: checked ? [...entity.keys, field] : entity.keys.filter(key => key !== field) })} />)}
      </div>}
      <div className="pb-checks">
        <Check label="Allow insert" checked={entity.allowInsert} onChange={v => set({ allowInsert: v })} />
        <Check label="Allow update" checked={entity.allowUpdate} onChange={v => set({ allowUpdate: v })} />
        <Check label="Allow delete" checked={entity.allowDelete} onChange={v => set({ allowDelete: v })} />
      </div>
      <div className="pb-section-label">Parent filters</div>
      {entity.parentFilters.map((filter, i) => <div className="pb-editor-row" key={i}>
        <Field label={`Parent source ${i + 1}`}><MappingChoice label={`Parent source ${i + 1}`} value={filter.source} options={['AcctId', 'BrkPrdId', 'UserId', ...sources]} onChange={source => set({ parentFilters: entity.parentFilters.map((f, j) => i === j ? { ...f, source } : f) })} /></Field>
        <Field label={`Parent target ${i + 1}`}><MappingChoice label={`Parent target ${i + 1}`} value={filter.target} options={availableFields} onChange={target => set({ parentFilters: entity.parentFilters.map((f, j) => i === j ? { ...f, target } : f) })} /></Field>
        <button type="button" aria-label={`Remove parent filter ${i + 1}`} onClick={() => set({ parentFilters: entity.parentFilters.filter((_, j) => j !== i) })}>×</button>
      </div>)}
      <button type="button" className="pb-text-button" onClick={() => set({ parentFilters: [...entity.parentFilters, { source: 'AcctId', target: 'AcctId' }] })}>+ Add parent filter</button>
    </div>
  </details>;
}

export default function PageBuilderProperties({ page, control: c, updatePage, updateControl, menus }: {
  page: PageDefinition; control: Control | undefined;
  menus: MenuLocation[];
  updatePage: (patch: Partial<PageDefinition>) => void; updateControl: (patch: Partial<Control>) => void;
}) {
  if (!c) return <PropertyPanel title={page.screenName} code={page.screenCode} kind="Page">
    <p className="pb-hint">Name your page, then drag controls onto the canvas. Select a control to configure it.</p>
    <Field label="Page name"><input value={page.screenName} maxLength={150} onChange={e => updatePage({ screenName: e.target.value })} /></Field>
    <Field label="Page code"><input value={page.screenCode} maxLength={32} disabled={!!page.revision} onChange={e => updatePage({ screenCode: e.target.value })} /></Field>
    <Field label="Create under menu"><select value={page.menuId || 0} onChange={e => updatePage({ menuId: Number(e.target.value) })}>
      <option value={0}>Saved pages only (no menu entry)</option>
      {menus.map(menu => <option key={menu.menuId} value={menu.menuId}>{menu.caption}</option>)}
    </select></Field>
    <p className="pb-hint">After saving, a page link appears under the selected menu. </p>
    <Field label="Description"><textarea rows={3} value={page.description} maxLength={500} onChange={e => updatePage({ description: e.target.value })} /></Field>
    <PropertySection section="data"><EntityEditor entity={page.entity} fields={page.controls.map(control => control.field)} bitFields={page.controls.filter(control => control.dataType === 'bit').map(control => control.field)} onChange={entity => updatePage({ entity })} /></PropertySection>
    <PropertySection section="advanced"><PageBuilderTableSettings key={page.screenCode} page={page} onChange={updatePage} /></PropertySection>
  </PropertyPanel>;
  const set = updateControl;
  const contentControls = page.controls.filter(control => control.type !== 'Button');
  function positionControl(position: number) {
    const remaining = page.controls.filter(control => control !== c);
    const content = remaining.filter(control => control.type !== 'Button');
    const at = position === 0 ? 0 : remaining.indexOf(content[position - 1]) + 1;
    remaining.splice(at, 0, c!);
    updatePage({ controls: remaining });
  }
  const sourceControls = page.controls.filter(other => other.type === 'Textbox' || other.type === 'Combobox');
  return <PropertyPanel title={c.label} code={c.code} kind={c.type}>

    {c.type !== 'Button' && c.type !== 'Grid' && <Field label="Control position"><select value={contentControls.indexOf(c)} onChange={event => positionControl(Number(event.target.value))}>
      {contentControls.map((control, index) => <option key={control.code} value={index}>{index === 0 ? 'Top of content' : `After ${contentControls.filter(other => other !== c)[index - 1]?.label}`}</option>)}
    </select></Field>}
    {c.type === 'Grid' && <>
      <Field label="Grid position"><select value={c.gridIsTop ? 'Top' : 'Below'} onChange={event => set({ gridIsTop: event.target.value === 'Top' })}>
        <option value="Top">Top</option><option value="Below">Below</option>
      </select></Field>
      <p className="pb-hint">Top displays the grid in the upper section. Below displays it in the lower grid section.</p>
    </>}
    <Field label="Caption / label"><input value={c.label} maxLength={100} onChange={e => set({ label: e.target.value })} /></Field>
    <Field label="Control code"><input value={c.code} maxLength={30} onChange={e => set({ code: e.target.value })} /></Field>
    <PropertySection section="data">
    {['Textbox', 'Combobox', 'Checkbox', 'Label'].includes(c.type) && <Field label="Field binding"><Combo value={c.field} options={entityFields(page.entity, sourceControls.map(control => control.field))} maxLength={50} placeholder={c.type === 'Label' ? 'Optional' : 'Column name'} onChange={field => set({ field })} /></Field>}
    {['Textbox', 'Combobox', 'Checkbox'].includes(c.type) && <>
      <Field label="Data type"><select value={c.dataType} onChange={e => set({ dataType: e.target.value })}>{dataTypes.map(type => <option key={type}>{type}</option>)}</select></Field>
      <Field label="Default value"><ValueEditor value={c.defaultValue} dataType={c.dataType} onChange={defaultValue => set({ defaultValue })} /></Field>
      <Field label="Placeholder"><input value={c.placeholder} maxLength={200} onChange={e => set({ placeholder: e.target.value })} /></Field>
    </>}
    </PropertySection>
    <div className="pb-two-fields">
      <Field label="Layout columns"><select value={c.span} onChange={e => set({ span: Number(e.target.value) })}>{[2, 3, 4, 6, 8, 12].map(n => <option key={n} value={n}>{n} / 12</option>)}</select></Field>
      <Field label="Width (px)"><input type="number" min={60} max={1600} value={c.width} onChange={e => set({ width: Number(e.target.value) })} /></Field>
    </div>
    <div className="pb-checks">
      <Check label="Visible" checked={c.visible} onChange={v => set({ visible: v })} />
      {['Textbox', 'Combobox', 'Checkbox'].includes(c.type) && <>
        <Check label="Required" checked={c.required} onChange={v => set({ required: v })} />
        <Check label="Read only" checked={c.readOnly} onChange={v => set({ readOnly: v })} />
        <Check label="Save field value" checked={c.saveValue} onChange={v => set({ saveValue: v })} />
      </>}
    </div>
    <PropertySection section="actions">
    {c.type === 'Button' && <Field label="Action"><select value={c.action} onChange={e => set({ action: e.target.value, executionType: ['SaveEdit','SaveClose','StoredProcedure'].includes(e.target.value) ? 'StoredProcedure' : 'Client', executionScope: e.target.value === 'StoredProcedure' ? 'PerPage' : c.executionScope || 'PerChange' })}>
      <option value="Validate">Validate form</option><option value="Reset">Reset form</option><option value="Refresh">Refresh preview</option><option value="StoredProcedure">Stored procedure (configuration)</option>
      <option value="SaveEdit">Save &amp; Edit</option><option value="SaveClose">Save &amp; Close</option><option value="Close">Close page</option><option value="AddRow">Add grid row</option><option value="RemoveRow">Remove selected row</option>
    </select></Field>}
    {c.type === 'Button' && <>
      <Field label="Execution"><input readOnly value={c.executionType === 'StoredProcedure' ? 'Stored procedure' : 'Client action'} /></Field>
      <Field label="Button position"><select value={c.placement || 'Toolbar'} onChange={e => set({ placement: e.target.value })}><option value="Toolbar">Top toolbar</option><option value="Footer">Bottom toolbar</option></select></Field>
      {['AddRow','RemoveRow'].includes(c.action) && <Field label="Target grid"><select value={c.targetTabCode || ''} onChange={e => set({ targetTabCode: e.target.value })}><option value="">Currently selected grid</option>{page.controls.filter(grid => grid.type === 'Grid' && grid.metadataTabCode).map(grid => <option key={grid.code} value={grid.metadataTabCode}>{grid.label}</option>)}</select></Field>}
      <Check label="Disabled" checked={c.readOnly} onChange={readOnly => set({ readOnly })} />
      <p className="pb-hint">The saved caption, action, position and visibility control this button on the page. Save actions use the configured procedure; row actions use the selected grid.</p>
    </>}
    {c.type === 'Button' && c.executionType === 'StoredProcedure' && <details className="pb-details" open><summary>Stored procedure call</summary><div className="pb-property-body">
      <Field label="Procedure schema"><Combo value={c.procedureSchema} options={['dbo', page.entity.schema]} maxLength={128} onChange={procedureSchema => set({ procedureSchema })} /></Field>
      <Field label="Procedure name"><input value={c.procedureName} maxLength={128} onChange={e => set({ procedureName: e.target.value })} /></Field>
      <Field label="Execution scope"><select value={c.executionScope || 'PerChange'} onChange={e => set({ executionScope: e.target.value })}><option value="PerChange">Once per changed record</option><option value="PerPage">Once for the page</option></select></Field>
      {(c.saveParameters || []).map((parameter,i) => <div className="pb-column-editor" key={i}>
        <div className="pb-column-title"><strong>Parameter {i+1}</strong><button type="button" aria-label={`Remove procedure parameter ${i+1}`} onClick={() => set({saveParameters:c.saveParameters!.filter((_,j)=>j!==i)})}>×</button></div>
        <Field label="Parameter name"><input value={parameter.name} placeholder="@DataJson" onChange={e=>set({saveParameters:c.saveParameters!.map((p,j)=>j===i?{...p,name:e.target.value}:p)})} /></Field>
        <div className="pb-two-fields">
          <Field label="SQL type"><select value={parameter.sqlType} onChange={e=>set({saveParameters:c.saveParameters!.map((p,j)=>j===i?{...p,sqlType:e.target.value}:p)})}>{['NVarChar','VarChar','Int','BigInt','SmallInt','TinyInt','Bit','Decimal','Float','Date','DateTime','DateTime2','UniqueIdentifier'].map(type=><option key={type}>{type}</option>)}</select></Field>
          <Field label="Size (-1 = max)"><input type="number" min={-1} max={4000} value={parameter.size} onChange={e=>set({saveParameters:c.saveParameters!.map((p,j)=>j===i?{...p,size:Number(e.target.value)}:p)})} /></Field>
        </div>
        <Field label="Value source"><select value={parameter.source} onChange={e=>set({saveParameters:c.saveParameters!.map((p,j)=>j===i?{...p,source:e.target.value}:p)})}>{['EntityCode','Operation','DataJson','KeyJson','ChangesJson','ValuesJson','AcctId','BrkPrdId','UserId','Control','Constant'].map(source=><option key={source}>{source}</option>)}</select></Field>
        {parameter.source==='Control' && <Field label="Control field"><Combo value={parameter.sourceKey || ''} options={sourceControls.flatMap(control => [control.field, control.code])} onChange={sourceKey=>set({saveParameters:c.saveParameters!.map((p,j)=>j===i?{...p,sourceKey}:p)})} /></Field>}
        {parameter.source==='Constant' && <Field label="Constant value"><ValueEditor value={parameter.value ?? ''} dataType={parameter.sqlType} onChange={value=>set({saveParameters:c.saveParameters!.map((p,j)=>j===i?{...p,value}:p)})} /></Field>}
        <Check label="Required parameter" checked={parameter.required} onChange={required=>set({saveParameters:c.saveParameters!.map((p,j)=>j===i?{...p,required}:p)})} />
      </div>)}
      <button type="button" className="pb-text-button" onClick={()=>set({saveParameters:[...(c.saveParameters || []),{name:'',sqlType:'NVarChar',size:-1,source:'DataJson',sourceKey:'',value:null,required:false}]})}>+ Add procedure parameter</button>
      <p className="pb-hint">This call and its parameter mappings are saved with the button. UserId uses the signed-in user.</p>
    </div></details>}
    </PropertySection>
    <PropertySection section="data">
    {c.type === 'Combobox' && <details className="pb-details" open>
      <summary>Options data source</summary>
      <div className="pb-property-body">
        {c.type === 'Combobox' && <Field label="Source type"><select value={c.sourceType} onChange={e => set({ sourceType: e.target.value })}><option value="Query">SQL query</option><option value="StoredProcedure">Stored procedure</option></select></Field>}
        {c.sourceType === 'StoredProcedure' ? <>
          <Field label="Procedure schema"><Combo value={c.procedureSchema} options={['dbo', page.entity.schema]} maxLength={128} onChange={procedureSchema => set({ procedureSchema })} /></Field>
          <Field label="Procedure name"><input value={c.procedureName} maxLength={128} onChange={e => set({ procedureName: e.target.value, sourceType: 'StoredProcedure' })} /></Field>
        </> : <Field label="Parameterized SQL"><textarea className="pb-code" rows={6} value={c.ddlSql} maxLength={32000} placeholder={'SELECT Id AS KeyValue, Name AS KeyText\nFROM dbo.YourTable\nWHERE AcctId = @AcctId'} onChange={e => set({ ddlSql: e.target.value })} /></Field>}
        {c.type === 'Combobox' && <div className="pb-two-fields">
          <Field label="Value field"><input value={c.valueField} maxLength={100} onChange={e => set({ valueField: e.target.value })} /></Field>
          <Field label="Display field"><input value={c.textField} maxLength={100} onChange={e => set({ textField: e.target.value })} /></Field>
        </div>}
        <div className="pb-section-label">Parameter → value source</div>
        {c.parameters.map((parameter, i) => <div className="pb-parameter" key={i}>
          <div className="pb-editor-row">
            <input aria-label={`Parameter name ${i + 1}`} value={parameter.name} placeholder="@AcctId" onChange={e => set({ parameters: c.parameters.map((p, j) => i === j ? { ...p, name: e.target.value } : p) })} />
            <select aria-label={`Parameter source ${i + 1}`} value={parameter.source} onChange={e => set({ parameters: c.parameters.map((p, j) => i === j ? { ...p, source: e.target.value } : p) })}>
              {['AcctId', 'BrkPrdId', 'UserId'].map(name => <option key={name} value={name}>Context: {name}</option>)}
              {sourceControls.filter(s => !['AcctId', 'BrkPrdId', 'UserId'].includes(s.code)).map(s => <option key={s.code} value={s.code}>{s.label} ({s.code})</option>)}
            </select>
            <button type="button" aria-label={`Remove parameter ${i + 1}`} onClick={() => set({ parameters: c.parameters.filter((_, j) => i !== j) })}>×</button>
          </div>
          <Check label="Required parameter" checked={parameter.required} onChange={required => set({ parameters: c.parameters.map((p, j) => i === j ? { ...p, required } : p) })} />
        </div>)}
        <button type="button" className="pb-text-button" onClick={() => set({ parameters: [...c.parameters, { name: '', source: 'AcctId', required: true }] })}>+ Add parameter</button>
        <p className="pb-hint">Queries and procedures are saved as configuration. Design preview does not execute them.</p>
      </div>
    </details>}
    </PropertySection>
    {c.type === 'Grid' && <>
      <PropertySection section="columns"><GridColumnsEditor control={c} onChange={set} /></PropertySection>
      <PropertySection section="data"><EntityEditor entity={c.entity} fields={c.columns.map(column => column.field)} bitFields={c.columns.filter(column => column.dataType === 'bit').map(column => column.field)} sources={page.controls.flatMap(control => [control.field, ...control.entity.keys])} onChange={entity => set({ entity })} /></PropertySection>
    </>}
    <PropertySection section="advanced"><PageBuilderTableSettings page={page} onChange={updatePage} /></PropertySection>
  </PropertyPanel>;
}
