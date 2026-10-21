/**
 * FF Portal — Backend บน Google Apps Script + Google Sheets (ฐานข้อมูล) + Google Drive (รูป/PDF)
 * วิธีติดตั้ง: สร้าง Google Sheet ใหม่ → ส่วนขยาย → Apps Script → วางโค้ดนี้ → ตั้ง ADMIN_USERNAME/ADMIN_PASSWORD
 * → เลือกฟังก์ชัน setup กดเรียกใช้ (ครั้งเดียว) → ทำให้ใช้งานได้ (Web app, Execute as: Me, Anyone)
 */
const ADMIN_USERNAME = 'admin';
const ADMIN_PASSWORD = 'เปลี่ยนรหัสนี้ก่อนรัน setup';
const SHEET_ID = '';                    // เว้นว่างถ้าสร้างสคริปต์จากเมนูของ Google Sheet (container-bound)
// Client ID จาก Google Cloud Console (OAuth client แบบ Web) ใช้เปิดปุ่ม "Sign in with Google" — เว้นว่างถ้าไม่ใช้
const GOOGLE_CLIENT_ID = '';
const ROOT_FOLDER = 'FF-Portal-Uploads';
const PW_ROUNDS = 1000;
const SESSION_KEEP_DAYS = 30, SESSION_SHORT_HOURS = 12;

/* ===================== โครงสร้างตาราง ===================== */
const SCHEMA = {
  settings: ['id', 'shop_name', 'logo_url', 'theme', 'integrations', 'company', 'permissions', 'updated_at'],
  customers: ['id', 'name', 'company_name', 'address', 'tax_id', 'phone', 'email', 'contact_name', 'note', 'pack_prices', 'share_token', 'share_enabled', 'created_at'],
  profiles: ['id', 'email', 'username', 'nickname', 'department', 'avatar_url', 'role', 'customer_id', 'last_login_at', 'created_at', 'salt', 'pwhash'],
  products: ['id', 'customer_id', 'sku', 'name', 'category', 'unit', 'image_url', 'zone', 'stock', 'reorder_point', 'locked', 'updated_at', 'created_at'],
  transactions: ['id', 'customer_id', 'product_id', 'type', 'tx_date', 'qty', 'stock_before', 'stock_after', 'ref_no', 'reason', 'note', 'evidence_url', 'created_by', 'created_at', 'channel', 'orders', 'box_size', 'return_cause', 'return_condition'],
  invoices: ['id', 'customer_id', 'invoice_no', 'issue_date', 'due_date', 'period_from', 'period_to', 'items', 'discount', 'vat_rate', 'wht_rate', 'subtotal', 'vat', 'wht', 'total', 'net_total', 'note', 'status', 'pdf_url', 'slip_url', 'paid_at', 'receipt_no', 'receipt_pdf_url', 'created_by', 'created_at'],
  bill_items: ['id', 'name', 'unit_price', 'created_at'],
  channels: ['name', 'sort', 'created_at'],
  box_sizes: ['name', 'sort'],
  sessions: ['token', 'user_id', 'expires_at', 'created_at']
};
const JSON_COLS = { settings: ['theme', 'integrations', 'company', 'permissions'], customers: ['pack_prices'], invoices: ['items'] };
const NUM_COLS = {
  products: ['stock', 'reorder_point'], transactions: ['qty', 'stock_before', 'stock_after', 'orders'],
  invoices: ['discount', 'vat_rate', 'wht_rate', 'subtotal', 'vat', 'wht', 'total', 'net_total'],
  bill_items: ['unit_price'], channels: ['sort'], box_sizes: ['sort']
};
const BOOL_COLS = { products: ['locked'], customers: ['share_enabled'] };
const HIDDEN = { profiles: ['salt', 'pwhash'] };
const UNIQUE = { products: ['customer_id', 'sku'], invoices: ['invoice_no'], channels: ['name'], box_sizes: ['name'] };
const REL = {
  transactions: { products: ['product_id', 'products'], customers: ['customer_id', 'customers'], profiles: ['created_by', 'profiles'] },
  products: { customers: ['customer_id', 'customers'] },
  invoices: { customers: ['customer_id', 'customers'] }
};
const FK_DELETE = { customers: [['products', 'customer_id'], ['transactions', 'customer_id'], ['invoices', 'customer_id']], products: [['transactions', 'product_id']] };

const DEFAULT_PERMS = {
  staff: { 'dashboard.view': true, 'stock.view': true, 'stock.edit': true, 'stock.delete': false, 'in.view': true, 'out.view': true, 'return.view': true, 'tx.create': true, 'tx.edit': true, 'tx.delete': false, 'bill.view': true, 'bill.edit': true, 'bill.delete': false, 'bill.slip': true, 'cust.view': true, 'cust.edit': true, 'cust.delete': false },
  viewer: { 'dashboard.view': true, 'stock.view': false, 'stock.edit': false, 'stock.delete': false, 'in.view': true, 'out.view': true, 'return.view': true, 'tx.create': false, 'tx.edit': false, 'tx.delete': false, 'bill.view': true, 'bill.edit': false, 'bill.delete': false, 'bill.slip': true, 'cust.view': false, 'cust.edit': false, 'cust.delete': false }
};

/* ===================== เครื่องมือพื้นฐาน ===================== */
const TZ = () => Session.getScriptTimeZone();
const nowIso = () => new Date().toISOString();
const uuid = () => Utilities.getUuid();
const has = (o, k) => o && Object.prototype.hasOwnProperty.call(o, k);
function fail(msg, code) { const e = new Error(msg); if (code) e.code = code; throw e; }
function parseJ(v, d) { if (v === '' || v == null) return d; try { return JSON.parse(v); } catch (e) { return d; } }

let _ss = null;
function ss() { return _ss || (_ss = SHEET_ID ? SpreadsheetApp.openById(SHEET_ID) : SpreadsheetApp.getActiveSpreadsheet()); }

function toCell(t, c, v) {
  if (v === null || v === undefined) return '';
  if (has(JSON_COLS, t) && JSON_COLS[t].indexOf(c) >= 0) return typeof v === 'string' ? v : JSON.stringify(v);
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  return String(v);
}
function fromCell(t, c, v) {
  if (v instanceof Date) v = Utilities.formatDate(v, TZ(), 'yyyy-MM-dd');
  if (has(JSON_COLS, t) && JSON_COLS[t].indexOf(c) >= 0) return parseJ(v, c === 'items' ? [] : {});
  if (v === '' || v == null) return null;
  if (has(NUM_COLS, t) && NUM_COLS[t].indexOf(c) >= 0) return Number(v);
  if (has(BOOL_COLS, t) && BOOL_COLS[t].indexOf(c) >= 0) return v === true || v === 'true' || v === 'TRUE';
  return String(v);
}

/* ---------- แคช + เวอร์ชัน (ใช้ทำ polling แทน realtime) ---------- */
let _props = null, _memo = {};
function props() { return _props || (_props = PropertiesService.getScriptProperties().getProperties()); }
function ver(t) { return props()['v_' + t] || '0'; }
function bump(t) {
  const n = String((Number(ver(t)) || 0) + 1);
  PropertiesService.getScriptProperties().setProperty('v_' + t, n);
  props()['v_' + t] = n; delete _memo[t];
}
function cachePutBig(key, obj) {
  try {
    const s = JSON.stringify(obj), size = 30000, n = Math.ceil(s.length / size), m = {};
    for (let i = 0; i < n; i++) m[key + '_' + i] = s.substr(i * size, size);
    m[key + '_n'] = String(n);
    CacheService.getScriptCache().putAll(m, 900);
  } catch (e) { /* ใหญ่เกินแคช → อ่านจากชีตตรงๆ */ }
}
function cacheGetBig(key) {
  try {
    const c = CacheService.getScriptCache(), n = Number(c.get(key + '_n'));
    if (!n) return null;
    const keys = []; for (let i = 0; i < n; i++) keys.push(key + '_' + i);
    const got = c.getAll(keys); let s = '';
    for (let i = 0; i < n; i++) { if (got[key + '_' + i] == null) return null; s += got[key + '_' + i]; }
    return JSON.parse(s);
  } catch (e) { return null; }
}
function readSheet(t) {
  const cols = SCHEMA[t], sh = ss().getSheetByName(t);
  if (!sh) return [];
  const lr = sh.getLastRow(); if (lr < 2) return [];
  const vals = sh.getRange(2, 1, lr - 1, cols.length).getValues(), out = [];
  vals.forEach((r, i) => {
    if (r[0] === '' || r[0] == null) return;
    const o = { _row: i + 2 }; cols.forEach((c, j) => { o[c] = fromCell(t, c, r[j]); }); out.push(o);
  });
  return out;
}
function loadTable(t) {
  if (_memo[t]) return _memo[t];
  const key = 't_' + t + '_' + ver(t);
  let rows = cacheGetBig(key);
  if (!rows) { rows = readSheet(t); cachePutBig(key, rows); }
  return (_memo[t] = rows);
}

/* ---------- เขียนข้อมูล ---------- */
function ensureCapacity(sh, row, ncols) {
  const max = sh.getMaxRows();
  if (max < row) {
    const add = Math.max(500, row - max);
    sh.insertRowsAfter(max, add);
    sh.getRange(max + 1, 1, add, ncols).setNumberFormat('@');
  }
}
function rowCells(t, o) { return SCHEMA[t].map(c => toCell(t, c, o[c])); }
function insertRow(t, o) {
  const sh = ss().getSheetByName(t), n = SCHEMA[t].length, row = sh.getLastRow() + 1;
  ensureCapacity(sh, row, n);
  sh.getRange(row, 1, 1, n).setValues([rowCells(t, o)]);
  bump(t);
}
function writeRow(t, row, o) {
  const sh = ss().getSheetByName(t), n = SCHEMA[t].length;
  sh.getRange(row, 1, 1, n).setValues([rowCells(t, o)]);
  bump(t);
}
function deleteRowAt(t, row) { ss().getSheetByName(t).deleteRow(row); bump(t); }
function withLock(fn) {
  const lock = LockService.getScriptLock();
  lock.waitLock(25000);
  try { return fn(); } finally { lock.releaseLock(); }
}

/* ===================== รหัสผ่าน / เซสชัน ===================== */
function hex(bytes) { return bytes.map(b => ('0' + (b & 0xff).toString(16)).slice(-2)).join(''); }
function hashPw(salt, pw) {
  let h = salt + ':' + pw;
  for (let i = 0; i < PW_ROUNDS; i++) h = hex(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, h));
  return h;
}
function publicUser(p) { return p && { id: p.id, email: p.email, username: p.username, nickname: p.nickname, department: p.department, avatar_url: p.avatar_url, role: p.role, customer_id: p.customer_id }; }
function userById(id) { return publicUser(loadTable('profiles').find(p => p.id === id)); }

function login(b) {
  const id = String(b.login || '').trim().toLowerCase(), pw = String(b.password || '');
  const cache = CacheService.getScriptCache(), fk = 'fail_' + id.replace(/[^a-z0-9@._-]/g, '').slice(0, 60);
  if (Number(cache.get(fk) || 0) >= 6) fail('ลองผิดหลายครั้งเกินไป กรุณารอ 10 นาที', 'LOCKED');
  const p = id && loadTable('profiles').find(r => (r.username || '').toLowerCase() === id || (r.email || '').toLowerCase() === id);
  if (!p || !p.pwhash || hashPw(p.salt, pw) !== p.pwhash) {
    cache.put(fk, String(Number(cache.get(fk) || 0) + 1), 600);
    Utilities.sleep(300);
    fail('ชื่อผู้ใช้/อีเมล หรือรหัสผ่านไม่ถูกต้อง', 'BAD_LOGIN');
  }
  cache.remove(fk);
  return startSession(p, b.keep);
}
function startSession(p, keep) {
  const token = uuid() + uuid(), exp = Date.now() + (keep ? SESSION_KEEP_DAYS * 86400000 : SESSION_SHORT_HOURS * 3600000);
  withLock(() => {
    insertRow('sessions', { token, user_id: p.id, expires_at: String(exp), created_at: nowIso() });
    writeRow('profiles', p._row, Object.assign({}, p, { last_login_at: nowIso() }));
  });
  return { data: { session: { access_token: token, expires_at: exp, user: { id: p.id, email: p.email } } } };
}
// อีเมล Gmail: ไม่สนจุด/ส่วน +tag และ googlemail.com = gmail.com
function normEmail(e) {
  e = String(e || '').trim().toLowerCase();
  const m = e.match(/^([^@]+)@(.+)$/); if (!m) return e;
  let l = m[1], d = m[2];
  if (d === 'gmail.com' || d === 'googlemail.com') { l = l.split('+')[0].replace(/\./g, ''); d = 'gmail.com'; }
  return l + '@' + d;
}
// ล็อกอินด้วย Google: ตรวจ ID token กับ Google แล้วจับคู่กับอีเมลที่ผู้จัดการลงทะเบียนไว้เท่านั้น
function googleLogin(b) {
  if (!GOOGLE_CLIENT_ID) fail('ยังไม่ได้ตั้งค่า Google Sign-In (GOOGLE_CLIENT_ID ในสคริปต์)', 'NO_GOOGLE');
  const res = UrlFetchApp.fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(String(b.credential || '')), { muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) fail('ยืนยันบัญชี Google ไม่สำเร็จ', 'BAD_LOGIN');
  const t = parseJ(res.getContentText(), {});
  const issOk = t.iss === 'accounts.google.com' || t.iss === 'https://accounts.google.com';
  if (t.aud !== GOOGLE_CLIENT_ID || !issOk || String(t.email_verified) !== 'true' || !t.email || Number(t.exp) * 1000 < Date.now()) fail('ยืนยันบัญชี Google ไม่สำเร็จ', 'BAD_LOGIN');
  const key = normEmail(t.email);
  const p = loadTable('profiles').find(r => normEmail(r.email) === key);
  if (!p) fail('อีเมล ' + t.email + ' ยังไม่ได้รับสิทธิ์ใช้งาน กรุณาแจ้งผู้จัดการให้เพิ่มอีเมลนี้', 'NOT_REGISTERED');
  return startSession(p, b.keep);
}
// รันครั้งเดียวหลังเพิ่มโค้ดนี้ เพื่ออนุญาตให้สคริปต์เรียกบริการภายนอก (ตรวจบัญชี Google)
function authorizeGoogle() { UrlFetchApp.fetch('https://oauth2.googleapis.com/tokeninfo?id_token=test', { muteHttpExceptions: true }); return 'อนุญาตแล้ว'; }
function userFromToken(token) {
  if (!token) return null;
  const cache = CacheService.getScriptCache(), c = cache.get('s_' + token);
  if (c) { const [uid, exp] = c.split('|'); if (Number(exp) > Date.now()) return userById(uid); }
  const s = loadTable('sessions').find(r => r.token === token);
  if (!s || Number(s.expires_at) < Date.now()) return null;
  cache.put('s_' + token, s.user_id + '|' + s.expires_at, 3600);
  return userById(s.user_id);
}
function requireUser(user) { if (!user) fail('กรุณาเข้าสู่ระบบใหม่', 'AUTH'); return user; }
function logout(b) {
  withLock(() => { const s = loadTable('sessions').find(r => r.token === b.token); if (s) deleteRowAt('sessions', s._row); });
  CacheService.getScriptCache().remove('s_' + b.token);
  return { data: true };
}
function setPassword(userId, pw) {
  if (String(pw || '').length < 6) fail('รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร');
  const p = loadTable('profiles').find(r => r.id === userId);
  if (!p) fail('ไม่พบผู้ใช้');
  const salt = uuid();
  writeRow('profiles', p._row, Object.assign({}, p, { salt, pwhash: hashPw(salt, pw) }));
  // ยกเลิกเซสชันเก่าของผู้ใช้นี้ (ยกเว้นเซสชันที่กำลังใช้อยู่จะถูกสร้างใหม่ตอนล็อกอิน)
}

/* ===================== สิทธิ์ ===================== */
function settingsRow() { return loadTable('settings')[0] || { permissions: {}, integrations: {}, company: {} }; }
function perm(user, key) {
  if (!user) return false;
  if (user.role === 'manager') return true;
  const p = (settingsRow().permissions || {})[user.role];
  if (p && has(p, key)) return !!p[key];
  return !!(DEFAULT_PERMS[user.role] || {})[key];
}
const isTeam = (u) => u.role === 'manager' || u.role === 'staff';
const own = (u, r, f) => isTeam(u) || (u.customer_id && r[f] === u.customer_id);
function canRead(u, t, r) {
  if (!u) return false;
  switch (t) {
    case 'settings': case 'channels': case 'box_sizes': return true;
    case 'customers': return u.role !== 'viewer' || r.id === u.customer_id;
    case 'profiles': return isTeam(u) || r.id === u.id;
    case 'products': return own(u, r, 'customer_id');
    case 'transactions': return own(u, r, 'customer_id') && perm(u, r.type === 'in' ? 'in.view' : r.type === 'out' ? 'out.view' : 'return.view');
    case 'invoices': return perm(u, 'bill.view') && (u.role !== 'viewer' || (r.customer_id === u.customer_id && (r.status === 'sent' || r.status === 'paid')));
    case 'bill_items': return perm(u, 'bill.view');
    default: return false;
  }
}
function canWrite(u, t, op, r) {
  if (!u) return false;
  if (u.role === 'manager' && t !== 'sessions' && t !== 'transactions') return op !== 'delete' || t !== 'products' || !r.locked;
  switch (t) {
    case 'customers': return perm(u, op === 'delete' ? 'cust.delete' : 'cust.edit');
    case 'products': return op === 'delete' ? perm(u, 'stock.delete') && !r.locked : perm(u, 'stock.edit');
    case 'transactions': return op === 'update' ? perm(u, 'tx.edit') : op === 'delete' ? perm(u, 'tx.delete') : false;
    case 'invoices': return perm(u, op === 'delete' ? 'bill.delete' : 'bill.edit');
    case 'bill_items': return perm(u, 'bill.edit');
    case 'channels': return op === 'insert' ? isTeam(u) : false;
    default: return false; // settings, box_sizes, profiles = ผู้จัดการเท่านั้น
  }
}

/* ===================== ตัวประมวลผลคิวรี ===================== */
function splitTop(s) {
  const out = []; let d = 0, cur = '';
  for (const ch of s) {
    if (ch === '(') d++; if (ch === ')') d--;
    if (ch === ',' && d === 0) { out.push(cur.trim()); cur = ''; } else cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}
function parseSelect(sel) {
  const cols = [], embeds = [];
  splitTop(sel || '*').forEach(tok => {
    const m = tok.match(/^(\w+)(!inner)?\(([\s\S]*)\)$/);
    if (m) embeds.push({ rel: m[1], inner: !!m[2], cols: splitTop(m[3]) }); else cols.push(tok);
  });
  return { cols, embeds };
}
function computed(t, r) {
  if (t === 'products') r.stock_status = r.stock <= 0 ? 'out' : r.stock <= r.reorder_point ? 'low' : 'normal';
  return r;
}
function likeRe(p, ci) { return new RegExp('^' + String(p).replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*').replace(/_/g, '.') + '$', ci ? 'i' : ''); }
function cmp(v, val) {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number') return v - Number(val);
  return String(v) < String(val) ? -1 : String(v) > String(val) ? 1 : 0;
}
function matchF(o, f) {
  const v = o ? o[f.col] : undefined;
  switch (f.op) {
    case 'eq': return v === null || v === undefined ? (f.val === null) : String(v) === String(f.val);
    case 'neq': return String(v) !== String(f.val);
    case 'gt': { const c = cmp(v, f.val); return c !== null && c > 0; }
    case 'gte': { const c = cmp(v, f.val); return c !== null && c >= 0; }
    case 'lt': { const c = cmp(v, f.val); return c !== null && c < 0; }
    case 'lte': { const c = cmp(v, f.val); return c !== null && c <= 0; }
    case 'like': return v != null && likeRe(f.val, false).test(String(v));
    case 'ilike': return v != null && likeRe(f.val, true).test(String(v));
    case 'in': return (f.val || []).map(String).indexOf(String(v)) >= 0;
    case 'is': return f.val === null ? v === null || v === undefined : v === f.val;
    default: return true;
  }
}
function parseOr(expr) {
  return splitTop(expr).map(p => { const m = p.match(/^(\w+)\.(\w+)\.([\s\S]*)$/); return m ? { col: m[1], op: m[2], val: m[3] } : null; }).filter(Boolean);
}
function applyBase(rows, q) {
  (q.filters || []).forEach(f => { rows = rows.filter(r => matchF(r, f)); });
  (q.ors || []).filter(o => !o.ref).forEach(o => { const fs = parseOr(o.expr); rows = rows.filter(r => fs.some(f => matchF(r, f))); });
  return rows;
}
function embedRows(user, t, rows, embeds) {
  embeds.forEach(e => {
    const rel = REL[t] && REL[t][e.rel]; if (!rel) return;
    const idx = {}; loadTable(rel[1]).forEach(r => { idx[r.id] = r; });
    rows.forEach(r => {
      const tr = idx[r[rel[0]]];
      r['__e_' + e.rel] = tr && canRead(user, rel[1], tr) ? pick(computed(rel[1], Object.assign({}, tr)), e.cols, rel[1]) : null;
    });
  });
}
function pick(r, cols, t) {
  const hid = HIDDEN[t] || [], o = {};
  if (cols.indexOf('*') >= 0) Object.keys(r).forEach(k => { if (k[0] !== '_' && hid.indexOf(k) < 0) o[k] = r[k]; });
  else cols.forEach(c => { if (hid.indexOf(c) < 0 && has(r, c)) o[c] = r[c]; });
  return o;
}
function finish(r, sel, t) {
  const o = pick(r, sel.cols, t);
  sel.embeds.forEach(e => { o[e.rel] = r['__e_' + e.rel] === undefined ? null : r['__e_' + e.rel]; });
  return o;
}
function runSelect(user, q) {
  const t = q.table; if (!SCHEMA[t]) fail('ไม่พบตาราง ' + t);
  const sel = parseSelect(q.select);
  let rows = loadTable(t).filter(r => canRead(user, t, r)).map(r => computed(t, Object.assign({}, r)));
  rows = applyBase(rows, q);
  const refOrs = (q.ors || []).filter(o => o.ref), early = refOrs.length > 0 || sel.embeds.some(e => e.inner);
  const doEmbed = (list) => { embedRows(user, t, list, sel.embeds); return list; };
  if (early) {
    rows = doEmbed(rows);
    refOrs.forEach(o => { const fs = parseOr(o.expr); rows = rows.filter(r => { const x = r['__e_' + o.ref]; return x && fs.some(f => matchF(x, f)); }); });
    sel.embeds.filter(e => e.inner).forEach(e => { rows = rows.filter(r => r['__e_' + e.rel]); });
  }
  const total = rows.length;
  (q.order || []).slice().reverse().forEach(o => {
    rows = rows.map((r, i) => [r, i]).sort((a, b) => {
      const x = a[0][o.col], y = b[0][o.col];
      if (x == null && y == null) return a[1] - b[1];
      if (x == null) return 1; if (y == null) return -1;
      const c = typeof x === 'number' ? x - y : String(x) < String(y) ? -1 : String(x) > String(y) ? 1 : 0;
      return c === 0 ? a[1] - b[1] : (o.asc === false ? -c : c);
    }).map(p => p[0]);
  });
  if (q.range) rows = rows.slice(q.range[0], q.range[1] + 1);
  else if (q.limit) rows = rows.slice(0, q.limit);
  if (!early) rows = doEmbed(rows);
  const out = q.head ? [] : rows.map(r => finish(r, sel, t));
  if (q.single || q.maybeSingle) {
    if (out.length === 1) return { data: out[0], error: null };
    if (q.maybeSingle && out.length === 0) return { data: null, error: null };
    return { data: null, error: { message: 'ไม่พบข้อมูล', code: 'PGRST116' } };
  }
  return { data: out, error: null, count: q.count ? total : null };
}

function checkUnique(t, o, selfRow) {
  const rows = loadTable(t);
  if (UNIQUE[t]) {
    const dup = rows.find(r => r._row !== selfRow && UNIQUE[t].every(c => String(r[c]) === String(o[c])));
    if (dup) fail('ข้อมูลซ้ำ', '23505');
  }
  if (t === 'profiles' && o.email) {
    const dupE = rows.find(r => r._row !== selfRow && normEmail(r.email) === normEmail(o.email));
    if (dupE) fail('อีเมลนี้ถูกใช้แล้ว', '23505');
  }
  if (t === 'profiles' && o.username) {
    const dup = rows.find(r => r._row !== selfRow && (r.username || '').toLowerCase() === String(o.username).toLowerCase());
    if (dup) fail('ชื่อผู้ใช้นี้ถูกใช้แล้ว', '23505');
  }
}
function defaults(t) {
  const d = { created_at: nowIso() };
  if (t !== 'channels' && t !== 'box_sizes' && t !== 'settings') d.id = uuid();
  if (t === 'products') Object.assign(d, { stock: 0, reorder_point: 10, unit: 'ชิ้น', locked: false, updated_at: nowIso() });
  if (t === 'customers') Object.assign(d, { pack_prices: {}, share_token: uuid(), share_enabled: false });
  if (t === 'invoices') Object.assign(d, { status: 'draft', items: [], discount: 0, vat_rate: 0, wht_rate: 0, subtotal: 0, vat: 0, wht: 0, total: 0, net_total: 0 });
  return d;
}
function cleanValues(t, v, forInsert) {
  const o = {}, hid = HIDDEN[t] || [];
  SCHEMA[t].forEach(c => { if (has(v, c) && hid.indexOf(c) < 0 && !(c === 'created_at' && !forInsert)) o[c] = v[c]; });
  return o;
}
function insertOne(user, t, v) {
  const row = Object.assign(defaults(t), cleanValues(t, v, true));
  if (!canWrite(user, t, 'insert', row)) fail('ไม่มีสิทธิ์เพิ่มข้อมูล (' + t + ')', '42501');
  if (t === 'profiles') fail('สร้างผู้ใช้ผ่านหน้าจัดการสิทธิ์เท่านั้น', '42501');
  checkUnique(t, row, -1);
  insertRow(t, row);
  return row;
}
function targetRows(t, q) { return applyBase(loadTable(t).map(r => Object.assign({}, r)), q); }
function updateOne(user, t, r, v) {
  const patch = cleanValues(t, v, false); delete patch.id;
  if (t === 'profiles' && user.role !== 'manager') {
    if (r.id !== user.id) fail('ไม่มีสิทธิ์แก้ไข', '42501');
    Object.keys(patch).forEach(k => { if (['nickname', 'avatar_url', 'last_login_at'].indexOf(k) < 0) delete patch[k]; });
  } else if (!canWrite(user, t, 'update', r)) fail('ไม่มีสิทธิ์แก้ไขข้อมูล (' + t + ')', '42501');
  const next = Object.assign({}, r, patch);
  if (t === 'products') next.updated_at = nowIso();
  checkUnique(t, next, r._row);
  writeRow(t, r._row, next);
  return next;
}
function deleteOne(user, t, r) {
  if (!canWrite(user, t, 'delete', r)) fail('ไม่มีสิทธิ์ลบข้อมูล (' + t + ')', '42501');
  (FK_DELETE[t] || []).forEach(([ct, col]) => { if (loadTable(ct).some(x => x[col] === r.id)) fail('มีข้อมูลอื่นผูกอยู่ ลบไม่ได้', '23503'); });
  deleteRowAt(t, r._row);
}
function runWrite(user, q) {
  const t = q.table, sel = parseSelect(q.select || '*'), out = [];
  if (!SCHEMA[t] || t === 'sessions') fail('ไม่พบตาราง');
  if (q.op === 'insert') (Array.isArray(q.values) ? q.values : [q.values]).forEach(v => out.push(insertOne(user, t, v)));
  else if (q.op === 'update') targetRows(t, q).forEach(r => out.push(updateOne(user, t, r, q.values)));
  else if (q.op === 'delete') targetRows(t, q).forEach(r => { deleteOne(user, t, r); out.push(r); });
  else if (q.op === 'upsert') {
    const keys = String(q.onConflict || 'id').split(',').map(s => s.trim());
    (Array.isArray(q.values) ? q.values : [q.values]).forEach(v => {
      const ex = loadTable(t).find(r => keys.every(k => String(r[k]) === String(v[k])));
      out.push(ex ? updateOne(user, t, Object.assign({}, ex), v) : insertOne(user, t, v));
    });
  }
  if (!q.returning) return { data: null, error: null };
  const data = out.map(r => { r = computed(t, Object.assign({}, r)); return pick(r, sel.cols, t); });
  if (q.single) return data.length === 1 ? { data: data[0], error: null } : { data: null, error: { message: 'ไม่พบข้อมูล', code: 'PGRST116' } };
  return { data, error: null };
}

/* ===================== RPC ===================== */
const today = () => Utilities.formatDate(new Date(), TZ(), 'yyyy-MM-dd');
const num = (v) => Number(v) || 0;
function scopedTx(user, from, to, customer) {
  return loadTable('transactions').filter(r => canRead(user, 'transactions', r) && r.tx_date >= from && r.tx_date <= to &&
    (!customer || r.customer_id === customer) && (isTeam(user) || r.customer_id === user.customer_id));
}
const RPC = {
  stock_counts(u, a) {
    const ps = loadTable('products').filter(p => canRead(u, 'products', p) && (!a.p_customer || p.customer_id === a.p_customer));
    return [{ total: ps.length, normal: ps.filter(p => p.stock > p.reorder_point).length, low: ps.filter(p => p.stock > 0 && p.stock <= p.reorder_point).length, out_of_stock: ps.filter(p => p.stock <= 0).length }];
  },
  daily_summary(u, a) {
    const days = {};
    scopedTx(u, a.p_from, a.p_to, a.p_customer).forEach(r => {
      if (a.p_channel && r.type === 'out' && r.channel !== a.p_channel) return;
      const d = days[r.tx_date] || (days[r.tx_date] = { day: r.tx_date, orders: 0, out_qty: 0, in_qty: 0, return_qty: 0 });
      if (r.type === 'out') { d.orders += num(r.orders); d.out_qty += r.qty; } else if (r.type === 'in') d.in_qty += r.qty; else d.return_qty += r.qty;
    });
    return Object.keys(days).sort().map(k => days[k]);
  },
  channel_summary(u, a) {
    const m = {};
    scopedTx(u, a.p_from, a.p_to, a.p_customer).filter(r => r.type === 'out').forEach(r => {
      const k = r.channel || 'อื่นๆ'; const x = m[k] || (m[k] = { channel: k, orders: 0, qty: 0 }); x.orders += num(r.orders); x.qty += r.qty;
    });
    return Object.keys(m).map(k => m[k]).sort((x, y) => y.qty - x.qty);
  },
  top_products(u, a) {
    const pm = {}; loadTable('products').forEach(p => { pm[p.id] = p; }); const m = {};
    scopedTx(u, a.p_from, a.p_to, a.p_customer).filter(r => r.type === 'out').forEach(r => {
      const p = pm[r.product_id]; if (!p) return; const x = m[p.id] || (m[p.id] = { name: p.name, sku: p.sku, qty: 0 }); x.qty += r.qty;
    });
    return Object.keys(m).map(k => m[k]).sort((x, y) => y.qty - x.qty).slice(0, a.p_limit || 5);
  },
  billing_usage(u, a) {
    if (!perm(u, 'bill.view')) fail('ไม่มีสิทธิ์');
    const m = {};
    scopedTx(u, a.p_from, a.p_to, a.p_customer).filter(r => r.type === 'out' && r.customer_id === a.p_customer).forEach(r => {
      const k = r.box_size || 'ไม่ระบุ'; const x = m[k] || (m[k] = { box_size: k, orders: 0, qty: 0 }); x.orders += num(r.orders); x.qty += r.qty;
    });
    return Object.keys(m).sort().map(k => m[k]);
  },
  record_transaction(u, a) {
    if (!perm(u, 'tx.create')) fail('ไม่มีสิทธิ์ทำรายการ');
    const p = loadTable('products').find(x => x.id === a.p_product); if (!p) fail('ไม่พบสินค้า');
    const qty = num(a.p_qty), after = a.p_type === 'out' ? p.stock - qty : p.stock + qty;
    if (after < 0) fail('สต็อกไม่พอ (คงเหลือ ' + p.stock + ')');
    writeRow('products', p._row, Object.assign({}, p, { stock: after, updated_at: nowIso() }));
    const row = { id: uuid(), customer_id: p.customer_id, product_id: p.id, type: a.p_type, tx_date: a.p_date || today(), qty, stock_before: p.stock, stock_after: after,
      ref_no: a.p_ref, reason: a.p_reason, note: a.p_note, evidence_url: a.p_evidence, created_by: u.id, created_at: nowIso(),
      channel: a.p_channel, orders: a.p_orders, box_size: a.p_box, return_cause: a.p_return_cause, return_condition: a.p_return_condition };
    insertRow('transactions', row); return row;
  },
  update_transaction(u, a) {
    if (!perm(u, 'tx.edit')) fail('ไม่มีสิทธิ์แก้ไขรายการ');
    const t = loadTable('transactions').find(x => x.id === a.p_id); if (!t) fail('ไม่พบรายการ');
    const p = loadTable('products').find(x => x.id === t.product_id), qty = num(a.p_qty), delta = qty - t.qty;
    const ns = t.type === 'out' ? p.stock - delta : p.stock + delta;
    if (ns < 0) fail('สต็อกไม่พอ (คงเหลือ ' + p.stock + ')');
    writeRow('products', p._row, Object.assign({}, p, { stock: ns, updated_at: nowIso() }));
    const row = Object.assign({}, t, { qty, tx_date: a.p_date, ref_no: a.p_ref, reason: a.p_reason, note: a.p_note, evidence_url: a.p_evidence,
      channel: a.p_channel, orders: a.p_orders, box_size: a.p_box, return_cause: a.p_return_cause, return_condition: a.p_return_condition,
      stock_after: t.stock_after + (t.type === 'out' ? -delta : delta) });
    writeRow('transactions', t._row, row); return row;
  },
  delete_transaction(u, a) {
    if (!perm(u, 'tx.delete')) fail('ไม่มีสิทธิ์ลบรายการ');
    const t = loadTable('transactions').find(x => x.id === a.p_id); if (!t) fail('ไม่พบรายการ');
    if (a.p_revert) {
      const p = loadTable('products').find(x => x.id === t.product_id), ns = t.type === 'out' ? p.stock + t.qty : p.stock - t.qty;
      if (ns < 0) fail('คืนยอดไม่ได้ สต็อกจะติดลบ (คงเหลือ ' + p.stock + ')');
      writeRow('products', p._row, Object.assign({}, p, { stock: ns, updated_at: nowIso() }));
    }
    deleteRowAt('transactions', loadTable('transactions').find(x => x.id === a.p_id)._row); return null;
  },
  submit_slip(u, a) {
    if (!perm(u, 'bill.slip')) fail('ไม่มีสิทธิ์อัปโหลดสลิป');
    const inv = loadTable('invoices').find(x => x.id === a.p_invoice); if (!inv) fail('ไม่พบใบแจ้งหนี้');
    if (u.role === 'viewer' && (inv.customer_id !== u.customer_id || (inv.status !== 'sent' && inv.status !== 'paid'))) fail('ไม่มีสิทธิ์กับใบแจ้งหนี้นี้');
    if (inv.status === 'cancelled') fail('ใบแจ้งหนี้นี้ถูกยกเลิกแล้ว');
    let rc = inv.receipt_no;
    if (!rc) {
      const pfx = 'RC-' + Utilities.formatDate(new Date(), TZ(), 'yyyyMM') + '-';
      const last = loadTable('invoices').filter(x => x.receipt_no && x.receipt_no.indexOf(pfx) === 0).reduce((m, x) => Math.max(m, parseInt(x.receipt_no.slice(pfx.length), 10) || 0), 0);
      rc = pfx + String(last + 1).padStart(3, '0');
    }
    const row = Object.assign({}, inv, { slip_url: a.p_slip, paid_at: inv.paid_at || nowIso(), status: 'paid', receipt_no: rc });
    writeRow('invoices', inv._row, row); return row;
  },
  admin_set_password(u, a) { if (u.role !== 'manager') fail('เฉพาะผู้จัดการเท่านั้น'); setPassword(a.p_user, a.p_password); return null; },
  admin_create_user(u, a) {
    if (u.role !== 'manager') fail('เฉพาะผู้จัดการเท่านั้น');
    const username = String(a.username || '').trim().toLowerCase(), email = String(a.email || '').trim().toLowerCase() || (username + '@ff-portal.app');
    const pw = String(a.password || '');
    if (!username && !String(a.email || '').trim()) fail('กรอกชื่อผู้ใช้หรืออีเมล');
    if (!pw && !String(a.email || '').trim()) fail('ถ้าไม่ตั้งรหัสผ่าน ต้องกรอกอีเมล Gmail เพื่อให้เข้าด้วย Google');
    if (pw && pw.length < 6) fail('รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร');
    if (loadTable('profiles').some(p => normEmail(p.email) === normEmail(email))) fail('อีเมลนี้ถูกใช้แล้ว', '23505');
    const salt = pw ? uuid() : '', row = { id: uuid(), email, username: username || null, nickname: username || email.split('@')[0], role: 'viewer', created_at: nowIso(), salt, pwhash: pw ? hashPw(salt, pw) : '' };
    checkUnique('profiles', row, -1); insertRow('profiles', row); return { id: row.id };
  }
};
const WRITE_RPC = ['record_transaction', 'update_transaction', 'delete_transaction', 'submit_slip', 'admin_set_password', 'admin_create_user'];

/* ---------- หน้าลูกค้า (ลิงก์ ไม่ต้องล็อกอิน) ---------- */
function portalCustomer(token) { return loadTable('customers').find(c => c.share_enabled && c.share_token === token) || null; }
const PUBLIC_RPC = {
  portal_data(a) {
    const c = portalCustomer(a.p_token); if (!c) return null;
    const s = settingsRow(), ps = loadTable('products').filter(p => p.customer_id === c.id), txs = loadTable('transactions').filter(t => t.customer_id === c.id && t.tx_date >= a.p_from && t.tx_date <= a.p_to);
    const days = {}, pm = {}; ps.forEach(p => { pm[p.id] = p; });
    txs.forEach(r => {
      const d = days[r.tx_date] || (days[r.tx_date] = { day: r.tx_date, orders: 0, out_qty: 0, in_qty: 0, return_qty: 0 });
      if (r.type === 'out') { d.orders += num(r.orders); d.out_qty += r.qty; } else if (r.type === 'in') d.in_qty += r.qty; else d.return_qty += r.qty;
    });
    return {
      customer: { name: c.name }, shop: { name: s.shop_name, logo: s.logo_url },
      counts: { total: ps.length, normal: ps.filter(p => p.stock > p.reorder_point).length, low: ps.filter(p => p.stock > 0 && p.stock <= p.reorder_point).length, out: ps.filter(p => p.stock <= 0).length },
      products: ps.sort((x, y) => String(x.name).localeCompare(String(y.name))).slice(0, 500).map(p => ({ sku: p.sku, name: p.name, category: p.category, unit: p.unit, stock: p.stock, reorder_point: p.reorder_point, image_url: p.image_url })),
      daily: Object.keys(days).sort().map(k => days[k]),
      recent: txs.sort((x, y) => (y.tx_date + y.created_at).localeCompare(x.tx_date + x.created_at)).slice(0, 200).map(t => ({ tx_date: t.tx_date, created_at: t.created_at, type: t.type, qty: t.qty, channel: t.channel, orders: t.orders, box_size: t.box_size, name: (pm[t.product_id] || {}).name, sku: (pm[t.product_id] || {}).sku, stock_after: t.stock_after }))
    };
  },
  portal_tx(a) {
    const c = portalCustomer(a.p_token); if (!c || ['in', 'out', 'return'].indexOf(a.p_type) < 0) return null;
    const pm = {}; loadTable('products').forEach(p => { pm[p.id] = p; });
    const all = loadTable('transactions').filter(t => t.customer_id === c.id && t.type === a.p_type && t.tx_date >= a.p_from && t.tx_date <= a.p_to)
      .sort((x, y) => (y.tx_date + y.created_at).localeCompare(x.tx_date + x.created_at));
    const off = num(a.p_offset), lim = Math.min(num(a.p_limit) || 25, 100);
    return { total: all.length, rows: all.slice(off, off + lim).map(t => ({ id: t.id, tx_date: t.tx_date, created_at: t.created_at, qty: t.qty, stock_before: t.stock_before, stock_after: t.stock_after, ref_no: t.ref_no, reason: t.reason, channel: t.channel, orders: t.orders, box_size: t.box_size, return_cause: t.return_cause, evidence_url: t.evidence_url, name: (pm[t.product_id] || {}).name, sku: (pm[t.product_id] || {}).sku })) };
  },
  portal_invoices(a) {
    const c = portalCustomer(a.p_token); if (!c) return null;
    const s = settingsRow();
    return { company: s.company, logo: s.logo_url,
      customer: { name: c.name, company_name: c.company_name, address: c.address, tax_id: c.tax_id, phone: c.phone, contact_name: c.contact_name },
      invoices: loadTable('invoices').filter(i => i.customer_id === c.id && (i.status === 'sent' || i.status === 'paid')).sort((x, y) => (y.issue_date + y.created_at).localeCompare(x.issue_date + x.created_at)).map(i => { const o = Object.assign({}, i); delete o.created_by; delete o._row; return o; }) };
  }
};

/* ===================== Drive ===================== */
const folderIdOf = (s) => { s = String(s || ''); const m = s.match(/folders\/([\w-]+)/); return m ? m[1] : (/^[\w-]{20,}$/.test(s) ? s : ''); };
function driveFolder(sub) {
  const fid = folderIdOf(((settingsRow().integrations || {}).drive || {}).folder);
  let base;
  if (fid) base = DriveApp.getFolderById(fid);
  else { const it = DriveApp.getFoldersByName(ROOT_FOLDER); base = it.hasNext() ? it.next() : DriveApp.createFolder(ROOT_FOLDER); }
  const name = String(sub || 'misc').replace(/[^a-z0-9_-]/gi, ''), it2 = base.getFoldersByName(name);
  return it2.hasNext() ? it2.next() : base.createFolder(name);
}
function upload(user, a) {
  requireUser(user);
  if (!/^(image\/|application\/pdf)/.test(a.mime || '')) fail('รองรับเฉพาะรูปภาพหรือ PDF');
  if (a.mime === 'application/pdf' && !perm(user, 'bill.edit') && !perm(user, 'bill.slip')) fail('ไม่มีสิทธิ์อัปโหลดไฟล์ PDF');
  const blob = Utilities.newBlob(Utilities.base64Decode(a.data), a.mime, a.name || ('file_' + Date.now()));
  const file = driveFolder(a.sub).createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return { data: { id: file.getId() } };
}
function imageData(user, a) {
  requireUser(user);
  const f = DriveApp.getFileById(a.id);
  if (f.getSharingAccess() !== DriveApp.Access.ANYONE_WITH_LINK) fail('ไฟล์นี้ไม่ได้แชร์');
  const b = f.getBlob(); if (b.getBytes().length > 3000000) fail('ไฟล์ใหญ่เกินไป');
  return { data: { mime: b.getContentType(), data: Utilities.base64Encode(b.getBytes()) } };
}

/* ===================== ตัวรับคำขอ ===================== */
function out(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function doGet() { return out({ ok: true, msg: 'FF v5 sheets-backend' }); }
function doPost(e) {
  let b; try { b = JSON.parse(e.postData.contents); } catch (_) { return out({ error: { message: 'bad request' } }); }
  return out(dispatch(b));
}
function dispatch(b) {
  _props = null; _memo = {}; _ss = null;
  try {
    const a = b.action;
    if (a === 'auth.login') return login(b);
    if (a === 'auth.google') return googleLogin(b);
    if (a === 'public.config') return { data: { googleClientId: GOOGLE_CLIENT_ID || '' } };
    if (a === 'rpc' && has(PUBLIC_RPC, b.name)) return { data: PUBLIC_RPC[b.name](b.args || {}), error: null };
    const user = requireUser(userFromToken(b.token));
    if (a === 'auth.logout') return logout(b);
    if (a === 'auth.update_password') return withLock(() => { setPassword(user.id, b.password); return { data: true }; });
    if (a === 'versions') { const v = {}; Object.keys(SCHEMA).forEach(t => { v[t] = ver(t); }); return { data: v }; }
    if (a === 'info') return { data: { sheetUrl: user.role === 'manager' ? ss().getUrl() : null } };
    if (a === 'upload') return upload(user, b);
    if (a === 'image') return imageData(user, b);
    if (a === 'query') {
      const q = b.q || {};
      return q.op && q.op !== 'select' ? withLock(() => runWrite(user, q)) : runSelect(user, q);
    }
    if (a === 'rpc') {
      const fn = RPC[b.name]; if (!fn) fail('ไม่พบฟังก์ชัน ' + b.name);
      const run = () => ({ data: fn(user, b.args || {}), error: null });
      return WRITE_RPC.indexOf(b.name) >= 0 ? withLock(run) : run();
    }
    fail('คำสั่งไม่ถูกต้อง');
  } catch (err) {
    return { data: null, error: { message: String(err.message || err), code: err.code || 'ERR' } };
  }
}

/* ===================== ติดตั้งครั้งแรก ===================== */
function setup() {
  if (ADMIN_PASSWORD.indexOf('เปลี่ยนรหัสนี้') >= 0 || ADMIN_PASSWORD.length < 6) throw new Error('ตั้ง ADMIN_PASSWORD (อย่างน้อย 6 ตัว) ที่ด้านบนของสคริปต์ก่อน');
  Object.keys(SCHEMA).forEach(t => {
    let sh = ss().getSheetByName(t);
    if (!sh) sh = ss().insertSheet(t);
    const n = SCHEMA[t].length, rows = Math.max(sh.getMaxRows(), 1000);
    if (sh.getMaxRows() < rows) sh.insertRowsAfter(sh.getMaxRows(), rows - sh.getMaxRows());
    sh.getRange(1, 1, rows, n).setNumberFormat('@');
    sh.getRange(1, 1, 1, n).setValues([SCHEMA[t]]).setFontWeight('bold');
    sh.setFrozenRows(1);
  });
  const def = ss().getSheetByName('Sheet1'); if (def && ss().getSheets().length > 1 && def.getLastRow() === 0) ss().deleteSheet(def);
  if (!loadTable('settings').length) insertRow('settings', { id: '1', shop_name: 'Fulfillment', theme: { primary: '#0C7C82', secondary: '#35B4B0' }, integrations: {}, company: {}, permissions: DEFAULT_PERMS, updated_at: nowIso() });
  if (!loadTable('channels').length) ['TikTok', 'Shopee', 'Lazada', 'Facebook'].forEach((n, i) => insertRow('channels', { name: n, sort: i + 1, created_at: nowIso() }));
  if (!loadTable('box_sizes').length) ['00/0+4', 'A, AB, 2A, B, B+7, 2B, C', 'C+8'].forEach((n, i) => insertRow('box_sizes', { name: n, sort: i + 1 }));
  if (!loadTable('profiles').some(p => p.role === 'manager')) {
    const salt = uuid();
    insertRow('profiles', { id: uuid(), email: ADMIN_USERNAME.toLowerCase() + '@ff-portal.app', username: ADMIN_USERNAME.toLowerCase(), nickname: 'ผู้จัดการ', role: 'manager', created_at: nowIso(), salt, pwhash: hashPw(salt, ADMIN_PASSWORD) });
  }
  return 'ติดตั้งเสร็จ: ล็อกอินด้วยชื่อผู้ใช้ ' + ADMIN_USERNAME + ' แล้วเปลี่ยนรหัสผ่านที่เมนูโปรไฟล์';
}
// กู้รหัสผ่านผู้จัดการ: ตั้ง ADMIN_USERNAME/ADMIN_PASSWORD แล้วรันฟังก์ชันนี้จากหน้าแก้ไข
function resetAdminPassword() {
  const p = loadTable('profiles').find(r => (r.username || '').toLowerCase() === ADMIN_USERNAME.toLowerCase());
  if (!p) throw new Error('ไม่พบผู้ใช้ ' + ADMIN_USERNAME);
  setPassword(p.id, ADMIN_PASSWORD);
}
