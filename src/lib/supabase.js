// ตัวแทน supabase-js: คง API เดิมไว้ แต่ส่งคำสั่งไป Google Apps Script (ฐานข้อมูล = Google Sheets)
const KEY = 'ff_session'
const POLL_MS = 10000
export const apiUrl = () => localStorage.getItem('api_url') || (typeof window !== 'undefined' && window.FF_API_URL) || import.meta.env.VITE_API_URL || ''
export const configured = Boolean(apiUrl())

let session = null
try { session = JSON.parse(localStorage.getItem(KEY) || 'null') } catch (e) { session = null }
const listeners = new Set()
const notify = (ev, s) => listeners.forEach(cb => { try { cb(ev, s) } catch (e) { /* ignore */ } })
function setSession(s) { session = s; s ? localStorage.setItem(KEY, JSON.stringify(s)) : localStorage.removeItem(KEY) }

export async function api(action, payload = {}) {
  let res
  try {
    // ส่งเป็น text/plain เพื่อเลี่ยง CORS preflight ของ Apps Script
    res = await fetch(apiUrl(), { method: 'POST', body: JSON.stringify({ action, token: session?.access_token, ...payload }) })
  } catch (e) { return { data: null, error: { message: 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ ตรวจอินเทอร์เน็ตหรือ API URL' } } }
  let j
  try { j = await res.json() } catch (e) { return { data: null, error: { message: 'เซิร์ฟเวอร์ตอบกลับผิดปกติ (ตรวจ API URL และการ Deploy ของ Apps Script)' } } }
  if (j?.error?.code === 'AUTH' && session) { setSession(null); notify('SIGNED_OUT', null) }
  return j
}

class Query {
  constructor(table) { this.q = { table, op: 'select', select: '*', filters: [], ors: [], order: [] } }
  select(cols = '*', opts = {}) {
    this.q.select = cols
    if (this.q.op === 'select') { if (opts.count) this.q.count = true; if (opts.head) this.q.head = true } else this.q.returning = true
    return this
  }
  insert(v) { this.q.op = 'insert'; this.q.values = v; return this }
  update(v) { this.q.op = 'update'; this.q.values = v; return this }
  upsert(v, o = {}) { this.q.op = 'upsert'; this.q.values = v; this.q.onConflict = o.onConflict; return this }
  delete() { this.q.op = 'delete'; return this }
  _f(op, col, val) { this.q.filters.push({ op, col, val }); return this }
  eq(c, v) { return this._f('eq', c, v) } neq(c, v) { return this._f('neq', c, v) }
  gt(c, v) { return this._f('gt', c, v) } gte(c, v) { return this._f('gte', c, v) }
  lt(c, v) { return this._f('lt', c, v) } lte(c, v) { return this._f('lte', c, v) }
  like(c, v) { return this._f('like', c, v) } ilike(c, v) { return this._f('ilike', c, v) }
  in(c, v) { return this._f('in', c, v) } is(c, v) { return this._f('is', c, v) }
  or(expr, o = {}) { this.q.ors.push({ expr, ref: o.referencedTable || o.foreignTable }); return this }
  order(c, o = {}) { this.q.order.push({ col: c, asc: o.ascending !== false }); return this }
  range(a, b) { this.q.range = [a, b]; return this }
  limit(n) { this.q.limit = n; return this }
  single() { this.q.single = true; return this }
  maybeSingle() { this.q.maybeSingle = true; return this }
  then(res, rej) { return api('query', { q: this.q }).then(res, rej) }
}

/* ---------- แทน Realtime: ตรวจเวอร์ชันของตารางทุก ~10 วินาที ---------- */
const subs = new Set()
let timer = null, last = null
async function poll() {
  if (document.hidden || !session || !subs.size) return
  const r = await api('versions')
  if (!r?.data) return
  if (last) {
    const changed = Object.keys(r.data).filter(t => r.data[t] !== last[t])
    if (changed.length) subs.forEach(ch => ch.handlers.forEach(h => changed.includes(h.table) && h.cb({})))
  }
  last = r.data
}
if (typeof document !== 'undefined') document.addEventListener('visibilitychange', () => { if (!document.hidden) poll() })

export const supabase = {
  from: (table) => new Query(table),
  rpc: (name, args = {}) => ({ then: (res, rej) => api('rpc', { name, args }).then(res, rej) }),
  channel() {
    return {
      handlers: [],
      on(_type, cfg, cb) { this.handlers.push({ table: cfg.table, cb }); return this },
      subscribe() { subs.add(this); if (!timer) timer = setInterval(poll, POLL_MS); return this }
    }
  },
  removeChannel(ch) { subs.delete(ch); if (!subs.size && timer) { clearInterval(timer); timer = null; last = null } },
  auth: {
    getSession: async () => ({ data: { session } }),
    onAuthStateChange(cb) { listeners.add(cb); return { data: { subscription: { unsubscribe() { listeners.delete(cb) } } } } },
    async signInWithPassword({ email, password }) {
      const r = await api('auth.login', { login: email, password, keep: localStorage.getItem('ff_keep') !== '0' })
      if (r.error) return { data: null, error: r.error }
      setSession(r.data.session); notify('SIGNED_IN', session)
      return { data: { user: session.user, session }, error: null }
    },
    async signInWithGoogle(credential) {
      const r = await api('auth.google', { credential, keep: localStorage.getItem('ff_keep') !== '0' })
      if (r.error) return { data: null, error: r.error }
      setSession(r.data.session); notify('SIGNED_IN', session)
      return { data: { user: session.user, session }, error: null }
    },
    async signOut() { await api('auth.logout'); setSession(null); notify('SIGNED_OUT', null); return { error: null } },
    async updateUser({ password }) { const r = await api('auth.update_password', { password }); return { data: null, error: r.error || null } }
  }
}
