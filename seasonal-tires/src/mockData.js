const nf = new Intl.NumberFormat('en-CA', { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat('en-CA', { maximumFractionDigits: 1 });
const df = new Intl.DateTimeFormat('en-CA', { month: 'short', day: 'numeric', year: 'numeric' });

export const fmtDate = (iso) => (iso ? df.format(new Date(`${iso}T12:00:00`)) : '—');
export const fmtKm = (n) => nf.format(n);
export const fmtKm1 = (n) => nf1.format(n);

export function torontoDate(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Toronto',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

/** Sample sets only — not a vehicle reading. */
export const SAMPLE_SETS = [
  {
    tire_set_id: 'summer',
    name: 'Summer',
    brand_model: 'Sample all-season / summer set',
    is_mounted: true,
    mounted_since: '2026-04-12',
    km_current_period: 0,
    total_km: 0,
    km_remaining: 40000,
    recommended_max_km: 40000,
    percent_used: 0,
    times_mounted: 1,
  },
  {
    tire_set_id: 'winter',
    name: 'Winter',
    brand_model: 'Sample winter set',
    is_mounted: false,
    mounted_since: null,
    km_current_period: 0,
    total_km: 0,
    km_remaining: 40000,
    recommended_max_km: 40000,
    percent_used: 0,
    times_mounted: 1,
  },
];

export function cloneSets(sets = SAMPLE_SETS) {
  return sets.map((s) => ({ ...s }));
}
