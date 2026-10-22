"""Exercise the real backend against an isolated SQLite database (standard library only)."""
import argparse
import copy
import http.cookiejar
import json
import os
from pathlib import Path
import secrets
import socket
import sqlite3
import subprocess
import tempfile
import time
import urllib.error
import urllib.request

ROOT = Path(__file__).resolve().parents[1]


def run(export_reference=False):
    subprocess.run(['dotnet', 'build', str(ROOT / 'backend'), '--nologo'], check=True)
    password = secrets.token_urlsafe(24)
    with tempfile.TemporaryDirectory(prefix='pagebuilder-test-') as temp:
        database = Path(temp) / 'test.db'
        with socket.socket() as probe:
            probe.bind(('127.0.0.1', 0))
            port = probe.getsockname()[1]
        base = f'http://127.0.0.1:{port}'
        env = {**os.environ, 'PB_DATABASE_PATH': str(database), 'PB_ADMIN_PASSWORD': password, 'PB_ADMIN_USERNAME': 'admin'}
        jar = http.cookiejar.CookieJar()
        client = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))

        def request(method, path, body=None, headers=None):
            data = None if body is None else json.dumps(body).encode()
            req = urllib.request.Request(base + path, data=data, method=method, headers={**({'Content-Type': 'application/json'} if data else {}), **(headers or {})})
            try:
                response = client.open(req, timeout=15)
            except urllib.error.HTTPError as error:
                response = error
            raw = response.read()
            return response.code, json.loads(raw) if raw else None

        def start():
            process = subprocess.Popen(['dotnet', str(ROOT / 'backend/bin/Debug/net8.0/PageBuilder.Api.dll'), '--contentRoot', str(ROOT / 'backend'), '--urls', base], cwd=ROOT / 'backend', env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            for _ in range(100):
                if process.poll() is not None:
                    raise AssertionError('Backend exited during startup. Run it directly to inspect startup errors.')
                try:
                    if request('GET', '/health')[0] == 200:
                        return process
                except OSError:
                    pass
                time.sleep(0.1)
            process.terminate()
            process.wait(timeout=10)
            raise AssertionError('Backend did not become ready.')

        process = start()
        try:
            assert request('GET', '/api/GenericPages')[0] == 401
            assert request('POST', '/Auth/Login', {'username': 'admin', 'password': 'incorrect'})[0] == 401
            assert request('POST', '/Auth/Login', {'username': 'admin', 'password': password})[0] == 200
            assert request('GET', '/Auth/Me')[1]['username'] == 'admin'
            assert request('GET', '/api/GenericPages')[1][0]['screenCode'] == 'CONTACT_FORM'
            code, original = request('GET', '/api/GenericPages/CONTACT_FORM')
            assert code == 200 and len(original['tableDefinitions']) == 11
            if export_reference:
                subprocess.run(['python', str(ROOT / 'scripts/export_reference.py'), '--database', str(database)], check=True)
            assert request('GET', '/api/GenericPages/table-layout?schema=main&table=DemoContacts')[1]['columns'][0]['isPrimaryKey']
            assert request('GET', '/api/GenericPages/table-layout?schema=main&table=Users')[0] == 400
            assert request('POST', '/Auth/Logout', headers={'Origin': 'https://unrelated.invalid'})[0] == 403
            page = copy.deepcopy(original)
            page.update(screenCode='TEST_DESIGN', screenName='Integration design', revision=None, tableDefinitions=[])
            status, saved = request('PUT', '/api/GenericPages/TEST_DESIGN', page)
            assert status == 200, saved
            assert saved['revision'] and not saved['metadataLayout']
            stale = copy.deepcopy(saved)
            screen = next(t for t in saved['tableDefinitions'] if t['name'] == 'PageBuilder_UI_Screen')
            screen['rows'][0]['IsActive'] = 0
            saved['screenName'] = 'Edited design'
            status, edited = request('PUT', '/api/GenericPages/TEST_DESIGN', saved)
            assert status == 200, edited
            assert next(t for t in edited['tableDefinitions'] if t['name'] == 'PageBuilder_UI_Screen')['rows'][0]['IsActive'] == 0
            assert request('PUT', '/api/GenericPages/TEST_DESIGN', stale)[0] == 409
            invalid = copy.deepcopy(edited)
            invalid['controls'].append(copy.deepcopy(invalid['controls'][0]))
            assert request('PUT', '/api/GenericPages/TEST_DESIGN', invalid)[0] == 400
            assert request('GET', '/api/GenericPages/TEST_DESIGN')[1]['revision'] == edited['revision']
            # A grid must create its own tab, entity, columns and key metadata.
            grid_page = copy.deepcopy(original)
            grid_page.update(screenCode='TEST_GRID', screenName='Grid design', revision=None, tableDefinitions=[])
            grid = copy.deepcopy(original['controls'][0])
            grid.update(code='Grid_1', label='Contacts', type='Grid', field='', entity=copy.deepcopy(original['entity']), columns=[
                {'field': 'Id', 'label': 'ID', 'dataType': 'numeric', 'width': 100, 'required': False, 'readOnly': True},
                {'field': 'Name', 'label': 'Name', 'dataType': 'string', 'width': 240, 'required': True, 'readOnly': False}
            ])
            grid_page['controls'].append(grid)
            status, grid_saved = request('PUT', '/api/GenericPages/TEST_GRID', grid_page)
            assert status == 200, grid_saved
            tabs = next(t for t in grid_saved['tableDefinitions'] if t['name'] == 'PageBuilder_UI_Tab')['rows']
            assert len(tabs) == 2 and any(t['TabMode'] == 'Grid' for t in tabs)
            assert request('GET', '/api/GenericPages/contact_form')[1]['tableDefinitions'][0]['rows']
            assert request('DELETE', '/api/GenericPages/test_grid?revision=' + grid_saved['revision'])[0] == 200
            # Restart using the same database: both page data and session state must persist.
            process.terminate(); process.wait(timeout=10)
            process = start()
            assert request('GET', '/api/GenericPages/TEST_DESIGN')[1]['screenName'] == 'Edited design'
            assert request('DELETE', '/api/GenericPages/TEST_DESIGN?revision=stale')[0] == 409
            assert request('DELETE', '/api/GenericPages/TEST_DESIGN?revision=' + edited['revision'])[0] == 200
            assert request('GET', '/api/GenericPages/TEST_DESIGN')[0] == 404
            assert request('GET', '/api/GenericPages/CONTACT_FORM')[0] == 200
            with sqlite3.connect(database) as cn:
                assert cn.execute("SELECT COUNT(*) FROM PageBuilder_UI_Control WHERE ScreenCode='TEST_DESIGN'").fetchone()[0] == 0
                assert cn.execute('SELECT COUNT(*) FROM DemoContacts').fetchone()[0] == 3
                assert cn.execute('PRAGMA integrity_check').fetchone()[0] == 'ok'
            cn.close()
            cookie = '; '.join(f'{c.name}={c.value}' for c in jar)
            assert request('POST', '/Auth/Logout')[0] == 204
            assert request('GET', '/Auth/Me', headers={'Cookie': cookie})[0] == 401
            print('PASS: login, protected APIs, metadata edits, revision conflicts, input validation, restart persistence, deletion cleanup, SQLite integrity, origin checks, logout revocation.')
        finally:
            if process.poll() is None:
                process.terminate(); process.wait(timeout=10)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--export-reference', action='store_true')
    run(parser.parse_args().export_reference)
