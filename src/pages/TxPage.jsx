import { useCallback, useEffect, useState } from 'react'
import { Plus, Trash2, Pencil, ArrowDownUp, FilterX } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useCustomer } from '../lib/customer.jsx'
import { useRealtime } from '../lib/realtime'
import { useLists } from '../lib/lists'
import { usePerm } from '../lib/usePerm'
import { useDebounce } from '../lib/useDebounce'
import { rangeOf } from '../lib/dates'
import { confirmRevert, run } from '../lib/ui'
import TxModal from '../components/TxModal.jsx'

const PAGE = 25
const COLS = 'id,type,product_id,tx_date,created_at,qty,stock_before,stock_after,ref_no,reason,note,channel,orders,box_size,return_cause,return_condition,evidence_url,profiles(nickname)'
const SIGN = { in: '+', out: '-', return: '+' }
const COLOR = { in: 'text-emerald-300 bg-emerald-500/15', out: 'text-rose-300 bg-rose-500/15', return: 'text-amber-300 bg-amber-500/15' }
const PRESETS = [['all', 'ทั้งหมด'], ['today', 'วันนี้'], ['7d', '7 วัน'], ['month', 'เดือนนี้']]
const fi = 'input !py-1 !text-xs'

export default function TxPage({ type, title }) {
  const perm = usePerm()
  const { cid } = useCustomer()
  const { channels, boxes } = useLists()
  const [rows, setRows] = useState([])
  const [count, setCount] = useState(0)
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null) // {} สร้างใหม่ | {tx} แก้ไข
  const [preset, setPreset] = useState('all')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [newest, setNewest] = useState(true)
  const [fp, setFp] = useState('')       // กรองสินค้า
  const [fch, setFch] = useState('')     // กรองช่องทาง
  const [fbox, setFbox] = useState('')   // กรองกล่อง
  const [fre, setFre] = useState('')     // กรองเหตุผล
  const dp = useDebounce(fp), dre = useDebounce(fre)

  const load = useCallback(async () => {
    setLoading(true)
    const prod = dp ? 'products!inner(name,sku)' : 'products(name,sku)'
    let q = supabase.from('transactions').select(`${COLS},${prod}`, { count: 'exact' }).eq('type', type)
      .order('tx_date', { ascending: !newest }).order('created_at', { ascending: !newest })
      .range(page * PAGE, page * PAGE + PAGE - 1)
    if (cid) q = q.eq('customer_id', cid)
    if (from) q = q.gte('tx_date', from)
    if (to) q = q.lte('tx_date', to)
    if (dp) q = q.or(`name.ilike.%${dp}%,sku.ilike.%${dp}%`, { referencedTable: 'products' })
    if (fch) q = q.eq('channel', fch)
    if (fbox) q = q.eq('box_size', fbox)
    if (dre) q = q.ilike('reason', `%${dre}%`)
    const { data, count } = await q
    setRows(data || []); setCount(count || 0); setLoading(false)
  }, [type, page, cid, from, to, newest, dp, fch, fbox, dre])

  useEffect(() => { setPage(0) }, [type, cid, from, to, newest, dp, fch, fbox, dre])
  useEffect(() => { setFp(''); setFch(''); setFbox(''); setFre('') }, [type])
  useEffect(() => { load() }, [load])
  useRealtime(['transactions'], load)

  const applyPreset = (k) => { setPreset(k); if (k === 'all') { setFrom(''); setTo('') } else { const r = rangeOf(k); setFrom(r.from); setTo(r.to) } }
  const hasFilter = fp || fch || fbox || fre || from || to
  const clear = () => { setFp(''); setFch(''); setFbox(''); setFre(''); applyPreset('all') }

  async function remove(r) {
    const choice = await confirmRevert('ลบรายการนี้?')
    if (!choice) return
    await run(async () => {
      const { error } = await supabase.rpc('delete_transaction', { p_id: r.id, p_revert: choice === 'revert' })
      if (error) throw error
    }, 'ลบแล้ว')
    load()
  }
  const cols = 8 + (type === 'out' ? 3 : 0)

  return (
    <div className="space-y-4">
      <div className="card p-4 flex items-center justify-between">
        <h2 className="font-bold">{title}</h2>
        {perm('tx.create') && <button className="btn-primary" onClick={() => setModal({})}><Plus size={16} /> บันทึกรายการใหม่</button>}
      </div>

      <div className="card p-3 flex flex-wrap items-center gap-2">
        <div className="flex rounded-xl overflow-hidden border border-bg-line">
          {PRESETS.map(([k, l]) => <button key={k} onClick={() => applyPreset(k)} className={`px-3 py-1.5 text-sm ${preset === k ? 'bg-brand text-white' : 'text-slate-400 hover:bg-white/5'}`}>{l}</button>)}
        </div>
        <input type="date" className="input !w-auto" value={from} onChange={e => { setFrom(e.target.value); setPreset('custom') }} />
        <span className="text-slate-500 text-sm">ถึง</span>
        <input type="date" className="input !w-auto" value={to} onChange={e => { setTo(e.target.value); setPreset('custom') }} />
        <div className="ml-auto flex gap-2">
          {hasFilter && <button className="btn-ghost" onClick={clear}><FilterX size={15} /> ล้างตัวกรอง</button>}
          <button className="btn-ghost" onClick={() => setNewest(!newest)}><ArrowDownUp size={15} /> {newest ? 'ใหม่ → เก่า' : 'เก่า → ใหม่'}</button>
        </div>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm min-w-[820px]">
          <thead className="text-xs text-slate-400">
            <tr className="border-b border-bg-line"><th className="text-left p-3">วันที่</th><th className="text-left p-3">สินค้า</th>
              {type === 'out' && <><th className="p-3">ช่องทาง</th><th className="p-3">ออเดอร์</th><th className="p-3">กล่อง</th></>}
              <th className="p-3">จำนวน</th><th className="p-3">ก่อน → หลัง</th><th className="text-left p-3">เหตุผล</th><th className="p-3">ผู้ทำรายการ</th><th className="p-3">หลักฐาน</th><th className="w-20" /></tr>
            <tr className="border-b border-bg-line">
              <th className="px-2 pb-2" />
              <th className="px-2 pb-2"><input className={fi} placeholder="ชื่อ / SKU" value={fp} onChange={e => setFp(e.target.value)} /></th>
              {type === 'out' && <>
                <th className="px-2 pb-2"><select className={fi} value={fch} onChange={e => setFch(e.target.value)}><option value="">ทั้งหมด</option>{channels.map(c => <option key={c}>{c}</option>)}</select></th>
                <th className="px-2 pb-2" />
                <th className="px-2 pb-2"><select className={fi} value={fbox} onChange={e => setFbox(e.target.value)}><option value="">ทั้งหมด</option>{boxes.map(b => <option key={b}>{b}</option>)}</select></th></>}
              <th className="px-2 pb-2" /><th className="px-2 pb-2" />
              <th className="px-2 pb-2"><input className={fi} placeholder="เหตุผล" value={fre} onChange={e => setFre(e.target.value)} /></th>
              <th className="px-2 pb-2" /><th className="px-2 pb-2" /><th className="px-2 pb-2" />
            </tr>
          </thead>
          <tbody>
            {loading && Array.from({ length: 5 }).map((_, i) => <tr key={i}><td colSpan={cols + 3} className="p-3"><div className="skeleton h-9" /></td></tr>)}
            {!loading && rows.length === 0 && <tr><td colSpan={cols + 3} className="p-10 text-center text-slate-500">ไม่พบรายการ</td></tr>}
            {!loading && rows.map(r => (
              <tr key={r.id} className="border-b border-bg-line/60">
                <td className="p-3 whitespace-nowrap">{new Date(r.tx_date).toLocaleDateString('th-TH')}</td>
                <td className="p-3"><div className="font-semibold">{r.products?.name}</div><div className="text-xs text-slate-400">{r.products?.sku}</div></td>
                {type === 'out' && <><td className="p-3 text-center"><span className="badge bg-white/10">{r.channel}</span></td>
                  <td className="p-3 text-center">{r.orders}</td><td className="p-3 text-center text-xs">{r.box_size}</td></>}
                <td className="p-3 text-center"><span className={`badge ${COLOR[type]}`}>{SIGN[type]}{r.qty.toLocaleString()}</span></td>
                <td className="p-3 text-center text-xs text-slate-400">{r.stock_before.toLocaleString()} → <b className="text-slate-200">{r.stock_after.toLocaleString()}</b></td>
                <td className="p-3 text-xs">{r.reason || r.return_cause || '-'}</td>
                <td className="p-3 text-center text-xs">{r.profiles?.nickname || '-'}</td>
                <td className="p-3 text-center">{r.evidence_url ? <a href={r.evidence_url} target="_blank" rel="noreferrer"><img src={r.evidence_url} loading="lazy" className="w-9 h-9 rounded-lg object-cover inline-block" /></a> : '-'}</td>
                <td className="p-3"><div className="flex justify-end gap-2">
                  {perm('tx.edit') && <button className="text-slate-300 hover:text-white" title="แก้ไข" onClick={() => setModal({ tx: r })}><Pencil size={15} /></button>}
                  {perm('tx.delete') && <button className="text-rose-400" title="ลบ" onClick={() => remove(r)}><Trash2 size={15} /></button>}
                </div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between text-sm text-slate-400">
        <span>ทั้งหมด {count.toLocaleString()} รายการ</span>
        <div className="flex gap-2 items-center">
          <button className="btn-ghost" disabled={page === 0} onClick={() => setPage(page - 1)}>ก่อนหน้า</button>
          <span>หน้า {page + 1} / {Math.max(1, Math.ceil(count / PAGE))}</span>
          <button className="btn-ghost" disabled={(page + 1) * PAGE >= count} onClick={() => setPage(page + 1)}>ถัดไป</button>
        </div>
      </div>
      {modal && <TxModal initialType={type} tx={modal.tx} onClose={() => setModal(null)} onSaved={load} />}
    </div>
  )
}
