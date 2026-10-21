import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Plus, Trash2, Pencil, Printer, Cloud, ArrowLeft, Save, ExternalLink, Download, RefreshCw, FileText, Bookmark, Receipt, Upload, Loader2, Eye } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth.jsx'
import { useCustomer } from '../lib/customer.jsx'
import { useShop } from '../lib/shop.jsx'
import { usePerm } from '../lib/usePerm'
import { useDataUrl } from '../lib/useDataUrl'
import { rangeOf, thDate } from '../lib/dates'
import { calc, money } from '../lib/invoice'
import { uploadPdf, uploadImage } from '../lib/drive'
import { makePdf, pdfBase64, printDoc } from '../lib/pdf'
import { confirm, run, ok, fail } from '../lib/ui'
import InvoiceView from '../components/InvoiceView.jsx'
import DocModal from '../components/DocModal.jsx'

const STATUS = { draft: ['ร่าง', 'bg-slate-500/20 text-slate-300'], sent: ['ส่งแล้ว', 'bg-sky-500/20 text-sky-300'], paid: ['ชำระแล้ว', 'bg-emerald-500/20 text-emerald-300'], cancelled: ['ยกเลิก', 'bg-rose-500/20 text-rose-300'] }
const today = () => new Date().toISOString().slice(0, 10)
const plusDays = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10) }
const fmtD = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const lastMonth = () => { const n = new Date(); return { from: fmtD(new Date(n.getFullYear(), n.getMonth() - 1, 1)), to: fmtD(new Date(n.getFullYear(), n.getMonth(), 0)) } }

/* ---------- แก้ไข / สร้างใบแจ้งหนี้ (พนักงาน / ผู้จัดการ) ---------- */
function Editor({ invoice, onClose, onSaved }) {
  const { profile } = useAuth()
  const { cid, customers } = useCustomer()
  const { shop } = useShop()
  const logo = useDataUrl(shop.logo_url)
  const [cust, setCust] = useState(null)
  const [catalog, setCatalog] = useState([])
  const m = rangeOf('month')
  const [f, setF] = useState(invoice || {
    id: null, invoice_no: '', customer_id: cid || customers[0]?.id || '', issue_date: today(), due_date: plusDays(7),
    period_from: m.from, period_to: m.to, items: [], discount: 0, vat_rate: 0, wht_rate: 0, note: '', status: 'draft', pdf_url: ''
  })
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const t = calc(f.items, f.discount, f.vat_rate, f.wht_rate)
  const scale = Math.min(0.62, (window.innerWidth - 48) / 794)

  useEffect(() => {
    if (!f.customer_id) return setCust(null)
    supabase.from('customers').select('*').eq('id', f.customer_id).single().then(({ data }) => setCust(data))
  }, [f.customer_id])
  const loadCatalog = useCallback(async () => {
    const { data } = await supabase.from('bill_items').select('id,name,unit_price').order('name')
    setCatalog(data || [])
  }, [])
  useEffect(() => { loadCatalog() }, [loadCatalog])

  const setItem = (i, k, v) => setF(x => ({ ...x, items: x.items.map((it, j) => j === i ? { ...it, [k]: v } : it) }))
  const missingPrice = f.items.filter(i => i.auto && !Number(i.price))
  const setPeriod = (p) => { const r = p === 'last' ? lastMonth() : rangeOf(p); setF(x => ({ ...x, period_from: r.from, period_to: r.to })) }

  async function fetchUsage() {
    if (!f.customer_id) return fail('เลือกลูกค้าก่อน')
    await run(async () => {
      const { data, error } = await supabase.rpc('billing_usage', { p_customer: f.customer_id, p_from: f.period_from, p_to: f.period_to })
      if (error) throw error
      const prices = cust?.pack_prices || {}
      const auto = (data || []).map(r => ({
        auto: true, desc: `ค่าแพ็คสินค้า กล่อง ${r.box_size}`,
        detail: `${thDate(f.period_from)} - ${thDate(f.period_to)} • ${Number(r.qty).toLocaleString()} ชิ้น`,
        qty: Number(r.orders), price: Number(prices[r.box_size] ?? 0)
      }))
      setF(x => ({ ...x, items: [...auto, ...x.items.filter(i => !i.auto)] }))
      if (!auto.length) throw new Error('ไม่พบรายการเบิกจ่ายของลูกค้ารายนี้ในช่วงเวลาที่เลือก')
    })
  }
  async function saveToCatalog(it) {
    if (!it.desc?.trim()) return fail('ใส่รายละเอียดรายการก่อน')
    const { error } = await supabase.from('bill_items').insert({ name: it.desc.trim(), unit_price: Number(it.price) || 0 })
    if (error) return fail('บันทึกไม่สำเร็จ', error.message)
    ok('บันทึกไว้ในรายการแล้ว'); loadCatalog()
  }
  const addFromCatalog = (id) => {
    const c = catalog.find(x => x.id === id)
    if (c) setF(x => ({ ...x, items: [...x.items, { desc: c.name, qty: 1, price: Number(c.unit_price) }] }))
  }

  async function nextNo(date) {
    const prefix = `INV-${date.slice(0, 7).replace('-', '')}-`
    const { data } = await supabase.from('invoices').select('invoice_no').like('invoice_no', prefix + '%').order('invoice_no', { ascending: false }).limit(1)
    const last = data?.[0]?.invoice_no ? parseInt(data[0].invoice_no.slice(prefix.length), 10) : 0
    return prefix + String((last || 0) + 1).padStart(3, '0')
  }
  async function persist() {
    if (!f.customer_id) throw new Error('เลือกลูกค้า')
    if (!f.items.length) throw new Error('ยังไม่มีรายการในบิล')
    const payload = {
      customer_id: f.customer_id, issue_date: f.issue_date, due_date: f.due_date || null, period_from: f.period_from || null, period_to: f.period_to || null,
      items: f.items, discount: Number(f.discount) || 0, vat_rate: Number(f.vat_rate) || 0, wht_rate: Number(f.wht_rate) || 0,
      subtotal: t.subtotal, vat: t.vat, total: t.total, wht: t.wht, net_total: t.net, note: f.note || null, status: f.status
    }
    if (f.id) {
      const { error } = await supabase.from('invoices').update(payload).eq('id', f.id)
      if (error) throw error
      return { id: f.id, invoice_no: f.invoice_no }
    }
    const invoice_no = await nextNo(f.issue_date)
    const { data, error } = await supabase.from('invoices').insert({ ...payload, invoice_no, created_by: profile.id }).select('id,invoice_no').single()
    if (error) throw error
    setF(x => ({ ...x, id: data.id, invoice_no: data.invoice_no }))
    return data
  }
  async function save() { const { error } = await run(persist, 'บันทึกใบแจ้งหนี้แล้ว'); if (!error) onSaved() }
  const cap = () => document.getElementById('invoice-capture')
  async function download() { await run(async () => { const row = await persist(); (await makePdf(cap())).save(`${row.invoice_no}.pdf`) }); onSaved() }
  async function toDrive() {
    const { error } = await run(async () => {
      const row = await persist()
      const url = await uploadPdf(pdfBase64(await makePdf(cap())), `${row.invoice_no}.pdf`)
      const { error } = await supabase.from('invoices').update({ pdf_url: url }).eq('id', row.id)
      if (error) throw error
      setF(x => ({ ...x, pdf_url: url }))
    }, 'บันทึก PDF ขึ้น Google Drive แล้ว')
    if (!error) onSaved()
  }

  const inv = { ...f, invoice_no: f.invoice_no || '(ออกเลขที่ตอนบันทึก)' }
  const vatOn = Number(f.vat_rate) > 0, whtOn = Number(f.wht_rate) > 0

  return (
    <div className="space-y-4">
      <div className="card p-3 flex flex-wrap items-center gap-2">
        <button className="btn-ghost" onClick={onClose}><ArrowLeft size={16} /> กลับ</button>
        <h2 className="font-bold mr-auto">{f.id ? `ใบแจ้งหนี้ ${f.invoice_no}` : 'สร้างใบแจ้งหนี้ใหม่'}</h2>
        <button className="btn-primary" onClick={save}><Save size={16} /> บันทึก</button>
        <button className="btn-ghost" onClick={printDoc}><Printer size={16} /> พิมพ์ A4</button>
        <button className="btn-ghost" onClick={download}><Download size={16} /> PDF</button>
        <button className="btn-ghost" onClick={toDrive}><Cloud size={16} /> บันทึกขึ้น Drive</button>
        {f.pdf_url && <a className="btn-ghost" href={f.pdf_url} target="_blank" rel="noreferrer"><ExternalLink size={16} /> เปิดไฟล์ใน Drive</a>}
      </div>

      <div className="grid lg:grid-cols-[minmax(0,1fr)_auto] gap-4 items-start">
        <div className="space-y-4 min-w-0">
          <div className="card p-4 space-y-3">
            <h3 className="font-semibold text-sm">ข้อมูลบิล</h3>
            <div className="grid sm:grid-cols-2 gap-3">
              <label className="text-xs text-slate-400">ลูกค้า *
                <select className="input mt-1" value={f.customer_id} onChange={e => setF({ ...f, customer_id: e.target.value, items: f.items.filter(i => !i.auto) })} disabled={Boolean(f.id)}>
                  <option value="">-- เลือกลูกค้า --</option>{customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select></label>
              <label className="text-xs text-slate-400">สถานะ
                <select className="input mt-1" value={f.status} onChange={set('status')}>{Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v[0]}</option>)}</select></label>
              <label className="text-xs text-slate-400">วันที่ออกบิล<input type="date" className="input mt-1" value={f.issue_date} onChange={set('issue_date')} /></label>
              <label className="text-xs text-slate-400">ครบกำหนดชำระ<input type="date" className="input mt-1" value={f.due_date || ''} onChange={set('due_date')} /></label>
            </div>
            <p className="text-xs text-slate-500">ตั้งสถานะเป็น "ส่งแล้ว" เพื่อให้ลูกค้าเห็นบิลและอัปโหลดสลิปได้ (ร่างลูกค้าจะไม่เห็น)</p>
          </div>

          <div className="card p-4 space-y-3">
            <h3 className="font-semibold text-sm">ดึงข้อมูลตามช่วงเวลา</h3>
            <div className="flex flex-wrap gap-2">
              {[['last', 'เดือนที่แล้ว'], ['month', 'เดือนนี้'], ['7d', '7 วันล่าสุด']].map(([k, l]) => <button key={k} className="btn-ghost !py-1" onClick={() => setPeriod(k)}>{l}</button>)}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <input type="date" className="input !w-auto" value={f.period_from || ''} onChange={set('period_from')} />
              <span className="text-slate-500 text-sm">ถึง</span>
              <input type="date" className="input !w-auto" value={f.period_to || ''} onChange={set('period_to')} />
              <button className="btn-primary" onClick={fetchUsage}><RefreshCw size={15} /> ดึงข้อมูลรายการ</button>
            </div>
            <p className="text-xs text-slate-500">ระบบรวมออเดอร์ที่เบิกจ่ายตามขนาดกล่อง คูณราคาค่าแพ็คที่ตั้งไว้ในเมนู "ลูกค้า" (ดึงใหม่จะแทนที่รายการอัตโนมัติ ส่วนรายการที่เพิ่มเองจะยังอยู่)</p>
            {missingPrice.length > 0 && <p className="text-xs text-amber-300">ยังไม่ได้ตั้งราคาสำหรับ: {missingPrice.map(i => i.desc.replace('ค่าแพ็คสินค้า กล่อง ', '')).join(', ')} — แก้ราคาในตารางด้านล่างได้เลย</p>}
          </div>

          <div className="card p-4 space-y-3">
            <div className="flex flex-wrap items-center gap-2 justify-between"><h3 className="font-semibold text-sm">รายการในบิล</h3>
              <div className="flex gap-2">
                <select className="input !w-auto !py-1" value="" onChange={e => addFromCatalog(e.target.value)}>
                  <option value="">+ เลือกจากรายการที่บันทึกไว้</option>
                  {catalog.map(c => <option key={c.id} value={c.id}>{c.name} ({money(c.unit_price)})</option>)}
                </select>
                <button className="btn-ghost !py-1" onClick={() => setF({ ...f, items: [...f.items, { desc: '', qty: 1, price: 0 }] })}><Plus size={14} /> เพิ่มเอง</button>
              </div></div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[520px]">
                <thead className="text-xs text-slate-400"><tr><th className="text-left p-1">รายละเอียด</th><th className="p-1 w-20">จำนวน</th><th className="p-1 w-24">ราคา</th><th className="p-1 w-24 text-right">รวม</th><th className="w-16" /></tr></thead>
                <tbody>{f.items.map((it, i) => (
                  <tr key={i}>
                    <td className="p-1"><input className="input !py-1" value={it.desc} onChange={e => setItem(i, 'desc', e.target.value)} /></td>
                    <td className="p-1"><input type="number" className="input !py-1 text-center" value={it.qty} onChange={e => setItem(i, 'qty', e.target.value)} /></td>
                    <td className="p-1"><input type="number" step="0.01" className="input !py-1 text-right" value={it.price} onChange={e => setItem(i, 'price', e.target.value)} /></td>
                    <td className="p-1 text-right">{money((Number(it.qty) || 0) * (Number(it.price) || 0))}</td>
                    <td className="p-1"><div className="flex gap-2 justify-end">
                      <button className="text-brand-light" title="บันทึกรายการนี้ไว้ใช้ซ้ำ" onClick={() => saveToCatalog(it)}><Bookmark size={15} /></button>
                      <button className="text-rose-400" onClick={() => setF({ ...f, items: f.items.filter((_, j) => j !== i) })}><Trash2 size={15} /></button></div></td>
                  </tr>))}
                  {f.items.length === 0 && <tr><td colSpan="5" className="p-6 text-center text-slate-500 text-xs">กด "ดึงข้อมูลรายการ" หรือเลือก/เพิ่มรายการ</td></tr>}</tbody>
              </table>
            </div>

            <div className="grid sm:grid-cols-3 gap-3">
              <label className="text-xs text-slate-400">ส่วนลด (บาท)<input type="number" min="0" className="input mt-1" value={f.discount} onChange={set('discount')} /></label>
              <div className="text-xs text-slate-400">ภาษีมูลค่าเพิ่ม (VAT)
                <label className="mt-1 flex items-center gap-2 input cursor-pointer"><input type="checkbox" checked={vatOn} onChange={e => setF({ ...f, vat_rate: e.target.checked ? 7 : 0 })} />
                  <span className="text-slate-200">{vatOn ? 'คิด VAT 7%' : 'ไม่คิด VAT'}</span></label></div>
              <div className="text-xs text-slate-400">หัก ณ ที่จ่าย
                <div className="mt-1 flex gap-2">
                  <label className="flex-1 flex items-center gap-2 input cursor-pointer"><input type="checkbox" checked={whtOn} onChange={e => setF({ ...f, wht_rate: e.target.checked ? 3 : 0 })} />
                    <span className="text-slate-200">{whtOn ? 'หัก' : 'ไม่หัก'}</span></label>
                  {whtOn && <select className="input !w-auto" value={f.wht_rate} onChange={set('wht_rate')}>{[1, 2, 3, 5].map(r => <option key={r} value={r}>{r}%</option>)}</select>}
                </div></div>
            </div>
            <label className="block text-xs text-slate-400">หมายเหตุในบิล<textarea rows="2" className="input mt-1" value={f.note || ''} onChange={set('note')} /></label>
            <div className="text-right text-sm space-y-0.5">
              <div className="text-slate-400">รวม {money(t.subtotal)}{vatOn && ` • VAT ${money(t.vat)}`}{whtOn && ` • หัก ณ ที่จ่าย ${money(t.wht)}`}</div>
              <div className="text-lg font-bold text-brand-light">{whtOn ? 'ยอดชำระสุทธิ' : 'ยอดสุทธิ'} ฿ {money(t.net)}</div>
            </div>
          </div>
        </div>

        <div className="card p-2 overflow-hidden" style={{ width: 794 * scale + 16 }}>
          <div style={{ width: 794 * scale, height: 1123 * scale, overflow: 'hidden' }}>
            <div style={{ transform: `scale(${scale})`, transformOrigin: 'top left' }}>
              <InvoiceView inv={inv} cust={cust || {}} company={shop.company || {}} logo={logo} />
            </div>
          </div>
        </div>
      </div>
      {createPortal(<div className="print-area"><InvoiceView id="invoice-capture" inv={inv} cust={cust || {}} company={shop.company || {}} logo={logo} /></div>, document.body)}
    </div>
  )
}

/* ---------- ปุ่มอัปโหลดสลิป → ชำระแล้ว + ออกใบเสร็จอัตโนมัติ ---------- */
function SlipButton({ invoice, onDone }) {
  const ref = useRef(null)
  const [busy, setBusy] = useState(false)
  async function pick(e) {
    const file = e.target.files?.[0]; e.target.value = ''
    if (!file) return
    setBusy(true)
    try {
      const url = await uploadImage(file, 'slips')
      const { error } = await supabase.rpc('submit_slip', { p_invoice: invoice.id, p_slip: url })
      if (error) throw error
      await ok('ส่งสลิปแล้ว ออกใบเสร็จเรียบร้อย'); onDone()
    } catch (err) { fail('อัปโหลดสลิปไม่สำเร็จ', err.message) }
    setBusy(false)
  }
  return (<>
    <button className="btn-primary !py-1" disabled={busy} onClick={() => ref.current.click()}>
      {busy ? <Loader2 size={14} className="spin" /> : <Upload size={14} />} {invoice.slip_url ? 'ส่งสลิปใหม่' : 'อัปโหลดสลิป'}</button>
    <input ref={ref} type="file" accept="image/*" hidden onChange={pick} />
  </>)
}

/* ---------- รายการใบแจ้งหนี้ ---------- */
export default function Billing() {
  const { cid } = useCustomer()
  const perm = usePerm()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(null)
  const [doc, setDoc] = useState(null) // { kind, inv }
  const canEdit = perm('bill.edit')

  const load = useCallback(async () => {
    setLoading(true)
    let q = supabase.from('invoices').select('*, customers(name)').order('created_at', { ascending: false }).limit(100)
    if (cid) q = q.eq('customer_id', cid)
    const { data } = await q
    setRows(data || []); setLoading(false)
  }, [cid])
  useEffect(() => { load() }, [load])

  async function remove(r) {
    if (!(await confirm(`ลบใบแจ้งหนี้ ${r.invoice_no}?`, 'ไฟล์ใน Drive จะไม่ถูกลบ', 'ลบ'))) return
    await run(async () => { const { error } = await supabase.from('invoices').delete().eq('id', r.id); if (error) throw error }, 'ลบแล้ว')
    load()
  }

  if (editing) return <Editor invoice={editing.id ? editing : null} onClose={() => { setEditing(null); load() }} onSaved={load} />

  return (
    <div className="space-y-4">
      <div className="card p-4 flex items-center justify-between">
        <h2 className="font-bold flex items-center gap-2"><FileText size={18} /> ใบแจ้งหนี้ / ใบเสร็จ</h2>
        {canEdit && <button className="btn-primary" onClick={() => setEditing({})}><Plus size={16} /> สร้างบิลใหม่</button>}
      </div>
      <div className="card overflow-x-auto">
        <table className="w-full text-sm min-w-[720px]">
          <thead className="text-xs text-slate-400 border-b border-bg-line"><tr>
            <th className="text-left p-3">เลขที่</th><th className="text-left p-3">ลูกค้า</th><th className="p-3">รอบบริการ</th><th className="p-3 text-right">ยอดชำระ</th><th className="p-3">สถานะ</th><th className="p-3 text-right">จัดการ</th></tr></thead>
          <tbody>
            {loading && Array.from({ length: 3 }).map((_, i) => <tr key={i}><td colSpan="6" className="p-3"><div className="skeleton h-9" /></td></tr>)}
            {!loading && rows.length === 0 && <tr><td colSpan="6" className="p-10 text-center text-slate-500">ยังไม่มีใบแจ้งหนี้</td></tr>}
            {!loading && rows.map(r => (
              <tr key={r.id} className="border-b border-bg-line/60">
                <td className="p-3 font-semibold whitespace-nowrap">{r.invoice_no}<div className="text-xs text-slate-400 font-normal">{thDate(r.issue_date)}{r.due_date && ` • ครบ ${thDate(r.due_date)}`}</div></td>
                <td className="p-3">{r.customers?.name}</td>
                <td className="p-3 text-center text-xs whitespace-nowrap">{r.period_from ? `${thDate(r.period_from)} - ${thDate(r.period_to)}` : '-'}</td>
                <td className="p-3 text-right font-bold">{money(r.net_total || r.total)}{r.wht > 0 && <div className="text-[10px] text-slate-400 font-normal">หัก ณ ที่จ่ายแล้ว</div>}</td>
                <td className="p-3 text-center"><span className={`badge ${STATUS[r.status][1]}`}>{STATUS[r.status][0]}</span>{r.receipt_no && <div className="text-[10px] text-slate-400 mt-1">{r.receipt_no}</div>}</td>
                <td className="p-3"><div className="flex flex-wrap justify-end gap-1">
                  <button className="btn-ghost !py-1 px-2" title="ดูใบแจ้งหนี้" onClick={() => setDoc({ kind: 'invoice', inv: r })}><Eye size={15} /></button>
                  {r.receipt_no && <button className="btn-ghost !py-1 px-2 text-emerald-300" title="ใบเสร็จ" onClick={() => setDoc({ kind: 'receipt', inv: r })}><Receipt size={15} /></button>}
                  {r.slip_url && <a className="btn-ghost !py-1 px-2" href={r.slip_url} target="_blank" rel="noreferrer" title="ดูสลิป"><ExternalLink size={15} /></a>}
                  {perm('bill.slip') && r.status === 'sent' && <SlipButton invoice={r} onDone={load} />}
                  {canEdit && <button className="btn-ghost !py-1 px-2" title="แก้ไข" onClick={() => setEditing(r)}><Pencil size={15} /></button>}
                  {perm('bill.delete') && <button className="btn-ghost !py-1 px-2 text-rose-400" onClick={() => remove(r)}><Trash2 size={15} /></button>}
                </div></td>
              </tr>))}
          </tbody>
        </table>
      </div>
      {doc && <DocModal kind={doc.kind} inv={doc.inv} onClose={() => setDoc(null)} onSaved={load} />}
    </div>
  )
}
