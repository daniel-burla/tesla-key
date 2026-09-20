# Seasonal Tires (Pages mock build)

Vite + React PWA. Production mode is **mock / gated-empty**:

- No `@supabase/supabase-js`
- No `VITE_SUPABASE_URL` / anon key
- Odometer and daily distance stay blank
- Summer / winter cards are sample UI only

Live data must wait for a Cloudflare Worker with an httpOnly Secure SameSite session that proxies Supabase.

```bash
npm install
npm run build
../scripts/overlay-vite-dist.sh dist
```
