import apiService from '../../services/apiService';

export type ControlType = 'Textbox' | 'Grid' | 'Combobox' | 'Checkbox' | 'Label' | 'Button';
export type GridColumn = { editorType?: string; visible?: boolean; saveValue?: boolean; maxLength?: number | null; visibleWhen?: string; editableWhen?: string; field: string; label: string; dataType: string; width: number; required: boolean; readOnly: boolean; metadata?: any; ddlSql?: string; defaultValueSql?: string };
export type Entity = { entityCode?: string; rowsSql?: string; rowReadOnlyColumn?: string; rowReadOnlyValue?: string; schema: string; table: string; keys: string[]; allowInsert: boolean; allowUpdate: boolean; allowDelete: boolean; parentFilters: { source: string; target: string; sourceEntityCode?: string }[] };
export type Parameter = { name: string; source: string; required: boolean };
export type ProcedureParameter = { name: string; sqlType: string; size: number; source: string; sourceKey: string; value: string | null; required: boolean };
export type Control = {
  metadata?: any; metadataTabCode?: string; gridIsTop?: boolean; defaultValueSql?: string;
  code: string; label: string; type: ControlType; field: string; dataType: string;
  width: number; span: number; required: boolean; readOnly: boolean; visible: boolean; saveValue: boolean;
  defaultValue: string; placeholder: string; sourceType: string; ddlSql: string;
  procedureSchema: string; procedureName: string; valueField: string; textField: string; action: string;
  placement?: string; targetTabCode?: string;
  executionType?: string; executionScope?: string; saveParameters?: ProcedureParameter[];
  parameters: Parameter[]; columns: GridColumn[]; entity: Entity;
};
export type MetadataColumn = { name: string; dataType: string; nullable: boolean; maxLength: number; editor: string; choices: string[] };
export type MetadataTable = { name: string; columns: MetadataColumn[]; rows: Record<string, string | number | boolean | null>[] };
export type PageDefinition = { tableDefinitions?: MetadataTable[]; screenCode: string; screenName: string; description: string; revision: string | null; menuId: number; metadataLayout?: boolean; entity: Entity; controls: Control[] };
export type BusinessColumn = { name: string; dataType: string; nullable: boolean; isPrimaryKey: boolean };
export type BusinessLayout = { schemas: string[]; tables: string[]; columns: BusinessColumn[]; values: string[]; valuesLimited: boolean };
export type PageSummary = { screenCode: string; screenName: string; controlCount: number; menuId: number };
export type MenuLocation = { menuId: number; caption: string };
export const emptyEntity = (): Entity => ({ schema: 'dbo', table: '', keys: [], allowInsert: false, allowUpdate: false, allowDelete: false, parentFilters: [] });
export const emptyPage = (): PageDefinition => ({ screenCode: '', screenName: '', description: '', revision: null, menuId: 0, entity: emptyEntity(), controls: [] });
export function newControl(type: ControlType, existing: Control[]): Control {
  let index = 1;
  while (existing.some(c => c.code.toLowerCase() === `${type}_${index}`.toLowerCase() || c.field.toLowerCase() === `${type}_${index}`.toLowerCase())) index++;
  return { code: `${type}_${index}`, label: type === 'Button' ? 'Validate' : `${type} ${index}`, type,
    field: type === 'Textbox' || type === 'Combobox' || type === 'Checkbox' ? `${type}_${index}` : '', dataType: type === 'Checkbox' ? 'bit' : 'string',
    width: type === 'Grid' ? 900 : 240, span: type === 'Grid' ? 12 : type === 'Button' ? 3 : 6,
    required: false, readOnly: false, visible: true, saveValue: type === 'Textbox' || type === 'Combobox' || type === 'Checkbox',
    defaultValue: '', placeholder: '', sourceType: 'Query', ddlSql: '', procedureSchema: 'dbo', procedureName: '',
    valueField: 'KeyValue', textField: 'KeyText', action: 'Validate', placement: 'Toolbar', targetTabCode: '', executionType: 'Client', executionScope: 'PerChange', saveParameters: [], parameters: [], entity: emptyEntity(),
    columns: type === 'Grid' ? [
      { field: 'Id', label: 'ID', dataType: 'numeric', width: 100, required: false, readOnly: true },
      { field: 'Name', label: 'Name', dataType: 'string', width: 240, required: false, readOnly: false },
    ] : [],
  };
}
async function call<T>(method: string, path = '', body?: unknown): Promise<T> {
  const result = await apiService.backendCall<T>(method, '/api/GenericPages' + path, body);
  if (!result.ok) throw new Error((result.data as any)?.message || (result.status === 403 ? 'Page Builder requires administrator access.' : result.status === 404 ? 'The running backend does not have the Page Builder API. Please update the backend.' : `Unable to contact Page Builder${result.status ? ` (HTTP ${result.status})` : ''}. Please try again.`));
  return result.data as T;
}
export const pageBuilderApi = {
  list: () => call<PageSummary[]>('GET'),
  delete: (code: string, revision: string) => call<{ message: string }>('DELETE', '/' + encodeURIComponent(code) + '?revision=' + encodeURIComponent(revision)),
  menus: () => call<MenuLocation[]>('GET', '/menu-locations'),
  tableLayout: (schema: string, table: string, column: string) => call<BusinessLayout>('GET', '/table-layout?' + new URLSearchParams({ schema, table, column })),
  get: (code: string) => call<PageDefinition>('GET', '/' + encodeURIComponent(code)),
  save: (page: PageDefinition) => call<PageDefinition>('PUT', '/' + encodeURIComponent(page.screenCode), page),
};
