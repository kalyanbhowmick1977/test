"""Export SQLite schema and non-sensitive sample records to a real .xlsx workbook."""
import argparse
from pathlib import Path
import sqlite3
from xml.sax.saxutils import escape
from zipfile import ZipFile, ZIP_DEFLATED

ROOT = Path(__file__).resolve().parents[1]


def cell(column, row, value):
    letters = ''
    while column:
        column, rem = divmod(column - 1, 26)
        letters = chr(65 + rem) + letters
    value = '' if value is None else str(value)
    value = ''.join(c for c in value if c in '\n\r\t' or ord(c) >= 32)[:32767]
    return f'<c r="{letters}{row}" t="inlineStr"><is><t xml:space="preserve">{escape(value)}</t></is></c>'


def worksheet(rows):
    body = ''.join(f'<row r="{i}">' + ''.join(cell(j, i, v) for j, v in enumerate(row, 1)) + '</row>' for i, row in enumerate(rows, 1))
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols><col min="1" max="50" width="26" customWidth="1"/></cols><sheetData>' + body + '</sheetData></worksheet>'


def export(database, output):
    if not database.is_file():
        raise SystemExit(f'Database not found: {database}. Start the backend once first.')
    cn = sqlite3.connect(database.resolve().as_uri() + '?mode=ro', uri=True)
    tables = [r[0] for r in cn.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")]
    sheets = [('Read me', [
        ['PageBuilder SQLite reference', 'Description'],
        ['Source', 'Standalone PageBuilder SQLite schema; synthetic samples only'],
        ['Setup', 'Run database/schema.sql and database/seed.sql, then start backend to create the login and project demo metadata'],
        ['Login', 'Initial username admin; choose password through PB_ADMIN_PASSWORD on first run'],
        ['Privacy', 'Users, password hashes, salts, active sessions and saved-page JSON are excluded from data sheets'],
        ['Scope', 'Designer configuration and preview only; SQL Server procedures and business runtime are not executed'],
        ['Relationships', 'SavedPage.ScreenCode -> UI_Screen.ScreenCode -> UI_Tab.ScreenCode / UI_Control.ScreenCode'],
        ['Relationships', 'UI_Tab.EntityCode -> UI_Entity_CRUD / UI_Entity / UI_Entity_PK / UI_EntityColumn / UI_Entity_ParentFilter'],
        ['Relationships', 'UI_Control.ControlId -> ControlsMaster.CtrlID / UI_ControlValidation.ControlId'],
        ['Relationships', 'Users.UserId -> Sessions.UserId; SavedPage.MenuId -> MenuLocations.MenuId (0 means no menu)'],
    ])]
    columns = [['Table', 'Column', 'SQLite type', 'Required', 'Default', 'Primary key ordinal']]
    catalog = [['Table', 'Role', 'Example row count']]
    excluded = {'Users', 'Sessions', 'PageBuilder_SavedPage', 'SchemaMigrations'}
    used_names = {'Read me', 'Columns', 'Tables'}
    for table in tables:
        quoted = '"' + table.replace('"', '""') + '"'
        for _, name, kind, required, default, primary in cn.execute(f'PRAGMA table_info({quoted})'):
            columns.append([table, name, kind, bool(required or primary), default, primary])
        if table in excluded:
            catalog.append([table, 'Runtime/auth storage (data excluded)', 'Not exported'])
            continue
        cursor = cn.execute(f'SELECT * FROM {quoted} LIMIT 10')
        rows = cursor.fetchall()
        name = table.removeprefix('PageBuilder_')[:31]
        while name in used_names:
            name = name[:28] + str(len(used_names))
        used_names.add(name)
        sheets.append((name, [[c[0] for c in cursor.description]] + rows))
        catalog.append([table, 'Designer metadata' if table.startswith('PageBuilder_') else 'Synthetic support data', len(rows)])
    cn.close()
    sheets[1:1] = [('Tables', catalog), ('Columns', columns)]
    output.parent.mkdir(parents=True, exist_ok=True)
    with ZipFile(output, 'w', ZIP_DEFLATED) as z:
        z.writestr('[Content_Types].xml', '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' + ''.join(f'<Override PartName="/xl/worksheets/sheet{i}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' for i in range(1, len(sheets)+1)) + '</Types>')
        z.writestr('_rels/.rels', '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>')
        z.writestr('xl/workbook.xml', '<?xml version="1.0"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>' + ''.join(f'<sheet name="{escape(name)}" sheetId="{i}" r:id="rId{i}"/>' for i, (name, _) in enumerate(sheets, 1)) + '</sheets></workbook>')
        z.writestr('xl/_rels/workbook.xml.rels', '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' + ''.join(f'<Relationship Id="rId{i}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet{i}.xml"/>' for i in range(1, len(sheets)+1)) + '</Relationships>')
        for i, (_, rows) in enumerate(sheets, 1):
            z.writestr(f'xl/worksheets/sheet{i}.xml', worksheet(rows))
    print(f'Exported {len(sheets)} worksheets to {output}')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--database', type=Path, default=ROOT / 'backend/data/pagebuilder.db')
    parser.add_argument('--output', type=Path, default=ROOT / 'docs/PageBuilder_Tables.xlsx')
    args = parser.parse_args()
    export(args.database, args.output)
