-- The single settings row (id = 1). Edited by the admin in Settings.
INSERT INTO "settings" ("id") VALUES (1) ON CONFLICT DO NOTHING;
