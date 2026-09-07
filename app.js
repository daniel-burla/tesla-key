import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
const { createDashboard, onceWhilePending } = await import(`./ui.js?v=${window.APP_VERSION ?? 'dev'}`);
const { say } = await import(`./render.js?v=${window.APP_VERSION ?? 'dev'}`);
const $ = (id) => document.getElementById(id);
const cfg = window.TESLA_MONITOR_CONFIG;
if (!cfg?.SUPABASE_URL || cfg.SUPABASE_URL.includes('YOUR-PROJECT')) {
  document.body.textContent = 'The dashboard is not configured yet.';
  throw new Error('config missing');
}
const sb = createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
let dashboard;
async function boot() {
  const { data: { session } } = await sb.auth.getSession();
  $('login').classList.toggle('hidden', Boolean(session));
  $('app').classList.toggle('hidden', !session);
  if (session) {
    dashboard ??= createDashboard(sb);
    await dashboard.refresh();
  }
}
$('signin').onclick = onceWhilePending(async () => {
  const button = $('signin');
  button.disabled = true; button.textContent = 'Signing in…';
  try {
    const { error } = await sb.auth.signInWithPassword({ email: $('email').value.trim(), password: $('password').value });
    if (error) say($('loginMsg'), 'Unable to sign in. Check your email, password, and connection.', 'err');
    else { say($('loginMsg'), ''); await boot(); }
  } catch { say($('loginMsg'), 'Unable to connect. Please try again.', 'err'); }
  finally { button.disabled = false; button.textContent = 'Sign in'; }
});
$('password').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('signin').click(); });
$('signout').onclick = onceWhilePending(async () => {
  $('signout').disabled = true;
  try {
    const { error } = await sb.auth.signOut();
    if (error) throw error;
    dashboard?.destroy(); location.reload();
  } catch { say($('settingsMsg'), 'Unable to sign out. Please retry.', 'err'); }
  finally { $('signout').disabled = false; }
});
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).catch(() => {});
boot().catch(() => { $('login').classList.remove('hidden'); say($('loginMsg'), 'Unable to load your session. Please sign in again.', 'err'); });
