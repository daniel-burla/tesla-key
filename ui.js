// Shared dashboard interactions, used by production and the fixture preview.
import { renderOdometer, renderChart, renderTires, renderStatus, collectSetEdits, say, torontoDate } from './render.js?v=8';

// Ignore repeated submissions while an operation is in flight.
export function onceWhilePending(action) {
  let pending = false;
  return async (...args) => {
    if (pending) return;
    pending = true;
    try { return await action(...args); }
    finally { pending = false; }
  };
}

export async function saveSetEdits(edits, update) {
  const saved = [];
  for (const [id, patch] of Object.entries(edits)) {
    try {
      const result = await update(id, patch);
      if (result.error) return { saved, failed: id, error: result.error };
      saved.push(id);
    } catch (error) { return { saved, failed: id, error }; }
  }
  return { saved };
}

export function createDashboard(sb) {
  const $ = (id) => document.getElementById(id);
  let vehicleId = null;
  let latestReading = null;
  let tireSets = [];
  let saving = false;
  let disposed = false;
  let status = { readingLoading: true, runLoading: true };
  const pending = new Map();
  const refreshStatus = () => renderStatus(status);
  const timer = setInterval(refreshStatus, 60000);
  const onVisible = () => { if (!document.hidden) refreshStatus(); };
  document.addEventListener('visibilitychange', onVisible);
  refreshStatus();

  const dialog = $('settingsDialog');
  $('openSettings').onclick = () => dialog.showModal();
  $('closeSettings').onclick = () => dialog.close();
  dialog.addEventListener('close', () => $('openSettings').focus());
  dialog.addEventListener('keydown', (event) => {
    if (event.key !== 'Tab') return;
    const targets = [...dialog.querySelectorAll('button:not([disabled]), summary, input:not([disabled]), select:not([disabled]), [tabindex="0"]')]
      .filter((el) => el.getClientRects().length);
    const first = targets[0], last = targets.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault(); last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault(); first?.focus();
    }
  });
  dialog.addEventListener('click', (event) => {
    if (event.target !== dialog) return;
    const r = dialog.getBoundingClientRect();
    if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) dialog.close();
  });

  const sectionState = (section, state, message = '') => {
    const title = section[0].toUpperCase() + section.slice(1);
    $(section + 'Section').setAttribute('aria-busy', String(state === 'loading'));
    $(section + 'Content').hidden = state !== 'ready';
    $(section + 'Feedback').textContent = message;
    $(section + 'Feedback').hidden = !message;
    $('retry' + title).hidden = state !== 'error';
    $('retry' + title).disabled = state === 'loading';
  };
  const safe = async (query) => {
    let result;
    try { result = await query; } catch (error) { result = { data: null, error }; }
    if (disposed) throw new Error('Dashboard closed');
    return result;
  };

  async function loadSection(section) {
    if (pending.has(section)) return pending.get(section);
    const work = (async () => {
      if (['overview', 'chart', 'tires'].includes(section)) sectionState(section, 'loading', 'Loading…');
      else {
        status[section === 'reading' ? 'readingLoading' : 'runLoading'] = true;
        $('retry' + (section === 'reading' ? 'Reading' : 'Collector')).hidden = true;
        refreshStatus();
      }
      if (!vehicleId) {
        const result = await safe(sb.from('vehicles').select('id, display_name, model').limit(1));
        if (result.error) throw new Error('Unable to load vehicle');
        if (!result.data?.length) throw new Error('No vehicle has been set up yet.');
        vehicleId = result.data[0].id;
        const models = { models: 'Model S', model3: 'Model 3', modelx: 'Model X', modely: 'Model Y' };
        $('carName').textContent = result.data[0].display_name || models[result.data[0].model] || 'Tesla';
      }
      const since = torontoDate(new Date(Date.now() - 400 * 864e5));
      if (section === 'reading') {
        const r = await safe(sb.from('daily_snapshots').select('captured_at, odometer_km, snapshot_date')
          .eq('vehicle_id', vehicleId).not('odometer_km', 'is', null)
          .order('captured_at', { ascending: false }).limit(1).maybeSingle());
        status.reading = r.data; status.readingError = Boolean(r.error); status.readingLoading = false;
        latestReading = r.error ? null : r.data;
        $('retryReading').hidden = !r.error;
        $('useOdometer').hidden = !latestReading;
        if (latestReading) $('useOdometer').textContent = `Use last recorded odometer: ${latestReading.odometer_km} km (${latestReading.snapshot_date})`;
        refreshStatus();
      } else if (section === 'collector') {
        const r = await safe(sb.from('collector_runs').select('ran_at, ok, detail').order('ran_at', { ascending: false }).limit(1));
        status.run = r.data?.[0]; status.runError = Boolean(r.error); status.runLoading = false;
        $('retryCollector').hidden = !r.error;
        refreshStatus();
      } else if (section === 'overview') {
        const r = await safe(sb.from('daily_snapshots').select('snapshot_date, odometer_km, battery_level')
          .eq('vehicle_id', vehicleId).gte('snapshot_date', since).not('odometer_km', 'is', null).order('snapshot_date'));
        if (r.error) throw r.error;
        renderOdometer(r.data ?? []);
        sectionState(section, 'ready', !r.data?.length ? 'No readings in the last 400 days.' : r.data.length < 2 ? 'Mileage comparisons need a second reading.' : '');
      } else if (section === 'chart') {
        const r = await safe(sb.from('daily_driving').select('snapshot_date, km_per_day, days_covered, previous_date')
          .eq('vehicle_id', vehicleId).gte('snapshot_date', since).order('snapshot_date'));
        if (r.error) throw r.error;
        sectionState(section, 'ready');
        renderChart(r.data ?? []);
      } else if (section === 'tires') {
        const [usage, projection] = await Promise.all([
          safe(sb.from('tire_set_usage').select('*').eq('vehicle_id', vehicleId).order('name')),
          safe(sb.from('tire_projection').select('*').eq('vehicle_id', vehicleId)),
        ]);
        if (usage.error || projection.error) throw usage.error || projection.error;
        tireSets = usage.data ?? [];
        renderTires(tireSets, projection.data ?? []);
        sectionState(section, 'ready');
      }
    })().catch(() => {
      if (disposed) return;
      if (['overview', 'chart', 'tires'].includes(section)) {
        sectionState(section, 'error', `Unable to load ${section === 'chart' ? 'distance history' : section === 'tires' ? 'tire sets' : 'overview'}. Please retry.`);
      } else {
        status[section === 'reading' ? 'readingError' : 'runError'] = true;
        status[section === 'reading' ? 'readingLoading' : 'runLoading'] = false;
        $('retry' + (section === 'reading' ? 'Reading' : 'Collector')).hidden = false;
        if (section === 'reading') { latestReading = null; $('useOdometer').hidden = true; }
        refreshStatus();
      }
    }).finally(() => pending.delete(section));
    pending.set(section, work);
    return work;
  }

  const sections = ['reading', 'overview', 'chart', 'tires', 'collector'];
  const refresh = onceWhilePending(async () => {
    if (saving) { say($('settingsMsg'), 'A save is in progress. Refresh after it finishes.'); return; }
    const button = $('refreshDashboard');
    button.disabled = true; button.textContent = 'Refreshing…';
    say($('settingsMsg'), '');
    try { await Promise.all(sections.map(loadSection)); }
    finally { button.disabled = false; button.textContent = 'Refresh dashboard'; }
  });
  for (const section of sections) {
    $('retry' + section[0].toUpperCase() + section.slice(1)).onclick = () => loadSection(section);
  }
  $('refreshDashboard').onclick = refresh;
  $('chDate').value = torontoDate();
  $('useOdometer').onclick = () => {
    if (latestReading) { $('chOdo').value = latestReading.odometer_km; $('chOdo').focus(); }
  };

  function invalid(input, message, messageId) {
    input.setAttribute('aria-invalid', 'true');
    input.setAttribute('aria-describedby', messageId);
    say($(messageId), message, 'err');
    input.focus();
  }
  for (const id of ['changeDetails', 'limitsDetails']) {
    $(id).addEventListener('input', (event) => { event.target.removeAttribute('aria-invalid'); event.target.removeAttribute('aria-describedby'); });
  }
  function lockForms(locked) {
    saving = locked;
    document.querySelectorAll('#changeDetails input, #changeDetails select, #changeDetails button, #limitsDetails input, #limitsDetails button').forEach((el) => { el.disabled = locked; });
  }

  const saveChange = onceWhilePending(async () => {
    if (saving || !vehicleId) return;
    if (!$('chDate').value || !$('chDate').checkValidity()) return invalid($('chDate'), 'Choose a valid tire-change date.', 'changeMsg');
    if (!tireSets.some((s) => s.tire_set_id === $('chSet').value)) return invalid($('chSet'), 'Choose the tire set going on the car.', 'changeMsg');
    const odo = Number($('chOdo').value);
    if (!Number.isFinite(odo) || odo <= 0 || !$('chOdo').checkValidity()) return invalid($('chOdo'), 'Enter an odometer reading greater than zero.', 'changeMsg');
    lockForms(true); $('saveChange').textContent = 'Saving…'; say($('changeMsg'), '');
    let saved = false;
    try {
      const r = await safe(sb.from('tire_changes').insert({ vehicle_id: vehicleId, tire_set_id: $('chSet').value,
        changed_on: $('chDate').value, odometer_km: odo, note: $('chNote').value || null }));
      if (r.error) {
        say($('changeMsg'), r.error.code === '23505' ? 'A tire change already exists on this date. Check the date before trying again.' : 'Could not save the tire change. Your entries are still here; please retry.', 'err');
      } else {
        saved = true;
        $('chNote').value = ''; $('chOdo').value = ''; $('chSet').value = '';
        say($('changeMsg'), 'Tire change saved.');
      }
    } finally { lockForms(false); $('saveChange').textContent = 'Save tire change'; }
    if (saved) await loadSection('tires');
  });
  $('saveChange').onclick = saveChange;

  const saveSets = onceWhilePending(async () => {
    if (saving || !vehicleId) return;
    const inputs = [...document.querySelectorAll('#setEditors input[data-field="recommended_max_km"]')];
    for (const input of inputs) {
      if (!Number.isFinite(Number(input.value)) || Number(input.value) <= 0 || !input.checkValidity()) {
        return invalid(input, `Enter a positive whole-number mileage limit for ${input.dataset.name}.`, 'setMsg');
      }
    }
    const edits = collectSetEdits();
    lockForms(true); $('saveSets').textContent = 'Saving…'; say($('setMsg'), '');
    let result;
    try {
      result = await saveSetEdits(edits, (id, patch) => sb.from('tire_sets').update(patch).eq('id', id));
      if (result.failed) {
        const name = tireSets.find((s) => s.tire_set_id === result.failed)?.name ?? 'this set';
        const savedNames = result.saved.map((id) => tireSets.find((s) => s.tire_set_id === id)?.name ?? id);
        say($('setMsg'), `${savedNames.length ? `Saved ${savedNames.join(', ')}. ` : ''}Could not save ${name}. Remaining edits are still here; please retry.`, 'err');
      } else say($('setMsg'), 'Tire limits saved.');
    } finally { lockForms(false); $('saveSets').textContent = 'Save limits'; }
    // Keep the editors mounted, including after a partial save.
    if (result?.saved.length) await loadSection('tires');
  });
  $('setEditors').addEventListener('click', (event) => { if (event.target.id === 'saveSets') saveSets(); });
  return { refresh, loadSection, saveChange, saveSets,
    destroy() { disposed = true; clearInterval(timer); document.removeEventListener('visibilitychange', onVisible); } };
}
