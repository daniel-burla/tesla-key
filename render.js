// Pure rendering. No network, no auth — everything here takes plain data and
// writes to the DOM, so dev-preview.html can exercise the whole UI with fixtures
// before a single real reading exists.

const $ = (id) => document.getElementById(id);
const nf = new Intl.NumberFormat('en-CA', { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat('en-CA', { maximumFractionDigits: 1 });
const df = new Intl.DateTimeFormat('en-CA', { month: 'short', day: 'numeric', year: 'numeric' });

export const fmtDate = (iso) => (iso ? df.format(new Date(iso + 'T12:00:00')) : '—');

export const esc = (s) => String(s).replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const say = (el, text, kind = 'ok') => {
  el.innerHTML = text ? `<div class="msg ${kind}">${esc(text)}</div>` : '';
};

export const torontoDate = (date = new Date()) => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Toronto', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(date);

let chart = null;

/**
 * Distance over a window, taken from the odometer rather than by summing daily
 * deltas: the odometer is cumulative, so this stays exact even when collection
 * days are missing.
 */
export function distanceSince(rows, isoDate) {
  if (!rows.length) return 0;
  const latest = rows.at(-1);
  const prior = rows.filter((r) => r.snapshot_date < isoDate);
  const base = prior.length ? prior.at(-1).odometer_km : rows[0].odometer_km;
  return Math.max(latest.odometer_km - base, 0);
}

export function renderOdometer(rows) {
  for (const id of ['odo', 'battery', 'kmWeek', 'kmMonth', 'kmYear', 'avgDay']) $(id).textContent = '—';
  if (!rows.length) return;

  const latest = rows.at(-1);
  $('odo').textContent = nf.format(latest.odometer_km);
  $('battery').textContent = latest.battery_level != null ? `${latest.battery_level}%` : '—';

  // Every figure below is a difference between two readings. With only one on
  // record there is nothing to subtract, and printing 0 would read as "you drove
  // nothing", which is a claim the data does not support.
  if (rows.length < 2) {
    for (const id of ['kmWeek', 'kmMonth', 'kmYear', 'avgDay']) $(id).textContent = '—';
    return;
  }

  const today = new Date(torontoDate() + 'T12:00:00Z');
  const iso = torontoDate;
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);

  $('kmWeek').textContent  = nf.format(distanceSince(rows, iso(weekAgo)));
  $('kmMonth').textContent = nf.format(distanceSince(rows, `${iso(today).slice(0, 7)}-01`));
  $('kmYear').textContent  = nf.format(distanceSince(rows, `${today.getFullYear()}-01-01`));

  const first = rows[0];
  const days = Math.max((new Date(latest.snapshot_date) - new Date(first.snapshot_date)) / 864e5, 1);
  $('avgDay').textContent = nf1.format((latest.odometer_km - first.odometer_km) / days);
}

export function renderChart(rows) {
  const recent = rows.filter((r) => r.km_per_day != null).slice(-60);
  const css = (name) => getComputedStyle(document.body).getPropertyValue(name).trim();
  chart?.destroy(); chart = null;
  $('distanceDetails').hidden = !recent.length;
  $('chartFrame').hidden = !recent.length;
  $('chartNote').hidden = false;
  $('distanceRows').innerHTML = recent.map((r) => `<tr>
    <th scope="row">${fmtDate(r.snapshot_date)}</th>
    <td>${nf1.format(r.km_per_day)} ${r.days_covered > 1 ? 'km/day average' : 'km'}</td>
    <td>${r.days_covered > 1 ? `${r.days_covered} days since ${fmtDate(r.previous_date)}` : '1 day'}</td>
  </tr>`).join('');
  if (!recent.length) {
    $('chartNote').textContent = 'A second reading is needed to calculate distance. Check back after the next collection.';
    return;
  }
  const zero = recent.every((r) => Number(r.km_per_day) === 0);
  const gaps = recent.some((r) => r.days_covered > 1);
  $('chartNote').textContent = zero ? 'No distance recorded between these readings.'
    : gaps ? 'Missing days are shown as a daily average at the next reading. Tap a bar or view the values below.'
    : 'Last 60 available comparisons. Tap a bar or view the values below.';
  // A zero-only plot has no visible bars; its empty axes and touch tooltip look
  // like a broken chart. Keep the explanation and exact values instead.
  if (zero) {
    $('chartFrame').hidden = true;
    return;
  }
  if (typeof Chart === 'undefined') {
    $('chartFrame').hidden = true;
    $('chartNote').textContent += ' The chart could not load; distance values are available below.';
    return;
  }
  chart = new Chart($('kmChart'), {
    type: 'bar',
    data: {
      labels: recent.map((r) => new Intl.DateTimeFormat('en-CA', { month: 'short', day: 'numeric' }).format(new Date(r.snapshot_date + 'T12:00:00'))),
      datasets: [{ data: recent.map((r) => r.km_per_day), backgroundColor: css('--accent'), borderRadius: 3 }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      animation: matchMedia('(prefers-reduced-motion: reduce)').matches ? false : undefined,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: {
          title: (items) => fmtDate(recent[items[0].dataIndex].snapshot_date),
          label: (c) => `${nf1.format(c.parsed.y)} ${recent[c.dataIndex].days_covered > 1 ? 'km/day average' : 'km'}`,
          afterLabel: (c) => { const r = recent[c.dataIndex]; return r.days_covered > 1 ? `Across ${r.days_covered} days since ${fmtDate(r.previous_date)}` : ''; },
        } },
      },
      scales: {
        x: { grid: { display: false }, ticks: { color: css('--muted'), maxRotation: 0, maxTicksLimit: 5, font: { size: 12 } } },
        y: { title: { display: true, text: 'km / day', color: css('--muted') }, grid: { color: css('--line') }, ticks: { color: css('--muted'), maxTicksLimit: 5, font: { size: 12 } }, beginAtZero: true },
      },
    },
  });
}

export function renderTires(sets, projections, { resetEditors = false } = {}) {
  sets = [...sets].sort((a, b) => Number(b.is_mounted) - Number(a.is_mounted) || a.name.localeCompare(b.name));
  const projFor = (id) => projections.find((p) => p.tire_set_id === id);

  $('tires').innerHTML = sets.map((s) => {
    const pct = Number(s.percent_used ?? 0);
    const cls = pct >= 100 ? 'bad' : pct >= 80 ? 'warn' : '';
    const p = projFor(s.tire_set_id);
    return `
      <div class="tire">
        <div class="tire-head">
          <span class="tire-name">${esc(s.name)}</span>
          ${s.is_mounted ? '<span class="badge on">On the car</span>' : '<span class="badge">Stored</span>'}
        </div>
        <div class="bar"><i class="${cls}" style="width:${Math.min(pct, 100)}%"></i></div>
        <div class="tire-totals"><span><b>${nf.format(s.total_km)} km</b> accumulated</span>
          <span><b>${nf.format(s.km_remaining)} km</b> to mileage limit</span></div>
        <p class="empty">${nf1.format(pct)}% of ${nf.format(s.recommended_max_km)} km limit${pct >= 100 ? ' · Limit reached' : pct >= 80 ? ' · Near limit' : ''}</p>
        <details class="tire-history"><summary>Mounting details</summary><div class="tire-meta">
          ${s.is_mounted ? `<span>Fitted <b>${fmtDate(s.mounted_since)}</b>, <b>${nf.format(s.km_current_period)}</b> km this stint</span>` : ''}
          ${s.times_mounted > 1 ? `<span>Mounted <b>${s.times_mounted}</b> times</span>` : ''}
          ${p?.projected_max_date ? `<span>Reaches limit around <b>${fmtDate(p.projected_max_date)}</b></span>` : ''}
        </div></details>
      </div>`;
  }).join('') || '<p class="empty">No tire sets have been added yet.</p>';
  if (sets.length) $('tires').insertAdjacentHTML('beforeend', '<p class="empty tire-note">Mileage is a reminder, not a measurement of tread wear.</p>');

  const selected = $('chSet').value;
  $('chSet').innerHTML = '<option value="">Choose a tire set</option>'
    + sets.map((s) => `<option value="${esc(s.tire_set_id)}">${esc(s.name)}</option>`).join('');
  if (sets.some((s) => s.tire_set_id === selected)) $('chSet').value = selected;
  if (!$('chDate').value) $('chDate').value = torontoDate();

  // Refreshing the cards must not discard an in-progress limit edit.
  if (resetEditors || !$('setEditors').children.length) {
    $('setEditors').innerHTML = sets.map((s) => `
      <div class="row">
        <div><label for="limit-${esc(s.tire_set_id)}">${esc(s.name)} — mileage limit (km)</label>
          <input id="limit-${esc(s.tire_set_id)}" type="number" min="1" step="1" required inputmode="numeric" data-name="${esc(s.name)}" data-set="${esc(s.tire_set_id)}" data-field="recommended_max_km" value="${s.recommended_max_km}"></div>
        <div><label for="brand-${esc(s.tire_set_id)}">${esc(s.name)} — brand / model</label>
          <input id="brand-${esc(s.tire_set_id)}" type="text" data-set="${esc(s.tire_set_id)}" data-field="brand_model" value="${esc(s.brand_model ?? '')}"></div>
      </div>`).join('') + (sets.length ? '<button id="saveSets">Save limits</button>' : '<p class="empty">No tire sets to edit.</p>');
  }

}

/** Reads the edited limit fields back out of the DOM, keyed by tire set id. */
export function collectSetEdits() {
  const byId = {};
  document.querySelectorAll('#setEditors input').forEach((i) => {
    byId[i.dataset.set] ??= {};
    byId[i.dataset.set][i.dataset.field] =
      i.dataset.field === 'recommended_max_km' ? Number(i.value) : (i.value || null);
  });
  return byId;
}

const statusDate = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Toronto', year: 'numeric', month: 'short', day: 'numeric',
  hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
});

// Run success is deliberately independent of reading freshness: a successful
// attempt may have skipped the read or found the car still asleep.
export function renderStatus({ reading = null, run = null, readingError = false,
  runError = false, readingLoading = false, runLoading = false } = {}, now = Date.now()) {
  const readingEl = $('asOf');
  const captured = Date.parse(reading?.captured_at);
  readingEl.dataset.status = 'unknown';
  $('readingAge').textContent = '';
  $('readingTime').textContent = '';
  if (readingLoading) {
    $('readingState').textContent = 'Loading reading…';
  } else if (readingError) {
    $('readingState').textContent = 'Unable to check';
  } else if (!reading || reading.odometer_km == null) {
    $('readingState').textContent = 'No readings yet';
  } else if (!Number.isFinite(captured) || captured > now) {
    $('readingState').textContent = 'Unable to check';
  } else {
    const age = now - captured;
    const minutes = Math.floor(age / 60000);
    const ageText = minutes < 1 ? 'less than a minute ago'
      : minutes < 60 ? `${minutes} min ago`
      : `${Math.floor(minutes / 60)}h ${minutes % 60}m ago`;
    const fresh = age <= 36 * 3600000;
    readingEl.dataset.status = fresh ? 'fresh' : 'outdated';
    $('readingState').textContent = fresh ? 'Fresh' : 'Outdated';
    $('readingAge').textContent = ` · ${ageText}`;
    $('readingTime').textContent = statusDate.format(captured);
  }

  const collectorEl = $('collectorStatus');
  collectorEl.dataset.status = 'unknown';
  $('collectorDetail').textContent = runError ? '' : (run?.detail ?? 'No diagnostic details available.');
  $('collectorDetails').hidden = runLoading || runError || !run;
  if (runLoading) {
    collectorEl.textContent = 'Loading collection status…';
  } else if (runError) {
    collectorEl.textContent = 'Collector: Unable to check';
  } else if (!run) {
    collectorEl.textContent = 'Collector: No attempts yet';
  } else if (!Number.isFinite(Date.parse(run.ran_at))) {
    collectorEl.textContent = 'Collector: Unable to check';
  } else {
    collectorEl.dataset.status = run.ok ? 'completed' : 'failed';
    collectorEl.textContent = `Collector: ${run.ok ? 'Completed' : 'Failed'} · `
      + `${statusDate.format(new Date(run.ran_at))}`;
  }
}
