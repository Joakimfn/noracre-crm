import {pathToFileURL} from 'node:url';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdtemp,symlink,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
const dir=await mkdtemp(path.join(tmpdir(),'contact-settings-'));
await symlink(path.resolve('node_modules'),path.join(dir,'node_modules'),'junction');
await build({stdin:{contents:`export {MailAccount} from './components/mail-account'; export {PhoneLink} from './components/phone-link'; export {teamsPhoneLink} from './lib/phone-link';`,resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',jsx:'automatic',packages:'external',outfile:path.join(dir,'ui.mjs')});
const {MailAccount,PhoneLink,teamsPhoneLink}=await import(pathToFileURL(path.join(dir,'ui.mjs')));
test('pending account status never claims user is disconnected or shows manual refresh',()=>{
 const html=renderToStaticMarkup(React.createElement(MailAccount,{organizationId:1}));
 assert.equal(html.split('Henter kontostatus …').length-1,1);assert.ok(!html.includes('Koble til kontoen du vil sende fra'));assert.ok(!html.includes('Oppdater kontostatus'));
});
test('phone links preserve international destinations and reject ambiguous or injected input',()=>{
 for(const value of ['48 48 48 48','+47 48484848','0047 48484848'])assert.equal(new URL(teamsPhoneLink(value)).searchParams.get('users'),'4:+4748484848');
 assert.equal(new URL(teamsPhoneLink('+44 (20) 7946-0000')).searchParams.get('users'),'4:+442079460000');
 for(const value of ['', 'Ikke oppgitt','123','48 48 48 48 ext 99','123&users=x','javascript:alert(1)'])assert.equal(teamsPhoneLink(value),null);
 const html=renderToStaticMarkup(React.createElement(PhoneLink,{phone:'48 48 48 48'}));assert.match(html,/aria-label="Ring 48 48 48 48 via Teams"/);assert.match(html,/noopener noreferrer/);
});
process.on('exit',()=>rm(dir,{recursive:true,force:true}));
