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

## Configuration

`config.json` holds the club (name, stamnummer, province) and a friendly label per series
code (`WP3DA` → "Dames A · Promo 3 Dames"). New series that are not listed still appear,
labelled with their code — add them to `config.json` to give them a nice name and position.
