// ทดสอบตรรกะของ Code.gs ในเครื่อง (จำลอง Google Sheets/Cache/Lock) — รัน: node test.js
const fs = require('fs'), vm = require('vm'), crypto = require('crypto'), assert = require('assert');

class Sheet {
  constructor(n) { this.name = n; this.data = []; this.maxRows = 1000; }
  getLastRow() { let lr = 0; this.data.forEach((r, i) => { if (r && r.some(c => c !== '' && c !== undefined)) lr = i + 1; }); return lr; }
  getMaxRows() { return this.maxRows; }
  insertRowsAfter(r, n) { this.maxRows += n; }
  setFrozenRows() {}
  deleteRow(r) { this.data.splice(r - 1, 1); }
  getRange(r, c, nr = 1, nc = 1) {
    const s = this;
    return {
      getValues() { const o = []; for (let i = 0; i < nr; i++) { const row = s.data[r - 1 + i] || []; const x = []; for (let j = 0; j < nc; j++) x.push(row[c - 1 + j] === undefined ? '' : row[c - 1 + j]); o.push(x); } return o; },
      setValues(v) { for (let i = 0; i < nr; i++) { s.data[r - 1 + i] = s.data[r - 1 + i] || []; for (let j = 0; j < nc; j++) s.data[r - 1 + i][c - 1 + j] = v[i][j]; } return this; },
      setNumberFormat() { return this; }, setFontWeight() { return this; }
    };
  }
}
const mockGoogle = { code: 200, body: {} };
const sheets = {};
const store = new Map(), propStore = {};
const ctx = {
  console, JSON, Date, Math, Object, Array, String, Number, RegExp, Error, Promise,
  SpreadsheetApp: { getActiveSpreadsheet: () => ({
    getSheetByName: n => sheets[n] || null, insertSheet: n => (sheets[n] = new Sheet(n)),
    getSheets: () => Object.values(sheets), deleteSheet: s => { delete sheets[s.name]; }, getUrl: () => 'https://docs.google.com/spreadsheets/d/TEST' }) },
  CacheService: { getScriptCache: () => ({
    get: k => (store.has(k) ? store.get(k) : null), put: (k, v) => store.set(k, v), remove: k => store.delete(k),
    putAll: m => Object.keys(m).forEach(k => store.set(k, m[k])), getAll: ks => { const o = {}; ks.forEach(k => { if (store.has(k)) o[k] = store.get(k); }); return o; } }) },
  PropertiesService: { getScriptProperties: () => ({ getProperties: () => Object.assign({}, propStore), setProperty: (k, v) => { propStore[k] = v; } }) },
  LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
  Session: { getScriptTimeZone: () => 'Asia/Bangkok' },
  Utilities: {
    getUuid: () => crypto.randomUUID(), sleep() {}, DigestAlgorithm: { SHA_256: 'sha256' },
    computeDigest: (a, s) => Array.from(crypto.createHash('sha256').update(s).digest()).map(b => (b > 127 ? b - 256 : b)),
    formatDate: (d, tz, f) => { const p = n => String(n).padStart(2, '0'); const y = d.getFullYear(), m = p(d.getMonth() + 1), dd = p(d.getDate()); return f === 'yyyyMM' ? `${y}${m}` : `${y}-${m}-${dd}`; }
  },
  UrlFetchApp: { fetch: () => ({ getResponseCode: () => mockGoogle.code, getContentText: () => JSON.stringify(mockGoogle.body) }) },
  ContentService: { createTextOutput: s => ({ setMimeType() { return s; } }), MimeType: { JSON: 1 } }
};
let code = fs.readFileSync(__dirname + '/Code.gs', 'utf8').replace("'เปลี่ยนรหัสนี้ก่อนรัน setup'", "'Passw0rd!'").replace("const GOOGLE_CLIENT_ID = '';", "const GOOGLE_CLIENT_ID = 'test-client.apps.googleusercontent.com';");
code += '\n;globalThis.__api = { dispatch, setup };';
vm.createContext(ctx); vm.runInContext(code, ctx);
const { dispatch, setup } = ctx.__api;

module.exports = { dispatch, setup, mockGoogle };
