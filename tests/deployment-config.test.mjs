import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

test('built D1 migration path resolves to repository migrations', () => {
  const root = path.resolve(import.meta.dirname, '..');
  const file = path.join(root, 'dist/server/wrangler.json');
  const config = JSON.parse(readFileSync(file, 'utf8'));
  assert.equal(config.keep_vars, true);
  const db = config.d1_databases.find(db => db.binding === 'DB');
  assert.equal(path.resolve(path.dirname(file), db.migrations_dir), path.join(root, 'drizzle'));
});
