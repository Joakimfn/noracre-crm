CREATE TABLE billing_events (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 organization_id INTEGER NOT NULL,
 entity_type TEXT NOT NULL,
 entity_id INTEGER NOT NULL,
 membership_id INTEGER NOT NULL DEFAULT 0,
 module_key TEXT NOT NULL DEFAULT '',
 label TEXT NOT NULL,
 active INTEGER NOT NULL,
 monthly_price INTEGER NOT NULL DEFAULT 0,
 event_kind TEXT NOT NULL,
 occurred_at TEXT NOT NULL,
 reference_at TEXT NOT NULL DEFAULT ''
);
CREATE INDEX billing_events_org_time ON billing_events(organization_id,occurred_at);
CREATE INDEX billing_events_time ON billing_events(occurred_at,id);
INSERT INTO billing_events (organization_id,entity_type,entity_id,membership_id,module_key,label,active,monthly_price,event_kind,occurred_at,reference_at) SELECT id,'organization',id,0,'',name,(status = 'Aktiv'),0,'baseline',strftime('%Y-%m-%dT%H:%M:%fZ','now'),created_at FROM organizations;
CREATE TRIGGER billing_organizations_insert AFTER INSERT ON organizations BEGIN
 INSERT INTO billing_events (organization_id,entity_type,entity_id,membership_id,module_key,label,active,monthly_price,event_kind,occurred_at,reference_at) VALUES (NEW.id,'organization',NEW.id,0,'',NEW.name,(NEW.status = 'Aktiv'),0,CASE WHEN (NEW.status = 'Aktiv') THEN 'activated' ELSE 'deactivated' END,strftime('%Y-%m-%dT%H:%M:%fZ','now'),NEW.created_at);
END;
CREATE TRIGGER billing_organizations_update AFTER UPDATE ON organizations WHEN OLD.status IS NOT NEW.status BEGIN
 INSERT INTO billing_events (organization_id,entity_type,entity_id,membership_id,module_key,label,active,monthly_price,event_kind,occurred_at,reference_at) VALUES (NEW.id,'organization',NEW.id,0,'',NEW.name,(NEW.status = 'Aktiv'),0,CASE WHEN (NEW.status = 'Aktiv') THEN 'activated' ELSE 'deactivated' END,strftime('%Y-%m-%dT%H:%M:%fZ','now'),NEW.created_at);
END;
CREATE TRIGGER billing_organizations_delete AFTER DELETE ON organizations BEGIN
 INSERT INTO billing_events (organization_id,entity_type,entity_id,membership_id,module_key,label,active,monthly_price,event_kind,occurred_at,reference_at) VALUES (OLD.id,'organization',OLD.id,0,'',OLD.name,0,0,'deleted',strftime('%Y-%m-%dT%H:%M:%fZ','now'),OLD.created_at);
END;
INSERT INTO billing_events (organization_id,entity_type,entity_id,membership_id,module_key,label,active,monthly_price,event_kind,occurred_at,reference_at) SELECT organization_id,'user',id,id,'',CASE WHEN name <> '' THEN name ELSE email END,(active),399,'baseline',strftime('%Y-%m-%dT%H:%M:%fZ','now'),created_at FROM memberships;
CREATE TRIGGER billing_memberships_insert AFTER INSERT ON memberships BEGIN
 INSERT INTO billing_events (organization_id,entity_type,entity_id,membership_id,module_key,label,active,monthly_price,event_kind,occurred_at,reference_at) VALUES (NEW.organization_id,'user',NEW.id,NEW.id,'',CASE WHEN NEW.name <> '' THEN NEW.name ELSE NEW.email END,(NEW.active),399,CASE WHEN (NEW.active) THEN 'activated' ELSE 'deactivated' END,strftime('%Y-%m-%dT%H:%M:%fZ','now'),NEW.created_at);
END;
CREATE TRIGGER billing_memberships_update AFTER UPDATE ON memberships WHEN OLD.active IS NOT NEW.active OR OLD.organization_id IS NOT NEW.organization_id BEGIN
 INSERT INTO billing_events (organization_id,entity_type,entity_id,membership_id,module_key,label,active,monthly_price,event_kind,occurred_at,reference_at) VALUES (NEW.organization_id,'user',NEW.id,NEW.id,'',CASE WHEN NEW.name <> '' THEN NEW.name ELSE NEW.email END,(NEW.active),399,CASE WHEN (NEW.active) THEN 'activated' ELSE 'deactivated' END,strftime('%Y-%m-%dT%H:%M:%fZ','now'),NEW.created_at);
END;
CREATE TRIGGER billing_memberships_delete AFTER DELETE ON memberships BEGIN
 INSERT INTO billing_events (organization_id,entity_type,entity_id,membership_id,module_key,label,active,monthly_price,event_kind,occurred_at,reference_at) VALUES (OLD.organization_id,'user',OLD.id,OLD.id,'',CASE WHEN OLD.name <> '' THEN OLD.name ELSE OLD.email END,0,399,'deleted',strftime('%Y-%m-%dT%H:%M:%fZ','now'),OLD.created_at);
END;
INSERT INTO billing_events (organization_id,entity_type,entity_id,membership_id,module_key,label,active,monthly_price,event_kind,occurred_at,reference_at) SELECT organization_id,'module',id,0,module_key,module_key,(active),0,'baseline',strftime('%Y-%m-%dT%H:%M:%fZ','now'),activated_at FROM organization_modules;
CREATE TRIGGER billing_organization_modules_insert AFTER INSERT ON organization_modules BEGIN
 INSERT INTO billing_events (organization_id,entity_type,entity_id,membership_id,module_key,label,active,monthly_price,event_kind,occurred_at,reference_at) VALUES (NEW.organization_id,'module',NEW.id,0,NEW.module_key,NEW.module_key,(NEW.active),0,CASE WHEN (NEW.active) THEN 'activated' ELSE 'deactivated' END,strftime('%Y-%m-%dT%H:%M:%fZ','now'),NEW.activated_at);
END;
CREATE TRIGGER billing_organization_modules_update AFTER UPDATE ON organization_modules WHEN OLD.active IS NOT NEW.active OR OLD.price_per_user IS NOT NEW.price_per_user BEGIN
 INSERT INTO billing_events (organization_id,entity_type,entity_id,membership_id,module_key,label,active,monthly_price,event_kind,occurred_at,reference_at) VALUES (NEW.organization_id,'module',NEW.id,0,NEW.module_key,NEW.module_key,(NEW.active),0,CASE WHEN (NEW.active) THEN 'activated' ELSE 'deactivated' END,strftime('%Y-%m-%dT%H:%M:%fZ','now'),NEW.activated_at);
END;
CREATE TRIGGER billing_organization_modules_delete AFTER DELETE ON organization_modules BEGIN
 INSERT INTO billing_events (organization_id,entity_type,entity_id,membership_id,module_key,label,active,monthly_price,event_kind,occurred_at,reference_at) VALUES (OLD.organization_id,'module',OLD.id,0,OLD.module_key,OLD.module_key,0,0,'deleted',strftime('%Y-%m-%dT%H:%M:%fZ','now'),OLD.activated_at);
END;
INSERT INTO billing_events (organization_id,entity_type,entity_id,membership_id,module_key,label,active,monthly_price,event_kind,occurred_at,reference_at) SELECT organization_id,'license',id,membership_id,module_key,module_key,(active),price_per_user,'baseline',strftime('%Y-%m-%dT%H:%M:%fZ','now'),activated_at FROM module_licenses;
CREATE TRIGGER billing_module_licenses_insert AFTER INSERT ON module_licenses BEGIN
 INSERT INTO billing_events (organization_id,entity_type,entity_id,membership_id,module_key,label,active,monthly_price,event_kind,occurred_at,reference_at) VALUES (NEW.organization_id,'license',NEW.id,NEW.membership_id,NEW.module_key,NEW.module_key,(NEW.active),NEW.price_per_user,CASE WHEN (NEW.active) THEN 'activated' ELSE 'deactivated' END,strftime('%Y-%m-%dT%H:%M:%fZ','now'),NEW.activated_at);
END;
CREATE TRIGGER billing_module_licenses_update AFTER UPDATE ON module_licenses WHEN OLD.active IS NOT NEW.active OR OLD.price_per_user IS NOT NEW.price_per_user OR OLD.membership_id IS NOT NEW.membership_id BEGIN
 INSERT INTO billing_events (organization_id,entity_type,entity_id,membership_id,module_key,label,active,monthly_price,event_kind,occurred_at,reference_at) VALUES (NEW.organization_id,'license',NEW.id,NEW.membership_id,NEW.module_key,NEW.module_key,(NEW.active),NEW.price_per_user,CASE WHEN (NEW.active) THEN 'activated' ELSE 'deactivated' END,strftime('%Y-%m-%dT%H:%M:%fZ','now'),NEW.activated_at);
END;
CREATE TRIGGER billing_module_licenses_delete AFTER DELETE ON module_licenses BEGIN
 INSERT INTO billing_events (organization_id,entity_type,entity_id,membership_id,module_key,label,active,monthly_price,event_kind,occurred_at,reference_at) VALUES (OLD.organization_id,'license',OLD.id,OLD.membership_id,OLD.module_key,OLD.module_key,0,OLD.price_per_user,'deleted',strftime('%Y-%m-%dT%H:%M:%fZ','now'),OLD.activated_at);
END;
