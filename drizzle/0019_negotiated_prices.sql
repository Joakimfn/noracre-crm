-- Preserve existing agreements; new organizations require an explicitly entered price.
ALTER TABLE organizations ADD COLUMN crm_price INTEGER CHECK(crm_price IS NULL OR (crm_price >= 0 AND crm_price <= 1000000));
ALTER TABLE organizations ADD COLUMN ring_price INTEGER CHECK(ring_price IS NULL OR (ring_price >= 0 AND ring_price <= 1000000));
ALTER TABLE organizations ADD COLUMN marketing_price INTEGER CHECK(marketing_price IS NULL OR (marketing_price >= 0 AND marketing_price <= 1000000));
UPDATE organizations SET crm_price=399,
 ring_price=COALESCE((SELECT price_per_user FROM organization_modules WHERE organization_id=organizations.id AND module_key='ringelister'),49),
 marketing_price=COALESCE((SELECT price_per_user FROM organization_modules WHERE organization_id=organizations.id AND module_key='markedsforing'),49);
DROP TRIGGER billing_memberships_insert;
DROP TRIGGER billing_memberships_update;
DROP TRIGGER billing_memberships_delete;
CREATE TRIGGER billing_memberships_insert AFTER INSERT ON memberships BEGIN
 INSERT INTO billing_events (organization_id,entity_type,entity_id,membership_id,module_key,label,active,monthly_price,event_kind,occurred_at,reference_at) VALUES (NEW.organization_id,'user',NEW.id,NEW.id,'',CASE WHEN NEW.name <> '' THEN NEW.name ELSE NEW.email END,(NEW.active),COALESCE((SELECT crm_price FROM organizations WHERE id=NEW.organization_id),0),CASE WHEN (NEW.active) THEN 'activated' ELSE 'deactivated' END,strftime('%Y-%m-%dT%H:%M:%fZ','now'),NEW.created_at);
END;
CREATE TRIGGER billing_memberships_update AFTER UPDATE ON memberships WHEN OLD.active IS NOT NEW.active OR OLD.organization_id IS NOT NEW.organization_id BEGIN
 INSERT INTO billing_events (organization_id,entity_type,entity_id,membership_id,module_key,label,active,monthly_price,event_kind,occurred_at,reference_at) VALUES (NEW.organization_id,'user',NEW.id,NEW.id,'',CASE WHEN NEW.name <> '' THEN NEW.name ELSE NEW.email END,(NEW.active),COALESCE((SELECT crm_price FROM organizations WHERE id=NEW.organization_id),0),CASE WHEN (NEW.active) THEN 'activated' ELSE 'deactivated' END,strftime('%Y-%m-%dT%H:%M:%fZ','now'),NEW.created_at);
END;
CREATE TRIGGER billing_memberships_delete AFTER DELETE ON memberships BEGIN
 INSERT INTO billing_events (organization_id,entity_type,entity_id,membership_id,module_key,label,active,monthly_price,event_kind,occurred_at,reference_at) VALUES (OLD.organization_id,'user',OLD.id,OLD.id,'',CASE WHEN OLD.name <> '' THEN OLD.name ELSE OLD.email END,0,COALESCE((SELECT crm_price FROM organizations WHERE id=OLD.organization_id),0),'deleted',strftime('%Y-%m-%dT%H:%M:%fZ','now'),OLD.created_at);
END;

-- Apply a negotiated price change atomically and append history without rewriting earlier months.
CREATE TRIGGER organization_prices_update AFTER UPDATE OF crm_price,ring_price,marketing_price ON organizations
WHEN OLD.crm_price IS NOT NEW.crm_price OR OLD.ring_price IS NOT NEW.ring_price OR OLD.marketing_price IS NOT NEW.marketing_price
BEGIN
 INSERT INTO billing_events(organization_id,entity_type,entity_id,membership_id,module_key,label,active,monthly_price,event_kind,occurred_at,reference_at)
 SELECT NEW.id,'user',id,id,'',CASE WHEN name<>'' THEN name ELSE email END,active,COALESCE(NEW.crm_price,0),'price_changed',strftime('%Y-%m-%dT%H:%M:%fZ','now'),created_at
 FROM memberships WHERE organization_id=NEW.id AND OLD.crm_price IS NOT NEW.crm_price;
 UPDATE organization_modules SET price_per_user=CASE module_key WHEN 'ringelister' THEN NEW.ring_price ELSE NEW.marketing_price END
 WHERE organization_id=NEW.id AND ((module_key='ringelister' AND NEW.ring_price IS NOT NULL) OR (module_key='markedsforing' AND NEW.marketing_price IS NOT NULL));
 UPDATE module_licenses SET price_per_user=CASE module_key WHEN 'ringelister' THEN NEW.ring_price ELSE NEW.marketing_price END
 WHERE organization_id=NEW.id AND ((module_key='ringelister' AND NEW.ring_price IS NOT NULL) OR (module_key='markedsforing' AND NEW.marketing_price IS NOT NULL));
END;
