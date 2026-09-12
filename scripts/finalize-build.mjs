import {readFile,writeFile,access} from 'node:fs/promises';
import path from 'node:path';
// Vite relocates the Worker configuration. D1 paths remain relative to that file.
const root=path.resolve(import.meta.dirname,'..');
const file=path.join(root,'dist/server/wrangler.json');
const config=JSON.parse(await readFile(file,'utf8'));
for(const database of config.d1_databases ?? []) {
  if(database.binding !== 'DB') continue;
  await access(path.join(root,'drizzle'));
  database.migrations_dir=path.relative(path.dirname(file),path.join(root,'drizzle'));
}
await writeFile(file,JSON.stringify(config,null,2)+'\n');
