import { useMemo, useState } from 'react';
import { LIVE_ODO_ENABLED } from './mode.js';
import { SAMPLE_SETS, cloneSets, fmtDate, fmtKm, fmtKm1, torontoDate } from './mockData.js';

function GearIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="m9 3-.6 2.2-2 .9-2-.6-2 3.5L4 10.6v2.8L2.4 15l2 3.5 2-.6 2 .9L9 21h4l.6-2.2 2-.9 2 .6 2-3.5-1.6-1.6v-2.8L19.6 9l-2-3.5-2 .6-2-.9L13 3Z" />
      <circle cx="11" cy="12" r="3" />
    </svg>
  );
}

export default function App() {
  const [sets, setSets] = useState(() => cloneSets());
  const [chDate, setChDate] = useState(torontoDate);
  const [chSet, setChSet] = useState('');
  const [chNote, setChNote] = useState('');
  const [changeMsg, setChangeMsg] = useState(null);
  const [limitMsg, setLimitMsg] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [changeOpen, setChangeOpen] = useState(false);
  const [limitsOpen, setLimitsOpen] = useState(false);

  const sorted = useMemo(
    () => [...sets].sort((a, b) => Number(b.is_mounted) - Number(a.is_mounted) || a.name.localeCompare(b.name)),
    [sets],
  );

  function saveChange(event) {
    event.preventDefault();
    if (!chDate) {
      setChangeMsg({ kind: 'err', text: 'Choose a valid tire-change date.' });
      return;
    }
    const next = sets.find((s) => s.tire_set_id === chSet);
    if (!next) {
      setChangeMsg({ kind: 'err', text: 'Choose the tire set going on the car.' });
      return;
    }
    setSets((prev) => prev.map((s) => ({
      ...s,
      is_mounted: s.tire_set_id === next.tire_set_id,
      mounted_since: s.tire_set_id === next.tire_set_id ? chDate : null,
      times_mounted: s.tire_set_id === next.tire_set_id ? s.times_mounted + (s.is_mounted ? 0 : 1) : s.times_mounted,
    })));
    setChNote('');
    setChSet('');
    setChangeMsg({ kind: 'ok', text: 'Recorded in this browser session only. Nothing was sent to a server.' });
  }

  function saveLimits(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const next = sets.map((s) => {
      const limit = Number(form.get(`limit-${s.tire_set_id}`));
      const brand = String(form.get(`brand-${s.tire_set_id}`) ?? '').trim();
      return {
        ...s,
        recommended_max_km: Number.isFinite(limit) && limit > 0 ? limit : s.recommended_max_km,
        brand_model: brand || s.brand_model,
        km_remaining: Math.max((Number.isFinite(limit) && limit > 0 ? limit : s.recommended_max_km) - s.total_km, 0),
        percent_used: ((s.total_km / (Number.isFinite(limit) && limit > 0 ? limit : s.recommended_max_km)) * 100),
      };
    });
    setSets(next);
    setLimitMsg({ kind: 'ok', text: 'Limits updated in this session only. Not saved to a backend.' });
  }

  function resetDemo() {
    setSets(cloneSets());
    setChangeMsg(null);
    setLimitMsg(null);
    setChDate(torontoDate());
    setChSet('');
    setChNote('');
  }

  return (
    <div className="wrap">
      <p className="banner" role="status">
        Demo mode. Live odometer and vehicle readings stay off until a Cloudflare Worker
        holds an httpOnly session and proxies Supabase.
      </p>

      <header className="app-header">
        <div className="header-row">
          <h1>Seasonal Tires</h1>
          <button className="icon-button ghost" type="button" aria-label="Settings" aria-haspopup="dialog" onClick={() => setSettingsOpen(true)}>
            <GearIcon />
          </button>
        </div>
        <div className="sub reading-status">
          <div>
            <span className="status-label">Live readings off</span>
            {' '}
            <span>· sample tire sets only</span>
          </div>
          <div className="muted-time">No vehicle connection on this host</div>
        </div>
      </header>

      <section className="card" aria-labelledby="overviewTitle">
        <h2 id="overviewTitle">Odometer</h2>
        <div className="odo" aria-hidden="true"><span>—</span><small>km</small></div>
        <p className="empty" role="status">
          {LIVE_ODO_ENABLED
            ? 'Live odometer is not available in this build.'
            : 'Gated empty — live odometer is not loaded on GitHub Pages. Distance and battery stay blank until the session Worker ships.'}
        </p>
        <div className="stats" aria-hidden="true">
          <div className="stat"><div className="v">—<small> km</small></div><div className="k">Last 7 days</div></div>
          <div className="stat"><div className="v">—<small> km</small></div><div className="k">This month</div></div>
          <div className="stat"><div className="v">—<small> km</small></div><div className="k">This year</div></div>
          <div className="stat"><div className="v">—<small> km</small></div><div className="k">Daily average</div></div>
        </div>
      </section>

      <section className="card" aria-labelledby="chartTitle">
        <h2 id="chartTitle">Daily distance</h2>
        <p className="empty" role="status">No live distance history. This page does not call Supabase or Tesla.</p>
      </section>

      <section className="card" aria-labelledby="tiresTitle">
        <h2 id="tiresTitle">Tires</h2>
        <p className="empty">Sample summer / winter sets so the UI can be reviewed. Mileage is a reminder, not tread wear — and these numbers are not from the car.</p>
        <div id="tires">
          {sorted.map((s) => {
            const pct = Number(s.percent_used ?? 0);
            const cls = pct >= 100 ? 'bad' : pct >= 80 ? 'warn' : '';
            return (
              <div className="tire" key={s.tire_set_id}>
                <div className="tire-head">
                  <span className="tire-name">{s.name}</span>
                  {s.is_mounted ? <span className="badge on">On the car</span> : <span className="badge">Stored</span>}
                </div>
                <div className="bar"><i className={cls} style={{ width: `${Math.min(pct, 100)}%` }} /></div>
                <div className="tire-totals">
                  <span><b>{fmtKm(s.total_km)} km</b> accumulated</span>
                  <span><b>{fmtKm(s.km_remaining)} km</b> to mileage limit</span>
                </div>
                <p className="empty">
                  {fmtKm1(pct)}% of {fmtKm(s.recommended_max_km)} km limit
                  {s.brand_model ? ` · ${s.brand_model}` : ''}
                </p>
                <details className="tire-history">
                  <summary>Mounting details</summary>
                  <div className="tire-meta">
                    {s.is_mounted ? (
                      <span>Fitted <b>{fmtDate(s.mounted_since)}</b> (demo date)</span>
                    ) : (
                      <span>Not mounted</span>
                    )}
                    {s.times_mounted > 1 ? <span>Mounted <b>{s.times_mounted}</b> times this session</span> : null}
                  </div>
                </details>
              </div>
            );
          })}
        </div>
        <p className="empty tire-note">Demo data only. A real swap will persist after the Worker + Supabase proxy exists.</p>

        <details className="form-disclosure" open={changeOpen} onToggle={(e) => setChangeOpen(e.currentTarget.open)}>
          <summary>Record a tire change</summary>
          <form onSubmit={saveChange}>
            <div className="row">
              <div>
                <label htmlFor="chDate">Date</label>
                <input id="chDate" type="date" required value={chDate} onChange={(e) => setChDate(e.target.value)} />
              </div>
              <div>
                <label htmlFor="chSet">Set going on</label>
                <select id="chSet" required value={chSet} onChange={(e) => setChSet(e.target.value)}>
                  <option value="">Choose a tire set</option>
                  {sets.map((s) => (
                    <option key={s.tire_set_id} value={s.tire_set_id}>{s.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <p className="empty">Odometer at swap is omitted here — live odo stays gated off.</p>
            <div className="row" style={{ gridTemplateColumns: '1fr' }}>
              <div>
                <label htmlFor="chNote">Note (optional)</label>
                <input id="chNote" type="text" placeholder="e.g. winter tires fitted at the dealer" value={chNote} onChange={(e) => setChNote(e.target.value)} />
              </div>
            </div>
            <button type="submit">Save tire change</button>
            {changeMsg ? <div className={`msg ${changeMsg.kind}`} role="status">{changeMsg.text}</div> : null}
          </form>
        </details>

        <details className="form-disclosure" open={limitsOpen} onToggle={(e) => setLimitsOpen(e.currentTarget.open)}>
          <summary>Edit set limits</summary>
          <form onSubmit={saveLimits}>
            {sets.map((s) => (
              <div className="row" key={s.tire_set_id}>
                <div>
                  <label htmlFor={`limit-${s.tire_set_id}`}>{s.name} — mileage limit (km)</label>
                  <input id={`limit-${s.tire_set_id}`} name={`limit-${s.tire_set_id}`} type="number" min="1" step="1" required inputMode="numeric" defaultValue={s.recommended_max_km} key={`${s.tire_set_id}-${s.recommended_max_km}`} />
                </div>
                <div>
                  <label htmlFor={`brand-${s.tire_set_id}`}>{s.name} — brand / model</label>
                  <input id={`brand-${s.tire_set_id}`} name={`brand-${s.tire_set_id}`} type="text" defaultValue={s.brand_model ?? ''} key={`${s.tire_set_id}-${s.brand_model}`} />
                </div>
              </div>
            ))}
            <button type="submit">Save limits</button>
            {limitMsg ? <div className={`msg ${limitMsg.kind}`} role="status">{limitMsg.text}</div> : null}
          </form>
        </details>
      </section>

      <p className="foot">Mock PWA · no live vehicle data · https://car.burla.ca</p>

      {settingsOpen ? (
        <dialog className="settings" open aria-labelledby="settingsTitle" onClick={(e) => { if (e.target === e.currentTarget) setSettingsOpen(false); }}>
          <div className="dialog-panel">
            <div className="dialog-heading">
              <h2 id="settingsTitle">Settings</h2>
              <button type="button" className="ghost" onClick={() => setSettingsOpen(false)}>Close</button>
            </div>
            <h3>Live data</h3>
            <p className="empty">
              GitHub Pages must not hold a working Supabase anon client. Sign-in and odometer
              stay empty until a burla/Cloudflare Worker issues an httpOnly Secure SameSite
              session and proxies the database.
            </p>
            <h3>This build</h3>
            <p id="collectorStatus">Mode: mock / gated-empty. Sample sets: {SAMPLE_SETS.length}.</p>
            <button type="button" className="ghost" onClick={resetDemo}>Reset sample sets</button>
            <p className="empty">Clears this tab’s demo edits. Does not wake the car.</p>
          </div>
        </dialog>
      ) : null}
    </div>
  );
}
