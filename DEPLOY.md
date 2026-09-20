# Seasonal Tires on GitHub Pages

`daniel-burla/tesla-key` is the Pages source for **https://car.burla.ca**.

This tree is a **Vite + React Seasonal Tires** production build in **mock / gated-empty** mode.

Tesla-tires on Origin was not reachable from the deploy agent, so this UI was rebuilt here (`seasonal-tires/`) to match the existing tire-set dashboard chrome. It is **not** wired to live vehicle data.

## Security (current ruling)

Until a Cloudflare / burla Worker ships an httpOnly Secure SameSite session and proxies Supabase:

- Pages stays mock / gated-empty
- **No live odometer** on car.burla.ca
- **Do not** embed a working Supabase URL + anon key
- Odometer and daily distance stay blank
- Tire cards are sample UI only (session-local edits)

Rebuild with `VITE_*` secrets is forbidden for this host.

## Must preserve (never delete or rewrite)

| Path | Rule |
| --- | --- |
| `.well-known/appspecific/com.tesla.3p.public-key.pem` | Exact path + existing PEM bytes |
| `.nojekyll` | Keep so Pages does not run Jekyll |
| `CNAME` | `car.burla.ca` plus trailing newline |

Static files win on GitHub Pages. `404.html` (copy of `index.html`) is for SPA routes only and must not rewrite `.well-known`.

PEM: https://car.burla.ca/.well-known/appspecific/com.tesla.3p.public-key.pem

## Rebuild

```bash
cd seasonal-tires
npm install
npm run build
../scripts/overlay-vite-dist.sh dist
```

`overlay-vite-dist.sh` restores the three preserve paths after copy and adds `404.html` if missing.
