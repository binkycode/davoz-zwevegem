'use strict';

const state = { data: null, tab: null, week: 'dit', weetjesMode: 'club', weetjesTeam: null, favs: [], mijnKey: null, lastTab: 'weekend' };

// Favourite teams live only in this browser (no account, no cookies). Storage can be blocked
// (private mode) or wiped; the site then simply works without favourites.
const FAV_KEY = 'davoz-favorieten';
try { const v = JSON.parse(localStorage.getItem(FAV_KEY) ?? '[]'); if (Array.isArray(v)) state.favs = v.filter((k) => typeof k === 'string'); } catch { /* no storage */ }
const saveFavs = () => { try { localStorage.setItem(FAV_KEY, JSON.stringify(state.favs)); } catch { /* no storage */ } };
const isFav = (t) => state.favs.includes(t.key);
// Keys of teams that left the feed (e.g. a new season) are ignored, not deleted.
const favTeams = () => state.data.teams.filter(isFav).sort((a, b) => state.favs.indexOf(a.key) - state.favs.indexOf(b.key));
const STAR = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.3l-5.8 3.1 1.1-6.5L2.6 9.3l6.5-.9z"/></svg>';
const starButton = (t) => `<button type="button" class="star" data-fav="${esc(t.key)}" aria-pressed="${isFav(t)}" aria-label="Favoriet: ${esc(t.label)}" title="${isFav(t) ? 'Verwijder uit Mijn ploeg' : 'Zet bij Mijn ploeg'}">${STAR}</button>`;

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Brussels' }).format(new Date());
const asDate = (iso) => new Date(`${iso}T12:00:00`);
const fmt = (iso, opts) => new Intl.DateTimeFormat('nl-BE', opts).format(asDate(iso));
const dayShort = (iso) => fmt(iso, { weekday: 'short' }).replace('.', '');
const dayMonth = (iso) => fmt(iso, { day: 'numeric', month: 'short' }).replace('.', '');
const dateLong = (iso) => fmt(iso, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

const won = (m) => m.result && (m.usHome ? m.result.home > m.result.away : m.result.away > m.result.home);
const setWon = (m, [h, a]) => (m.usHome ? h > a : a > h);
// A set won while the opponent stayed under the team's `bickyBelow` points earns a Bicky burger.
const bicky = (t, m, [h, a]) => t.bickyBelow != null && setWon(m, [h, a]) && (m.usHome ? a : h) < t.bickyBelow;
const burger = (t) => `<svg class="burger" viewBox="0 0 24 24" role="img" aria-label="Bicky burger: tegenstander scoorde minder dan ${t.bickyBelow} punten"><title>Bicky burger! Tegenstander scoorde minder dan ${t.bickyBelow} punten</title>`
  + '<path d="M3 10a9 6 0 0 1 18 0z" fill="#E3A33B"/><circle cx="9" cy="7" r=".7" fill="#FFF3D6"/><circle cx="13" cy="6" r=".7" fill="#FFF3D6"/><circle cx="15.5" cy="8" r=".7" fill="#FFF3D6"/>'
  + '<path d="M2.5 11.5c1.5 1.2 2.5-.6 4 .4s2.5-.6 4 .4 2.5-.6 4 .4 2.5-.6 4 .4 2-.4 3-.4" fill="none" stroke="#4CAF50" stroke-width="1.6" stroke-linecap="round"/>'
  + '<rect x="3" y="13" width="18" height="3.2" rx="1.4" fill="#6B3A1E"/><path d="M3 17.6h18a2.6 2.6 0 0 1-2.6 2.6H5.6A2.6 2.6 0 0 1 3 17.6z" fill="#E3A33B"/></svg>';
const fullAddress = (m) => m.address?.street ? `${m.address.street}, ${m.address.city}` : null;
const PIN = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg>';
const routeLink = (m) => m.address?.mapsUrl
  ? `<a class="route" href="${esc(m.address.mapsUrl)}" target="_blank" rel="noopener" data-track="route" data-track-title="Route: ${esc(m.hall)}">${PIN}Route in Google Maps<span class="sr-only"> (opent in een nieuw venster)</span></a>`
  : '';
const teamHref = (t) => `#/${encodeURIComponent(t.key)}`;
const matchHref = (t, m) => `#/${encodeURIComponent(t.key)}/${encodeURIComponent(m.nr)}`;

// '#/' (or no hash) is the club weekend overview; '#/<team>' and '#/<team>/<match nr>' the team pages.
function route() {
  const [, teamKey, matchNr] = location.hash.split('/').map(decodeURIComponent);
  if (['weetjes', 'ploegen', 'mijn', 'installeren'].includes(teamKey)) return { page: teamKey, team: null, match: null };
  const team = teamKey ? state.data.teams.find((t) => t.key === teamKey) : null;
  if (!team) return { page: 'weekend', team: null, match: null };
  const match = matchNr ? team.matches.find((m) => m.nr === matchNr) : null;
  return { page: 'team', team, match };
}

// Team and match pages keep the tab they were opened from (Mijn ploeg or Ploegen).
function renderTabbar(page, team) {
  const active = page === 'team' ? (state.lastTab === 'mijn' && isFav(team) ? 'mijn' : 'ploegen') : page;
  document.querySelectorAll('[data-tabbar]').forEach((a) => {
    if (a.dataset.tabbar === active) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
}

// Youth series play a fixed number of sets, so a match can end in a draw (2–2).
const outcome = (m) => !m.result ? null : m.result.home === m.result.away ? 'G' : won(m) ? 'W' : 'V';
const BADGES = {
  W: '<span class="badge win" aria-label="Gewonnen">W</span>',
  G: '<span class="badge draw" aria-label="Gelijkspel">G</span>',
  V: '<span class="badge" aria-label="Verloren">V</span>'
};
const badge = (m) => BADGES[outcome(m)] ?? '<span class="badge pending" aria-label="Nog geen uitslag">–</span>';

const name = (m, side) => {
  const us = side === 'home' ? m.usHome : !m.usHome;
  return `<span${us ? ' class="us"' : ''}>${esc(side === 'home' ? m.home : m.away)}</span>`;
};

function matchRow(t, m) {
  const sets = m.sets.map((s) => `<span class="chip${setWon(m, s) ? ' won' : ''}">${s[0]}–${s[1]}${bicky(t, m, s) ? burger(t) : ''}</span>`).join('');
  let meta = m.result ? '' : `${m.time ? esc(m.time) + ' · ' : ''}${esc(m.hall ?? '')}${fullAddress(m) ? ' · ' + esc(fullAddress(m)) : ''}`;
  if (!m.result && m.date < today) meta = 'Uitslag nog niet ingevoerd';
  if (m.postponed) meta = 'Uitgesteld';
  if (m.forfait) meta = `Forfait: ${esc(m.forfait)}`;
  return `
    <a class="match" href="${matchHref(t, m)}">
      <div class="match-date"><span>${esc(dayShort(m.date))}</span><b>${esc(dayMonth(m.date))}</b></div>
      <div class="match-teams">
        <div class="names">${name(m, 'home')}${name(m, 'away')}</div>
        ${sets ? `<div class="chips">${sets}</div>` : ''}
        ${meta ? `<div class="meta">${meta}</div>` : ''}
      </div>
      <div class="match-score">${m.result ? `<b>${m.result.home}–${m.result.away}</b>` : ''}${badge(m)}</div>
    </a>`;
}

function scoreboard(t, m, { title, link }) {
  const html = `
    <section class="scoreboard" aria-label="${esc(title)}">
      <div class="eyebrow"><h2>${esc(title)} · ${esc(t.division)}</h2><span>${esc(dateLong(m.date))}${m.time ? ' · ' + esc(m.time) : ''}</span></div>
      <div class="score-row">
        <div class="team">${esc(m.home)}</div>
        <div class="score"><span>${m.result.home}</span><span class="dash">–</span><span>${m.result.away}</span></div>
        <div class="team away">${esc(m.away)}</div>
      </div>
      ${m.sets.length ? `<div class="set-chips">${m.sets.map((s, i) => `
        <div class="set-chip${setWon(m, s) ? ' won' : ''}"><small>Set ${i + 1}</small><b>${s[0]}–${s[1]}${bicky(t, m, s) ? burger(t) : ''}</b><i></i></div>`).join('')}</div>` : ''}
      ${link ? '<span class="more">Bekijk matchdetail →</span>' : ''}
    </section>`;
  // The whole scoreboard is the link, not only the text at the bottom.
  return link ? `<a class="scoreboard-link" href="${matchHref(t, m)}">${html}</a>` : html;
}

function statsCard(t, played) {
  const row = t.ranking.find((r) => r.teamId === t.teamId);
  // Counted from the matches: VolleyAdmin2 leaves the win/loss counters at 0 for youth series.
  const count = (o) => played.filter((m) => outcome(m) === o).length;
  const [w, g, l] = [count('W'), count('G'), count('V')];
  const record = g ? `${w}–${g}–${l}` : `${w}–${l}`;
  let sw = 0, sl = 0;
  for (const m of played) { sw += m.usHome ? m.result.home : m.result.away; sl += m.usHome ? m.result.away : m.result.home; }
  if (row) { sw = row.setsWon; sl = row.setsLost; }
  return `
    <section class="card" aria-labelledby="cijfers">
      <h2 id="cijfers" class="section-title" style="margin-bottom:14px">Seizoen in cijfers</h2>
      <div class="stat-grid">
        <div class="stat"><b>${record}</b><span>${g ? 'W – G – V' : 'W – V'}</span></div>
        <div class="stat"><b>${sw}–${sl}</b><span>Sets</span></div>
        <div class="stat"><b>${row ? row.points : '—'}</b><span>${row ? `Punten · ${row.pos}e` : 'Punten'}</span></div>
      </div>
    </section>`;
}

// Subscribe links: webcal:// for Apple and Outlook, Google via its "add by URL" page, or copy the https link.
function calendarCard(path, title, intro, trackName, trackLabel) {
  if (!path) return '';
  const url = new URL(path, location.href.split('#')[0]).href;
  const webcal = url.replace(/^https?:/, 'webcal:');
  return `
    <section class="card cal-card" aria-labelledby="agenda">
      <h2 id="agenda" class="section-title">${esc(title)}</h2>
      <span class="muted">${esc(intro)}</span>
      <div class="cal-actions">
        <a class="btn" href="${esc(webcal)}" data-track="agenda-apple-${trackName}" data-track-title="Agenda Apple/Outlook: ${esc(trackLabel)}">Apple / Outlook</a>
        <a class="btn" href="https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcal)}" target="_blank" rel="noopener" data-track="agenda-google-${trackName}" data-track-title="Agenda Google: ${esc(trackLabel)}">Google Agenda<span class="sr-only"> (opent in een nieuw venster)</span></a>
        <button type="button" class="btn btn-ghost" data-copy="${esc(url)}" data-track="agenda-kopieer-${trackName}" data-track-title="Agenda link gekopieerd: ${esc(trackLabel)}">Kopieer link</button>
      </div>
    </section>`;
}

function bickyCard(t, played) {
  if (t.bickyBelow == null) return '';
  const count = played.reduce((n, m) => n + m.sets.filter((s) => bicky(t, m, s)).length, 0);
  return `
    <section class="card bicky-card" aria-labelledby="bicky">
      <div class="bicky-icon">${burger(t)}</div>
      <h2 id="bicky" class="section-title">Bicky-sets</h2>
      <b class="bicky-count">${count}</b>
    </section>`;
}

function rankingTable(t) {
  // Without win/loss counters in the feed (youth series) the column would only show 0–0.
  const showRecord = t.ranking.some((r) => r.won + r.lost > 0);
  return `
      <div class="table-box">
        <table>
          <thead><tr><th scope="col">#</th><th scope="col">Ploeg</th><th scope="col" class="num">M</th>${showRecord ? '<th scope="col" class="num">W–V</th>' : ''}<th scope="col" class="num">Sets</th><th scope="col" class="num">Ptn</th></tr></thead>
          <tbody>${t.ranking.map((r) => `
            <tr${r.teamId === t.teamId ? ' class="us"' : ''}>
              <td>${r.pos}</td><td>${esc(r.name)}</td><td class="num">${r.played}</td>${showRecord ? `<td class="num">${r.won}–${r.lost}</td>` : ''}
              <td class="num">${r.setsWon}–${r.setsLost}</td><td class="num pts">${r.points}</td>
            </tr>`).join('')}</tbody>
        </table>
      </div>`;
}

function rankingCard(t) {
  if (!t.ranking.length) return '';
  return `
    <section class="card" aria-labelledby="klassement">
      <div class="section-head"><h2 id="klassement" class="section-title">Klassement</h2><span class="muted" style="font-size:14px">${esc(t.division)}</span></div>
      ${rankingTable(t)}
    </section>`;
}

function renderTeam(t) {
  const played = t.matches.filter((m) => m.result);
  const upcoming = t.matches.filter((m) => !m.result && m.date >= today);
  const open = t.matches.filter((m) => !m.result && m.date < today);
  const last = played.at(-1);
  const next = upcoming[0];
  const hasRanking = t.ranking.length > 0;
  if (!state.tab || (state.tab === 'klassement' && !hasRanking)) state.tab = played.length ? 'uitslagen' : 'kalender';
  const list = state.tab === 'uitslagen' ? [...played, ...open].sort((a, b) => b.date.localeCompare(a.date)) : upcoming;
  document.title = `${t.label} — Davoz Zwevegem`;
  const rank = t.ranking.find((r) => r.teamId === t.teamId)?.pos;

  return `
    <div class="page-head">
      <div>
        <h1>${esc(t.label)}</h1>
        <span class="muted">${esc(t.division)}${rank ? ` · ${rank}e` : ''}</span>
      </div>
      ${starButton(t)}
    </div>
    <div class="layout">
      <div class="col-main">
        ${last ? scoreboard(t, last, { title: 'Laatste uitslag', link: true }) : ''}
        ${next ? `
          <section class="card next" aria-label="Volgende match">
            <span class="tag">Volgende match</span>
            <div class="next-body">
              <strong>${esc(next.home)} – ${esc(next.away)}</strong>
              <span class="muted">${esc(dateLong(next.date))}${next.time ? ' · ' + esc(next.time) : ''}</span>
              ${next.hall ? `<span class="muted">${esc(next.hall)}${fullAddress(next) ? ' · ' + esc(fullAddress(next)) : ''}</span>` : ''}
              ${routeLink(next)}
            </div>
          </section>` : ''}
        <section aria-label="Wedstrijden">
          <div class="seg team-seg" role="group" aria-label="Toon">
            <button type="button" data-tab="uitslagen" aria-pressed="${state.tab === 'uitslagen'}">Uitslagen <span class="tab-count">${played.length + open.length}</span></button>
            <button type="button" data-tab="kalender" aria-pressed="${state.tab === 'kalender'}">Kalender <span class="tab-count">${upcoming.length}</span></button>
            ${hasRanking ? `<button type="button" data-tab="klassement" aria-pressed="${state.tab === 'klassement'}">Klassement</button>` : ''}
          </div>
          ${state.tab === 'klassement' ? `
          <div class="ranking-panel" aria-label="Klassement ${esc(t.division)}">
            ${rankingTable(t)}
          </div>` : `
          <div class="match-list">
            ${list.length ? list.map((m) => matchRow(t, m)).join('') : `<p class="empty">${state.tab === 'uitslagen' ? 'Nog geen gespeelde wedstrijden.' : 'Geen wedstrijden meer gepland.'}</p>`}
          </div>`}
        </section>
      </div>
      <aside class="col-side">
        ${statsCard(t, played)}
        ${bickyCard(t, played)}
        ${calendarCard(t.calendar, 'In je agenda', `Alle matchen van ${t.label} in je gsm-agenda, met sporthal en adres. Verplaatste matchen passen zich vanzelf aan.`, slug(t.label), t.label)}
      </aside>
    </div>`;
}

// ---- Teams list and favourites --------------------------------------------------------

function renderPloegen() {
  document.title = 'Ploegen — Davoz Zwevegem';
  const groupOf = (t) => (t.cup ? 'Beker' : t.group ?? 'Overige ploegen');
  const groups = ['Seniors', 'Jeugd', 'Overige ploegen', 'Beker'];
  const row = (t) => {
    const rank = t.ranking.find((r) => r.teamId === t.teamId)?.pos;
    const last = t.matches.filter((m) => m.result).at(-1);
    return `
      <div class="team-row">
        <a class="team-link" href="${teamHref(t)}">
          <span><strong>${esc(t.label)}</strong><span class="muted">${esc(t.division)}${rank ? ` · ${rank}e` : ''}</span></span>
          ${last ? `<span class="team-last"><span class="sr-only">Laatste uitslag </span>${last.result.home}–${last.result.away}${badge(last)}</span>` : ''}
        </a>
        ${starButton(t)}
      </div>`;
  };
  return `
    <div class="page-head"><div><h1>Ploegen</h1><span class="muted">Tik op de ster om een ploeg bij Mijn ploeg te zetten.</span></div></div>
    <div class="team-groups">${groups.map((g) => {
      const list = state.data.teams.filter((t) => groupOf(t) === g);
      return list.length ? `
        <section aria-labelledby="groep-${slug(g)}">
          <h2 class="group-title" id="groep-${slug(g)}">${esc(g)}</h2>
          <div class="team-list">${list.map(row).join('')}</div>
        </section>` : '';
    }).join('')}</div>`;
}

// "Mijn ploeg": the team page of a favourite, with a switcher when there are several.
function mijnTeam() {
  const favs = favTeams();
  return favs.find((t) => t.key === state.mijnKey) ?? favs[0] ?? null;
}

function renderMijn(t) {
  if (!t) {
    document.title = 'Mijn ploeg — Davoz Zwevegem';
    return `
      <section class="empty-state">
        <h1>Mijn ploeg</h1>
        <p class="muted" style="margin:0">Kies de ploegen die je volgt. Hun uitslagen, volgende match en klassement staan dan hier, en bovenaan de weekendpagina.</p>
        <a class="btn" href="#/ploegen">Kies je ploeg</a>
      </section>`;
  }
  const favs = favTeams();
  const switcher = favs.length > 1 ? `
    <div class="seg fav-switch" role="group" aria-label="Kies een van je ploegen">
      ${favs.map((f) => `<button type="button" data-mijn="${esc(f.key)}" aria-pressed="${f.key === t.key}">${esc(f.label)}</button>`).join('')}
    </div>` : '';
  return installCard() + switcher + renderTeam(t);
}

// Top of the weekend page: this weekend's matches of the favourite teams.
function favCard(items, title) {
  const favs = favTeams();
  if (!favs.length) return '';
  const list = items.filter((x) => isFav(x.t)).sort((a, b) => a.m.date.localeCompare(b.m.date) || (a.m.time ?? '').localeCompare(b.m.time ?? ''));
  const rows = list.map(({ t, m }) => {
    const opp = m.usHome ? `tegen ${m.away}` : `bij ${m.home}`;
    const right = m.result
      ? `<a class="fav-score" href="${matchHref(t, m)}" aria-label="Matchdetail ${esc(m.home)} – ${esc(m.away)}">${m.result.home}–${m.result.away}${badge(m)}</a>`
      : m.postponed ? '<span class="meta">Uitgesteld</span>' : '';
    return `
      <div class="fav-match">
        <div class="fav-when"><small>${esc(capital(dayShort(m.date)))}</small>${esc(m.time ?? '–')}</div>
        <div class="fav-body">
          <span><a class="fav-team" href="${teamHref(t)}">${esc(t.label)}</a> ${esc(opp)}</span>
          <span class="meta">${m.usHome ? 'Thuis' : 'Uit'}${m.hall ? ' · ' + esc(m.hall) : ''}</span>
          ${!m.result && !started(m) ? routeLink(m).replace('Route in Google Maps', 'Route') : ''}
        </div>
        ${right}
      </div>`;
  }).join('');
  const who = favs.length === 1 ? favs[0].label : 'Jouw ploegen';
  return `
    <section class="fav-card" aria-labelledby="fav-title">
      <h2 id="fav-title"><span>${STAR}${esc(who)}</span><span>${list.length ? plural(list.length, 'match', 'matchen') : ''}</span></h2>
      ${rows || `<p class="fav-empty">${favs.length === 1 ? `${esc(favs[0].label)} speelt` : 'Jouw ploegen spelen'} ${title.toLowerCase()} niet.</p>`}
    </section>`;
}

// All meetings with this opponent in the same series: normally a first and a return leg,
// youth series sometimes play each other more often.
function meetingsCard(t, m) {
  if (!m.opponentId) return '';
  const all = t.matches.filter((x) => x.opponentId === m.opponentId);
  if (all.length < 2) return '';
  const label = (i) => all.length === 2 ? ['Heenmatch', 'Terugmatch'][i] : `${i + 1}e duel`;
  const rows = all.map((x, i) => {
    const current = x.nr === m.nr;
    const right = x.result
      ? `<b class="h2h-score">${x.result.home}–${x.result.away}</b>${badge(x)}`
      : `<span class="muted">${x.date < today ? 'Uitslag volgt' : 'Nog te spelen'}</span>`;
    const sets = x.sets.length ? `<span class="muted h2h-sets">${x.sets.map(([h, a]) => `${h}–${a}`).join(' · ')}</span>` : '';
    const body = `
      <div class="h2h-when">
        <span class="h2h-label">${label(i)}${current ? ' <span class="h2h-now">Deze match</span>' : ''}</span>
        <span class="muted">${esc(capital(dayShort(x.date)))} ${esc(dayMonth(x.date))} · <span class="venue${x.usHome ? ' home' : ''}">${x.usHome ? 'Thuis' : 'Uit'}</span></span>
      </div>
      <div class="h2h-teams">${name(x, 'home')}${name(x, 'away')}${sets}</div>
      <div class="h2h-right">${right}</div>`;
    return current
      ? `<div class="h2h-row is-current" aria-current="true">${body}</div>`
      : `<a class="h2h-row" href="${matchHref(t, x)}">${body}</a>`;
  }).join('');
  return `
    <section class="card" aria-labelledby="h2h">
      <h2 id="h2h" class="section-title" style="margin-bottom:12px">${all.length === 2 ? 'Heen- en terugmatch' : 'Onderlinge duels'}</h2>
      <div class="h2h-list">${rows}</div>
    </section>`;
}

function renderMatch(t, m) {
  const total = m.sets.reduce((acc, [h, a]) => [acc[0] + h, acc[1] + a], [0, 0]);
  const header = m.result
    ? scoreboard(t, m, { title: t.label, link: false })
    : `<section class="scoreboard" aria-label="Wedstrijd">
        <div class="eyebrow"><h2>${esc(t.label)} · ${esc(t.division)}</h2><span>${esc(dateLong(m.date))}${m.time ? ' · ' + esc(m.time) : ''}</span></div>
        <div class="score-row"><div class="team">${esc(m.home)}</div><div class="score"><span class="dash">vs</span></div><div class="team away">${esc(m.away)}</div></div>
      </section>`;
  document.title = `${m.home} – ${m.away}`;

  return `
    <a class="back" href="${teamHref(t)}">← Terug naar ${esc(t.label)}</a>
    <div class="layout" style="margin-top:8px">
      <div class="col-main">
        ${header}
        ${m.sets.length ? `
          <section class="card" aria-labelledby="sets">
            <h2 id="sets" class="section-title" style="margin-bottom:16px">Set per set</h2>
            <div class="set-bars">${m.sets.map(([h, a], i) => `
              <div>
                <div class="set-bar-head"><span>Set ${i + 1}</span><b>${h}–${a}${bicky(t, m, [h, a]) ? burger(t) : ''}</b></div>
                <div class="set-bar" role="img" aria-label="Set ${i + 1}: ${h} tegen ${a}"><span class="${m.usHome ? 'us' : 'them'}" style="flex:${h}"></span><span class="${m.usHome ? 'them' : 'us'}" style="flex:${a}"></span></div>
              </div>`).join('')}
            </div>
            <div class="legend"><span><i class="us"></i>${esc(t.teamName)}</span><span><i class="them"></i>${esc(m.usHome ? m.away : m.home)}</span></div>
            <div class="table-box" style="margin-top:16px">
              <table>
                <thead><tr><th scope="col">Ploeg</th>${m.sets.map((_, i) => `<th scope="col" class="num">S${i + 1}</th>`).join('')}<th scope="col" class="num">Punten</th><th scope="col" class="num">Sets</th></tr></thead>
                <tbody>
                  <tr><td>${esc(m.home)}</td>${m.sets.map(([h, a]) => `<td class="num"${h > a ? ' style="font-weight:700"' : ''}>${h}</td>`).join('')}<td class="num">${total[0]}</td><td class="num pts">${m.result.home}</td></tr>
                  <tr><td>${esc(m.away)}</td>${m.sets.map(([h, a]) => `<td class="num"${a > h ? ' style="font-weight:700"' : ''}>${a}</td>`).join('')}<td class="num">${total[1]}</td><td class="num pts">${m.result.away}</td></tr>
                </tbody>
              </table>
            </div>
          </section>` : ''}
        ${meetingsCard(t, m)}
      </div>
      <aside class="col-side">
        <section class="card" aria-labelledby="info">
          <h2 id="info" class="section-title" style="margin-bottom:12px">Matchinfo</h2>
          <dl class="info">
            <dt>Datum</dt><dd>${esc(dateLong(m.date))}</dd>
            ${m.time ? `<dt>Aanvang</dt><dd>${esc(m.time)}</dd>` : ''}
            ${m.hall ? `<dt>Sporthal</dt><dd class="hall">${esc(m.hall)}
              ${fullAddress(m) ? `<span>${esc(m.address.street)}<br>${esc(m.address.city)}</span>` : ''}
              ${m.address?.note ? `<span class="muted">${esc(m.address.note)}</span>` : ''}
              ${routeLink(m)}</dd>` : ''}
            <dt>Reeks</dt><dd>${esc(t.division)}</dd>
            <dt>Wedstrijdnr.</dt><dd>${esc(m.nr)}</dd>
            ${m.forfait ? `<dt>Forfait</dt><dd>${esc(m.forfait)}</dd>` : ''}
            ${m.postponed ? '<dt>Status</dt><dd>Uitgesteld</dd>' : ''}
          </dl>
        </section>
        ${rankingCard(t)}
      </aside>
    </div>`;
}

// ---- Club weekend overview -------------------------------------------------------------

const addDays = (iso, n) => { const d = new Date(`${iso}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const capital = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const listNames = (xs) => xs.length > 1 ? `${xs.slice(0, -1).join(', ')} en ${xs.at(-1)}` : xs[0];
const nowTime = () => new Intl.DateTimeFormat('nl-BE', { timeZone: 'Europe/Brussels', hour: '2-digit', minute: '2-digit' }).format(new Date());
const dayTitle = (iso) => capital(fmt(iso, { weekday: 'long', day: 'numeric', month: 'long' }));

// A weekend runs Friday to Sunday; from Monday on, "this weekend" is the coming one.
function weekendDays(which) {
  const dow = new Date(`${today}T12:00:00Z`).getUTCDay();
  const friday = addDays(today, (dow === 0 ? -2 : 5 - dow) + (which === 'volgend' ? 7 : 0));
  return [friday, addDays(friday, 1), addDays(friday, 2)];
}

function rangeLabel(from, to) {
  const month = (iso) => fmt(iso, { month: 'long' });
  const [a, b] = [asDate(from), asDate(to)];
  const start = `${capital(dayShort(from))} ${a.getDate()}${month(from) !== month(to) ? ' ' + month(from) : ''}`;
  return `${start} – ${dayShort(to)} ${b.getDate()} ${month(to)} ${b.getFullYear()}`;
}

// Rough end of the day's last match, for bar and welcome desk planning.
const endEstimate = (time) => {
  const [h, m] = time.split(':').map(Number);
  const end = h * 60 + m + 150;
  return `${String(Math.floor(end / 60) % 24).padStart(2, '0')}:${String(end % 60).padStart(2, '0')}`;
};

const started = (m) => m.date < today || (m.date === today && !!m.time && m.time <= nowTime());

function weekendCard({ t, m }) {
  const rank = t.ranking.find((r) => r.teamId === t.teamId)?.pos;
  const sets = m.sets.map((s) => `<span class="chip${setWon(m, s) ? ' won' : ''}">${s[0]}–${s[1]}${bicky(t, m, s) ? burger(t) : ''}</span>`).join('');
  const right = resultCell(t, m);
  const hall = !m.result && !started(m) && m.hall
    ? `<div class="wk-hall"><span class="muted">${esc(m.hall)}${m.address?.street ? ' · ' + esc(m.address.street) : ''}</span>${routeLink(m).replace('Route in Google Maps', 'Route')}</div>`
    : '';
  return `
    <article class="wk-match">
      <div class="wk-body">
        <div class="wk-head">
          <a class="wk-team" href="${teamHref(t)}">${esc(t.label)}</a>
          <span class="venue${m.usHome ? ' home' : ''}">${m.usHome ? 'Thuis' : 'Uit'}</span>
          <span class="muted wk-division">${esc(t.division)}${rank ? ` · ${rank}e` : ''}</span>
        </div>
        <div class="wk-teams">${name(m, 'home')} <span class="muted">–</span> ${name(m, 'away')}</div>
        ${sets ? `<div class="chips">${sets}</div>` : ''}
        ${hall}
      </div>
      ${right ? `<div class="wk-right">${right}</div>` : ''}
    </article>`;
}

const resultCell = (t, m) => {
  if (m.result) return `<a class="wk-score" href="${matchHref(t, m)}" aria-label="Matchdetail ${esc(m.home)} – ${esc(m.away)}"><b>${m.result.home}–${m.result.away}</b>${badge(m)}</a>`;
  if (m.postponed) return '<span class="wk-pending">Uitgesteld</span>';
  if (started(m)) return '<span class="wk-pending">Uitslag volgt</span>';
  return '';
};

// One day's home matches in one hall: the address and route once, then a compact row per match.
function hallGroup(hall, list) {
  const m = list[0].m;
  const [town, ...rest] = (hall ?? '').split(',');
  const timed = list.filter((x) => x.m.time);
  const span = timed.length ? ` · ${timed[0].m.time} tot ±${endEstimate(timed.at(-1).m.time)}` : '';
  const rows = list.map(({ t, m: x }) => {
    const sets = x.sets.map((s) => `<span class="chip${setWon(x, s) ? ' won' : ''}">${s[0]}–${s[1]}${bicky(t, x, s) ? burger(t) : ''}</span>`).join('');
    const right = resultCell(t, x);
    return `
      <div class="wk-row">
        <span class="wk-time">${esc(x.time ?? '–')}</span>
        <div class="wk-row-body">
          <a class="wk-team" href="${teamHref(t)}">${esc(t.label)}</a>
          <span class="wk-teams">${name(x, 'home')} – ${name(x, 'away')}</span>
          ${sets ? `<div class="chips">${sets}</div>` : ''}
        </div>
        <div class="wk-right">${right}</div>
      </div>`;
  }).join('');
  return `
    <section class="wk-hall-group" aria-label="Thuis in ${esc(hall ?? 'onbekende sporthal')}">
      <div class="wk-hall-head">
        <div>
          <strong>Thuis · ${esc(rest.join(',').trim() || hall || 'sporthal onbekend')}</strong>
          <span class="muted">${esc(fullAddress(m) ?? town)}${esc(span)}</span>
        </div>
        ${routeLink(m).replace('Route in Google Maps', 'Route')}
      </div>
      ${rows}
    </section>`;
}

function renderWeekend() {
  const days = weekendDays(state.week);
  const items = state.data.teams.flatMap((t) => t.matches.filter((m) => days.includes(m.date)).map((m) => ({ t, m })));
  const byTime = (a, b) => (a.m.time ?? '').localeCompare(b.m.time ?? '') || a.t.order - b.t.order;
  // Friday only shows up when somebody plays then.
  const shownDays = days.filter((d, i) => i > 0 || items.some((x) => x.m.date === d));
  const title = state.week === 'dit' ? 'Dit weekend' : 'Volgend weekend';
  document.title = `${title} — Davoz Zwevegem`;

  const dayBlocks = shownDays.map((d) => {
    const list = items.filter((x) => x.m.date === d).sort(byTime);
    const homeList = list.filter((x) => x.m.usHome);
    const awayList = list.filter((x) => !x.m.usHome);
    const halls = [...new Set(homeList.map((x) => x.m.hall))];
    const awayTimes = [...new Set(awayList.map((x) => x.m.time ?? '–'))];
    const away = awayList.length ? `
      ${homeList.length ? '<h3 class="wk-away-title">Op verplaatsing</h3>' : ''}
      ${awayTimes.map((time) => `
        <div class="wk-slot">
          <div class="wk-time">${esc(time)}</div>
          <div class="wk-slot-matches">${awayList.filter((x) => (x.m.time ?? '–') === time).map(weekendCard).join('')}</div>
        </div>`).join('')}` : '';
    return `
      <section class="wk-day" aria-labelledby="dag-${d}">
        <h2 class="wk-day-title" id="dag-${d}">${esc(dayTitle(d))}${list.length ? ` <span>${plural(list.length, 'wedstrijd', 'wedstrijden')}</span>` : ''}</h2>
        ${list.length ? halls.map((h) => hallGroup(h, homeList.filter((x) => x.m.hall === h))).join('') + away : '<p class="wk-empty">Geen wedstrijden.</p>'}
      </section>`;
  }).join('');

  // Results once the weekend is under way, otherwise the programme.
  const home = items.filter((x) => x.m.usHome);
  const count = (o) => items.filter((x) => outcome(x.m) === o).length;
  const todo = items.filter((x) => !x.m.result && !x.m.postponed);
  const stats = items.some((x) => x.m.result || started(x.m))
    ? [['Gewonnen', count('W')], ...(count('G') ? [['Gelijk', count('G')]] : []), ['Verloren', count('V')],
      ...(todo.length ? [[todo.some((x) => !started(x.m)) ? 'Nog te spelen' : 'Uitslag volgt', todo.length]] : [])]
    : [['Matchen', items.length], ['Thuis', home.length], ['Uit', items.length - home.length]];

  const leaders = [...new Set(items.filter((x) => x.t.ranking.find((r) => r.teamId === x.t.teamId)?.pos === 1).map((x) => x.t.label))];
  const bickies = items.flatMap((x) => x.m.sets.filter((s) => bicky(x.t, x.m, s)).map(() => x.t.label));
  const summary = items.length ? [
    `${plural(items.length, 'match', 'matchen')}: ${!home.length ? 'allemaal op verplaatsing' : home.length === items.length ? 'allemaal thuis' : `${home.length} thuis en ${items.length - home.length} op verplaatsing`}.`,
    leaders.length ? `${listNames(leaders)} ${leaders.length === 1 ? 'staat' : 'staan'} op kop.` : '',
    bickies.length ? `${plural(bickies.length, 'Bicky-set', 'Bicky-sets')} voor ${listNames([...new Set(bickies)])}!` : ''
  ].filter(Boolean).join(' ') : 'Geen wedstrijden dit weekend.';

  const noHome = items.length && !home.length ? `
    <section class="card wk-home" aria-labelledby="geen-thuis">
      <h2 class="section-title" id="geen-thuis">Geen thuismatchen</h2>
      <span class="muted">Alle ploegen spelen op verplaatsing. Supporters zijn overal welkom.</span>
    </section>` : '';

  return `
    <section class="wk-intro">
      <div>
        <span class="wk-range">${esc(rangeLabel(shownDays[0], days[2]))}</span>
        <h1 class="wk-title">${title} bij Davoz</h1>
      </div>
      <div class="seg" role="group" aria-label="Kies een weekend">
        <button type="button" data-week="dit" aria-pressed="${state.week === 'dit'}">Dit weekend</button>
        <button type="button" data-week="volgend" aria-pressed="${state.week === 'volgend'}">Volgend weekend</button>
      </div>
    </section>
    ${favCard(items, title)}
    ${installCard()}
    <div class="layout">
      <div class="col-main wk-days">${dayBlocks}</div>
      <aside class="col-side">
        <section class="wk-stats" aria-labelledby="wk-cijfers">
          <h2 id="wk-cijfers">${title} in cijfers</h2>
          <div class="wk-stat-grid">${stats.map(([label, value]) => `<div><b>${value}</b><span>${esc(label)}</span></div>`).join('')}</div>
          <p>${esc(summary)}</p>
        </section>
        ${noHome}
        ${calendarCard(state.data.calendar, 'Altijd op de hoogte', 'Alle matchen van de club in je gsm-agenda. Wil je alleen je eigen ploeg? Open ze via Ploegen.', 'club', 'hele club')}
      </aside>
    </div>`;
}

// ---- Season fun facts ("weetjes") -------------------------------------------------------

const dayLong = (iso) => fmt(iso, { day: 'numeric', month: 'long' });
const thousands = (n) => n.toLocaleString('nl-BE');
const ourPts = (m, [h, a]) => (m.usHome ? h : a);
const theirPts = (m, [h, a]) => (m.usHome ? a : h);
// A tiebreak is a fifth set played to 15; youth series play a fifth set to 25 as a normal set.
const isTiebreak = (i, [h, a]) => i === 4 && Math.max(h, a) < 25;

function teamStats(t) {
  const played = t.matches.filter((m) => m.result && m.sets.length);
  const s = {
    team: t, played: played.length, won: 0, setsWon: 0, setsLost: 0, ptsFor: 0, ptsAgainst: 0,
    bicky: 0, tiebreaks: 0, tiebreaksWon: 0, biggest: null, streak: 0, streakFrom: null, streakTo: null, longestSet: null, winRun: 0
  };
  let run = 0, runFrom = null, winRun = 0;
  for (const m of played) {
    let pf = 0, pa = 0, sw = 0;
    m.sets.forEach((set, i) => {
      const w = setWon(m, set);
      w ? s.setsWon++ : s.setsLost++;
      if (w) sw++;
      pf += ourPts(m, set); pa += theirPts(m, set);
      if (bicky(t, m, set)) s.bicky++;
      if (isTiebreak(i, set)) { s.tiebreaks++; if (w) s.tiebreaksWon++; }
      if (w) {
        if (!run) runFrom = m.date;
        run++;
        if (run > s.streak) { s.streak = run; s.streakFrom = runFrom; s.streakTo = m.date; }
      } else run = 0;
      if (!s.longestSet || set[0] + set[1] > s.longestSet.total) s.longestSet = { total: set[0] + set[1], set, m };
    });
    s.ptsFor += pf; s.ptsAgainst += pa;
    if (outcome(m) === 'W') {
      s.won++;
      winRun++; s.winRun = Math.max(s.winRun, winRun);
      // Measured per set, so 3-, 4- and 5-set formats compare fairly.
      const perSet = (pf - pa) / m.sets.length;
      if (!s.biggest || perSet > s.biggest.perSet || (perSet === s.biggest.perSet && pf - pa > s.biggest.diff)) s.biggest = { m, perSet, diff: pf - pa, pf, pa };
    } else winRun = 0;
  }
  return s;
}

const perSetLabel = (x) => x.toLocaleString('nl-BE', { maximumFractionDigits: 1 });
const matchLine = (m) => `${m.usHome ? 'Thuis tegen' : 'Bij'} ${m.usHome ? m.away : m.home} · ${dayLong(m.date)}`;
const streakRange = (s) => s.streakFrom === s.streakTo ? dayLong(s.streakFrom) : `${dayLong(s.streakFrom)} – ${dayLong(s.streakTo)}`;
const setChips = (m) => m.sets.map((set) => `<span class="ft-set">${set[0]}–${set[1]}</span>`).join('');

function factCard({ dark, title, value, unit, who, sub, body, note, id }) {
  return `
    <section class="ft-card${dark ? ' dark' : ''}" aria-labelledby="${id}">
      <h2 id="${id}" class="ft-eyebrow">${esc(title)}</h2>
      <div class="ft-value"><b>${esc(value)}</b>${unit ? `<span>${esc(unit)}</span>` : ''}</div>
      ${who ? `<div class="ft-who"><strong>${esc(who)}</strong>${sub ? `<span>${esc(sub)}</span>` : ''}</div>` : ''}
      ${body ?? ''}
      ${note ? `<span class="ft-note">${esc(note)}</span>` : ''}
    </section>`;
}

function renderWeetjes() {
  const all = state.data.teams.map(teamStats).filter((s) => s.played);
  const teamKey = state.weetjesTeam && all.some((s) => s.team.key === state.weetjesTeam) ? state.weetjesTeam : all[0]?.team.key;
  const perTeam = state.weetjesMode === 'team' && teamKey;
  const sel = perTeam ? all.find((s) => s.team.key === teamKey) : null;
  document.title = `Seizoensweetjes — Davoz Zwevegem`;
  if (!all.length) return '<p class="empty">Nog geen gespeelde wedstrijden dit seizoen.</p>';

  const byBig = all.filter((s) => s.biggest).sort((a, b) => b.biggest.perSet - a.biggest.perSet || b.biggest.diff - a.biggest.diff);
  const byStreak = all.filter((s) => s.streak).sort((a, b) => b.streak - a.streak);
  const byBicky = all.filter((s) => s.bicky).sort((a, b) => b.bicky - a.bicky || a.team.order - b.team.order);
  const totalBicky = all.reduce((n, s) => n + s.bicky, 0);
  const lastPlayed = all.flatMap((s) => s.team.matches.filter((m) => m.result)).map((m) => m.date).sort().at(-1);
  const rankOf = (list, s) => list.indexOf(s) + 1;
  const runnersUp = (list, fmtOne) => list.slice(1, 3).map(fmtOne).join(' en ');

  // Card 1: biggest win
  const bigS = perTeam ? sel : byBig[0];
  const big = bigS?.biggest;
  const bigCard = big ? factCard({
    dark: true, id: 'ft-big', title: 'Grootste overwinning',
    value: `${big.m.result.home}–${big.m.result.away}`, unit: `${big.pf}–${big.pa}`,
    who: bigS.team.label, sub: matchLine(big.m),
    body: `<div class="ft-sets">${setChips(big.m)}</div>`,
    note: perTeam
      ? `Gemiddeld ${perSetLabel(big.perSet)} punten verschil per set${rankOf(byBig, bigS) === 1 ? ' · clubrecord' : ''}.`
      : `Gemiddeld ${perSetLabel(big.perSet)} punten verschil per set.${byBig.length > 1 ? ` Daarna: ${runnersUp(byBig, (s) => `${s.team.label} (+${perSetLabel(s.biggest.perSet)})`)}.` : ''}`
  }) : factCard({ dark: true, id: 'ft-big', title: 'Grootste overwinning', value: '—', who: 'Nog geen overwinning', sub: 'De eerste komt er zeker aan.' });

  // Card 2: longest run of won sets
  const strS = perTeam ? sel : byStreak[0];
  const streakCard = strS?.streak ? factCard({
    id: 'ft-streak', title: 'Langste reeks gewonnen sets', value: String(strS.streak), unit: strS.streak === 1 ? 'set' : 'sets op rij',
    who: strS.team.label, sub: streakRange(strS),
    body: `<div class="ft-dots" role="img" aria-label="${strS.streak} gewonnen sets op rij">${'<span></span>'.repeat(Math.min(strS.streak, 30))}</div>`,
    note: perTeam
      ? (rankOf(byStreak, strS) === 1 ? 'Clubrecord dit seizoen.' : `${rankOf(byStreak, strS)}e van de club.`)
      : (byStreak.length > 1 ? `Daarna: ${runnersUp(byStreak, (s) => `${s.team.label} (${s.streak} op rij)`)}.` : '')
  }) : factCard({ id: 'ft-streak', title: 'Langste reeks gewonnen sets', value: '0', who: 'Nog geen set gewonnen', sub: 'Elke reeks begint met één set.' });

  // Card 3: Bicky sets
  const bickyNote = `Bicky-set: gewonnen set waarin de tegenstander onder de ${state.data.teams.find((t) => t.bickyBelow != null)?.bickyBelow ?? 10} punten blijft.`;
  const bickyCount = perTeam ? sel.bicky : totalBicky;
  const bickyWho = perTeam
    ? (sel.bicky ? (rankOf(byBicky, sel) === 1 ? 'Meeste van de club' : `${rankOf(byBicky, sel)}e van de club`) : 'Nog geen Bicky-set')
    : (byBicky.length ? `Bicky-koninginnen: ${byBicky[0].team.label}` : 'Nog geen Bicky-set');
  const bickySub = perTeam
    ? `${plural(totalBicky, 'Bicky-set', 'Bicky-sets')} voor de hele club`
    : (byBicky.length ? `${byBicky[0].bicky} van de ${totalBicky} Bicky-sets van de club` : '');
  const bickyCard = factCard({
    id: 'ft-bicky', title: 'Bicky-sets', value: String(bickyCount),
    body: `<div class="ft-bicky-icon">${burger({ bickyBelow: state.data.teams[0]?.bickyBelow ?? 10 })}</div>`,
    who: bickyWho, sub: bickySub, note: bickyNote
  });

  // Bicky leaderboard: one series, so one colour; the selected (or leading) team in the accent.
  const highlight = perTeam ? sel.team.key : byBicky[0]?.team.key;
  const max = byBicky[0]?.bicky ?? 1;
  const board = byBicky.length ? `
    <section class="card ft-board" aria-labelledby="ft-board">
      <div class="section-head"><h2 id="ft-board" class="section-title">Bicky-klassement</h2><span class="muted" style="font-size:14px">${plural(totalBicky, 'Bicky-set', 'Bicky-sets')} voor de hele club</span></div>
      <table class="ft-bars">
        <caption class="sr-only">Aantal Bicky-sets per ploeg</caption>
        <tbody>${byBicky.map((s) => `
          <tr${s.team.key === highlight ? ' class="hl"' : ''} title="${esc(s.team.label)}: ${s.bicky}">
            <th scope="row"><a href="${teamHref(s.team)}">${esc(s.team.label)}</a></th>
            <td class="ft-bar-cell"><span class="ft-bar" style="width:${Math.max(4, Math.round((s.bicky / max) * 100))}%"></span></td>
            <td class="num ft-bar-value">${s.bicky}</td>
          </tr>`).join('')}</tbody>
      </table>
      <span class="muted" style="font-size:14px">Ploegen zonder Bicky-set staan niet in het klassement.</span>
    </section>` : '';

  // Smaller facts
  const facts = [];
  if (perTeam) {
    const row = sel.team.ranking.find((r) => r.teamId === sel.team.teamId);
    facts.push({ value: `${sel.won} / ${sel.played}`, label: 'Matchen gewonnen', sub: sel.won === sel.played ? `Nog ongeslagen${row ? ` · ${row.pos}e in ${sel.team.division}` : ''}` : (row ? `${row.pos}e in ${sel.team.division}` : sel.team.division) });
    facts.push({ value: `${sel.setsWon}–${sel.setsLost}`, label: 'Sets', sub: sel.setsLost <= 2 ? `Slechts ${plural(sel.setsLost, 'set', 'sets')} verloren` : 'Gewonnen tegen verloren' });
    facts.push({ value: thousands(sel.ptsFor), label: 'Punten gescoord', sub: `${thousands(sel.ptsAgainst)} tegen` });
    if (sel.longestSet) facts.push({ value: `${sel.longestSet.set[0]}–${sel.longestSet.set[1]}`, label: 'Langste set', sub: `${sel.longestSet.m.usHome ? 'Tegen' : 'Bij'} ${sel.longestSet.m.usHome ? sel.longestSet.m.away : sel.longestSet.m.home}, ${dayLong(sel.longestSet.m.date)}` });
    if (sel.tiebreaks) facts.push({ value: `${sel.tiebreaksWon} / ${sel.tiebreaks}`, label: 'Tiebreaks gewonnen', sub: 'Vijfde set tot 15' });
  } else {
    const longest = all.filter((s) => s.longestSet).sort((a, b) => b.longestSet.total - a.longestSet.total)[0];
    if (longest) facts.push({ value: `${longest.longestSet.set[0]}–${longest.longestSet.set[1]}`, label: 'Langste set', sub: `${longest.team.label} ${longest.longestSet.m.usHome ? 'tegen' : 'bij'} ${longest.longestSet.m.usHome ? longest.longestSet.m.away : longest.longestSet.m.home}, ${dayLong(longest.longestSet.m.date)}` });
    const unbeaten = all.filter((s) => s.played >= 3 && s.won === s.played);
    if (unbeaten.length) facts.push({ value: unbeaten.length === 1 ? `${unbeaten[0].won} / ${unbeaten[0].played}` : String(unbeaten.length), label: 'Nog ongeslagen', sub: unbeaten.length === 1 ? `${unbeaten[0].team.label} won al haar matchen` : listNames(unbeaten.map((s) => s.team.label)) });
    else {
      const runner = [...all].sort((a, b) => b.winRun - a.winRun)[0];
      if (runner?.winRun > 1) facts.push({ value: String(runner.winRun), label: 'Langste winstreeks', sub: `${runner.team.label}, matchen op rij gewonnen` });
    }
    const tb = all.reduce((n, s) => n + s.tiebreaks, 0), tbw = all.reduce((n, s) => n + s.tiebreaksWon, 0);
    if (tb) facts.push({ value: `${tbw} / ${tb}`, label: 'Tiebreaks gewonnen', sub: tbw * 2 < tb ? 'De vijfde set blijft een werkpunt' : 'Sterk in de vijfde set' });
    facts.push({ value: thousands(all.reduce((n, s) => n + s.ptsFor, 0)), label: 'Punten gescoord', sub: `Alle ploegen samen, in ${all.reduce((n, s) => n + s.setsWon, 0)} gewonnen sets` });
  }

  return `
    <section class="wk-intro">
      <div>
        <span class="wk-range">Seizoen tot en met ${esc(dayLong(lastPlayed))}</span>
        <h1 class="wk-title">${perTeam ? `${esc(sel.team.label)} in weetjes` : 'Seizoensweetjes'}</h1>
      </div>
      <div class="ft-controls">
        <div class="seg" role="group" aria-label="Toon weetjes van">
          <button type="button" data-ft-mode="club" aria-pressed="${!perTeam}">Hele club</button>
          <button type="button" data-ft-mode="team" aria-pressed="${!!perTeam}">Per ploeg</button>
        </div>
        ${perTeam ? `
          <label class="ft-select">Ploeg
            <select id="ft-team">${all.map((s) => `<option value="${esc(s.team.key)}"${s.team.key === teamKey ? ' selected' : ''}>${esc(s.team.label)}</option>`).join('')}</select>
          </label>` : ''}
      </div>
    </section>
    <div class="ft-cards">${bigCard}${streakCard}${bickyCard}</div>
    <div class="layout" style="margin-top:24px">
      <div class="col-main">${board}</div>
      <aside class="col-side">
        <section aria-labelledby="ft-more" class="ft-facts">
          <h2 id="ft-more" class="section-title">Nog meer weetjes</h2>
          ${facts.map((f) => `<div class="ft-fact"><b>${esc(f.value)}</b><div><strong>${esc(f.label)}</strong><span class="muted">${esc(f.sub)}</span></div></div>`).join('')}
        </section>
      </aside>
    </div>`;
}

// ---- Install hint ("Zet op beginscherm") ------------------------------------------------
// iOS never offers installation itself, so iPhone users get the steps; Android gets the real button.

// iPadOS reports itself as a Mac, but with touch.
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const HINT_KEY = 'davoz-installatie-tip';
const SHARE_ICON = '<svg class="ios-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12M7.5 7.5 12 3l4.5 4.5M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1"/></svg>';
const ADD_ICON = '<svg class="ios-icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="4"/><path d="M12 8.5v7M8.5 12h7"/></svg>';

function hintDismissed() {
  try {
    const v = localStorage.getItem(HINT_KEY);
    return v === 'nooit' || (v && Number(v) > Date.now());
  } catch { return false; }
}

let hintCounted = false;
// Shown in the browser only, once somebody follows a team: that is when a home screen icon pays off.
function installCard() {
  if (standalone || hintDismissed() || !favTeams().length) return '';
  if (!isIOS && !installPrompt) return '';
  if (!hintCounted) { hintCounted = true; trackEvent('installatie-tip-getoond', `Installatietip getoond (${isIOS ? 'iPhone/iPad' : 'Android'})`); }
  const favs = favTeams();
  const who = favs.length === 1 ? favs[0].label : 'jouw ploegen';
  return `
    <section class="install-card" aria-labelledby="install-title">
      <img class="install-icon" src="icons/icon-192.png" alt="" width="56" height="56">
      <div class="install-body">
        <h2 id="install-title">Zet Davoz op je beginscherm</h2>
        <p>Dan open je ${esc(who)} met één tik, ook zonder internet. Gratis, zonder App Store.</p>
        ${isIOS ? iosSteps() : '<button type="button" class="btn" data-install>Installeer app</button>'}
        <div class="install-actions">
          <button type="button" class="btn btn-ghost" data-hint="later">Niet nu</button>
          <button type="button" class="link-btn" data-hint="nooit">Niet meer tonen</button>
          ${isIOS ? '<a href="#/installeren">Meer uitleg</a>' : ''}
        </div>
      </div>
    </section>`;
}

const iosSteps = () => `
  <ol class="install-steps">
    <li>Tik op ${SHARE_ICON}<b>Deel</b>. Zie je die knop niet, tik dan eerst op <b>•••</b>.</li>
    <li>Kies ${ADD_ICON}<b>Zet op beginscherm</b>. Staat het er niet, scroll dan wat naar beneden.</li>
    <li>Tik op <b>Voeg toe</b>.</li>
  </ol>`;

// "Niet nu" hides the card for 30 days, "Niet meer tonen" for good.
function dismissHint(how) {
  try { localStorage.setItem(HINT_KEY, how === 'nooit' ? 'nooit' : String(Date.now() + 30 * 864e5)); } catch { /* no storage */ }
  trackEvent(how === 'nooit' ? 'installatie-tip-nooit' : 'installatie-tip-later', how === 'nooit' ? 'Installatietip: niet meer tonen' : 'Installatietip: niet nu');
  render();
}

// Instructions page, for the "Meer uitleg" link and a QR code on a poster.
function renderInstall() {
  document.title = 'Installeer de app — Davoz Zwevegem';
  const already = standalone ? '<p class="install-done">Je gebruikt de app al. Je vindt Davoz op je beginscherm.</p>' : '';
  return `
    <div class="page-head"><div><h1>Installeer de app</h1><span class="muted">Davoz op je beginscherm: opent meteen op je ploeg, werkt ook zonder internet, gratis en zonder App Store.</span></div></div>
    ${already}
    <div class="install-guides">
      <section class="card install-guide${isIOS ? ' is-yours' : ''}" aria-labelledby="gids-iphone">
        <h2 id="gids-iphone" class="section-title">iPhone en iPad</h2>
        <span class="muted">In Safari of Chrome:</span>
        ${iosSteps()}
        <span class="muted">Daarna staat Davoz tussen je apps. Open hem voortaan via dat icoon.</span>
      </section>
      <section class="card install-guide${!isIOS ? ' is-yours' : ''}" aria-labelledby="gids-android">
        <h2 id="gids-android" class="section-title">Android</h2>
        ${installPrompt ? '<button type="button" class="btn" data-install>Installeer app</button><span class="muted">Of volg de stappen hieronder.</span>' : ''}
        <ol class="install-steps">
          <li>Tik in Chrome rechtsboven op <b>⋮</b>.</li>
          <li>Kies <b>App installeren</b> of <b>Toevoegen aan startscherm</b>.</li>
          <li>Tik op <b>Installeren</b>.</li>
        </ol>
      </section>
    </div>
    <p class="muted" style="margin-top:20px">Tip: duid eerst je ploeg aan met de ster bij <a href="#/ploegen">Ploegen</a>. De app opent dan meteen op die ploeg.</p>`;
}

// ---- Analytics (GoatCounter: anonymous, no cookies) -------------------------------------

const slug = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
// count.js loads async; anything counted before it is ready waits in this queue.
const gcQueue = [];
const gc = (vars) => (window.goatcounter?.count ? window.goatcounter.count(vars) : gcQueue.push(vars));
document.getElementById('goatcounter')?.addEventListener('load', () => gcQueue.splice(0).forEach(gc));
const trackEvent = (name, title) => gc({ path: name, title: title ?? name, event: true });

// The site navigates with '#/…' links, so every view is counted as its own page.
let lastTracked = null;
function trackPage(page, team, match) {
  const path = page === 'weetjes' ? '/weetjes' : page === 'ploegen' ? '/ploegen' : page === 'installeren' ? '/installeren'
    : page === 'mijn' ? (team ? `/mijn-ploeg/${slug(team.label)}` : '/mijn-ploeg')
    : !team ? '/' : `/ploeg/${slug(team.label)}${match ? `/match/${slug(match.nr)}` : ''}`;
  if (path === lastTracked) return;
  lastTracked = path;
  gc({ path, title: document.title });
}

function render() {
  const r = route();
  const { page, match } = r;
  const team = page === 'mijn' ? mijnTeam() : r.team;
  if (team?.key !== state.teamKey) { state.teamKey = team?.key; state.tab = null; }
  if (page !== 'team') state.lastTab = page;
  renderTabbar(page, team);
  const app = document.getElementById('app');
  app.innerHTML = page === 'weetjes' ? renderWeetjes() : page === 'ploegen' ? renderPloegen() : page === 'mijn' ? renderMijn(team)
    : page === 'installeren' ? renderInstall()
    : !team ? renderWeekend() : match ? renderMatch(team, match) : renderTeam(team);
  trackPage(page, team, match);
}

function toggleFav(key) {
  const t = state.data.teams.find((x) => x.key === key);
  if (!t) return;
  const on = !isFav(t);
  state.favs = on ? [...state.favs, key] : state.favs.filter((k) => k !== key);
  saveFavs();
  trackEvent(on ? 'favoriet-aan' : 'favoriet-uit', `${on ? 'Favoriet' : 'Geen favoriet meer'}: ${t.label}`);
  render();
  // The list is redrawn; keep keyboard and screen reader focus on the same star.
  document.querySelector(`[data-fav="${CSS.escape(key)}"]`)?.focus();
}

document.addEventListener('click', (e) => {
  const fav = e.target.closest('[data-fav]');
  if (fav) { toggleFav(fav.dataset.fav); return; }
  const mijn = e.target.closest('[data-mijn]');
  if (mijn) { state.mijnKey = mijn.dataset.mijn; render(); return; }
  if (e.target.closest('[data-install]')) { runInstallPrompt(); return; }
  const hint = e.target.closest('[data-hint]');
  if (hint) { dismissHint(hint.dataset.hint); return; }
  const tab = e.target.closest('[data-tab]');
  if (tab && tab.dataset.tab !== state.tab) {
    state.tab = tab.dataset.tab;
    render();
    document.querySelector(`[data-tab="${state.tab}"]`)?.focus();
    // Only real taps are counted; the tab a team page opens on is not.
    const t = state.data.teams.find((x) => x.key === state.teamKey);
    const name = tab.dataset.tab.charAt(0).toUpperCase() + tab.dataset.tab.slice(1);
    if (t) trackEvent(`tab-${tab.dataset.tab}/${slug(t.label)}`, `${name}: ${t.label}`);
  }
  const week = e.target.closest('[data-week]');
  if (week) { state.week = week.dataset.week; render(); if (week.dataset.week === 'volgend') trackEvent('weekend-volgend', 'Volgend weekend bekeken'); }
  const mode = e.target.closest('[data-ft-mode]');
  if (mode) { state.weetjesMode = mode.dataset.ftMode; render(); if (mode.dataset.ftMode === 'team') trackEvent('weetjes-per-ploeg', 'Weetjes per ploeg bekeken'); }
  const tracked = e.target.closest('[data-track]');
  if (tracked) trackEvent(tracked.dataset.track, tracked.dataset.trackTitle);
  const copy = e.target.closest('[data-copy]');
  if (copy) {
    navigator.clipboard.writeText(copy.dataset.copy).then(
      () => { copy.textContent = 'Gekopieerd'; setTimeout(() => { copy.textContent = 'Kopieer link'; }, 2000); },
      () => { window.prompt('Kopieer deze link:', copy.dataset.copy); }
    );
  }
});
document.addEventListener('change', (e) => {
  if (e.target.id === 'ft-team') { state.weetjesTeam = e.target.value; render(); document.getElementById('ft-team')?.focus(); }
});
window.addEventListener('hashchange', () => { render(); window.scrollTo(0, 0); });

// ---- Installable app and offline use ------------------------------------------------------

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});

// Optional chaining: an older cached index.html may lack these elements; the results must still load.
const offlineBar = document.getElementById('offline');
const installButton = document.getElementById('install');
const showOnline = () => { if (offlineBar) offlineBar.hidden = navigator.onLine; };
window.addEventListener('online', showOnline);
window.addEventListener('offline', showOnline);
showOnline();

// Android/desktop Chrome offer installation through this event; iOS uses Share → Add to Home Screen.
let installPrompt = null;
// Pages that may show the install card are redrawn when Android offers installation later on.
const redrawIfCardPage = () => { if (state.data && ['weekend', 'mijn'].includes(route().page)) render(); };
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  installPrompt = e;
  if (installButton) installButton.hidden = false;
  redrawIfCardPage();
});
async function runInstallPrompt() {
  if (!installPrompt) return;
  trackEvent('app-installeer-klik', 'Klik op Installeer app');
  installPrompt.prompt();
  await installPrompt.userChoice;
  installPrompt = null;
  if (installButton) installButton.hidden = true;
  redrawIfCardPage();
}
installButton?.addEventListener('click', runInstallPrompt);
window.addEventListener('appinstalled', () => { if (installButton) installButton.hidden = true; trackEvent('app-geinstalleerd', 'App geïnstalleerd'); });
// Opened from the home screen (installed app) rather than in the browser.
const standalone = !!(window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone);
if (standalone) {
  trackEvent('app-geopend', 'App geopend vanaf startscherm');
  // Counted once per installation: an installed iPhone web app has its own storage, separate from Safari.
  try {
    if (!localStorage.getItem('davoz-app-gestart')) {
      localStorage.setItem('davoz-app-gestart', new Date().toISOString());
      trackEvent('app-eerste-start', `App voor het eerst gestart (${isIOS ? 'iPhone/iPad' : 'Android/andere'})`);
    }
  } catch { /* no storage: skip the count */ }
}

fetch('data.json', { cache: 'no-cache' })
  .then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); })
  .then((data) => {
    state.data = data;
    const at = new Date(data.generatedAt);
    document.getElementById('updated').textContent = `Bijgewerkt ${at.toLocaleString('nl-BE', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Brussels' })}`;
    // The installed app opens on the favourite team; the website keeps the weekend as start page.
    if (standalone && !location.hash && favTeams().length) history.replaceState(null, '', '#/mijn');
    render();
  })
  .catch(() => {
    document.getElementById('app').innerHTML = '<p class="empty">De uitslagen konden niet geladen worden. Probeer later opnieuw.</p>';
  });
