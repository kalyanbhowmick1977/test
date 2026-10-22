import { Children, Fragment, isValidElement, useId, useState, type ReactNode } from 'react';
import { Table2, Database, Settings2, SlidersHorizontal, Zap } from 'lucide-react';

type Section = 'general' | 'data' | 'columns' | 'actions' | 'advanced';
const sections = [
  { key: 'general' as Section, label: 'General', icon: Settings2, hint: 'Name, appearance and visibility' },
  { key: 'data' as Section, label: 'Data', icon: Database, hint: 'Field bindings, options and record mapping' },
  { key: 'columns' as Section, label: 'Columns', icon: Table2, hint: 'Find and configure grid columns' },
  { key: 'actions' as Section, label: 'Actions', icon: Zap, hint: 'Button behavior and procedure parameters' },
  { key: 'advanced' as Section, label: 'Advanced', icon: SlidersHorizontal, hint: 'PageBuilder table settings' },
];

/** Section wrappers keep the existing controlled inputs mounted when changing tabs. */
export function PropertySection({ children }: { section: Section; children: ReactNode }) { return <>{children}</>; }

export default function PropertyPanel({ title, code, kind, children }: { title: string; code: string; kind: string; children: ReactNode }) {
  const [selected, setSelected] = useState<Section>('general');
  const id = useId();
  const groups = new Map<Section, ReactNode[]>();
  function collect(nodes: ReactNode, inherited: Section = 'general') {
    Children.forEach(nodes, child => {
      if (!isValidElement(child)) { if (child) groups.set(inherited, [...(groups.get(inherited) || []), child]); return; }
      const props = child.props as any;
      if (child.type === Fragment) { collect(props.children, inherited); return; }
      if (child.type === PropertySection) { collect(props.children, props.section); return; }
      const group = groups.get(inherited) || []; group.push(child); groups.set(inherited, group);
    });
  }
  collect(children);
  const available = sections.filter(section => groups.has(section.key));
  const active = available.some(section => section.key === selected) ? selected : available[0]?.key;
  return <div className="pb-inspector">
    <div className="pb-inspector-context"><span className="pb-inspector-icon"><Settings2 size={18} /></span>
      <div><small>{kind} settings</small><strong>{title || 'Untitled'}</strong><code>{code || 'New page'}</code></div>
    </div>
    <div className="pb-inspector-tabs" role="tablist" aria-label="Property sections">
      {available.map(({ key, label, icon: Icon, hint }, index) => <button type="button" key={key} role="tab" title={hint}
        id={`${id}-tab-${key}`} aria-controls={`${id}-panel-${key}`} aria-selected={active === key} tabIndex={active === key ? 0 : -1}
        onClick={() => setSelected(key)} onKeyDown={event => {
          if (!['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return;
          event.preventDefault();
          const next = event.key === 'Home' ? 0 : event.key === 'End' ? available.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + available.length) % available.length;
          setSelected(available[next].key); document.getElementById(`${id}-tab-${available[next].key}`)?.focus();
        }}><Icon size={14} /><span>{label}</span></button>)}
    </div>
    {available.map(({key,hint}) => <section key={key} id={`${id}-panel-${key}`} role="tabpanel" aria-labelledby={`${id}-tab-${key}`}
      hidden={key !== active} className="pb-inspector-content"><p className="pb-inspector-description">{hint}</p>
      {groups.get(key)?.map((child,index)=><Fragment key={index}>{child}</Fragment>)}
    </section>)}
    <p className="pb-inspector-save-note">Changes apply when you select <strong>Save page</strong>.</p>
  </div>;
}
