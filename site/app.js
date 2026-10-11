'use strict';

const state = { data: null, tab: null, week: 'dit' };

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
  ? `<a class="route" href="${esc(m.address.mapsUrl)}" target="_blank" rel="noopener">${PIN}Route in Google Maps<span class="sr-only"> (opent in een nieuw venster)</span></a>`
  : '';
const teamHref = (t) => `#/${encodeURIComponent(t.key)}`;
const matchHref = (t, m) => `#/${encodeURIComponent(t.key)}/${encodeURIComponent(m.nr)}`;

// '#/' (or no hash) is the club weekend overview; '#/<team>' and '#/<team>/<match nr>' the team pages.
function route() {
  const [, teamKey, matchNr] = location.hash.split('/').map(decodeURIComponent);
  const team = teamKey ? state.data.teams.find((t) => t.key === teamKey) : null;
  if (!team) return { team: null, match: null };
  const match = matchNr ? team.matches.find((m) => m.nr === matchNr) : null;
  return { team, match };
}

function renderNav(current) {
  const nav = document.getElementById('team-nav');
  const pill = (t) => `<a class="pill" href="${teamHref(t)}"${t.key === current?.key ? ' aria-current="page"' : ''}>${esc(t.label)}</a>`;
  const league = state.data.teams.filter((t) => !t.cup);
  const cup = state.data.teams.filter((t) => t.cup);
  nav.innerHTML = `<a class="pill pill-weekend" href="#/"${current ? '' : ' aria-current="page"'}>Dit weekend</a>`
    + league.map(pill).join('') + (cup.length ? `<span class="pill-sep">Beker</span>${cup.map(pill).join('')}` : '');
  const active = nav.querySelector('[aria-current]');
  if (active) nav.scrollLeft = active.offsetLeft - (nav.clientWidth - active.offsetWidth) / 2;
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
  return `
    <section class="scoreboard" aria-label="${esc(title)}">
      <div class="eyebrow"><h2>${esc(title)} · ${esc(t.division)}</h2><span>${esc(dateLong(m.date))}${m.time ? ' · ' + esc(m.time) : ''}</span></div>
      <div class="score-row">
        <div class="team">${esc(m.home)}</div>
        <div class="score"><span>${m.result.home}</span><span class="dash">–</span><span>${m.result.away}</span></div>
        <div class="team away">${esc(m.away)}</div>
      </div>
      ${m.sets.length ? `<div class="set-chips">${m.sets.map((s, i) => `
        <div class="set-chip${setWon(m, s) ? ' won' : ''}"><small>Set ${i + 1}</small><b>${s[0]}–${s[1]}${bicky(t, m, s) ? burger(t) : ''}</b><i></i></div>`).join('')}</div>` : ''}
      ${link ? `<a class="more" href="${matchHref(t, m)}">Bekijk matchdetail →</a>` : ''}
    </section>`;
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
function calendarCard(path, title, intro) {
  if (!path) return '';
  const url = new URL(path, location.href.split('#')[0]).href;
  const webcal = url.replace(/^https?:/, 'webcal:');
  return `
    <section class="card cal-card" aria-labelledby="agenda">
      <h2 id="agenda" class="section-title">${esc(title)}</h2>
      <span class="muted">${esc(intro)}</span>
      <div class="cal-actions">
        <a class="btn" href="${esc(webcal)}">Apple / Outlook</a>
        <a class="btn" href="https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcal)}" target="_blank" rel="noopener">Google Agenda<span class="sr-only"> (opent in een nieuw venster)</span></a>
        <button type="button" class="btn btn-ghost" data-copy="${esc(url)}">Kopieer link</button>
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

function rankingCard(t) {
  if (!t.ranking.length) return '';
  // Without win/loss counters in the feed (youth series) the column would only show 0–0.
  const showRecord = t.ranking.some((r) => r.won + r.lost > 0);
  return `
    <section class="card" aria-labelledby="klassement">
      <div class="section-head"><h2 id="klassement" class="section-title">Klassement</h2><span class="muted" style="font-size:14px">${esc(t.division)}</span></div>
      <div class="table-box">
        <table>
          <thead><tr><th scope="col">#</th><th scope="col">Ploeg</th><th scope="col" class="num">M</th>${showRecord ? '<th scope="col" class="num">W–V</th>' : ''}<th scope="col" class="num">Sets</th><th scope="col" class="num">Ptn</th></tr></thead>
          <tbody>${t.ranking.map((r) => `
            <tr${r.teamId === t.teamId ? ' class="us"' : ''}>
              <td>${r.pos}</td><td>${esc(r.name)}</td><td class="num">${r.played}</td>${showRecord ? `<td class="num">${r.won}–${r.lost}</td>` : ''}
              <td class="num">${r.setsWon}–${r.setsLost}</td><td class="num pts">${r.points}</td>
            </tr>`).join('')}</tbody>
        </table>
      </div>
    </section>`;
}

function renderTeam(t) {
  const played = t.matches.filter((m) => m.result);
  const upcoming = t.matches.filter((m) => !m.result && m.date >= today);
  const open = t.matches.filter((m) => !m.result && m.date < today);
  const last = played.at(-1);
  const next = upcoming[0];
  if (!state.tab) state.tab = played.length ? 'uitslagen' : 'kalender';
  const list = state.tab === 'uitslagen' ? [...played, ...open].sort((a, b) => b.date.localeCompare(a.date)) : upcoming;
  document.title = `${t.label} — Davoz Zwevegem`;

  return `
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
          <div class="tabs" role="tablist">
            <button class="tab" role="tab" data-tab="uitslagen" aria-selected="${state.tab === 'uitslagen'}">Uitslagen (${played.length + open.length})</button>
            <button class="tab" role="tab" data-tab="kalender" aria-selected="${state.tab === 'kalender'}">Kalender (${upcoming.length})</button>
          </div>
          <div class="match-list" role="tabpanel">
            ${list.length ? list.map((m) => matchRow(t, m)).join('') : `<p class="empty">${state.tab === 'uitslagen' ? 'Nog geen gespeelde wedstrijden.' : 'Geen wedstrijden meer gepland.'}</p>`}
          </div>
        </section>
      </div>
      <aside class="col-side">
        ${statsCard(t, played)}
        ${bickyCard(t, played)}
        ${rankingCard(t)}
        ${calendarCard(t.calendar, 'In je agenda', `Alle matchen van ${t.label} in je gsm-agenda, met sporthal en adres. Verplaatste matchen passen zich vanzelf aan.`)}
      </aside>
    </div>`;
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
  let right = '';
  if (m.result) right = `<a class="wk-score" href="${matchHref(t, m)}" aria-label="Matchdetail ${esc(m.home)} – ${esc(m.away)}"><b>${m.result.home}–${m.result.away}</b>${badge(m)}</a>`;
  else if (m.postponed) right = '<span class="wk-pending">Uitgesteld</span>';
  else if (started(m)) right = '<span class="wk-pending">Uitslag volgt</span>';
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

function homeCards(home, byTime) {
  return [...new Set(home.map((x) => x.m.hall))].map((hall) => {
    const list = home.filter((x) => x.m.hall === hall).sort((a, b) => a.m.date.localeCompare(b.m.date) || byTime(a, b));
    const multiDay = new Set(list.map((x) => x.m.date)).size > 1;
    const keys = [...new Set(list.map((x) => `${x.m.date}|${x.m.time ?? '–'}`))];
    const slots = keys.map((k) => {
      const [date, time] = k.split('|');
      const teams = list.filter((x) => x.m.date === date && (x.m.time ?? '–') === time).map((x) => x.t.label).join(' · ');
      return `<div><b>${esc(`${multiDay ? capital(dayShort(date)) + ' ' : ''}${time}`)}</b><span class="muted">${esc(teams)}</span></div>`;
    }).join('');
    const timed = list.filter((x) => x.m.time);
    const span = timed.length && !multiDay ? ` van ${timed[0].m.time} tot ongeveer ${endEstimate(timed.at(-1).m.time)}` : '';
    const [town, ...rest] = (hall ?? '').split(',');
    const m = list[0].m;
    return `
      <section class="card wk-home" aria-label="Thuismatchen in ${esc(hall)}">
        <span class="tag">Thuis in ${esc(town)}</span>
        <h2 class="wk-home-title">${esc(rest.join(',').trim() || hall)}</h2>
        ${fullAddress(m) ? `<span>${esc(fullAddress(m))}</span>` : ''}
        ${m.address?.note ? `<span class="muted">${esc(m.address.note)}</span>` : ''}
        <div class="wk-home-slots">${slots}</div>
        <span class="muted">${plural(list.length, 'match', 'matchen')}${span}</span>
        ${routeLink(m)}
      </section>`;
  }).join('');
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
    const times = [...new Set(list.map((x) => x.m.time ?? '–'))];
    return `
      <section class="wk-day" aria-labelledby="dag-${d}">
        <h2 class="wk-day-title" id="dag-${d}">${esc(dayTitle(d))}${list.length ? ` <span>${plural(list.length, 'wedstrijd', 'wedstrijden')}</span>` : ''}</h2>
        ${list.length ? times.map((time) => `
          <div class="wk-slot">
            <div class="wk-time">${esc(time)}</div>
            <div class="wk-slot-matches">${list.filter((x) => (x.m.time ?? '–') === time).map(weekendCard).join('')}</div>
          </div>`).join('') : '<p class="wk-empty">Geen wedstrijden.</p>'}
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
    <div class="layout">
      <div class="col-main wk-days">${dayBlocks}</div>
      <aside class="col-side">
        <section class="wk-stats" aria-labelledby="wk-cijfers">
          <h2 id="wk-cijfers">${title} in cijfers</h2>
          <div class="wk-stat-grid">${stats.map(([label, value]) => `<div><b>${value}</b><span>${esc(label)}</span></div>`).join('')}</div>
          <p>${esc(summary)}</p>
        </section>
        ${homeCards(home, byTime)}${noHome}
        ${calendarCard(state.data.calendar, 'Altijd op de hoogte', 'Alle matchen van de club in je gsm-agenda. Wil je alleen je eigen ploeg? Kies ze bovenaan.')}
      </aside>
    </div>`;
}

function render() {
  const { team, match } = route();
  if (team?.key !== state.teamKey) { state.teamKey = team?.key; state.tab = null; }
  renderNav(team);
  document.getElementById('app').innerHTML = !team ? renderWeekend() : match ? renderMatch(team, match) : renderTeam(team);
}

document.addEventListener('click', (e) => {
  const tab = e.target.closest('[data-tab]');
  if (tab) { state.tab = tab.dataset.tab; render(); }
  const week = e.target.closest('[data-week]');
  if (week) { state.week = week.dataset.week; render(); }
  const copy = e.target.closest('[data-copy]');
  if (copy) {
    navigator.clipboard.writeText(copy.dataset.copy).then(
      () => { copy.textContent = 'Gekopieerd'; setTimeout(() => { copy.textContent = 'Kopieer link'; }, 2000); },
      () => { window.prompt('Kopieer deze link:', copy.dataset.copy); }
    );
  }
});
window.addEventListener('hashchange', () => { render(); window.scrollTo(0, 0); });

fetch('data.json', { cache: 'no-cache' })
  .then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); })
  .then((data) => {
    state.data = data;
    const at = new Date(data.generatedAt);
    document.getElementById('updated').textContent = `Bijgewerkt ${at.toLocaleString('nl-BE', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Brussels' })}`;
    render();
  })
  .catch(() => {
    document.getElementById('app').innerHTML = '<p class="empty">De uitslagen konden niet geladen worden. Probeer later opnieuw.</p>';
  });
