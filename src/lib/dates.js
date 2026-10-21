export const fmt = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
export function rangeOf(preset) {
  const now = new Date(), t = fmt(now)
  if (preset === 'today') return { from: t, to: t }
  if (preset === '7d') { const d = new Date(now); d.setDate(d.getDate() - 6); return { from: fmt(d), to: t } }
  if (preset === 'month') return { from: fmt(new Date(now.getFullYear(), now.getMonth(), 1)), to: t }
  if (preset === 'all') return { from: '2000-01-01', to: t }
  return { from: t, to: t }
}
export function daysBetween(from, to) {
  const out = [], d = new Date(from + 'T00:00:00'), end = new Date(to + 'T00:00:00')
  while (d <= end && out.length < 400) { out.push(fmt(d)); d.setDate(d.getDate() + 1) }
  return out
}
export const thDate = (s) => new Date(s + 'T00:00:00').toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: '2-digit' })
export const thDateLong = (s) => s ? new Date(s + 'T00:00:00').toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' }) : '-'
