# Davoz Zwevegem — uitslagen

Static website with the results, fixtures and rankings of all Davoz Zwevegem teams
(stamnummer W-0830), based on the public VolleyAdmin2 XML feed of Volley Vlaanderen.

## How it works

- `scripts/fetch-data.mjs` downloads the club's matches
  (`wedstrijden_xml.php?province_id=9&stamnummer=W-0830`) and the ranking of each series
  (`rangschikking_xml.php?province_id=9&reeks=<code>`), and writes `site/data.json`.
- `site/` is a plain HTML/CSS/JS site (no build step) that renders `data.json`.
- The GitHub Action in `.github/workflows/publish.yml` refreshes the data every hour and
  publishes `site/` to GitHub Pages. If the feed is down, the run fails and the previous
  version stays online.

The feed has no CORS headers, so browsers cannot call it directly — that is why the data is
fetched at build time.

## Run locally

```bash
node scripts/fetch-data.mjs
python -m http.server 8765 --directory site
```

Then open http://localhost:8765.

## Publish on GitHub Pages

1. Create a repository on GitHub and push this folder to the `main` branch.
2. In the repository: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. The workflow runs on every push and every hour; trigger it manually via **Actions → Publish site → Run workflow**.

## Installable app and offline use

The site is a Progressive Web App: `site/manifest.webmanifest` plus the icons in
`site/icons/` let phones add it to the home screen (Android/Chrome shows an "Installeer app"
button; on iPhone use Share → Add to Home Screen). `site/sw.js` caches the pages and the last
loaded `data.json`, so the results stay visible offline. It fetches from the network first,
so online visitors always get fresh data. Bump `CACHE` in `sw.js` when the list of cached
files changes.

The icons are drawn by `node scripts/make-icons.mjs` (no dependencies); rerun it only when
the artwork changes and commit the PNGs.

## Calendar subscriptions

Every build also writes iCalendar feeds to `site/agenda/`: one per team
(`agenda/<series>-<team id>.ics`) and one for the whole club (`agenda/davoz-zwevegem.ics`).
Team pages and the weekend page offer subscribe links (webcal for Apple/Outlook, Google
Calendar, or copy the URL). Events keep a stable UID, so moved matches update in place;
upcoming matches carry a reminder one hour before the start. `siteUrl` in `config.json`
is used for the links back to the site inside each event.

## Sports hall addresses

The feed only names halls as "Town, Hall". `halls.json` holds the street address and
coordinates per hall; the build adds them to each match together with a Google Maps link.
A hall that is missing from `halls.json` still gets a Maps link based on its name.

`halls.json` is filled once from the hall pages on volleyscores.be. When new halls appear
(e.g. at the start of a season), run this locally and commit the updated `halls.json`:

```bash
node scripts/fetch-data.mjs && node scripts/fetch-halls.mjs
```

The script only looks up halls that are not in the file yet; fix an address by editing the file.

## Configuration

`bickyBelow` in `config.json` sets the Bicky threshold for all teams: a set won while the
opponent stays below this many points earns a burger icon and counts on the "Weetjes" page
(season facts, computed in the browser from `data.json`). A team entry may override it.

`config.json` holds the club (name, stamnummer, province) and a friendly label per series
code (`WP3DA` → "Dames A · Promo 3 Dames"). New series that are not listed still appear,
labelled with their code — add them to `config.json` to give them a nice name and position.
