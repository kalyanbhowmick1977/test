-- Synthetic records only. Login users are created by the backend using PB_ADMIN_PASSWORD.
INSERT OR IGNORE INTO MenuLocations(MenuId, Caption) VALUES (1, 'Demo pages');
INSERT OR IGNORE INTO DemoContacts(Id,Name,Email,IsActive) VALUES
 (1,'Alex Example','alex@example.test',1),
 (2,'Sam Example','sam@example.test',1),
 (3,'Taylor Example','taylor@example.test',0);
