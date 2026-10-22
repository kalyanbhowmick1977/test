import { useId, useState } from 'react';
import { ArrowDown, ArrowUp, ChevronDown, EyeOff, Search, Trash2 } from 'lucide-react';
import type { Control, GridColumn } from './pageBuilderApi';

export default function GridColumnsEditor({ control, onChange }: { control: Control; onChange: (patch: Partial<Control>) => void }) {
  const [query,setQuery]=useState('');
  const [visibility,setVisibility]=useState('all');
  const fieldList=useId();
  const fields=[...new Set([...control.columns.map(column=>column.field),...control.entity.keys,...control.entity.parentFilters.map(filter=>filter.target)].filter(Boolean))];
  const update=(index:number,patch:Partial<GridColumn>)=>onChange({columns:control.columns.map((column,i)=>i===index?{...column,...patch}:column)});
  const matches=control.columns.map((column,index)=>({column,index})).filter(({column})=>
    `${column.label} ${column.field}`.toLowerCase().includes(query.trim().toLowerCase()) &&
    (visibility==='all' || (visibility==='visible' ? column.visible!==false : column.visible===false)));
  function move(index:number,offset:number){const columns=[...control.columns];[columns[index],columns[index+offset]]=[columns[index+offset],columns[index]];onChange({columns});}
  return <div className="pb-grid-column-list">
    <div className="pb-column-search"><Search size={15}/><input type="search" aria-label="Find a grid column" placeholder="Find a column by name or field" value={query} onChange={e=>setQuery(e.target.value)}/></div>
    <div className="pb-column-list-options"><span>{matches.length} of {control.columns.length} columns</span>
      <select aria-label="Column visibility filter" value={visibility} onChange={e=>setVisibility(e.target.value)}><option value="all">All columns</option><option value="visible">Visible only</option><option value="hidden">Hidden only</option></select></div>
    {!matches.length && <div className="pb-inspector-empty">No matching columns.<button type="button" onClick={()=>{setQuery('');setVisibility('all');}}>Clear filters</button></div>}
    {matches.map(({column,index})=><details className="pb-column-accordion" key={index} open={query.trim() && matches.length===1 ? true : undefined}>
      <summary><span className="pb-column-order">{index+1}</span><span className="pb-column-summary"><strong>{column.label || 'Untitled column'}</strong><code>{column.field || 'No field selected'}</code></span>
        {column.visible===false && <EyeOff size={14} aria-label="Hidden column"/>}<ChevronDown className="pb-column-chevron" size={14}/></summary>
      <div className="pb-column-settings">
        <label className="pb-field"><span>Heading</span><input value={column.label} maxLength={100} onChange={e=>update(index,{label:e.target.value})}/></label>
        <label className="pb-field"><span>Field</span><input list={fieldList} value={column.field} maxLength={100} onChange={e=>update(index,{field:e.target.value})}/></label>
        <div className="pb-two-fields"><label className="pb-field"><span>Editor</span><select value={column.editorType || 'Textbox'} onChange={e=>update(index,{editorType:e.target.value})}>
          {['Textbox','Dropdown','Checkbox','Date','Button'].map(type=><option key={type}>{type}</option>)}</select></label>
          <label className="pb-field"><span>Data type</span><select value={column.dataType} onChange={e=>update(index,{dataType:e.target.value})}>{[['string','Text'],['numeric','Number'],['date','Date'],['bit','Yes / No']].map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label></div>
        <div className="pb-two-fields"><label className="pb-field"><span>Width (px)</span><input type="number" min={60} max={1600} value={column.width} onChange={e=>update(index,{width:Number(e.target.value)})}/></label>
          <label className="pb-field"><span>Maximum length</span><input type="number" min={1} max={4000} placeholder="Default" value={column.maxLength || ''} onChange={e=>update(index,{maxLength:e.target.value?Number(e.target.value):null})}/></label></div>
        <div className="pb-setting-checks">{[
          ['Visible column',column.visible!==false,(value:boolean)=>update(index,{visible:value})],
          ['Required',column.required,(value:boolean)=>update(index,{required:value})],
          ['Read only',column.readOnly,(value:boolean)=>update(index,{readOnly:value})],
          ['Save column value',column.saveValue!==false,(value:boolean)=>update(index,{saveValue:value})]
        ].map(([label,checked,change])=><label className="pb-check" key={String(label)}><input type="checkbox" checked={Boolean(checked)} onChange={e=>(change as (value:boolean)=>void)(e.target.checked)}/>{String(label)}</label>)}</div>
        <details className="pb-column-data"><summary>Queries &amp; rules</summary><div>
          <label className="pb-field"><span>Lookup SQL</span><textarea className="pb-code" rows={5} value={column.ddlSql || ''} onChange={e=>update(index,{ddlSql:e.target.value})}/></label>
          <label className="pb-field"><span>New row default SQL</span><textarea className="pb-code" rows={5} value={column.defaultValueSql || ''} onChange={e=>update(index,{defaultValueSql:e.target.value})}/></label>
          <label className="pb-field"><span>Show when field is true</span><input placeholder="Always show" value={column.visibleWhen || ''} onChange={e=>update(index,{visibleWhen:e.target.value})}/></label>
          <label className="pb-field"><span>Allow editing when field is true</span><input placeholder="Use normal edit permissions" value={column.editableWhen || ''} onChange={e=>update(index,{editableWhen:e.target.value})}/></label>
        </div></details>
        <div className="pb-column-actions"><button type="button" aria-label={`Move column ${index+1} up`} disabled={!index} onClick={()=>move(index,-1)}><ArrowUp size={14}/></button>
          <button type="button" aria-label={`Move column ${index+1} down`} disabled={index===control.columns.length-1} onClick={()=>move(index,1)}><ArrowDown size={14}/></button>
          <button type="button" className="pb-remove-column" aria-label={`Remove column ${index+1}`} onClick={()=>onChange({columns:control.columns.filter((_,i)=>i!==index)})}><Trash2 size={14}/>Remove</button></div>
      </div></details>)}
    <button type="button" className="pb-add-column" onClick={()=>{setQuery('');setVisibility('all');onChange({columns:[...control.columns,{field:`Column${control.columns.length+1}`,label:`Column ${control.columns.length+1}`,dataType:'string',editorType:'Textbox',width:150,required:false,readOnly:false,visible:true,saveValue:true}]});}}>+ Add column</button>
    <datalist id={fieldList}>{fields.map(field=><option key={field} value={field}/>)}</datalist>
  </div>;
}
