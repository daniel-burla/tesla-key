/**
 * GitHub Pages builds are mock-only until a Cloudflare Worker fronts
 * Supabase with an httpOnly Secure SameSite session.
 *
 * Live odometer / snapshots must never ship in this static bundle.
 * Do not import @supabase/supabase-js here and do not bake VITE_SUPABASE_*.
 */
export const DATA_MODE = 'mock';
export const LIVE_ODO_ENABLED = false;
