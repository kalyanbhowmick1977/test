# Standalone PageBuilder with login and SQLite

This repository contains the existing React PageBuilder designer and login view, extracted from the larger application, with a small ASP.NET Core backend rewritten for SQLite. It does not require SQL Server.

Included: login/logout, six control types, layout editing, grid column configuration, undo/redo, copy/reorder controls, save/reopen/delete page designs, metadata table settings, business-table inspection, optimistic revision checks, and design preview. The database includes synthetic sample metadata and three example contacts. No production users, passwords, connection strings, fund records, or authentication keys are copied.

This is the **PageBuilder designer only**. Preview values are temporary. Configured SQL queries, stored procedures, and business save buttons are stored as design configuration and are not executed. SQLite has no SQL Server stored procedures. Series Management New, Currency Source Maintenance, fund selection, Microsoft sign-in, production permissions, and the business runtime are not part of this package.

## Requirements

- .NET 8 SDK (or a newer SDK capable of building .NET 8).
- Node.js 22.12 or later and npm.
- Python 3.10 or later only for the optional Excel export and integration tests.

## Run locally

In PowerShell, from the repository root:

```powershell
cd frontend
npm ci
npm run build
cd ..

# Choose your own local password, at least 12 characters. Do not commit it.
$env:PB_ADMIN_PASSWORD = Read-Host 'Choose the local admin password'
dotnet run --project backend --urls http://127.0.0.1:5080
```

Open **http://127.0.0.1:5080**. Sign in as **admin**, using the password you chose. Open **Contact Form Demo** from **Open saved page**, or create a new page. Add controls and press **Save**. Reopen it to verify persistence; **Saved preview** shows the layout.

The backend creates `backend/data/pagebuilder.db` on first launch, applies `database/schema.sql` and `database/seed.sql`, creates a PBKDF2-hashed admin login, and imports `database/demo-page.json`. `PB_ADMIN_PASSWORD` is required only when creating the first user; changing that environment variable later does not reset an existing password. Stop with Ctrl+C. Restart using the same command to retain your saved pages.

Optional configuration:

| Environment variable | Purpose |
| --- | --- |
| `PB_ADMIN_USERNAME` | Initial administrator name; defaults to `admin` |
| `PB_ADMIN_PASSWORD` | Initial password, minimum 12 characters |
| `PB_DATABASE_PATH` | Absolute path to an alternative SQLite database |
| `PB_FRONTEND_ORIGIN` | Exact frontend origin for separate Vite development, e.g. `http://127.0.0.1:5173` |

For development with hot reload, start the backend with `PB_FRONTEND_ORIGIN=http://127.0.0.1:5173`, then run `npm run dev` in `frontend` and open that exact URL. Vite proxies `/Auth` and `/api` to port 5080. The normal build/run instructions above use one origin and require no CORS configuration.

## SQLite scripts and Excel

- `database/schema.sql`: SQLite-compatible structures for login, sessions, saved designs, all 11 PageBuilder metadata tables, menu locations, and the sample business table.
- `database/seed.sql`: synthetic menu and contact records.
- `database/demo-page.json`: designer sample; the backend projects this into related metadata tables on first launch.
- `docs/PageBuilder_Tables.xlsx`: table/column reference and synthetic example records. Users/password hashes and sessions are excluded from example data.

The backend applies scripts automatically. To inspect schema/sample contacts without starting the application, use SQLite CLI:

```sh
sqlite3 example.db ".read database/schema.sql"
sqlite3 example.db ".read database/seed.sql"
```

The CLI scripts do not create a login password or project the demo JSON into metadata; start the backend for a complete runnable database. To regenerate the Excel workbook after the backend has initialized the database:

```powershell
python scripts/export_reference.py --database backend/data/pagebuilder.db
```

The workbook uses the Python standard library and does not require Excel or third-party Python packages. It documents this standalone SQLite schema; it is not a full export of the original SQL Server database. Use the SQL files to initialize SQLite, not the workbook.

## API

Authentication uses an HttpOnly session cookie. Logout revokes the session immediately. All `/api/GenericPages` requests require login.

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/Auth/Login` | JSON `{ "username": "admin", "password": "your chosen password" }` |
| GET | `/Auth/Me` | Current user |
| POST | `/Auth/Logout` | No body; revoke session |
| GET | `/api/GenericPages` | Saved pages |
| GET | `/api/GenericPages/menu-locations` | Menu choices |
| GET | `/api/GenericPages/table-layout?schema=main&table=DemoContacts` | Sample table mapping |
| GET | `/api/GenericPages/{code}` | Full design, revision and metadata settings |
| PUT | `/api/GenericPages/{code}` | Full edited design; preserve its revision |
| DELETE | `/api/GenericPages/{code}?revision=...` | Delete design and owned metadata |

The original production `/Auth/Token` bearer-token flow is replaced by local session authentication. Existing production Bruno login requests are not interchangeable with this package. SQLite's schema name is `main`; `dbo` is accepted as an alias for table inspection only.

## Checks

```powershell
dotnet build backend
python tests/integration.py
cd frontend
npm run build
# After starting the app on port 5080:
$env:PB_TEST_USERNAME = 'admin'
$env:PB_TEST_PASSWORD = Read-Host 'Local admin password'
npx playwright install chromium
npm run test:browser
```

Integration tests create an isolated temporary SQLite database and verify authentication, persistence, metadata editing, revision conflicts, deletion, origin checks and logout. Browser tests exercise the extracted login and designer UI against a running local instance. Do not use a production database for tests.

Only source, setup scripts and synthetic reference data belong in Git. SQLite database files, secrets, dependencies and build outputs are ignored. Use HTTPS and suitable operational configuration when hosting beyond a local development environment.
