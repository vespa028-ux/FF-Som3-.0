import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Package, RefreshCw, ShieldAlert, Eye, Receipt, ExternalLink, Printer, X, LogIn } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { rangeOf, daysBetween, thDate } from '../lib/dates'
import { money } from '../lib/invoice'
import { printDoc } from '../lib/pdf'
import ChartBox from '../components/ChartBox.jsx'
import InvoiceView from '../components/InvoiceView.jsx'

const PRESETS = [['today', 'วันนี้'], ['7d', '7 วัน'], ['month', 'เดือนนี้'], ['all', 'ทั้งหมด']]
const TABS = [['dash', 'แดชบอร์ด'], ['in', 'สินค้าเข้า'], ['out', 'สินค้าออก'], ['return', 'ตีกลับ'], ['bill', 'ใบแจ้งหนี้']]
const TYPE = { in: ['รับเข้า', 'bg-emerald-500/20 text-emerald-300', '+'], out: ['เบิกออก', 'bg-rose-500/20 text-rose-300', '-'], return: ['ตีกลับ', 'bg-amber-500/20 text-amber-300', '+'] }
const STATUS = { sent: ['รอชำระ', 'bg-sky-500/20 text-sky-300'], paid: ['ชำระแล้ว', 'bg-emerald-500/20 text-emerald-300'] }
const PAGE = 25

function Stat({ label, value, color }) {
  return <div className="card p-4"><div className="text-xs text-slate-400">{label}</div><div className={`text-2xl font-bold mt-1 ${color}`}>{Number(value || 0).toLocaleString()}</div></div>
}

function DateBar({ preset, setPreset }) {
  return (
    <div className="flex rounded-xl overflow-hidden border border-bg-line w-fit">
      {PRESETS.map(([k, l]) => <button key={k} onClick={() => setPreset(k)} className={`px-3 py-1.5 text-sm ${preset === k ? 'bg-brand text-white' : 'text-slate-400 hover:bg-white/5'}`}>{l}</button>)}
    </div>
  )
}

/* ---------- แดชบอร์ด ---------- */
function DashTab({ token, preset, setPreset, tick }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    let on = true
    setLoading(true)
    const r = rangeOf(preset)
    supabase.rpc('portal_data', { p_token: token, p_from: r.from, p_to: r.to }).then(({ data }) => { if (on) { setData(data); setLoading(false) } })
    return () => { on = false }
  }, [token, preset, tick])

  const series = useMemo(() => {
    if (!data) return []
    const r = rangeOf(preset)
    const map = Object.fromEntries((data.daily || []).map(x => [x.day, x]))
    const days = preset === 'all' ? (data.daily || []).map(x => x.day) : daysBetween(r.from, r.to)
    return days.map(d => ({ day: d, orders: +(map[d]?.orders || 0), out: +(map[d]?.out_qty || 0), inn: +(map[d]?.in_qty || 0), ret: +(map[d]?.return_qty || 0) }))
  }, [data, preset])
  if (!data) return <div className="skeleton h-64" />
  const tot = series.reduce((a, r) => ({ orders: a.orders + r.orders, out: a.out + r.out, inn: a.inn + r.inn, ret: a.ret + r.ret }), { orders: 0, out: 0, inn: 0, ret: 0 })
  const labels = series.map(r => r.day.slice(8) + '/' + r.day.slice(5, 7))
  const badge = (p) => p.stock <= 0 ? ['หมดสต็อก', 'bg-rose-500/20 text-rose-300'] : p.stock <= p.reorder_point ? ['ใกล้หมด', 'bg-amber-500/20 text-amber-300'] : ['ปกติ', 'bg-emerald-500/20 text-emerald-300']

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="รายการสินค้า" value={data.counts.total} color="text-sky-400" />
        <Stat label="ปกติ" value={data.counts.normal} color="text-emerald-400" />
        <Stat label="ใกล้หมด" value={data.counts.low} color="text-amber-400" />
        <Stat label="หมดสต็อก" value={data.counts.out} color="text-rose-400" />
      </div>
      <DateBar preset={preset} setPreset={setPreset} />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="ออเดอร์" value={tot.orders} color="text-violet-400" />
        <Stat label="จ่ายออก (ชิ้น)" value={tot.out} color="text-cyan-400" />
        <Stat label="รับเข้า (ชิ้น)" value={tot.inn} color="text-teal-400" />
        <Stat label="ตีกลับ (ชิ้น)" value={tot.ret} color="text-orange-400" />
      </div>
      <div className="grid lg:grid-cols-2 gap-3">
        <div className="card p-4"><h3 className="font-semibold text-sm mb-2">ออเดอร์รายวัน</h3>
          <ChartBox labels={labels} datasets={[{ label: 'ออเดอร์', data: series.map(r => r.orders), backgroundColor: '#3b82f6', borderRadius: 6 }]} /></div>
        <div className="card p-4"><h3 className="font-semibold text-sm mb-2">รับเข้า vs จ่ายออก (ชิ้น)</h3>
          <ChartBox labels={labels} datasets={[
            { label: 'รับเข้า', data: series.map(r => r.inn), backgroundColor: '#26A69A', borderRadius: 6 },
            { label: 'จ่ายออก', data: series.map(r => r.out), backgroundColor: '#22d3ee', borderRadius: 6 }]} /></div>
      </div>
      <div className="card overflow-x-auto">
        <h3 className="font-semibold text-sm p-4 pb-2">สต็อกสินค้าคงเหลือ</h3>
        <table className="w-full text-sm min-w-[520px]">
          <thead className="text-xs text-slate-400 border-b border-bg-line"><tr><th className="text-left p-3">สินค้า</th><th className="p-3">หมวดหมู่</th><th className="p-3">คงเหลือ</th><th className="p-3">สถานะ</th></tr></thead>
          <tbody>{data.products.map(p => { const b = badge(p); return (
            <tr key={p.sku} className="border-b border-bg-line/60">
              <td className="p-3"><div className="flex items-center gap-3">
                {p.image_url ? <img src={p.image_url} loading="lazy" className="w-10 h-10 rounded-lg object-cover" /> : <div className="w-10 h-10 rounded-lg bg-white/5" />}
                <div><div className="font-semibold">{p.name}</div><div className="text-xs text-slate-400">{p.sku}</div></div></div></td>
              <td className="p-3 text-center text-xs">{p.category || '-'}</td>
              <td className="p-3 text-center font-bold">{p.stock.toLocaleString()} <span className="text-xs text-slate-400 font-normal">{p.unit}</span></td>
              <td className="p-3 text-center"><span className={`badge ${b[1]}`}>{b[0]}</span></td></tr>) })}</tbody>
        </table>
      </div>
    </div>
  )
}

/* ---------- สินค้าเข้า / ออก / ตีกลับ ---------- */
function TxTab({ token, type, preset, setPreset, tick }) {
  const [res, setRes] = useState(null)
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(true)
  useEffect(() => { setPage(0) }, [type, preset])
  useEffect(() => {
    let on = true
    setLoading(true)
    const r = rangeOf(preset)
    supabase.rpc('portal_tx', { p_token: token, p_type: type, p_from: r.from, p_to: r.to, p_limit: PAGE, p_offset: page * PAGE })
      .then(({ data }) => { if (on) { setRes(data); setLoading(false) } })
    return () => { on = false }
  }, [token, type, preset, page, tick])
  const t = TYPE[type]
  const total = res?.total || 0

  return (
    <div className="space-y-4">
      <DateBar preset={preset} setPreset={setPreset} />
      <div className="card overflow-x-auto">
        <table className="w-full text-sm min-w-[620px]">
          <thead className="text-xs text-slate-400 border-b border-bg-line"><tr>
            <th className="text-left p-3">วันที่</th><th className="text-left p-3">สินค้า</th>
            {type === 'out' && <><th className="p-3">ช่องทาง</th><th className="p-3">ออเดอร์</th><th className="p-3">กล่อง</th></>}
            <th className="p-3">จำนวน</th><th className="p-3">ก่อน → หลัง</th><th className="text-left p-3">เหตุผล</th><th className="p-3">หลักฐาน</th></tr></thead>
          <tbody>
            {loading && Array.from({ length: 4 }).map((_, i) => <tr key={i}><td colSpan="9" className="p-3"><div className="skeleton h-9" /></td></tr>)}
            {!loading && (res?.rows || []).length === 0 && <tr><td colSpan="9" className="p-10 text-center text-slate-500">ไม่มีรายการในช่วงนี้</td></tr>}
            {!loading && (res?.rows || []).map(r => (
              <tr key={r.id} className="border-b border-bg-line/60">
                <td className="p-3 whitespace-nowrap">{thDate(r.tx_date)}</td>
                <td className="p-3"><div className="font-semibold">{r.name}</div><div className="text-xs text-slate-400">{r.sku}</div></td>
                {type === 'out' && <><td className="p-3 text-center"><span className="badge bg-white/10">{r.channel}</span></td><td className="p-3 text-center">{r.orders}</td><td className="p-3 text-center text-xs">{r.box_size}</td></>}
                <td className="p-3 text-center"><span className={`badge ${t[1]}`}>{t[2]}{r.qty.toLocaleString()}</span></td>
                <td className="p-3 text-center text-xs text-slate-400">{r.stock_before.toLocaleString()} → <b className="text-slate-200">{r.stock_after.toLocaleString()}</b></td>
                <td className="p-3 text-xs">{r.reason || r.return_cause || '-'}</td>
                <td className="p-3 text-center">{r.evidence_url ? <a href={r.evidence_url} target="_blank" rel="noreferrer"><img src={r.evidence_url} loading="lazy" className="w-9 h-9 rounded-lg object-cover inline-block" /></a> : '-'}</td>
              </tr>))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between text-sm text-slate-400">
        <span>ทั้งหมด {total.toLocaleString()} รายการ</span>
        <div className="flex gap-2 items-center">
          <button className="btn-ghost" disabled={page === 0} onClick={() => setPage(page - 1)}>ก่อนหน้า</button>
          <span>หน้า {page + 1} / {Math.max(1, Math.ceil(total / PAGE))}</span>
          <button className="btn-ghost" disabled={(page + 1) * PAGE >= total} onClick={() => setPage(page + 1)}>ถัดไป</button>
        </div>
      </div>
    </div>
  )
}

/* ---------- ใบแจ้งหนี้ / ใบเสร็จ ---------- */
function DocModal({ kind, inv, cust, company, logo, onClose }) {
  const scale = Math.min(0.75, (window.innerWidth - 40) / 794)
  const props = { kind, inv, cust, company, logo }
  return (
    <div className="fixed inset-0 z-[60] bg-black/80 overflow-auto p-3" onClick={onClose}>
      <div className="max-w-fit mx-auto" onClick={e => e.stopPropagation()}>
        <div className="card p-2 mb-2 flex items-center gap-2 sticky top-0 z-10">
          <b className="px-2">{kind === 'receipt' ? `ใบเสร็จ ${inv.receipt_no}` : `ใบแจ้งหนี้ ${inv.invoice_no}`}</b>
          <button className="btn-ghost !py-1 ml-auto" onClick={printDoc}><Printer size={15} /> พิมพ์ / บันทึก PDF</button>
          <button className="btn-ghost !py-1 px-2" onClick={onClose}><X size={16} /></button>
        </div>
        <div style={{ width: 794 * scale, height: 1123 * scale, overflow: 'hidden', background: '#fff' }}>
          <div style={{ transform: `scale(${scale})`, transformOrigin: 'top left' }}><InvoiceView {...props} /></div>
        </div>
      </div>
      {createPortal(<div className="print-area"><InvoiceView {...props} /></div>, document.body)}
    </div>
  )
}

function BillTab({ token, tick }) {
  const [data, setData] = useState(null)
  const [doc, setDoc] = useState(null)
  useEffect(() => { supabase.rpc('portal_invoices', { p_token: token }).then(({ data }) => setData(data)) }, [token, tick])
  if (!data) return <div className="skeleton h-40" />
  return (
    <div className="space-y-4">
      <div className="card p-3 text-sm flex items-center gap-2 text-slate-300">
        <LogIn size={16} className="text-brand-light shrink-0" />
        <span>ต้องการอัปโหลดสลิปชำระเงิน? <a className="text-brand-light underline" href={location.origin + location.pathname}>เข้าสู่ระบบด้วยชื่อผู้ใช้ของคุณ</a> แล้วไปที่เมนู "ใบแจ้งหนี้" ระบบจะออกใบเสร็จให้ทันที</span>
      </div>
      <div className="card overflow-x-auto">
        <table className="w-full text-sm min-w-[620px]">
          <thead className="text-xs text-slate-400 border-b border-bg-line"><tr><th className="text-left p-3">เลขที่</th><th className="p-3">รอบบริการ</th><th className="p-3 text-right">ยอดชำระ</th><th className="p-3">สถานะ</th><th className="p-3 text-right">เอกสาร</th></tr></thead>
          <tbody>
            {data.invoices.length === 0 && <tr><td colSpan="5" className="p-10 text-center text-slate-500">ยังไม่มีใบแจ้งหนี้</td></tr>}
            {data.invoices.map(r => (
              <tr key={r.id} className="border-b border-bg-line/60">
                <td className="p-3 font-semibold whitespace-nowrap">{r.invoice_no}<div className="text-xs text-slate-400 font-normal">{thDate(r.issue_date)}{r.due_date && ` • ครบ ${thDate(r.due_date)}`}</div></td>
                <td className="p-3 text-center text-xs whitespace-nowrap">{r.period_from ? `${thDate(r.period_from)} - ${thDate(r.period_to)}` : '-'}</td>
                <td className="p-3 text-right font-bold">{money(r.net_total || r.total)}</td>
                <td className="p-3 text-center"><span className={`badge ${STATUS[r.status][1]}`}>{STATUS[r.status][0]}</span></td>
                <td className="p-3"><div className="flex justify-end gap-1">
                  <button className="btn-ghost !py-1 px-2" title="ดูใบแจ้งหนี้" onClick={() => setDoc({ kind: 'invoice', inv: r })}><Eye size={15} /></button>
                  {r.receipt_no && <button className="btn-ghost !py-1 px-2 text-emerald-300" title="ใบเสร็จ" onClick={() => setDoc({ kind: 'receipt', inv: r })}><Receipt size={15} /></button>}
                  {r.slip_url && <a className="btn-ghost !py-1 px-2" href={r.slip_url} target="_blank" rel="noreferrer" title="ดูสลิป"><ExternalLink size={15} /></a>}
                </div></td>
              </tr>))}
          </tbody>
        </table>
      </div>
      {doc && <DocModal kind={doc.kind} inv={doc.inv} cust={data.customer} company={data.company || {}} logo={data.logo} onClose={() => setDoc(null)} />}
    </div>
  )
}

/* ---------- หน้าลูกค้า (เปิดด้วยลิงก์ ไม่ต้องล็อกอิน อ่านอย่างเดียว) ---------- */
export default function Portal({ token }) {
  const [tab, setTab] = useState('dash')
  const [preset, setPreset] = useState('month')
  const [tick, setTick] = useState(0)
  const [head, setHead] = useState(undefined) // undefined=กำลังโหลด null=ลิงก์ใช้ไม่ได้

  useEffect(() => {
    const r = rangeOf('today')
    supabase.rpc('portal_data', { p_token: token, p_from: r.from, p_to: r.to }).then(({ data }) => setHead(data ? { name: data.customer.name, shop: data.shop } : null))
  }, [token])

  if (head === undefined) return <div className="min-h-screen grid place-items-center"><div className="skeleton w-48 h-6" /></div>
  if (head === null) return (
    <div className="min-h-screen grid place-items-center p-6 text-center">
      <div><ShieldAlert className="mx-auto text-amber-400 mb-3" size={40} /><h1 className="font-bold text-lg">ลิงก์นี้ใช้งานไม่ได้</h1>
        <p className="text-slate-400 text-sm mt-1">ลิงก์อาจถูกปิดหรือเปลี่ยนใหม่ กรุณาติดต่อผู้ให้บริการ</p></div>
    </div>)

  return (
    <div className="min-h-screen">
      <header className="border-b border-bg-line p-4 flex items-center gap-3">
        {head.shop?.logo ? <img src={head.shop.logo} className="w-9 h-9 rounded-lg object-cover" /> : <Package className="text-brand-light" />}
        <div className="min-w-0"><div className="font-bold truncate">{head.name}</div><div className="text-xs text-slate-400 truncate">{head.shop?.name} • อ่านอย่างเดียว</div></div>
        <button className="btn-ghost ml-auto" onClick={() => setTick(tick + 1)}><RefreshCw size={15} /> รีเฟรช</button>
      </header>
      <nav className="border-b border-bg-line px-2 overflow-x-auto flex gap-1">
        {TABS.map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={`px-4 py-3 text-sm whitespace-nowrap border-b-2 ${tab === k ? 'border-brand-light text-white font-semibold' : 'border-transparent text-slate-400 hover:text-slate-200'}`}>{l}</button>))}
      </nav>
      <main className="p-4 max-w-6xl mx-auto">
        {tab === 'dash' && <DashTab token={token} preset={preset} setPreset={setPreset} tick={tick} />}
        {['in', 'out', 'return'].includes(tab) && <TxTab token={token} type={tab} preset={preset} setPreset={setPreset} tick={tick} />}
        {tab === 'bill' && <BillTab token={token} tick={tick} />}
      </main>
    </div>
  )
}
