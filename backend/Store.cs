using System.Globalization;
using System.Security.Cryptography;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;
using Microsoft.Data.Sqlite;

sealed class Store
{
    private readonly string connectionString;
    private readonly string databaseFolder;
    private readonly IConfiguration configuration;
    private readonly IWebHostEnvironment environment;
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);
    private static readonly Dictionary<string, string[]> Managed = new()
    {
        ["PageBuilder_UI_Screen"] = ["ScreenCode", "ScreenName", "Description"],
        ["PageBuilder_UI_Tab"] = ["TabId", "ScreenCode", "TabCode", "TabName", "EntityCode", "TabMode", "ParentTabCode", "ParentEntityCode", "SequenceNo", "IsTop"],
        ["PageBuilder_UI_Control"] = ["ControlId", "ScreenCode", "TabCode", "EntityCode", "ControlCode", "ColumnName", "Label", "ControlType", "DataType", "IsRequired", "IsReadOnly", "SequenceNo", "DefaultValue", "Placeholder", "Width", "IsVisible", "IsSave", "DDLSQL"],
        ["PageBuilder_ControlsMaster"] = ["CtrlID", "CtrlName", "Name", "ColumnName", "CtrlType", "Width", "FormID", "DisplayOrder", "DDLSql", "DataTxtField", "DataValField", "IsMandatory", "DefaultValSQL", "IsVisible", "IsEnabled", "IsEditable", "Position", "SaveValue", "TabId"],
        ["PageBuilder_UI_Entity_CRUD"] = ["EntityCode", "EntityName", "TableSchema", "TableName", "ParentEntityCode", "ParentKeyColumn", "AllowInsert", "AllowUpdate", "AllowDelete"],
        ["PageBuilder_UI_Entity_PK"] = ["EntityCode", "KeyOrdinal", "ColumnName"],
        ["PageBuilder_UI_Entity_ParentFilter"] = ["EntityCode", "FilterSequence", "FilterName", "SourceEntityCode", "SourceKeyColumn", "TargetColumn"],
        ["PageBuilder_UI_Entity"] = ["EntityCode", "EntityName", "SchemaName", "TableName", "PrimaryKeyField", "AllowInsert", "AllowUpdate", "AllowDelete"],
        ["PageBuilder_UI_EntityColumn"] = ["EntityColumnId", "EntityCode", "ColumnName", "PropertyName", "IsRequired", "DisplayOrder"],
        ["PageBuilder_UI_Control_DDLParameter"] = ["EntityCode", "ControlCode", "ParameterName", "ParentControlCode", "ParameterSequence", "IsRequired"],
        ["PageBuilder_UI_ControlValidation"] = ["ValidationId", "ControlId"]
    };

    public Store(IConfiguration configuration, IWebHostEnvironment environment)
    {
        this.configuration = configuration;
        this.environment = environment;
        var path = Path.GetFullPath(configuration["PB_DATABASE_PATH"] ?? Path.Combine(environment.ContentRootPath, "data", "pagebuilder.db"));
        Directory.CreateDirectory(Path.GetDirectoryName(path)!);
        connectionString = new SqliteConnectionStringBuilder { DataSource = path, ForeignKeys = true }.ToString();
        databaseFolder = Directory.Exists(Path.Combine(environment.ContentRootPath, "database")) ? Path.Combine(environment.ContentRootPath, "database") : Path.Combine(environment.ContentRootPath, "..", "database");
    }
    private SqliteConnection Open() { var cn = new SqliteConnection(connectionString); cn.Open(); return cn; }
    private static object? Plain(JsonNode? node) => node is null ? null : JsonSerializer.Deserialize<JsonElement>(node.ToJsonString()) is var value ? value.ValueKind switch { JsonValueKind.String => value.GetString(), JsonValueKind.Number => value.TryGetInt64(out var i) ? i : value.GetDouble(), JsonValueKind.True => 1L, JsonValueKind.False => 0L, _ => node.ToJsonString() } : null;
    private static string S(JsonNode? node, string fallback = "") => node is null ? fallback : Convert.ToString(Plain(node), CultureInfo.InvariantCulture) ?? fallback;
    private static int I(JsonNode? node, int fallback = 0) => int.TryParse(S(node), out var value) ? value : fallback;
    private static bool B(JsonNode? node, bool fallback = false) => node is null ? fallback : S(node).ToLowerInvariant() is "true" or "1";
    private static JsonArray Array(JsonObject obj, string name) => obj[name] as JsonArray ?? new();
    private static string Identifier(string value, int limit = 100)
    {
        if (value.Length > limit || !Regex.IsMatch(value, "^[A-Za-z_][A-Za-z0-9_]*$")) throw new ArgumentException("Invalid identifier: " + value);
        return '"' + value + '"';
    }
    private static SqliteCommand Command(SqliteConnection cn, SqliteTransaction? tx, string sql, params (string Name, object? Value)[] args)
    {
        var cmd = cn.CreateCommand(); cmd.Transaction = tx; cmd.CommandText = sql;
        foreach (var (name, value) in args) cmd.Parameters.AddWithValue(name, value ?? DBNull.Value);
        return cmd;
    }
    private static List<Dictionary<string, object?>> Query(SqliteConnection cn, SqliteTransaction? tx, string sql, params (string, object?)[] args)
    {
        using var cmd = Command(cn, tx, sql, args); using var reader = cmd.ExecuteReader();
        var rows = new List<Dictionary<string, object?>>();
        while (reader.Read()) { var row = new Dictionary<string, object?>(); for (var i = 0; i < reader.FieldCount; i++) row[reader.GetName(i)] = reader.IsDBNull(i) ? null : reader.GetValue(i); rows.Add(row); }
        return rows;
    }
    private static void Exec(SqliteConnection cn, SqliteTransaction? tx, string sql, params (string, object?)[] args) { using var cmd = Command(cn, tx, sql, args); cmd.ExecuteNonQuery(); }
    private static long Insert(SqliteConnection cn, SqliteTransaction tx, string table, Dictionary<string, object?> row)
    {
        using var cmd = Command(cn, tx, $"INSERT INTO {Identifier(table)} ({string.Join(',', row.Keys.Select(k => Identifier(k)))}) VALUES ({string.Join(',', row.Keys.Select((_, i) => "@p" + i))}); SELECT last_insert_rowid();", row.Values.Select((v, i) => ("@p" + i, v)).ToArray());
        return Convert.ToInt64(cmd.ExecuteScalar());
    }

    public void Initialize()
    {
        using (var cn = Open())
        {
            Exec(cn, null, File.ReadAllText(Path.Combine(databaseFolder, "schema.sql")));
            using var check = Command(cn, null, "SELECT COUNT(*) FROM Users");
            if (Convert.ToInt64(check.ExecuteScalar()) == 0)
            {
                var password = configuration["PB_ADMIN_PASSWORD"];
                if (string.IsNullOrEmpty(password) || password.Length < 12) throw new InvalidOperationException("First run: set PB_ADMIN_PASSWORD to a password of at least 12 characters. See README.md.");
                var salt = RandomNumberGenerator.GetBytes(32);
                var hash = Rfc2898DeriveBytes.Pbkdf2(password, salt, 210_000, HashAlgorithmName.SHA256, 32);
                Exec(cn, null, "INSERT INTO Users(Username,PasswordHash,PasswordSalt,CreatedAt) VALUES(@u,@h,@s,@d)", ("@u", configuration["PB_ADMIN_USERNAME"] ?? "admin"), ("@h", Convert.ToBase64String(hash)), ("@s", Convert.ToBase64String(salt)), ("@d", DateTimeOffset.UtcNow.ToString("O")));
            }
            using var tx = cn.BeginTransaction();
            Exec(cn, tx, File.ReadAllText(Path.Combine(databaseFolder, "seed.sql")));
            tx.Commit();
        }
        // Seed once: deleting a sample page must not recreate it on the next startup.
        using var db = Open();
        Exec(db, null, "CREATE TABLE IF NOT EXISTS SchemaMigrations(Name TEXT PRIMARY KEY)");
        using var migration = Command(db, null, "SELECT COUNT(*) FROM SchemaMigrations WHERE Name='demo-page-v1'");
        if (Convert.ToInt64(migration.ExecuteScalar()) == 0)
        {
            if (Get("CONTACT_FORM") is null) Save("CONTACT_FORM", JsonNode.Parse(File.ReadAllText(Path.Combine(databaseFolder, "demo-page.json")))!.AsObject());
            Exec(db, null, "INSERT INTO SchemaMigrations(Name) VALUES('demo-page-v1')");
        }
    }
    public (long Id, string Name)? VerifyUser(string username, string password)
    {
        using var cn = Open();
        var user = Query(cn, null, "SELECT UserId,Username,PasswordHash,PasswordSalt FROM Users WHERE Username=@u AND IsActive=1", ("@u", username)).FirstOrDefault();
        // Do the same expensive derivation for unknown users.
        var salt = user is null ? new byte[32] : Convert.FromBase64String((string)user["PasswordSalt"]!);
        var hash = Rfc2898DeriveBytes.Pbkdf2(password, salt, 210_000, HashAlgorithmName.SHA256, 32);
        if (user is null || !CryptographicOperations.FixedTimeEquals(hash, Convert.FromBase64String((string)user["PasswordHash"]!))) return null;
        return (Convert.ToInt64(user["UserId"]), (string)user["Username"]!);
    }
    public string CreateSession(long user)
    {
        var id = Convert.ToHexString(RandomNumberGenerator.GetBytes(32)); using var cn = Open();
        Exec(cn, null, "DELETE FROM Sessions WHERE ExpiresAt<@now", ("@now", DateTimeOffset.UtcNow.ToString("O")));
        Exec(cn, null, "INSERT INTO Sessions(SessionId,UserId,ExpiresAt) VALUES(@id,@user,@until)", ("@id", id), ("@user", user), ("@until", DateTimeOffset.UtcNow.AddHours(8).ToString("O")));
        return id;
    }
    public bool SessionActive(string id)
    {
        using var cn = Open(); using var cmd = Command(cn, null, "SELECT COUNT(*) FROM Sessions s JOIN Users u ON u.UserId=s.UserId WHERE s.SessionId=@id AND s.ExpiresAt>@now AND u.IsActive=1", ("@id", id), ("@now", DateTimeOffset.UtcNow.ToString("O")));
        return Convert.ToInt64(cmd.ExecuteScalar()) == 1;
    }
    public void EndSession(string id) { using var cn = Open(); Exec(cn, null, "DELETE FROM Sessions WHERE SessionId=@id", ("@id", id)); }
    public object List()
    {
        using var cn = Open(); return Query(cn, null, "SELECT ScreenCode,ScreenName,MenuId,json_array_length(DefinitionJson,'$.controls') AS ControlCount FROM PageBuilder_SavedPage ORDER BY ScreenName").Select(r => new { screenCode = r["ScreenCode"], screenName = r["ScreenName"], menuId = r["MenuId"], controlCount = r["ControlCount"] });
    }
    public object Menus() { using var cn = Open(); return Query(cn, null, "SELECT MenuId,Caption FROM MenuLocations ORDER BY Caption").Select(r => new { menuId = r["MenuId"], caption = r["Caption"] }); }
    public JsonObject? Get(string code)
    {
        Identifier(code, 32); using var cn = Open();
        return Get(cn, null, code);
    }
    private static JsonObject? Get(SqliteConnection cn, SqliteTransaction? tx, string code)
    {
        var row = Query(cn, tx, "SELECT DefinitionJson FROM PageBuilder_SavedPage WHERE ScreenCode=@c", ("@c", code)).FirstOrDefault();
        if (row is null) return null;
        var page = JsonNode.Parse((string)row["DefinitionJson"]!)!.AsObject();
        page["tableDefinitions"] = TableDefinitions(cn, tx, S(page["screenCode"]));
        return page;
    }
    private static string Scope(string table) => table switch
    {
        "PageBuilder_UI_Screen" or "PageBuilder_UI_Tab" or "PageBuilder_UI_Control" => "ScreenCode=@c",
        "PageBuilder_ControlsMaster" => "CtrlID IN (SELECT ControlId FROM PageBuilder_UI_Control WHERE ScreenCode=@c)",
        "PageBuilder_UI_ControlValidation" => "ControlId IN (SELECT ControlId FROM PageBuilder_UI_Control WHERE ScreenCode=@c)",
        _ => "EntityCode IN (SELECT EntityCode FROM PageBuilder_UI_Tab WHERE ScreenCode=@c)"
    };
    private static List<Dictionary<string, object?>> Columns(SqliteConnection cn, SqliteTransaction? tx, string table) => Query(cn, tx, "PRAGMA table_info(" + Identifier(table) + ")");
    private static bool Flag(string name) => name.StartsWith("Is") || name.StartsWith("Allow") || name is "SaveValue" or "AutoPostBack" or "SoftDelete";
    private static JsonArray TableDefinitions(SqliteConnection cn, SqliteTransaction? tx, string code)
    {
        var definitions = new JsonArray();
        foreach (var (table, managed) in Managed)
        {
            var columns = Columns(cn, tx, table).Select(col =>
            {
                var name = (string)col["name"]!; var type = ((string)col["type"]!).ToUpperInvariant(); var numeric = type == "INTEGER";
                return new { name, dataType = numeric ? Flag(name) ? "bit" : "int" : "nvarchar", nullable = Convert.ToInt64(col["notnull"]) == 0 && Convert.ToInt64(col["pk"]) == 0, maxLength = -1, editor = managed.Contains(name) ? "managed" : name == "Allignment" ? "select" : Flag(name) && numeric ? "checkbox" : numeric ? "number" : name.Contains("SQL", StringComparison.OrdinalIgnoreCase) || name == "Script" ? "textarea" : "text", choices = name == "Allignment" ? new[] { "0", "1", "2" } : System.Array.Empty<string>() };
            });
            definitions.Add(JsonSerializer.SerializeToNode(new { name = table, columns, rows = Query(cn, tx, "SELECT * FROM " + Identifier(table) + " WHERE " + Scope(table), ("@c", code)) }, JsonOptions));
        }
        return definitions;
    }
    private static void Validate(string code, JsonObject page)
    {
        Identifier(code, 32);
        if (S(page["screenCode"]) != code) throw new ArgumentException("Page code must match the URL.");
        if (string.IsNullOrWhiteSpace(S(page["screenName"])) || S(page["screenName"]).Length > 150) throw new ArgumentException("Enter a page name of at most 150 characters.");
        if (page["controls"] is not JsonArray controls || controls.Count > 100 || page["entity"] is not JsonObject) throw new ArgumentException("Invalid page definition.");
        var codes = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (var node in controls)
        {
            if (node is not JsonObject control) throw new ArgumentException("Invalid control.");
            Identifier(S(control["code"]), 50);
            if (!codes.Add(S(control["code"]))) throw new ArgumentException("Control codes must be unique.");
            if (!new[] { "Textbox", "Grid", "Combobox", "Checkbox", "Label", "Button" }.Contains(S(control["type"]))) throw new ArgumentException("Invalid control type.");
            if (string.IsNullOrWhiteSpace(S(control["label"])) || S(control["label"]).Length > 100) throw new ArgumentException("Enter control captions of at most 100 characters.");
            if (I(control["span"], 6) is < 1 or > 12) throw new ArgumentException("Control span must be between 1 and 12.");
            if (Array(control, "columns").Count > 100) throw new ArgumentException("A grid supports at most 100 columns.");
            var fields = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            foreach (var col in Array(control, "columns").OfType<JsonObject>()) { Identifier(S(col["field"])); if (!fields.Add(S(col["field"]))) throw new ArgumentException("Grid fields must be unique."); }
        }
    }
    public JsonObject Save(string code, JsonObject input)
    {
        Validate(code, input);
        var page = input.DeepClone().AsObject(); using var cn = Open(); using var tx = cn.BeginTransaction();
        var prior = Get(cn, tx, code);
        if (prior is not null && S(prior["revision"]) != S(page["revision"]) || prior is null && !string.IsNullOrEmpty(S(page["revision"]))) throw new PageConflictException("This page changed. Reopen it before saving.");
        if (I(page["menuId"]) != 0 && Query(cn, tx, "SELECT MenuId FROM MenuLocations WHERE MenuId=@m", ("@m", I(page["menuId"]))).Count == 0) throw new ArgumentException("Choose a valid menu location.");
        var edits = page["tableDefinitions"]?.DeepClone() as JsonArray ?? new();
        var old = TableDefinitions(cn, tx, code);
        Cleanup(cn, tx, code);
        BuildMetadata(cn, tx, page);
        ApplySettings(cn, tx, code, old);
        ApplySettings(cn, tx, code, edits);
        page["revision"] = Guid.NewGuid().ToString("N");
        page["metadataLayout"] = false; // Designer preview: does not execute SQL Server business actions.
        page.Remove("tableDefinitions");
        Exec(cn, tx, "INSERT INTO PageBuilder_SavedPage(ScreenCode,ScreenName,Revision,MenuId,DefinitionJson,UpdatedAt) VALUES(@c,@n,@r,@m,@j,@d) ON CONFLICT(ScreenCode) DO UPDATE SET ScreenName=excluded.ScreenName,Revision=excluded.Revision,MenuId=excluded.MenuId,DefinitionJson=excluded.DefinitionJson,UpdatedAt=excluded.UpdatedAt", ("@c", code), ("@n", S(page["screenName"])), ("@r", S(page["revision"])), ("@m", I(page["menuId"])), ("@j", page.ToJsonString()), ("@d", DateTimeOffset.UtcNow.ToString("O")));
        var saved = Get(cn, tx, code)!; tx.Commit(); return saved;
    }
    public void Delete(string code, string revision)
    {
        Identifier(code, 32); using var cn = Open(); using var tx = cn.BeginTransaction();
        var prior = Get(cn, tx, code) ?? throw new ArgumentException("Page not found.");
        if (string.IsNullOrEmpty(revision) || S(prior["revision"]) != revision) throw new PageConflictException("This page changed. Reopen it before deleting.");
        code = S(prior["screenCode"]);
        Cleanup(cn, tx, code);
        Exec(cn, tx, "DELETE FROM PageBuilder_SavedPage WHERE ScreenCode=@c", ("@c", code)); tx.Commit();
    }
    private static void Cleanup(SqliteConnection cn, SqliteTransaction tx, string code)
    {
        foreach (var table in new[] { "PageBuilder_UI_ControlValidation", "PageBuilder_ControlsMaster", "PageBuilder_UI_Control_DDLParameter", "PageBuilder_UI_Entity_PK", "PageBuilder_UI_Entity_ParentFilter", "PageBuilder_UI_EntityColumn", "PageBuilder_UI_Entity", "PageBuilder_UI_Entity_CRUD", "PageBuilder_UI_Control", "PageBuilder_UI_Tab", "PageBuilder_UI_Screen" })
            Exec(cn, tx, "DELETE FROM " + Identifier(table) + " WHERE " + Scope(table), ("@c", code));
    }
    private static void BuildMetadata(SqliteConnection cn, SqliteTransaction tx, JsonObject page)
    {
        var code = S(page["screenCode"]); var controls = Array(page, "controls").OfType<JsonObject>().ToList(); var mainEntity = code + "_MAIN";
        Insert(cn, tx, "PageBuilder_UI_Screen", new() { ["ScreenCode"] = code, ["ScreenName"] = S(page["screenName"]), ["Description"] = S(page["description"]) });
        void Entity(string entityCode, JsonObject mapping, IEnumerable<JsonObject> fields)
        {
            Insert(cn, tx, "PageBuilder_UI_Entity_CRUD", new() { ["EntityCode"] = entityCode, ["EntityName"] = S(page["screenName"]), ["TableSchema"] = S(mapping["schema"], "main"), ["TableName"] = S(mapping["table"]), ["AllowInsert"] = B(mapping["allowInsert"]), ["AllowUpdate"] = B(mapping["allowUpdate"]), ["AllowDelete"] = B(mapping["allowDelete"]) });
            var keys = Array(mapping, "keys").Select(n => S(n)).ToList();
            Insert(cn, tx, "PageBuilder_UI_Entity", new() { ["EntityCode"] = entityCode, ["EntityName"] = S(page["screenName"]), ["SchemaName"] = S(mapping["schema"], "main"), ["TableName"] = S(mapping["table"]), ["PrimaryKeyField"] = keys.FirstOrDefault() ?? "", ["AllowInsert"] = B(mapping["allowInsert"]), ["AllowUpdate"] = B(mapping["allowUpdate"]), ["AllowDelete"] = B(mapping["allowDelete"]) });
            for (var i = 0; i < keys.Count; i++) Insert(cn, tx, "PageBuilder_UI_Entity_PK", new() { ["EntityCode"] = entityCode, ["KeyOrdinal"] = i + 1, ["ColumnName"] = keys[i] });
            var order = 0;
            foreach (var field in fields.Where(f => !string.IsNullOrEmpty(S(f["field"]))).GroupBy(f => S(f["field"])).Select(g => g.First()))
                Insert(cn, tx, "PageBuilder_UI_EntityColumn", new() { ["EntityCode"] = entityCode, ["ColumnName"] = S(field["field"]), ["PropertyName"] = S(field["field"]), ["IsPrimaryKey"] = keys.Contains(S(field["field"])), ["IsRequired"] = B(field["required"]), ["DisplayOrder"] = ++order });
            order = 0;
            foreach (var filter in Array(mapping, "parentFilters").OfType<JsonObject>())
                Insert(cn, tx, "PageBuilder_UI_Entity_ParentFilter", new() { ["EntityCode"] = entityCode, ["FilterSequence"] = ++order, ["FilterName"] = "Filter" + order, ["SourceEntityCode"] = S(filter["sourceEntityCode"]), ["SourceKeyColumn"] = S(filter["source"]), ["TargetColumn"] = S(filter["target"]) });
        }
        long Tab(string tabCode, string caption, string entityCode, string mode, int order, bool top) => Insert(cn, tx, "PageBuilder_UI_Tab", new() { ["ScreenCode"] = code, ["TabCode"] = tabCode, ["TabName"] = caption, ["EntityCode"] = entityCode, ["TabMode"] = mode, ["SequenceNo"] = order, ["IsTop"] = top });
        void Control(JsonObject c, string controlCode, string tabCode, long tabId, string entityCode, int order, string type)
        {
            var row = new Dictionary<string, object?> { ["ScreenCode"] = code, ["TabCode"] = tabCode, ["EntityCode"] = entityCode, ["ControlCode"] = controlCode, ["ColumnName"] = S(c["field"]), ["Label"] = S(c["label"]), ["ControlType"] = type, ["DataType"] = S(c["dataType"], "string"), ["IsRequired"] = B(c["required"]), ["IsReadOnly"] = B(c["readOnly"]), ["SequenceNo"] = order, ["DefaultValue"] = S(c["defaultValue"]), ["Placeholder"] = S(c["placeholder"]), ["Width"] = I(c["width"], 240), ["IsVisible"] = B(c["visible"], true), ["IsSave"] = B(c["saveValue"], true), ["DefaultValueSQL"] = S(c["defaultValueSql"]), ["DDLSQL"] = S(c["ddlSql"]) };
            var id = Insert(cn, tx, "PageBuilder_UI_Control", row);
            Insert(cn, tx, "PageBuilder_ControlsMaster", new() { ["CtrlID"] = id, ["CtrlName"] = controlCode, ["Name"] = S(c["label"]), ["ColumnName"] = S(c["field"]), ["Width"] = I(c["width"], 240), ["DisplayOrder"] = order, ["DDLSql"] = S(c["ddlSql"]), ["IsMandatory"] = B(c["required"]), ["IsVisible"] = B(c["visible"], true), ["IsEnabled"] = !B(c["readOnly"]), ["SaveValue"] = B(c["saveValue"], true), ["TabId"] = tabId });
            order = 0;
            foreach (var parameter in Array(c, "parameters").OfType<JsonObject>())
                Insert(cn, tx, "PageBuilder_UI_Control_DDLParameter", new() { ["EntityCode"] = entityCode, ["ControlCode"] = controlCode, ["ParameterName"] = S(parameter["name"]), ["ParentEntityCode"] = mainEntity, ["ParentControlCode"] = S(parameter["source"]), ["ParameterSequence"] = ++order, ["IsRequired"] = B(parameter["required"], true) });
        }
        Entity(mainEntity, page["entity"]!.AsObject(), controls.Where(c => S(c["type"]) != "Grid"));
        var mainTab = Tab("MAIN", S(page["screenName"]), mainEntity, "Single", 0, true);
        for (var i = 0; i < controls.Count; i++)
        {
            var c = controls[i]; var type = S(c["type"]);
            if (type != "Grid") { Control(c, S(c["code"]), "MAIN", mainTab, mainEntity, i + 1, type); continue; }
            var tabCode = "GRID_" + S(c["code"]); var entityCode = code + "_" + S(c["code"]);
            if (entityCode.Length > 50) entityCode = code[..Math.Min(code.Length, 16)] + "_" + Convert.ToHexString(SHA256.HashData(System.Text.Encoding.UTF8.GetBytes(entityCode)))[..20];
            c["metadataTabCode"] = tabCode;
            var columns = Array(c, "columns").OfType<JsonObject>().ToList();
            Entity(entityCode, c["entity"] as JsonObject ?? new(), columns);
            var tab = Tab(tabCode, S(c["label"]), entityCode, "Grid", i + 1, B(c["gridIsTop"]));
            for (var j = 0; j < columns.Count; j++) Control(columns[j], S(c["code"]) + "_" + j, tabCode, tab, entityCode, j + 1, S(columns[j]["editorType"], "Textbox"));
        }
    }
    private static string RowIdentity(string table, JsonObject row) => table switch
    {
        "PageBuilder_UI_Screen" => S(row["ScreenCode"]),
        "PageBuilder_UI_Tab" => S(row["TabCode"]),
        "PageBuilder_UI_Control" => S(row["ControlCode"]),
        "PageBuilder_ControlsMaster" => S(row["CtrlName"]),
        "PageBuilder_UI_EntityColumn" => S(row["EntityCode"]) + ":" + S(row["ColumnName"]),
        "PageBuilder_UI_Entity_PK" => S(row["EntityCode"]) + ":" + S(row["KeyOrdinal"]),
        "PageBuilder_UI_Entity_ParentFilter" => S(row["EntityCode"]) + ":" + S(row["FilterSequence"]),
        "PageBuilder_UI_Control_DDLParameter" => S(row["EntityCode"]) + ":" + S(row["ControlCode"]) + ":" + S(row["ParameterName"]),
        "PageBuilder_UI_ControlValidation" => S(row["ValidationId"]),
        _ => S(row["EntityCode"])
    };
    private static void ApplySettings(SqliteConnection cn, SqliteTransaction tx, string code, JsonArray definitions)
    {
        foreach (var definition in definitions.OfType<JsonObject>())
        {
            var table = S(definition["name"]);
            if (!Managed.TryGetValue(table, out var managed)) continue;
            var schema = Columns(cn, tx, table);
            var primary = schema.Where(c => Convert.ToInt64(c["pk"]) > 0).Select(c => (string)c["name"]!).ToList();
            var current = Query(cn, tx, "SELECT * FROM " + Identifier(table) + " WHERE " + Scope(table), ("@c", code)).Select(r => JsonSerializer.SerializeToNode(r)!.AsObject()).ToList();
            foreach (var row in Array(definition, "rows").OfType<JsonObject>())
            {
                var match = current.FirstOrDefault(r => RowIdentity(table, r) == RowIdentity(table, row));
                if (match is null) continue;
                var editable = schema.Select(c => (string)c["name"]!).Where(n => !managed.Contains(n) && !primary.Contains(n) && row.ContainsKey(n)).ToList();
                if (editable.Count == 0) continue;
                using var cmd = Command(cn, tx, "UPDATE " + Identifier(table) + " SET " + string.Join(',', editable.Select((n, i) => Identifier(n) + "=@v" + i)) + " WHERE " + string.Join(" AND ", primary.Select((n, i) => Identifier(n) + "=@k" + i)), editable.Select((n, i) => ("@v" + i, Plain(row[n]))).Concat(primary.Select((n, i) => ("@k" + i, Plain(match[n])))).ToArray());
                cmd.ExecuteNonQuery();
            }
        }
    }
    public object BusinessLayout(string schema, string table, string column)
    {
        if (schema is not ("main" or "dbo")) throw new ArgumentException("SQLite uses the main schema.");
        if (table.Length > 0 && table != "DemoContacts") throw new ArgumentException("Only DemoContacts is included in this standalone sample.");
        using var cn = Open();
        var columns = table.Length == 0 ? new List<Dictionary<string, object?>>() : Columns(cn, null, table);
        if (column.Length > 0 && !columns.Any(c => (string)c["name"]! == column)) throw new ArgumentException("Unknown column.");
        var values = column.Length == 0 ? new List<string>() : Query(cn, null, "SELECT DISTINCT " + Identifier(column) + " AS Value FROM DemoContacts LIMIT 100").Select(r => Convert.ToString(r["Value"], CultureInfo.InvariantCulture) ?? "").ToList();
        return new { schemas = new[] { "main" }, tables = new[] { "DemoContacts" }, columns = columns.Select(c => new { name = c["name"], dataType = (string)c["type"]! == "INTEGER" ? "numeric" : "string", nullable = Convert.ToInt64(c["notnull"]) == 0, isPrimaryKey = Convert.ToInt64(c["pk"]) > 0 }), values, valuesLimited = values.Count == 100 };
    }
}
