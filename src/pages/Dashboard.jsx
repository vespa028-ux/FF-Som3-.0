import { useCallback, useEffect, useMemo, useState } from 'react'
import { Package, CheckCircle2, AlertTriangle, XCircle, ShoppingCart, Boxes, ArrowDownToLine, Undo2, Printer, Download } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { rangeOf, daysBetween, thDate } from '../lib/dates'
import ChartBox from '../components/ChartBox.jsx'
import { useCustomer } from '../lib/customer.jsx'
import { useRealtime } from '../lib/realtime'
import { usePerm } from '../lib/usePerm'

const PRESETS = [['today', 'วันนี้'], ['7d', '7 วัน'], ['month', 'เดือนนี้'], ['all', 'ทั้งหมด']]
const CH_COLORS = { TikTok: '#e2e8f0', Shopee: '#FF8A65', Lazada: '#7c83fd', Facebook: '#0288D1', 'อื่นๆ': '#64748b' }

function Card({ icon: Icon, label, value, color, loading, sub }) {
  return (
    <div className="card p-4">
      <div className="flex items-center justify-between text-xs text-slate-400"><span>{label}</span><Icon size={18} className={color} /></div>
      {loading ? <div className="skeleton h-8 w-24 mt-2" /> : <div className={`text-2xl font-bold mt-1 ${color}`}>{Number(value || 0).toLocaleString()}</div>}
      {sub && <div className="text-xs text-slate-500 mt-1">{sub}</div>}
    </div>
  )
}

export default function Dashboard() {
  const { cid } = useCustomer()
  const perm = usePerm()
  const [preset, setPreset] = useState('month')
  const [custom, setCustom] = useState({ from: '', to: '' })
  const [counts, setCounts] = useState(null)
  const [days, setDays] = useState([])
  const [channels, setChannels] = useState([])
  const [top, setTop] = useState([])
  const [loading, setLoading] = useState(true)

  const range = preset === 'custom' && custom.from && custom.to ? custom : rangeOf(preset === 'custom' ? 'month' : preset)

  const load = useCallback(async () => {
    setLoading(true)
    const args = { p_from: range.from, p_to: range.to, p_customer: cid || null }
    const [c, d, ch, tp] = await Promise.all([
      supabase.rpc('stock_counts', { p_customer: cid || null }),
      supabase.rpc('daily_summary', args),
      supabase.rpc('channel_summary', args),
      supabase.rpc('top_products', { ...args, p_limit: 5 })
    ])
    setCounts(c.data?.[0] || null); setDays(d.data || []); setChannels(ch.data || []); setTop(tp.data || [])
    setLoading(false)
  }, [range.from, range.to, cid])
  useEffect(() => { load() }, [load])
  useRealtime(['transactions', 'products'], load)

  // เติมวันที่ว่างให้กราฟต่อเนื่อง (ยกเว้นช่วง "ทั้งหมด" ใช้เฉพาะวันที่มีข้อมูล)
  const series = useMemo(() => {
    const map = Object.fromEntries(days.map(r => [r.day, r]))
    const list = preset === 'all' ? days.map(r => r.day) : daysBetween(range.from, range.to)
    return list.map(day => ({ day, orders: +(map[day]?.orders || 0), out_qty: +(map[day]?.out_qty || 0), in_qty: +(map[day]?.in_qty || 0), return_qty: +(map[day]?.return_qty || 0) }))
  }, [days, preset, range.from, range.to])

  const tot = series.reduce((a, r) => ({ orders: a.orders + r.orders, out: a.out + r.out_qty, inn: a.inn + r.in_qty, ret: a.ret + r.return_qty }), { orders: 0, out: 0, inn: 0, ret: 0 })
  const labels = series.map(r => r.day.slice(8) + '/' + r.day.slice(5, 7))

  function exportCsv() {
    const rows = [['วันที่', 'ออเดอร์', 'จ่ายออก(ชิ้น)', 'รับเข้า(ชิ้น)', 'ตีกลับ(ชิ้น)'], ...series.map(r => [r.day, r.orders, r.out_qty, r.in_qty, r.return_qty])]
    const blob = new Blob(['\ufeff' + rows.map(r => r.join(',')).join('\n')], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `report_${range.from}_${range.to}.csv`; a.click()
  }

  return (
    <div className="space-y-4">
      <div className="card p-3 flex flex-wrap items-center gap-2 no-print">
        <div className="flex rounded-xl overflow-hidden border border-bg-line">
          {PRESETS.map(([k, l]) => <button key={k} onClick={() => setPreset(k)} className={`px-3 py-1.5 text-sm ${preset === k ? 'bg-brand text-white' : 'text-slate-400 hover:bg-white/5'}`}>{l}</button>)}
        </div>
        <input type="date" className="input !w-auto" value={custom.from} onChange={e => { setCustom({ ...custom, from: e.target.value }); setPreset('custom') }} />
        <span className="text-slate-500">ถึง</span>
        <input type="date" className="input !w-auto" value={custom.to} onChange={e => { setCustom({ ...custom, to: e.target.value }); setPreset('custom') }} />
        <div className="ml-auto flex gap-2">
          <button className="btn-ghost" onClick={exportCsv}><Download size={16} /> CSV</button>
          <button className="btn-primary" onClick={() => window.print()}><Printer size={16} /> พิมพ์รายงาน</button>
        </div>
      </div>

      <div className="hidden print:block text-black">
        <h1 className="text-xl font-bold">รายงานสรุปคลังสินค้า</h1>
        <p>ช่วงวันที่ {thDate(range.from)} ถึง {thDate(range.to)} • พิมพ์เมื่อ {new Date().toLocaleString('th-TH')}</p>
      </div>

      {perm('stock.view') && (<div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card icon={Package} label="รายการสินค้าทั้งหมด" value={counts?.total} color="text-sky-400" loading={loading} />
        <Card icon={CheckCircle2} label="สินค้าปกติ" value={counts?.normal} color="text-emerald-400" loading={loading} />
        <Card icon={AlertTriangle} label="ใกล้หมด" value={counts?.low} color="text-amber-400" loading={loading} />
        <Card icon={XCircle} label="หมดสต็อก" value={counts?.out_of_stock} color="text-rose-400" loading={loading} />
      </div>)}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card icon={ShoppingCart} label="ออเดอร์ (ช่วงที่เลือก)" value={tot.orders} color="text-violet-400" loading={loading} />
        <Card icon={Boxes} label="จ่ายออก (ชิ้น)" value={tot.out} color="text-cyan-400" loading={loading} />
        <Card icon={ArrowDownToLine} label="รับเข้า (ชิ้น)" value={tot.inn} color="text-teal-400" loading={loading} />
        <Card icon={Undo2} label="ตีกลับ (ชิ้น)" value={tot.ret} color="text-orange-400" loading={loading} />
      </div>

      <div className="grid lg:grid-cols-2 gap-3">
        <div className="card p-4"><h3 className="font-semibold text-sm mb-2">ยอดออเดอร์รายวัน</h3>
          {loading ? <div className="skeleton h-60" /> : <ChartBox labels={labels} datasets={[{ label: 'ออเดอร์', data: series.map(r => r.orders), backgroundColor: '#3b82f6', borderRadius: 6 }]} />}</div>
        <div className="card p-4"><h3 className="font-semibold text-sm mb-2">จ่ายสินค้าออกรายวัน (ชิ้น)</h3>
          {loading ? <div className="skeleton h-60" /> : <ChartBox labels={labels} datasets={[{ label: 'จ่ายออก', data: series.map(r => r.out_qty), backgroundColor: '#22d3ee', borderRadius: 6 }]} />}</div>
        <div className="card p-4"><h3 className="font-semibold text-sm mb-2">รับเข้า vs ตีกลับ (ชิ้น)</h3>
          {loading ? <div className="skeleton h-60" /> : <ChartBox labels={labels} datasets={[
            { label: 'รับเข้า', data: series.map(r => r.in_qty), backgroundColor: '#26A69A', borderRadius: 6 },
            { label: 'ตีกลับ', data: series.map(r => r.return_qty), backgroundColor: '#FFCA28', borderRadius: 6 }]} />}</div>
        <div className="card p-4"><h3 className="font-semibold text-sm mb-2">สัดส่วนช่องทางขาย (ชิ้น)</h3>
          {loading ? <div className="skeleton h-60" /> : channels.length === 0 ? <div className="h-60 grid place-items-center text-slate-500 text-sm">ยังไม่มีข้อมูล</div> :
            <ChartBox type="doughnut" labels={channels.map(c => `${c.channel} (${Number(c.qty).toLocaleString()})`)}
              datasets={[{ data: channels.map(c => +c.qty), backgroundColor: channels.map(c => CH_COLORS[c.channel] || '#64748b'), borderWidth: 0 }]} />}</div>
      </div>

      <div className="grid lg:grid-cols-3 gap-3">
        <div className="card p-4 lg:col-span-1"><h3 className="font-semibold text-sm mb-3">สินค้าจ่ายออกสูงสุด 5 อันดับ</h3>
          {loading ? <div className="skeleton h-32" /> : top.length === 0 ? <div className="text-slate-500 text-sm">ยังไม่มีข้อมูล</div> :
            <ol className="space-y-2 text-sm">{top.map((t, i) => <li key={t.sku} className="flex justify-between gap-2"><span className="truncate">{i + 1}. {t.name}</span><b>{Number(t.qty).toLocaleString()}</b></li>)}</ol>}</div>
        <div className="card overflow-x-auto lg:col-span-2">
          <table className="w-full text-sm min-w-[480px]">
            <thead className="text-xs text-slate-400 border-b border-bg-line"><tr><th className="text-left p-3">วันที่</th><th className="p-3">ออเดอร์</th><th className="p-3">จ่ายออก</th><th className="p-3">รับเข้า</th><th className="p-3">ตีกลับ</th></tr></thead>
            <tbody>
              {loading ? Array.from({ length: 4 }).map((_, i) => <tr key={i}><td colSpan="5" className="p-2"><div className="skeleton h-7" /></td></tr>) :
                series.filter(r => r.orders || r.out_qty || r.in_qty || r.return_qty).map(r => (
                  <tr key={r.day} className="border-b border-bg-line/60 text-center"><td className="p-2.5 text-left">{thDate(r.day)}</td>
                    <td>{r.orders || '-'}</td><td className="text-cyan-300">{r.out_qty || '-'}</td><td className="text-teal-300">{r.in_qty ? '+' + r.in_qty : '-'}</td><td className="text-amber-300">{r.return_qty ? '+' + r.return_qty : '-'}</td></tr>))}
              {!loading && series.every(r => !r.orders && !r.out_qty && !r.in_qty && !r.return_qty) && <tr><td colSpan="5" className="p-8 text-center text-slate-500">ไม่มีรายการในช่วงนี้</td></tr>}
            </tbody>
            {!loading && <tfoot className="border-t border-bg-line font-bold text-center"><tr><td className="p-3 text-left">รวม</td><td>{tot.orders.toLocaleString()}</td><td>{tot.out.toLocaleString()}</td><td>+{tot.inn.toLocaleString()}</td><td>+{tot.ret.toLocaleString()}</td></tr></tfoot>}
          </table>
        </div>
      </div>
    </div>
  )
}
