const fs = require('fs'), assert = require('assert');
const { dispatch, setup, mockGoogle } = require('./mock-env.cjs');
const call = (token, action, extra = {}) => dispatch(Object.assign({ action, token }, extra));
const q = (token, qq) => call(token, 'query', { q: qq });
const rpc = (token, name, args) => call(token, 'rpc', { name, args });
const ok = r => { assert.ok(!r.error, JSON.stringify(r.error)); return r.data; };
const bad = (r, code) => { assert.ok(r.error, 'ควรเกิด error'); if (code) assert.strictEqual(r.error.code, code); };

setup();
const M = ok(call(null, 'auth.login', { login: 'admin', password: 'Passw0rd!' })).session.access_token;
bad(call(null, 'auth.login', { login: 'admin', password: 'wrong' }), 'BAD_LOGIN');
bad(q(null, { table: 'products', op: 'select', select: '*' }), 'AUTH');

// ลูกค้า + ผู้ใช้
const cA = ok(q(M, { table: 'customers', op: 'insert', values: { name: 'ลูกค้า A', pack_prices: { '00/0+4': 8 } }, returning: true, select: '*', single: true }));
const cB = ok(q(M, { table: 'customers', op: 'insert', values: { name: 'ลูกค้า B' }, returning: true, select: '*', single: true }));
const staffId = ok(rpc(M, 'admin_create_user', { username: 'staff1', password: 'staff123' })).id;
const viewId = ok(rpc(M, 'admin_create_user', { username: 'cust1', password: 'cust123' })).id;
ok(q(M, { table: 'profiles', op: 'update', values: { role: 'staff' }, filters: [{ op: 'eq', col: 'id', val: staffId }] }));
ok(q(M, { table: 'profiles', op: 'update', values: { role: 'viewer', customer_id: cA.id }, filters: [{ op: 'eq', col: 'id', val: viewId }] }));
bad(rpc(M, 'admin_create_user', { username: 'staff1', password: 'abcdef' }), '23505');
const S = ok(call(null, 'auth.login', { login: 'staff1', password: 'staff123', keep: true })).session.access_token;
const V = ok(call(null, 'auth.login', { login: 'CUST1', password: 'cust123' })).session.access_token;

// สินค้า + รายการสต็อก
const pA = ok(q(S, { table: 'products', op: 'insert', values: { customer_id: cA.id, sku: 'SKU-1', name: 'ครีมกันแดด', category: 'สกินแคร์' }, returning: true, select: '*', single: true }));
ok(q(S, { table: 'products', op: 'insert', values: { customer_id: cB.id, sku: 'SKU-9', name: 'สินค้าของ B' } }));
bad(q(S, { table: 'products', op: 'insert', values: { customer_id: cA.id, sku: 'SKU-1', name: 'ซ้ำ' } }), '23505');
ok(rpc(S, 'record_transaction', { p_product: pA.id, p_type: 'in', p_qty: 100, p_date: '2026-10-10', p_reason: 'รับเข้า' }));
ok(rpc(S, 'record_transaction', { p_product: pA.id, p_type: 'out', p_qty: 30, p_date: '2026-10-11', p_channel: 'TikTok', p_orders: 3, p_box: '00/0+4' }));
ok(rpc(S, 'record_transaction', { p_product: pA.id, p_type: 'out', p_qty: 10, p_date: '2026-10-12', p_channel: 'Shopee', p_orders: 2, p_box: 'C+8' }));
bad(rpc(S, 'record_transaction', { p_product: pA.id, p_type: 'out', p_qty: 999, p_date: '2026-10-12' }));
bad(rpc(V, 'record_transaction', { p_product: pA.id, p_type: 'in', p_qty: 5 }));
let prod = ok(q(S, { table: 'products', op: 'select', select: 'id,sku,stock,stock_status,customers(name)', filters: [{ op: 'eq', col: 'sku', val: 'SKU-1' }], single: true }));
assert.strictEqual(prod.stock, 60); assert.strictEqual(prod.customers.name, 'ลูกค้า A'); assert.strictEqual(prod.stock_status, 'normal');

// คิวรีแบบหน้ารายงาน (embed inner + or บน embed + order + range + count)
const r1 = q(S, { table: 'transactions', op: 'select', select: 'id,type,qty,tx_date,products!inner(name,sku),profiles(nickname)', count: true,
  filters: [{ op: 'eq', col: 'type', val: 'out' }], ors: [{ expr: 'name.ilike.%ครีม%,sku.ilike.%ครีม%', ref: 'products' }],
  order: [{ col: 'tx_date', asc: false }], range: [0, 24] });
assert.strictEqual(r1.count, 2); assert.strictEqual(r1.data[0].tx_date, '2026-10-12'); assert.strictEqual(r1.data[0].products.sku, 'SKU-1'); assert.strictEqual(r1.data[0].profiles.nickname, 'staff1');
const r2 = q(S, { table: 'transactions', op: 'select', select: 'id', count: true, head: true, filters: [{ op: 'eq', col: 'channel', val: 'Shopee' }] });
assert.strictEqual(r2.count, 1); assert.strictEqual(r2.data.length, 0);
const r3 = q(S, { table: 'products', op: 'select', select: 'sku', ors: [{ expr: 'sku.ilike.%SKU%,name.ilike.%SKU%' }], filters: [{ op: 'gte', col: 'stock', val: 1 }], order: [{ col: 'sku', asc: true }] });
assert.strictEqual(r3.data.length, 1); assert.strictEqual(r3.data[0].sku, 'SKU-1');

// สรุป
const ds = ok(rpc(S, 'daily_summary', { p_from: '2026-10-01', p_to: '2026-10-31', p_customer: cA.id }));
assert.deepStrictEqual(ds.map(d => [d.day, d.orders, d.out_qty, d.in_qty]), [['2026-10-10', 0, 0, 100], ['2026-10-11', 3, 30, 0], ['2026-10-12', 2, 10, 0]]);
assert.strictEqual(ok(rpc(S, 'channel_summary', { p_from: '2026-10-01', p_to: '2026-10-31' }))[0].channel, 'TikTok');
assert.strictEqual(ok(rpc(S, 'top_products', { p_from: '2026-10-01', p_to: '2026-10-31' }))[0].qty, 40);
assert.strictEqual(ok(rpc(S, 'billing_usage', { p_customer: cA.id, p_from: '2026-10-01', p_to: '2026-10-31' })).length, 2);
assert.strictEqual(ok(rpc(S, 'stock_counts', {}))[0].total, 2);

// สิทธิ์
bad(q(S, { table: 'products', op: 'delete', filters: [{ op: 'eq', col: 'id', val: pA.id }] }), '42501');
const txs = ok(q(S, { table: 'transactions', op: 'select', select: 'id,type,qty', filters: [{ op: 'eq', col: 'type', val: 'out' }] }));
bad(rpc(S, 'delete_transaction', { p_id: txs[0].id }));
bad(q(M, { table: 'products', op: 'delete', filters: [{ op: 'eq', col: 'id', val: pA.id }] }), '23503');
bad(q(M, { table: 'customers', op: 'delete', filters: [{ op: 'eq', col: 'id', val: cA.id }] }), '23503');
assert.strictEqual(ok(q(V, { table: 'products', op: 'select', select: 'sku' })).length, 1);          // เห็นเฉพาะของตัวเอง
assert.strictEqual(ok(q(V, { table: 'customers', op: 'select', select: 'name' })).length, 1);
assert.strictEqual(ok(q(V, { table: 'transactions', op: 'select', select: 'id' })).length, 3);
assert.strictEqual(ok(q(V, { table: 'profiles', op: 'select', select: '*' })).length, 1);
assert.ok(!('pwhash' in ok(q(M, { table: 'profiles', op: 'select', select: '*' }))[0]));
ok(q(V, { table: 'profiles', op: 'update', values: { role: 'manager', customer_id: cB.id, nickname: 'ลูกค้าทดสอบ' }, filters: [{ op: 'eq', col: 'id', val: viewId }] }));
const me = ok(q(V, { table: 'profiles', op: 'select', select: 'role,customer_id,nickname', single: true }));
assert.strictEqual(me.role, 'viewer'); assert.strictEqual(me.customer_id, cA.id); assert.strictEqual(me.nickname, 'ลูกค้าทดสอบ');
bad(q(V, { table: 'settings', op: 'update', values: { shop_name: 'x' }, filters: [{ op: 'eq', col: 'id', val: 1 }] }), '42501');

// แก้ไข / ลบรายการ
ok(rpc(S, 'update_transaction', { p_id: txs.find(t => t.qty === 30).id, p_qty: 20, p_date: '2026-10-11', p_channel: 'TikTok', p_orders: 3, p_box: '00/0+4' }));
prod = ok(q(S, { table: 'products', op: 'select', select: 'stock', filters: [{ op: 'eq', col: 'id', val: pA.id }], single: true })); assert.strictEqual(prod.stock, 70);
ok(rpc(M, 'delete_transaction', { p_id: txs.find(t => t.qty === 10).id, p_revert: true }));
prod = ok(q(S, { table: 'products', op: 'select', select: 'stock', filters: [{ op: 'eq', col: 'id', val: pA.id }], single: true })); assert.strictEqual(prod.stock, 80);

// ใบแจ้งหนี้ → สลิป → ใบเสร็จ
const inv = ok(q(S, { table: 'invoices', op: 'insert', returning: true, select: '*', single: true, values: { customer_id: cA.id, invoice_no: 'INV-202610-001', issue_date: '2026-10-15', items: [{ desc: 'ค่าแพ็ค', qty: 3, price: 8 }], total: 24, net_total: 24 } }));
assert.strictEqual(ok(q(V, { table: 'invoices', op: 'select', select: 'id' })).length, 0);            // ร่าง ลูกค้าไม่เห็น
ok(q(S, { table: 'invoices', op: 'update', values: { status: 'sent' }, filters: [{ op: 'eq', col: 'id', val: inv.id }] }));
assert.strictEqual(ok(q(V, { table: 'invoices', op: 'select', select: 'id,items' }))[0].items[0].qty, 3);
const paid = ok(rpc(V, 'submit_slip', { p_invoice: inv.id, p_slip: 'https://x/slip.jpg' }));
assert.strictEqual(paid.status, 'paid'); assert.ok(/^RC-\d{6}-001$/.test(paid.receipt_no));
bad(q(V, { table: 'invoices', op: 'delete', filters: [{ op: 'eq', col: 'id', val: inv.id }] }), '42501');

// ลิงก์ลูกค้า (ไม่ล็อกอิน)
assert.strictEqual(ok(call(null, 'rpc', { name: 'portal_data', args: { p_token: cA.share_token, p_from: '2026-10-01', p_to: '2026-10-31' } })), null);
ok(q(M, { table: 'customers', op: 'update', values: { share_enabled: true }, filters: [{ op: 'eq', col: 'id', val: cA.id }] }));
const pd = ok(call(null, 'rpc', { name: 'portal_data', args: { p_token: cA.share_token, p_from: '2026-10-01', p_to: '2026-10-31' } }));
assert.strictEqual(pd.customer.name, 'ลูกค้า A'); assert.strictEqual(pd.counts.total, 1); assert.strictEqual(pd.products[0].stock, 80);
const pt = ok(call(null, 'rpc', { name: 'portal_tx', args: { p_token: cA.share_token, p_type: 'in', p_from: '2026-10-01', p_to: '2026-10-31', p_limit: 25, p_offset: 0 } }));
assert.strictEqual(pt.total, 1); assert.strictEqual(pt.rows[0].name, 'ครีมกันแดด');
assert.strictEqual(ok(call(null, 'rpc', { name: 'portal_invoices', args: { p_token: cA.share_token } })).invoices[0].receipt_no, paid.receipt_no);

// เปลี่ยนรหัสผ่าน + ล็อกเอาต์ + เวอร์ชัน
ok(rpc(M, 'admin_set_password', { p_user: viewId, p_password: 'newpass1' }));
bad(call(null, 'auth.login', { login: 'cust1', password: 'cust123' }), 'BAD_LOGIN');
ok(call(null, 'auth.login', { login: 'cust1', password: 'newpass1' }));
ok(call(S, 'auth.update_password', { password: 'staff456' }));
ok(call(null, 'auth.login', { login: 'staff1', password: 'staff456' }));
assert.ok(Number(ok(call(M, 'versions')).transactions) > 0);
ok(call(V, 'auth.logout', { token: V })); bad(q(V, { table: 'products', op: 'select', select: '*' }), 'AUTH');

// upsert (นำเข้า)
ok(q(S, { table: 'products', op: 'upsert', onConflict: 'customer_id,sku', values: [{ customer_id: cA.id, sku: 'SKU-1', name: 'ครีมกันแดด v2', stock: 5 }, { customer_id: cA.id, sku: 'SKU-2', name: 'ใหม่', stock: 7 }] }));
assert.strictEqual(ok(q(S, { table: 'products', op: 'select', select: 'sku,name,stock', filters: [{ op: 'eq', col: 'customer_id', val: cA.id }], order: [{ col: 'sku', asc: true }] })).map(p => p.name + ':' + p.stock).join('|'), 'ครีมกันแดด v2:5|ใหม่:7');
// ล็อกอินด้วย Google (Gmail)
const CID = 'test-client.apps.googleusercontent.com';
assert.strictEqual(ok(call(null, 'public.config')).googleClientId, CID);
const gid = ok(rpc(M, 'admin_create_user', { email: 'Som.Chai@gmail.com' })).id;          // ไม่ตั้งรหัสผ่าน = เข้าด้วย Google เท่านั้น
ok(q(M, { table: 'profiles', op: 'update', values: { role: 'staff' }, filters: [{ op: 'eq', col: 'id', val: gid }] }));
bad(rpc(M, 'admin_create_user', { email: 'somchai+x@googlemail.com' }), '23505');            // Gmail ซ้ำ (ไม่สนจุด/+tag)
bad(rpc(M, 'admin_create_user', { username: 'nopw' }));                                      // ไม่มีรหัสผ่านและไม่มีอีเมล
const gtok = (over) => { mockGoogle.code = 200; mockGoogle.body = Object.assign({ aud: CID, iss: 'https://accounts.google.com', email: 'somchai@gmail.com', email_verified: 'true', exp: String(Math.floor(Date.now() / 1000) + 3600) }, over); };
gtok({}); const G = ok(call(null, 'auth.google', { credential: 'x', keep: true })).session.access_token;
assert.strictEqual(ok(q(G, { table: 'profiles', op: 'select', select: 'role,email', filters: [{ op: 'eq', col: 'id', val: gid }], single: true })).role, 'staff');
gtok({ aud: 'other' }); bad(call(null, 'auth.google', { credential: 'x' }), 'BAD_LOGIN');
gtok({ email_verified: 'false' }); bad(call(null, 'auth.google', { credential: 'x' }), 'BAD_LOGIN');
gtok({ exp: String(Math.floor(Date.now() / 1000) - 10) }); bad(call(null, 'auth.google', { credential: 'x' }), 'BAD_LOGIN');
gtok({ email: 'stranger@gmail.com' }); bad(call(null, 'auth.google', { credential: 'x' }), 'NOT_REGISTERED');
mockGoogle.code = 400; bad(call(null, 'auth.google', { credential: 'x' }), 'BAD_LOGIN');
bad(call(null, 'auth.login', { login: 'somchai@gmail.com', password: '' }), 'BAD_LOGIN');    // บัญชี Google-only ใช้รหัสผ่านเข้าไม่ได้
// ใช้งานพร้อมกันหลายคน: ทุกคนมีเซสชันของตัวเอง
assert.strictEqual(ok(q(S, { table: 'products', op: 'select', select: 'sku' })).length >= 2, true);
assert.strictEqual(ok(q(G, { table: 'products', op: 'select', select: 'sku' })).length >= 2, true);
console.log('ผ่านทั้งหมด ✔');
