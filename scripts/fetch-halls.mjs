// One-off helper: looks up the street address and coordinates of every sports hall the club
// plays in (from the hall pages on volleyscores.be) and writes them to halls.json.
// The hourly build only reads halls.json; run this again when new halls show up:
//   node scripts/fetch-data.mjs && node scripts/fetch-halls.mjs

import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const data = JSON.parse(await readFile(resolve(root, 'site/data.json'), 'utf8'));
const hallsFile = resolve(root, 'halls.json');
const halls = JSON.parse(await readFile(hallsFile, 'utf8').catch(() => '{}'));

const norm = (s) => s.replace(/\s+/g, ' ').trim();
// Pages only list matches for an explicit season id; the homepage carries the current one.
const home = await (await fetch('https://www.volleyscores.be/')).text();
const season = /se=(\d+)/.exec(home)?.[1];
if (!season) throw new Error('Current season id not found on volleyscores.be');
const page = async (params) => {
  const qs = new URLSearchParams({ v: 2, ss: 1, isActiveSeason: 1, t: '', se: season, pi: '', si: '', ti: '', ci: '', mm: '', ssi: '', st: '', w: '', f: '', lng: 'nl', ...params });
  const res = await fetch(`https://www.volleyscores.be/index.php?${qs}`);
  if (!res.ok) throw new Error(`volleyscores.be ${res.status}`);
  await new Promise((r) => setTimeout(r, 500)); // be gentle with their server
  return res.text();
};

const wanted = new Set(data.teams.flatMap((t) => t.matches.map((m) => m.hall)).filter(Boolean).map(norm));
const missing = () => [...wanted].filter((h) => !halls[h]);

// Team pages link each hall as loadPage('Sporthal <name>','s',...,'<hall id>',...).
const ids = {};
for (const t of data.teams) {
  if (missing().every((h) => ids[h])) break;
  const html = await page({ a: 't', ti: t.teamId });
  for (const [, name, id] of html.matchAll(/loadPage\('Sporthal ([^']*)','s'(?:,'[^']*'){6},'(\d+)'/g)) ids[norm(name)] = id;
}

const field = (text, label) => norm(new RegExp(`${label}\\s*\\n\\s*([^\\n]*)`).exec(text)?.[1] ?? '');
for (const name of missing()) {
  if (!ids[name]) continue;
  const text = (await page({ a: 's', si: ids[name] })).replace(/<[^>]*>/g, '\n').replace(/\n\s*\n+/g, '\n');
  // Some addresses carry a remark, e.g. "Blommestraat (Parking aan ...) 14": keep it apart.
  const rawStreet = field(text, 'Adres');
  const note = /\(([^)]*)\)/.exec(rawStreet)?.[1] ?? null;
  const street = norm(rawStreet.replace(/\([^)]*\)/, ''));
  const city = field(text, 'Gemeente').toLowerCase().replace(/(^|[\s-])(\p{L})/gu, (_, sep, ch) => sep + ch.toUpperCase());
  const lat = parseFloat(field(text, 'Latitude'));
  const lng = parseFloat(field(text, 'Longitude'));
  halls[name] = { street, city, ...(note ? { note } : {}), ...(lat && lng ? { lat, lng } : {}) };
  console.log(`${name}: ${street}, ${city}`);
}

const sorted = Object.fromEntries(Object.entries(halls).sort(([a], [b]) => a.localeCompare(b)));
await writeFile(hallsFile, JSON.stringify(sorted, null, 2) + '\n');
const left = missing();
console.log(`halls.json: ${Object.keys(sorted).length} halls.${left.length ? ` Not found: ${left.join('; ')}` : ''}`);
