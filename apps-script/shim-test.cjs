// ทดสอบตัวแทน supabase (หน้าเว็บ) ต่อกับเซิร์ฟเวอร์จำลอง — รัน: node shim-test.cjs
const fs = require('fs'), assert = require('assert');
const { dispatch, setup } = require('./mock-env.cjs');
setup();
const ls = new Map();
global.localStorage = { getItem: k => (ls.has(k) ? ls.get(k) : null), setItem: (k, v) => ls.set(k, String(v)), removeItem: k => ls.delete(k) };
global.window = { FF_API_URL: 'http://mock' };
global.document = { hidden: false, addEventListener() {} };
global.fetch = async (url, opts) => ({ json: async () => dispatch(JSON.parse(opts.body)) });
fs.writeFileSync('/tmp/shim.mjs', fs.readFileSync(__dirname + '/../src/lib/supabase.js', 'utf8').replace('import.meta.env.VITE_API_URL', '""'));
(async () => {
  const { supabase, configured } = await import('/tmp/shim.mjs');
  assert.ok(configured);
  const events = []; const sub = supabase.auth.onAuthStateChange((e) => events.push(e));
  const bad = await supabase.auth.signInWithPassword({ email: 'admin', password: 'x' });
  assert.ok(bad.error && /ไม่ถูกต้อง/.test(bad.error.message));
  const li = await supabase.auth.signInWithPassword({ email: 'ADMIN', password: 'Passw0rd!' });
  assert.ok(!li.error && li.data.user.id); assert.deepStrictEqual(events, ['SIGNED_IN']);
  assert.ok((await supabase.auth.getSession()).data.session);

  const me = await supabase.from('profiles').select('id,email,username,role,customer_id').eq('id', li.data.user.id).single();
  assert.strictEqual(me.data.role, 'manager');
  const sh = await supabase.from('settings').select('shop_name,logo_url,integrations,company,permissions').eq('id', 1).single();
  assert.strictEqual(sh.data.shop_name, 'Fulfillment'); assert.ok(sh.data.permissions.staff['tx.create']);

  const c = await supabase.from('customers').insert({ name: 'ร้าน A' }).select().single();
  assert.ok(c.data.id && c.data.share_token);
  const p = await supabase.from('products').insert({ customer_id: c.data.id, sku: 'P1', name: 'สบู่' }).select('id').single();
  const dup = await supabase.from('products').insert({ customer_id: c.data.id, sku: 'P1', name: 'ซ้ำ' });
  assert.strictEqual(dup.error.code, '23505');
  assert.ok(!(await supabase.rpc('record_transaction', { p_product: p.data.id, p_type: 'in', p_qty: 50, p_date: '2026-10-10' })).error);
  assert.ok(!(await supabase.rpc('record_transaction', { p_product: p.data.id, p_type: 'out', p_qty: 5, p_date: '2026-10-11', p_channel: 'TikTok', p_orders: 1, p_box: '00/0+4' })).error);

  const tx = await supabase.from('transactions').select('id,type,qty,products!inner(name,sku),profiles(nickname)', { count: 'exact' })
    .eq('type', 'out').order('tx_date', { ascending: false }).order('created_at', { ascending: false }).range(0, 24)
    .or('name.ilike.%สบู่%,sku.ilike.%สบู่%', { referencedTable: 'products' });
  assert.strictEqual(tx.count, 1); assert.strictEqual(tx.data[0].products.name, 'สบู่');
  const cnt = await supabase.from('invoices').select('id', { count: 'exact', head: true }).gte('issue_date', '2026-01-01');
  assert.strictEqual(cnt.count, 0);
  const own = await supabase.from('products').select('id,name,stock,stock_status,customers(name)', { count: 'exact' }).eq('stock_status', 'normal');
  assert.strictEqual(own.data[0].customers.name, 'ร้าน A');
  const ds = await supabase.rpc('daily_summary', { p_from: '2026-10-01', p_to: '2026-10-31', p_customer: null });
  assert.strictEqual(ds.data.length, 2);
  const up = await supabase.from('customers').update({ share_enabled: true }).eq('id', c.data.id);
  assert.ok(!up.error);
  const portal = await supabase.rpc('portal_data', { p_token: c.data.share_token, p_from: '2026-10-01', p_to: '2026-10-31' });
  assert.strictEqual(portal.data.counts.total, 1);
  const rm = await supabase.from('channels').delete().eq('name', 'Facebook'); assert.ok(!rm.error);

  await supabase.auth.signOut();
  assert.deepStrictEqual(events, ['SIGNED_IN', 'SIGNED_OUT']);
  const after = await supabase.from('products').select('*');
  assert.strictEqual(after.error.code, 'AUTH');
  console.log('shim ผ่านทั้งหมด ✔');
})().catch(e => { console.error(e); process.exit(1); });
