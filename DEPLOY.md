# Seasonal Tires → GitHub Pages (hold)

This repo (`daniel-burla/tesla-key`) is the GitHub Pages source for **https://car.burla.ca**.

A full replace of the current Tesla Monitor static files with the Vite+React **Seasonal Tires** production build was blocked: the source of truth is Origin PR `dburla/Tesla-tires` #1 (branch `cursor/live-pages-supabase-8064`), Origin is not authenticated in this agent VM, and no GitHub mirror of `Tesla-tires` exists under `daniel-burla` or `dburla`.

This hold **does not change** the live Pages tree. Tesla partner-key verification stays up.

## Must preserve (never delete or rewrite)

| Path | Rule |
| --- | --- |
| `.well-known/appspecific/com.tesla.3p.public-key.pem` | Exact path + existing PEM bytes. Tesla Fleet / partner-key check. |
| `.nojekyll` | Keep so GitHub Pages does not run Jekyll (required for `.well-known`). |
| `CNAME` | Exact content: `car.burla.ca` plus trailing newline. |

GitHub Pages serves static files first. A SPA `404.html` fallback must **not** intercept `/.well-known/...`.

Public PEM URL after any deploy:

`https://car.burla.ca/.well-known/appspecific/com.tesla.3p.public-key.pem`

Verified on this hold: repo PEM SHA-256 matches the live URL.

## Do not commit

- Supabase service-role keys
- Tesla refresh / access tokens
- Any `.env` with secrets

Browser-safe Vite `VITE_*` public vars (project URL + anon key only) may be baked into a production build. Do not add service-role or Tesla tokens to this repo.

## Target file tree after a real deploy

Pages is **legacy** (`main` / `/`). Overlay the Vite `dist/` at the repo root. Keep the three preserve paths, then expect something like:

```
.
├── .nojekyll
├── CNAME                          # car.burla.ca
├── .well-known/
│   └── appspecific/
│       └── com.tesla.3p.public-key.pem
├── index.html                     # Vite+React Seasonal Tires
├── 404.html                       # copy of index.html (SPA client routes)
├── manifest.webmanifest           # or manifest.json from the Vite PWA plugin
├── sw.js / workbox-*.js           # if the PWA plugin emits them
├── assets/                        # hashed JS/CSS from Vite
└── icons / apple-touch-icon / favicon
```

Remove the old Tesla Monitor files only when the new `dist/` is present:

`app.js`, `config.js`, `render.js`, `ui.js`, `styles.css`, and the old `sw.js` / icons / `manifest.webmanifest` if the new build replaces them.

## How to finish the deploy (once Tesla-tires is reachable)

1. Clone `dburla/Tesla-tires` at `cursor/live-pages-supabase-8064` (or the merged equivalent).
2. Install and `npm run build` (or `pnpm`/`yarn` as the repo specifies). Use only public `VITE_*` env for the Pages build.
3. From this repo: `./scripts/overlay-vite-dist.sh /path/to/Tesla-tires/dist`
4. Confirm the PEM path still exists and `CNAME` / `.nojekyll` are unchanged.
5. Merge to `main` (Pages source). Recheck:
   - https://car.burla.ca/
   - https://car.burla.ca/.well-known/appspecific/com.tesla.3p.public-key.pem

`scripts/overlay-vite-dist.sh` refuses to run if any preserve path would be removed.
