// Builds iCalendar (.ics) subscription feeds from the site data (RFC 5545).

const TZ = 'Europe/Brussels';
const MATCH_MINUTES = 120;

// Brussels rules, so calendar apps place the matches correctly across DST changes.
const VTIMEZONE = [
  'BEGIN:VTIMEZONE', `TZID:${TZ}`,
  'BEGIN:DAYLIGHT', 'TZOFFSETFROM:+0100', 'TZOFFSETTO:+0200', 'TZNAME:CEST', 'DTSTART:19700329T020000', 'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU', 'END:DAYLIGHT',
  'BEGIN:STANDARD', 'TZOFFSETFROM:+0200', 'TZOFFSETTO:+0100', 'TZNAME:CET', 'DTSTART:19701025T030000', 'RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU', 'END:STANDARD',
  'END:VTIMEZONE'
];

const text = (s) => String(s ?? '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

// Lines longer than 75 octets are folded with CRLF + space, without splitting a UTF-8 character.
function fold(line) {
  const out = [];
  let cur = '', bytes = 0;
  for (const ch of line) {
    const n = Buffer.byteLength(ch);
    if (bytes + n > (out.length ? 74 : 75)) { out.push(cur); cur = ''; bytes = 0; }
    cur += ch; bytes += n;
  }
  out.push(cur);
  return out.join('\r\n ');
}

const compact = (date, time) => `${date.replace(/-/g, '')}T${time.replace(':', '')}00`;
function plusMinutes(date, time, minutes) {
  const d = new Date(`${date}T${time}:00Z`);
  d.setUTCMinutes(d.getUTCMinutes() + minutes);
  return d.toISOString().slice(0, 16).replace(/[-:]/g, '') + '00';
}
const nextDay = (date) => { const d = new Date(`${date}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + 1); return d.toISOString().slice(0, 10).replace(/-/g, ''); };

function event({ team, match: m }, { stamp, siteUrl, domain }) {
  const score = m.result ? ` (${m.result.home}–${m.result.away})` : '';
  const status = m.postponed ? ' — uitgesteld' : m.forfait ? ' — forfait' : '';
  const location = [m.hall, m.address?.street && `${m.address.street}, ${m.address.city}`].filter(Boolean).join(' — ');
  const url = siteUrl ? `${siteUrl}#/${encodeURIComponent(team.key)}/${encodeURIComponent(m.nr)}` : null;
  const description = [
    `${team.label} · ${team.division}`,
    m.result && m.sets.length ? `Sets: ${m.sets.map(([h, a]) => `${h}–${a}`).join(', ')}` : null,
    m.address?.note ? `Opmerking sporthal: ${m.address.note}` : null,
    m.address?.mapsUrl ? `Route: ${m.address.mapsUrl}` : null,
    `Wedstrijdnr. ${m.nr}`,
    url
  ].filter(Boolean).join('\n');

  const when = m.time
    ? [`DTSTART;TZID=${TZ}:${compact(m.date, m.time)}`, `DTEND;TZID=${TZ}:${plusMinutes(m.date, m.time, MATCH_MINUTES)}`]
    : [`DTSTART;VALUE=DATE:${m.date.replace(/-/g, '')}`, `DTEND;VALUE=DATE:${nextDay(m.date)}`];

  return [
    'BEGIN:VEVENT',
    `UID:${text(m.nr)}-${team.teamId}@${domain}`,
    `DTSTAMP:${stamp}`,
    ...when,
    `SUMMARY:${text(`${team.label}: ${m.home} – ${m.away}${score}${status}`)}`,
    location ? `LOCATION:${text(location)}` : null,
    m.address?.lat ? `GEO:${m.address.lat};${m.address.lng}` : null,
    `DESCRIPTION:${text(description)}`,
    url ? `URL:${url}` : null,
    m.postponed ? 'STATUS:TENTATIVE' : 'STATUS:CONFIRMED',
    'TRANSP:OPAQUE',
    // Reminder an hour before the start, for matches that are still to come.
    ...(m.time && !m.result ? ['BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${text(`${team.label} speelt over een uur`)}`, 'TRIGGER:-PT1H', 'END:VALARM'] : []),
    'END:VEVENT'
  ].filter(Boolean);
}

export function buildCalendar(name, entries, { generatedAt, siteUrl, domain }) {
  const stamp = generatedAt.replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:-//${domain}//Davoz scores//NL`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${text(name)}`,
    `X-WR-TIMEZONE:${TZ}`,
    'REFRESH-INTERVAL;VALUE=DURATION:PT6H',
    'X-PUBLISHED-TTL:PT6H',
    ...VTIMEZONE,
    ...entries.flatMap((e) => event(e, { stamp, siteUrl, domain })),
    'END:VCALENDAR'
  ];
  return lines.map(fold).join('\r\n') + '\r\n';
}

// File name per team, stable through the season (the key holds series code and team id).
export const calendarSlug = (key) => key.toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
