import { useState } from 'react'
import { RefreshCw, Loader2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { rangeOf } from '../lib/dates'
import { useCustomer } from '../lib/customer.jsx'

export default function FooterTracker({ roleLabel }) {
  const { cid } = useCustomer()
  const [preset, setPreset] = useState('month')
  const [sum, setSum] = useState(null)
  const [busy, setBusy] = useState(false)

  async function fetchSum() {
    setBusy(true)
    const r = rangeOf(preset)
    const { data } = await supabase.rpc('daily_summary', { p_from: r.from, p_to: r.to, p_customer: cid || null })
    setSum((data || []).reduce((a, x) => ({ inn: a.inn + +x.in_qty, out: a.out + +x.out_qty, ret: a.ret + +x.return_qty, orders: a.orders + +x.orders }), { inn: 0, out: 0, ret: 0, orders: 0 }))
    setBusy(false)
  }
  const n = (v) => Number(v).toLocaleString()
  return (
    <footer className="border-t border-bg-line px-4 lg:px-6 py-3 pb-24 lg:pb-3 text-xs flex flex-wrap items-center gap-x-4 gap-y-2">
      <span className="text-slate-500">ติดตามยอด</span>
      <select className="input !w-auto !py-1" value={preset} onChange={e => { setPreset(e.target.value); setSum(null) }}>
        <option value="today">วันนี้</option><option value="7d">7 วันล่าสุด</option><option value="month">เดือนนี้</option><option value="all">ทั้งหมด</option>
      </select>
      <button className="btn-ghost !py-1" onClick={fetchSum} disabled={busy}>{busy ? <Loader2 size={13} className="spin" /> : <RefreshCw size={13} />} ดึงข้อมูล</button>
      {sum ? (
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          <span className="text-teal-300">รับเข้า +{n(sum.inn)}</span>
          <span className="text-rose-300">จ่ายออก −{n(sum.out)}</span>
          <span className="text-amber-300">ตีกลับ +{n(sum.ret)}</span>
          <span className="text-slate-300">ออเดอร์ {n(sum.orders)}</span>
          <span className="font-semibold">สุทธิ {sum.inn + sum.ret - sum.out >= 0 ? '+' : ''}{n(sum.inn + sum.ret - sum.out)} ชิ้น</span>
        </div>
      ) : <span className="text-slate-600">กด "ดึงข้อมูล" เพื่อดูยอดรวม</span>}
      <span className="ml-auto text-slate-600 hidden lg:inline">บทบาท: {roleLabel}</span>
    </footer>
  )
}
