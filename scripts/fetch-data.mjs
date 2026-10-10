// Fetches the club's matches and rankings from the public VolleyAdmin2 XML feed
// (Volley Vlaanderen) and writes them as one JSON file for the static site.
// Usage: node scripts/fetch-data.mjs [outputFile]   (Node 18+, no dependencies)

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outFile = resolve(root, process.argv[2] ?? 'site/data.json');
const config = JSON.parse(await readFile(resolve(root, 'config.json'), 'utf8'));

const BASE = 'https://www.volleyadmin2.be/services';

async function fetchXml(url, attempts = 3) {
  for (let i = 1; ; i++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': `${config.clubName} scores site` } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = new Uint8Array(await res.arrayBuffer());
      // The feeds mix UTF-8 and ISO-8859-1: honour the XML declaration.
      const head = new TextDecoder('latin1').decode(buf.slice(0, 100));
      const enc = /encoding="([^"]+)"/i.exec(head)?.[1] ?? 'utf-8';
      return new TextDecoder(enc.toLowerCase() === 'iso-8859-1' ? 'latin1' : enc).decode(buf);
    } catch (err) {
      if (i >= attempts) throw new Error(`${url}: ${err.message}`);
      await new Promise((r) => setTimeout(r, 2000 * i));
    }
  }
}

const decode = (s) => s
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
  .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
  .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
  .trim();

function records(xml, tag) {
  return [...xml.matchAll(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, 'g'))].map(([, body]) => {
    const rec = {};
    for (const [, k, v] of body.matchAll(/<([A-Za-z0-9_]+)>([\s\S]*?)<\/\1>/g)) rec[k] = decode(v);
    for (const [, k] of body.matchAll(/<([A-Za-z0-9_]+)\s*\/>/g)) rec[k] = '';
    return rec;
  });
}

const isoDate = (d) => { const [dd, mm, yyyy] = d.split('/'); return `${yyyy}-${mm}-${dd}`; };
const pair = (s) => { const m = /^(\d+)\s*[-/]\s*(\d+)$/.exec(s ?? ''); return m ? [+m[1], +m[2]] : null; };

const matchesXml = await fetchXml(`${BASE}/wedstrijden_xml.php?province_id=${config.provinceId}&stamnummer=${encodeURIComponent(config.stamnummer)}`);
const rawMatches = records(matchesXml, 'wedstrijd');
if (rawMatches.length === 0) throw new Error('No matches returned by VolleyAdmin2 — refusing to publish empty data.');

const teams = new Map();
for (const m of rawMatches) {
  const usHome = m.stamnummer_thuisclub === config.stamnummer;
  const usAway = m.stamnummer_bezoekersclub === config.stamnummer;
  if (!usHome && !usAway) continue;
  // A club derby (both sides ours) is listed under the home team only.
  const teamId = usHome ? m.thuisploeg_id : m.bezoekersploeg_id;
  const key = `${m.reeks}-${teamId}`;
  if (!teams.has(key)) {
    const cfg = config.teams[m.reeks] ?? {};
    teams.set(key, {
      key, reeks: m.reeks, reeksId: m.reeksid, teamId,
      teamName: usHome ? m.thuisploeg : m.bezoekersploeg,
      label: cfg.label ?? null, division: cfg.division ?? m.reeks,
      cup: !!cfg.cup || /^WB/.test(m.reeks), order: cfg.order ?? 99,
      bickyBelow: cfg.bickyBelow ?? null,
      matches: [], ranking: []
    });
  }
  const result = pair(m.uitslag);
  teams.get(key).matches.push({
    nr: m.nr,
    date: isoDate(m.datum),
    time: m.aanvangsuur || null,
    home: m.thuisploeg, away: m.bezoekersploeg,
    usHome,
    hall: m.sporthal || null,
    result: result ? { home: result[0], away: result[1] } : null,
    sets: [1, 2, 3, 4, 5].map((i) => pair(m[`uitslag_set_${i}`])).filter(Boolean),
    forfait: m.ForfaitHoofd || null,
    postponed: m.postponed === '1'
  });
}

// Two teams of the club in the same series would otherwise share one label.
const labelCount = {};
for (const t of teams.values()) labelCount[t.reeks] = (labelCount[t.reeks] ?? 0) + 1;
for (const t of teams.values()) {
  const suffix = t.teamName.replace(config.clubName, '').trim();
  if (!t.label) t.label = suffix ? `${suffix} · ${t.reeks}` : t.reeks;
  else if (labelCount[t.reeks] > 1 && suffix) t.label = `${t.label} ${suffix}`;
  t.matches.sort((a, b) => (a.date + (a.time ?? '')).localeCompare(b.date + (b.time ?? '')));
}

for (const reeks of new Set([...teams.values()].map((t) => t.reeks))) {
  const xml = await fetchXml(`${BASE}/rangschikking_xml.php?province_id=${config.provinceId}&reeks=${encodeURIComponent(reeks)}`);
  const ranking = records(xml, 'rangschikking')
    .filter((r) => r.reeks === reeks && (r.wedstrijdtype || 'Hoofd') === 'Hoofd')
    .map((r) => ({
      pos: parseInt(r.volgorde, 10),
      teamId: r.ploegid,
      name: r.ploegnaam,
      played: +r.aantalGespeeldeWedstrijden || 0,
      won: (+r.aantalGewonnen30_31 || 0) + (+r.aantalGewonnen32 || 0),
      lost: (+r.aantalVerloren30_31 || 0) + (+r.aantalVerloren32 || 0),
      setsWon: +r.aantalGewonnenSets || 0,
      setsLost: +r.aantalVerlorenSets || 0,
      points: +r.puntentotaal || 0,
      forfait: +r.forfait || 0
    }));
  for (const t of teams.values()) if (t.reeks === reeks) t.ranking = ranking;
}

const sorted = [...teams.values()].sort((a, b) => (a.cup - b.cup) || (a.order - b.order) || a.label.localeCompare(b.label));
const data = {
  club: config.clubName,
  stamnummer: config.stamnummer,
  generatedAt: new Date().toISOString(),
  source: 'VolleyAdmin2 — Volley Vlaanderen',
  teams: sorted
};

await mkdir(dirname(outFile), { recursive: true });
await writeFile(outFile, JSON.stringify(data));
console.log(`Wrote ${outFile}: ${sorted.length} teams, ${rawMatches.length} matches.`);
