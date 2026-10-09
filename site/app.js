'use strict';

const state = { data: null, tab: null };

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Brussels' }).format(new Date());
const asDate = (iso) => new Date(`${iso}T12:00:00`);
const fmt = (iso, opts) => new Intl.DateTimeFormat('nl-BE', opts).format(asDate(iso));
const dayShort = (iso) => fmt(iso, { weekday: 'short' }).replace('.', '');
const dayMonth = (iso) => fmt(iso, { day: 'numeric', month: 'short' }).replace('.', '');
const dateLong = (iso) => fmt(iso, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

const won = (m) => m.result && (m.usHome ? m.result.home > m.result.away : m.result.away > m.result.home);
const setWon = (m, [h, a]) => (m.usHome ? h > a : a > h);
const teamHref = (t) => `#/${encodeURIComponent(t.key)}`;
const matchHref = (t, m) => `#/${encodeURIComponent(t.key)}/${encodeURIComponent(m.nr)}`;

function route() {
  const [, teamKey, matchNr] = location.hash.split('/').map(decodeURIComponent);
  const teams = state.data.teams;
  const team = teams.find((t) => t.key === teamKey) ?? teams.find((t) => !t.cup) ?? teams[0];
  const match = matchNr ? team.matches.find((m) => m.nr === matchNr) : null;
  return { team, match };
}

function renderNav(current) {
  const nav = document.getElementById('team-nav');
  const pill = (t) => `<a class="pill" href="${teamHref(t)}"${t.key === current.key ? ' aria-current="page"' : ''}>${esc(t.label)}</a>`;
  const league = state.data.teams.filter((t) => !t.cup);
  const cup = state.data.teams.filter((t) => t.cup);
  nav.innerHTML = league.map(pill).join('') + (cup.length ? `<span class="pill-sep">Beker</span>${cup.map(pill).join('')}` : '');
  const active = nav.querySelector('[aria-current]');
  if (active) nav.scrollLeft = active.offsetLeft - (nav.clientWidth - active.offsetWidth) / 2;
}

const badge = (m) => !m.result
  ? '<span class="badge pending" aria-label="Nog geen uitslag">–</span>'
  : won(m) ? '<span class="badge win" aria-label="Gewonnen">W</span>' : '<span class="badge" aria-label="Verloren">V</span>';

const name = (m, side) => {
  const us = side === 'home' ? m.usHome : !m.usHome;
  return `<span${us ? ' class="us"' : ''}>${esc(side === 'home' ? m.home : m.away)}</span>`;
};

function matchRow(t, m) {
  const sets = m.sets.map((s) => `<span class="chip${setWon(m, s) ? ' won' : ''}">${s[0]}–${s[1]}</span>`).join('');
  let meta = m.result ? '' : `${m.time ? esc(m.time) + ' · ' : ''}${esc(m.hall ?? '')}`;
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
        <div class="set-chip${setWon(m, s) ? ' won' : ''}"><small>Set ${i + 1}</small><b>${s[0]}–${s[1]}</b><i></i></div>`).join('')}</div>` : ''}
      ${link ? `<a class="more" href="${matchHref(t, m)}">Bekijk matchdetail →</a>` : ''}
    </section>`;
}

function statsCard(t, played) {
  const row = t.ranking.find((r) => r.teamId === t.teamId);
  const w = row ? row.won : played.filter(won).length;
  const l = row ? row.lost : played.length - w;
  let sw = 0, sl = 0;
  for (const m of played) { sw += m.usHome ? m.result.home : m.result.away; sl += m.usHome ? m.result.away : m.result.home; }
  if (row) { sw = row.setsWon; sl = row.setsLost; }
  const form = played.slice(-5);
  return `
    <section class="card" aria-labelledby="cijfers">
      <h2 id="cijfers" class="section-title" style="margin-bottom:14px">Seizoen in cijfers</h2>
      <div class="stat-grid">
        <div class="stat"><b>${w}–${l}</b><span>W – V</span></div>
        <div class="stat"><b>${sw}–${sl}</b><span>Sets</span></div>
        <div class="stat"><b>${row ? row.points : '—'}</b><span>${row ? `Punten · ${row.pos}e` : 'Punten'}</span></div>
      </div>
      ${form.length ? `<div class="form"><span class="muted" style="font-size:14px">Vorm (oud → recent)</span><div class="form-row">${form.map(badge).join('')}</div></div>` : ''}
    </section>`;
}

function rankingCard(t) {
  if (!t.ranking.length) return '';
  return `
    <section class="card" aria-labelledby="klassement">
      <div class="section-head"><h2 id="klassement" class="section-title">Klassement</h2><span class="muted" style="font-size:14px">${esc(t.division)}</span></div>
      <div class="table-box">
        <table>
          <thead><tr><th scope="col">#</th><th scope="col">Ploeg</th><th scope="col" class="num">M</th><th scope="col" class="num">W–V</th><th scope="col" class="num">Sets</th><th scope="col" class="num">Ptn</th></tr></thead>
          <tbody>${t.ranking.map((r) => `
            <tr${r.teamId === t.teamId ? ' class="us"' : ''}>
              <td>${r.pos}</td><td>${esc(r.name)}</td><td class="num">${r.played}</td><td class="num">${r.won}–${r.lost}</td>
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
              <span class="muted">${esc(dateLong(next.date))}${next.time ? ' · ' + esc(next.time) : ''}${next.hall ? ' · ' + esc(next.hall) : ''}</span>
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
        ${rankingCard(t)}
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
                <div class="set-bar-head"><span>Set ${i + 1}</span><b>${h}–${a}</b></div>
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
            ${m.hall ? `<dt>Sporthal</dt><dd>${esc(m.hall)}</dd>` : ''}
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

function render() {
  const { team, match } = route();
  if (team.key !== state.teamKey) { state.teamKey = team.key; state.tab = null; }
  renderNav(team);
  document.getElementById('app').innerHTML = match ? renderMatch(team, match) : renderTeam(team);
}

document.addEventListener('click', (e) => {
  const tab = e.target.closest('[data-tab]');
  if (tab) { state.tab = tab.dataset.tab; render(); }
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
