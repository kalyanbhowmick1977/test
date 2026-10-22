-- SQLite schema; converted from the PageBuilder SQL Server table definitions.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS Users (
  UserId INTEGER PRIMARY KEY AUTOINCREMENT,
  Username TEXT NOT NULL COLLATE NOCASE UNIQUE,
  PasswordHash TEXT NOT NULL,
  PasswordSalt TEXT NOT NULL,
  IsActive INTEGER NOT NULL DEFAULT 1 CHECK (IsActive IN (0,1)),
  CreatedAt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS Sessions (
  SessionId TEXT PRIMARY KEY,
  UserId INTEGER NOT NULL REFERENCES Users(UserId) ON DELETE CASCADE,
  ExpiresAt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS MenuLocations (
  MenuId INTEGER PRIMARY KEY,
  Caption TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS PageBuilder_SavedPage (
  ScreenCode TEXT PRIMARY KEY COLLATE NOCASE,
  ScreenName TEXT NOT NULL,
  Revision TEXT NOT NULL,
  MenuId INTEGER NOT NULL DEFAULT 0,
  DefinitionJson TEXT NOT NULL CHECK (json_valid(DefinitionJson)),
  UpdatedAt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS "PageBuilder_UI_Screen" (
  "ScreenCode" TEXT NOT NULL CHECK (length("ScreenCode") <= 50),
  "ScreenName" TEXT NOT NULL CHECK (length("ScreenName") <= 150),
  "Description" TEXT CHECK (length("Description") <= 500),
  "IsActive" INTEGER NOT NULL DEFAULT 1 CHECK ("IsActive" IN (0,1)),
  "IsMultipleTab" INTEGER DEFAULT 0 CHECK ("IsMultipleTab" IN (0,1)),
  "IsParentChild" INTEGER DEFAULT 0 CHECK ("IsParentChild" IN (0,1)),
  PRIMARY KEY ("ScreenCode")
);

CREATE TABLE IF NOT EXISTS "PageBuilder_UI_Tab" (
  "TabId" INTEGER PRIMARY KEY AUTOINCREMENT,
  "ScreenCode" TEXT NOT NULL CHECK (length("ScreenCode") <= 50),
  "TabCode" TEXT NOT NULL CHECK (length("TabCode") <= 50),
  "TabName" TEXT NOT NULL CHECK (length("TabName") <= 150),
  "EntityCode" TEXT NOT NULL CHECK (length("EntityCode") <= 50),
  "TabMode" TEXT NOT NULL CHECK (length("TabMode") <= 20),
  "ParentTabCode" TEXT CHECK (length("ParentTabCode") <= 50),
  "ParentEntityCode" TEXT CHECK (length("ParentEntityCode") <= 50),
  "SequenceNo" INTEGER NOT NULL,
  "IsActive" INTEGER NOT NULL DEFAULT 1 CHECK ("IsActive" IN (0,1)),
  "IsTop" INTEGER NOT NULL DEFAULT 0 CHECK ("IsTop" IN (0,1))
);

CREATE TABLE IF NOT EXISTS "PageBuilder_UI_Control" (
  "ControlId" INTEGER PRIMARY KEY AUTOINCREMENT,
  "EntityCode" TEXT NOT NULL CHECK (length("EntityCode") <= 50),
  "ScreenCode" TEXT NOT NULL CHECK (length("ScreenCode") <= 50),
  "TabCode" TEXT NOT NULL CHECK (length("TabCode") <= 50),
  "ControlCode" TEXT NOT NULL CHECK (length("ControlCode") <= 50),
  "ColumnName" TEXT NOT NULL,
  "Label" TEXT NOT NULL CHECK (length("Label") <= 100),
  "ControlType" TEXT NOT NULL CHECK (length("ControlType") <= 30),
  "DataType" TEXT NOT NULL CHECK (length("DataType") <= 30),
  "IsRequired" INTEGER NOT NULL DEFAULT 0 CHECK ("IsRequired" IN (0,1)),
  "IsReadOnly" INTEGER NOT NULL DEFAULT 0 CHECK ("IsReadOnly" IN (0,1)),
  "SequenceNo" INTEGER NOT NULL,
  "DefaultValue" TEXT CHECK (length("DefaultValue") <= 200),
  "Placeholder" TEXT CHECK (length("Placeholder") <= 200),
  "Width" INTEGER,
  "IsVisible" INTEGER NOT NULL DEFAULT 1 CHECK ("IsVisible" IN (0,1)),
  "IsActive" INTEGER NOT NULL DEFAULT 1 CHECK ("IsActive" IN (0,1)),
  "IsSave" INTEGER NOT NULL DEFAULT 1 CHECK ("IsSave" IN (0,1)),
  "DefaultValueSQL" TEXT,
  "ParentControlCode" TEXT CHECK (length("ParentControlCode") <= 100),
  "Allignment" INTEGER,
  "IntegerPlace" INTEGER,
  "DecimalPlace" INTEGER,
  "DDLSQL" TEXT
);

CREATE TABLE IF NOT EXISTS "PageBuilder_ControlsMaster" (
  "CtrlID" INTEGER NOT NULL,
  "CtrlName" TEXT CHECK (length("CtrlName") <= 50),
  "Name" TEXT CHECK (length("Name") <= 100),
  "ColumnName" TEXT CHECK (length("ColumnName") <= 50),
  "CtrlType" INTEGER,
  "Width" INTEGER,
  "FormID" INTEGER,
  "DisplayOrder" INTEGER,
  "DDLSql" TEXT,
  "DataTxtField" TEXT CHECK (length("DataTxtField") <= 100),
  "DataValField" TEXT CHECK (length("DataValField") <= 100),
  "IsMandatory" INTEGER NOT NULL DEFAULT 0 CHECK ("IsMandatory" IN (0,1)),
  "Script" TEXT,
  "DefaultValSQL" TEXT,
  "IsVisible" INTEGER NOT NULL DEFAULT 1 CHECK ("IsVisible" IN (0,1)),
  "IsEnabled" INTEGER NOT NULL DEFAULT 1 CHECK ("IsEnabled" IN (0,1)),
  "IsDuplicate" INTEGER NOT NULL DEFAULT 0 CHECK ("IsDuplicate" IN (0,1)),
  "IsEditable" INTEGER NOT NULL DEFAULT 1,
  "Position" INTEGER NOT NULL DEFAULT 1,
  "AutoPostBack" INTEGER NOT NULL DEFAULT 0,
  "SaveValue" INTEGER NOT NULL DEFAULT 1,
  "ParentCtrlId" INTEGER,
  "IsLoadChild" INTEGER NOT NULL DEFAULT 0,
  "TabId" INTEGER NOT NULL DEFAULT 0,
  "IsHistMaint" INTEGER CHECK ("IsHistMaint" IN (0,1)),
  "LockOnParentVal" TEXT CHECK (length("LockOnParentVal") <= 1000),
  "IsRefreshOnParentVal" INTEGER CHECK ("IsRefreshOnParentVal" IN (0,1)),
  "IsAutoIncr" INTEGER NOT NULL DEFAULT 0,
  "IntegerPlaces" INTEGER,
  "DecimalPlaces" INTEGER,
  "SignType" INTEGER,
  "ParentCtrlId2" INTEGER,
  "LockOnParentVal2" INTEGER,
  PRIMARY KEY ("CtrlID")
);

CREATE TABLE IF NOT EXISTS "PageBuilder_UI_Entity_CRUD" (
  "EntityCode" TEXT NOT NULL CHECK (length("EntityCode") <= 50),
  "EntityName" TEXT NOT NULL CHECK (length("EntityName") <= 100),
  "TableSchema" TEXT NOT NULL,
  "TableName" TEXT NOT NULL,
  "ParentEntityCode" TEXT CHECK (length("ParentEntityCode") <= 50),
  "ParentKeyColumn" TEXT,
  "AllowInsert" INTEGER NOT NULL DEFAULT 1 CHECK ("AllowInsert" IN (0,1)),
  "AllowUpdate" INTEGER NOT NULL DEFAULT 1 CHECK ("AllowUpdate" IN (0,1)),
  "AllowDelete" INTEGER NOT NULL DEFAULT 1 CHECK ("AllowDelete" IN (0,1)),
  "IsActive" INTEGER NOT NULL DEFAULT 1 CHECK ("IsActive" IN (0,1)),
  PRIMARY KEY ("EntityCode")
);

CREATE TABLE IF NOT EXISTS "PageBuilder_UI_Entity_PK" (
  "EntityCode" TEXT NOT NULL CHECK (length("EntityCode") <= 50),
  "KeyOrdinal" INTEGER NOT NULL,
  "ColumnName" TEXT NOT NULL,
  PRIMARY KEY ("EntityCode", "KeyOrdinal")
);

CREATE TABLE IF NOT EXISTS "PageBuilder_UI_Entity_ParentFilter" (
  "EntityCode" TEXT NOT NULL CHECK (length("EntityCode") <= 50),
  "FilterSequence" INTEGER NOT NULL,
  "FilterName" TEXT NOT NULL CHECK (length("FilterName") <= 50),
  "SourceEntityCode" TEXT NOT NULL CHECK (length("SourceEntityCode") <= 50),
  "SourceKeyColumn" TEXT NOT NULL,
  "TargetColumn" TEXT NOT NULL,
  "IsActive" INTEGER NOT NULL DEFAULT 1 CHECK ("IsActive" IN (0,1)),
  PRIMARY KEY ("EntityCode", "FilterSequence")
);

CREATE TABLE IF NOT EXISTS "PageBuilder_UI_EntityColumn" (
  "EntityColumnId" INTEGER PRIMARY KEY AUTOINCREMENT,
  "EntityCode" TEXT NOT NULL CHECK (length("EntityCode") <= 50),
  "ColumnName" TEXT NOT NULL,
  "PropertyName" TEXT NOT NULL,
  "IsPrimaryKey" INTEGER NOT NULL DEFAULT 0 CHECK ("IsPrimaryKey" IN (0,1)),
  "IsIdentity" INTEGER NOT NULL DEFAULT 0 CHECK ("IsIdentity" IN (0,1)),
  "IsInsertable" INTEGER NOT NULL DEFAULT 1 CHECK ("IsInsertable" IN (0,1)),
  "IsUpdatable" INTEGER NOT NULL DEFAULT 1 CHECK ("IsUpdatable" IN (0,1)),
  "IsRequired" INTEGER NOT NULL DEFAULT 0 CHECK ("IsRequired" IN (0,1)),
  "IsParentKey" INTEGER NOT NULL DEFAULT 0 CHECK ("IsParentKey" IN (0,1)),
  "ParentEntityCode" TEXT CHECK (length("ParentEntityCode") <= 50),
  "ParentColumnName" TEXT,
  "IsAuditColumn" INTEGER NOT NULL DEFAULT 0 CHECK ("IsAuditColumn" IN (0,1)),
  "IsComputed" INTEGER NOT NULL DEFAULT 0 CHECK ("IsComputed" IN (0,1)),
  "IsConcurrency" INTEGER NOT NULL DEFAULT 0 CHECK ("IsConcurrency" IN (0,1)),
  "DisplayOrder" INTEGER
);

CREATE TABLE IF NOT EXISTS "PageBuilder_UI_Entity" (
  "EntityCode" TEXT NOT NULL CHECK (length("EntityCode") <= 50),
  "EntityName" TEXT NOT NULL CHECK (length("EntityName") <= 100),
  "SchemaName" TEXT NOT NULL DEFAULT 'main',
  "TableName" TEXT NOT NULL,
  "PrimaryKeyField" TEXT NOT NULL,
  "IsActive" INTEGER NOT NULL DEFAULT 1 CHECK ("IsActive" IN (0,1)),
  "AllowInsert" INTEGER NOT NULL DEFAULT 1 CHECK ("AllowInsert" IN (0,1)),
  "AllowUpdate" INTEGER NOT NULL DEFAULT 1 CHECK ("AllowUpdate" IN (0,1)),
  "AllowDelete" INTEGER NOT NULL DEFAULT 1 CHECK ("AllowDelete" IN (0,1)),
  "SoftDelete" INTEGER NOT NULL DEFAULT 0 CHECK ("SoftDelete" IN (0,1)),
  "SoftDeleteColumn" TEXT,
  PRIMARY KEY ("EntityCode")
);

CREATE TABLE IF NOT EXISTS "PageBuilder_UI_Control_DDLParameter" (
  "EntityCode" TEXT NOT NULL CHECK (length("EntityCode") <= 50),
  "ControlCode" TEXT NOT NULL CHECK (length("ControlCode") <= 50),
  "ParameterName" TEXT NOT NULL,
  "ParentEntityCode" TEXT NOT NULL CHECK (length("ParentEntityCode") <= 50),
  "ParentControlCode" TEXT NOT NULL CHECK (length("ParentControlCode") <= 50),
  "ParameterSequence" INTEGER NOT NULL,
  "IsRequired" INTEGER NOT NULL DEFAULT 1 CHECK ("IsRequired" IN (0,1)),
  "IsActive" INTEGER NOT NULL DEFAULT 1 CHECK ("IsActive" IN (0,1)),
  PRIMARY KEY ("EntityCode", "ControlCode", "ParameterName")
);

CREATE TABLE IF NOT EXISTS PageBuilder_UI_ControlValidation (
  ValidationId INTEGER PRIMARY KEY AUTOINCREMENT,
  ControlId INTEGER NOT NULL REFERENCES PageBuilder_UI_Control(ControlId) ON DELETE CASCADE,
  ValidationType TEXT NOT NULL DEFAULT 'Required',
  ValidationExpression TEXT,
  ErrorMessage TEXT,
  IsActive INTEGER NOT NULL DEFAULT 1 CHECK(IsActive IN (0,1))
);

CREATE TABLE IF NOT EXISTS DemoContacts (
  Id INTEGER PRIMARY KEY AUTOINCREMENT,
  Name TEXT NOT NULL,
  Email TEXT,
  IsActive INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS IX_PB_Tab_Screen ON PageBuilder_UI_Tab(ScreenCode, SequenceNo);

CREATE INDEX IF NOT EXISTS IX_PB_Control_Screen ON PageBuilder_UI_Control(ScreenCode, TabCode, SequenceNo);

CREATE UNIQUE INDEX IF NOT EXISTS UX_PB_Control_Code ON PageBuilder_UI_Control(ScreenCode, ControlCode);

CREATE UNIQUE INDEX IF NOT EXISTS UX_PB_EntityColumn ON PageBuilder_UI_EntityColumn(EntityCode, ColumnName);
