import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

const dir=await mkdtemp(path.join(tmpdir(),'noracre-outbound-markets-'));
await build({entryPoints:['lib/outbound-markets.ts','lib/home-countries.ts'],bundle:true,format:'esm',platform:'node',outdir:dir});
const {marketDefaults,outboundPlaybook,defaultOutboundRules,normalizeOutboundRules,eligibleForOutbound,localDateTimeToUtc,utcToLocalDateTime}=await import(pathToFileURL(path.join(dir,'outbound-markets.js')));
const {homeCountries}=await import(pathToFileURL(path.join(dir,'home-countries.js')));
after(()=>rm(dir,{recursive:true,force:true}));

test('market defaults cover all selectable home countries with usable currency and time zones',()=>{
  assert.equal(homeCountries.length,249);
  for(const country of homeCountries){
    const defaults=marketDefaults(country);
    assert.equal(defaults.country,country);
    assert.match(defaults.currency,/^[A-Z]{3}$/);
    assert.ok(['nb','en','fr'].includes(defaults.locale));
    assert.doesNotThrow(()=>new Intl.DateTimeFormat('en',{timeZone:defaults.timeZone}).format(new Date()));
    assert.doesNotThrow(()=>new Intl.NumberFormat('en',{style:'currency',currency:defaults.currency}).format(1));
  }
});
test('home-country defaults use local denominations and reviewed 2026 currencies',()=>{
  for(const [country,currency,zone,locale] of [
    ['NO','NOK','Europe/Oslo','nb'],['SE','SEK','Europe/Stockholm','en'],['DK','DKK','Europe/Copenhagen','en'],
    ['FR','EUR','Europe/Paris','fr'],['BE','EUR','Europe/Brussels','fr'],['GB','GBP','Europe/London','en'],
    ['IE','EUR','Europe/Dublin','en'],['US','USD','America/New_York','en'],['NG','NGN','Africa/Lagos','en'],
    ['ZM','ZMW','Africa/Lusaka','en'],['AU','AUD','Australia/Sydney','en'],['NZ','NZD','Pacific/Auckland','en'],
    ['BG','EUR','Europe/Sofia','en'],['CW','XCG','America/Curacao','en'],['ZW','ZWG','Africa/Harare','en'],
  ])assert.deepEqual(marketDefaults(country),{country,currency,timeZone:zone,locale});
  assert.equal(marketDefaults(' fr ').country,'FR');
  assert.equal(marketDefaults().country,'NO');
  assert.throws(()=>marketDefaults('invalid'));
});
test('country playbooks are editable generic drafts with opt-out wording and language overrides',()=>{
  for(const country of homeCountries){
    const draft=outboundPlaybook(country);
    assert.equal(draft.country,country);
    assert.match(draft.phoneScript,/\{\{companyName\}\}/);
    assert.match(draft.emailBody,/\{\{meetingLink\}\}/);
    assert.equal(draft.placeholders.length,6);
    assert.ok(draft.permissionGuidance.length>50);
    assert.doesNotMatch(draft.phoneScript+draft.emailBody,/Noracre|50%|500 NOK|guarantee/i);
  }
  assert.match(outboundPlaybook('NO').phoneScript,/^Hei/);
  assert.match(outboundPlaybook('FR').phoneScript,/^Bonjour/);
  assert.match(outboundPlaybook('NG').phoneScript,/^Good day/);
  assert.match(outboundPlaybook('FR','en').phoneScript,/^Hello/);
  assert.equal(outboundPlaybook('NO','fr-FR').locale,'fr');
});
test('rules normalize JSON and case without sharing mutable default state',()=>{
  const source={blockedCountries:['fr',' FR ','NO'],blockedIndustries:[' legal ','legal'],blockedRegions:[' Nordland '],requireContactPermission:true,
    contactHours:{weekdays:[5,1,1],start:'09:00',end:'17:00'}};
  const normalized=normalizeOutboundRules(JSON.stringify(source));
  assert.deepEqual(normalized,{blockedCountries:['FR','NO'],blockedIndustries:['legal'],blockedRegions:['Nordland'],requireContactPermission:true,
    contactHours:{weekdays:[1,5],start:'09:00',end:'17:00'}});
  const first=defaultOutboundRules();first.blockedCountries.push('NO');
  assert.deepEqual(defaultOutboundRules(),normalizeOutboundRules(undefined));
  assert.deepEqual(normalizeOutboundRules('{}'),defaultOutboundRules());
});
test('malformed rules fail closed and cannot silently disable restrictions',()=>{
  for(const value of ['{','[]',[],1,{blockedCountries:['XX']},{blockedIndustries:['']},{blockedCountries:'NO'},
    {requireContactPermission:'false'},{blockedRegions:['x'.repeat(121)]},
    {contactHours:{weekdays:[],start:'09:00',end:'17:00'}},{contactHours:{weekdays:[0],start:'09:00',end:'17:00'}},
    {contactHours:{weekdays:[1],start:'09:00',end:'09:00'}},{contactHours:{weekdays:[1],start:'24:00',end:'17:00'}}]){
    assert.throws(()=>normalizeOutboundRules(value));
    assert.deepEqual(eligibleForOutbound({country:'NO'},value),{eligible:false,reason:'invalid_rules'});
  }
});
test('do-not-contact flags override permissions and market settings',()=>{
  for(const entry of [{doNotContact:true},{suppressed:true},{suppressionId:9},{state:{doNotContact:true}},{doNotContact:1},{doNotContact:'true'}]){
    assert.deepEqual(eligibleForOutbound({country:'FR',contactPermission:true,...entry},{}),{eligible:false,reason:'do_not_contact'});
  }
  assert.equal(eligibleForOutbound({country:'FR',doNotContact:false,suppressed:false,suppressionId:0},{}).eligible,true);
});
test('configured country, industry and region blocks match case and accent variations',()=>{
  assert.equal(eligibleForOutbound({country:' fr '},{blockedCountries:['FR']}).reason,'country_blocked');
  assert.equal(eligibleForOutbound({country:'NO',industry:'Juridiske TJENESTER'},{blockedIndustries:['juridiske']}).reason,'industry_blocked');
  assert.equal(eligibleForOutbound({country:'FR',industry:'Services juridiques spécialisés'},{blockedIndustries:['SPECIALISES']}).reason,'industry_blocked');
  assert.equal(eligibleForOutbound({country:'FR',industryCode:'69.10Z'},{blockedIndustries:['69.10']}).reason,'industry_blocked');
  assert.equal(eligibleForOutbound({country:'NO',city:'Bodø',region:'NORDLAND'},{blockedRegions:['nordland']}).reason,'region_blocked');
  assert.equal(eligibleForOutbound({country:'NO',address:'Sentrum 4, Nordland'},{blockedRegions:['Nordland']}).reason,'region_blocked');
  assert.equal(eligibleForOutbound({country:'NO',city:'Oslo',industry:'Software'},{}).eligible,true);
});
test('requiring permission needs an explicit grant rather than truthy user input',()=>{
  const rules={requireContactPermission:true};
  for(const value of [undefined,null,false,'false','true','pending','',1])assert.equal(eligibleForOutbound({country:'NO',contactPermission:value},rules).reason,'permission_required');
  for(const value of [true,'granted'])assert.equal(eligibleForOutbound({country:'NO',contactPermission:value},rules).eligible,true);
  assert.equal(eligibleForOutbound({country:'NO',state:{contactPermission:true}},rules).eligible,true);
});
const daytime={contactHours:{weekdays:[1,2,3,4,5],start:'09:00',end:'17:00'}};
test('business hours use recipient market zones with inclusive opening and exclusive closing',()=>{
  const entry={country:'NG'};
  assert.equal(eligibleForOutbound(entry,daytime,'2026-10-12T07:59:59Z').reason,'outside_contact_hours');
  assert.deepEqual(eligibleForOutbound(entry,daytime,'2026-10-12T08:00:00Z'),{
    eligible:true,reason:'eligible',localDate:'2026-10-12',localTime:'09:00',timeZone:'Africa/Lagos'});
  assert.equal(eligibleForOutbound(entry,daytime,'2026-10-12T15:59:59Z').eligible,true);
  assert.equal(eligibleForOutbound(entry,daytime,'2026-10-12T16:00:00Z').reason,'outside_contact_hours');
  assert.equal(eligibleForOutbound(entry,daytime,'2026-10-11T10:00:00Z').reason,'outside_contact_hours');
});
test('contact windows follow daylight-saving changes and recipient overrides',()=>{
  assert.equal(eligibleForOutbound({country:'FR'},daytime,'2026-03-27T08:00:00Z').localTime,'09:00');
  assert.equal(eligibleForOutbound({country:'FR'},daytime,'2026-03-30T07:00:00Z').localTime,'09:00');
  assert.equal(eligibleForOutbound({country:'FR'},daytime,'2026-10-23T07:00:00Z').localTime,'09:00');
  assert.equal(eligibleForOutbound({country:'FR'},daytime,'2026-10-26T08:00:00Z').localTime,'09:00');
  assert.equal(eligibleForOutbound({country:'US',timeZone:'America/Los_Angeles'},daytime,'2026-10-12T16:00:00Z').localTime,'09:00');
  assert.equal(eligibleForOutbound({country:'NO'},daytime,'2026-10-12T09:00:00Z','Etc/UTC').localTime,'09:00');
  assert.equal(eligibleForOutbound({country:'NO'},daytime,'2026-10-12T09:00:00Z','invalid').reason,'invalid_time_zone');
  assert.equal(eligibleForOutbound({country:'NO'},daytime,'invalid').reason,'invalid_date');
  assert.equal(eligibleForOutbound({country:'XX'},daytime,'2026-10-12T09:00:00Z').reason,'invalid_country');
});
test('overnight windows remain associated with their starting weekday',()=>{
  const night={contactHours:{weekdays:[1],start:'22:00',end:'06:00'}};
  const check=at=>eligibleForOutbound({country:'NO'},night,at,'Etc/UTC').eligible;
  assert.equal(check('2026-10-12T21:59:59Z'),false);
  assert.equal(check('2026-10-12T22:00:00Z'),true);
  assert.equal(check('2026-10-13T05:59:59Z'),true);
  assert.equal(check('2026-10-13T06:00:00Z'),false);
  assert.equal(check('2026-10-13T23:00:00Z'),false);
  assert.equal(check('2026-10-12T05:00:00Z'),false);
});
test('callback local dates round-trip in chosen zones rather than the browser time zone',()=>{
  for(const [value,zone,utc] of [
    ['2026-10-12T09:30','Europe/Oslo','2026-10-12T07:30:00.000Z'],
    ['2026-10-26T09:30','Europe/Paris','2026-10-26T08:30:00.000Z'],
    ['2026-10-12T09:30','Africa/Lagos','2026-10-12T08:30:00.000Z'],
    ['2026-10-12T09:30','America/New_York','2026-10-12T13:30:00.000Z'],
    ['2026-10-12T09:30','Asia/Kathmandu','2026-10-12T03:45:00.000Z'],
  ]){assert.equal(localDateTimeToUtc(value,zone),utc);assert.equal(utcToLocalDateTime(utc,zone),value);}
});
test('callback conversions reject impossible dates and daylight-saving gaps',()=>{
  for(const value of ['2026-02-30T09:00','2026-04-31T09:00','2026-12-01T24:00','2026-12-01T12:60','not-a-date'])assert.throws(()=>localDateTimeToUtc(value,'Europe/Paris'));
  assert.throws(()=>localDateTimeToUtc('2026-03-29T02:30','Europe/Paris'),/does not exist/);
  assert.equal(localDateTimeToUtc('2026-10-25T02:30','Europe/Paris'),'2026-10-25T00:30:00.000Z');
  assert.equal(utcToLocalDateTime('', 'Europe/Paris'),'');
  assert.equal(utcToLocalDateTime('invalid','Europe/Paris'),'');
  assert.equal(utcToLocalDateTime('2026-01-01T12:00:00Z','invalid'),'');
});
