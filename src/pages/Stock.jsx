import { useCallback, useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, Lock, Unlock, ArrowLeftRight, Package, Upload, FilterX } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useCustomer } from '../lib/customer.jsx'
import { useRealtime } from '../lib/realtime'
import { usePerm } from '../lib/usePerm'
import { useDebounce } from '../lib/useDebounce'
import { confirm, run } from '../lib/ui'
import ProductModal from '../components/ProductModal.jsx'
import TxModal from '../components/TxModal.jsx'
import ImportModal from '../components/ImportModal.jsx'

const PAGE = 25
const COLS = 'id,customer_id,sku,name,category,unit,image_url,zone,stock,reorder_point,locked,updated_at,customers(name)'
const fi = 'input !py-1 !text-xs'

export function stockBadge(p) {
  if (p.stock <= 0) return <span className="badge bg-rose-500/20 text-rose-300">หมดสต็อก</span>
  if (p.stock <= p.reorder_point) return <span className="badge bg-amber-500/20 text-amber-300">ใกล้หมด</span>
  return <span className="badge bg-emerald-500/20 text-emerald-300">ปกติ</span>
}

export default function Stock() {
  const perm = usePerm()
  const { cid, customers } = useCustomer()
  const [rows, setRows] = useState([])
  const [count, setCount] = useState(0)
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('')
  const [status, setStatus] = useState('')
  const [own, setOwn] = useState('')
  const [min, setMin] = useState('')
  const [max, setMax] = useState('')
  const dq = useDebounce(q), dcat = useDebounce(cat), dmin = useDebounce(min), dmax = useDebounce(max)

  const load = useCallback(async () => {
    setLoading(true)
    let query = supabase.from('products').select(COLS, { count: 'exact' })
      .order('updated_at', { ascending: false }).range(page * PAGE, page * PAGE + PAGE - 1)
    if (cid || own) query = query.eq('customer_id', cid || own)
    if (dq.trim()) query = query.or(`sku.ilike.%${dq.trim()}%,name.ilike.%${dq.trim()}%`)
    if (dcat.trim()) query = query.ilike('category', `%${dcat.trim()}%`)
    if (status) query = query.eq('stock_status', status)
    if (dmin !== '') query = query.gte('stock', Number(dmin))
    if (dmax !== '') query = query.lte('stock', Number(dmax))
    const { data, count } = await query
    setRows(data || []); setCount(count || 0); setLoading(false)
  }, [page, cid, own, dq, dcat, status, dmin, dmax])

  useEffect(() => { setPage(0) }, [cid, own, dq, dcat, status, dmin, dmax])
  useEffect(() => { load() }, [load])
  useRealtime(['products'], load)
  const hasFilter = q || cat || own || status || min !== '' || max !== ''
  const clear = () => { setQ(''); setCat(''); setOwn(''); setStatus(''); setMin(''); setMax('') }

  async function toggleLock(p) {
    await run(async () => {
      const { error } = await supabase.from('products').update({ locked: !p.locked }).eq('id', p.id)
      if (error) throw error
    }, p.locked ? 'ปลดล็อกแล้ว' : 'ล็อกสินค้าแล้ว')
    load()
  }
  async function remove(p) {
    if (p.locked) return run(async () => { throw new Error('สินค้านี้ถูกล็อกอยู่ ต้องปลดล็อกก่อนลบ') })
    if (!(await confirm(`ลบ "${p.name}"?`, 'รายการเคลื่อนไหวที่เกี่ยวข้องอาจได้รับผลกระทบ', 'ลบสินค้า'))) return
    await run(async () => {
      const { error } = await supabase.from('products').delete().eq('id', p.id)
      if (error) throw error
    }, 'ลบแล้ว')
    load()
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center justify-end">
        {hasFilter && <button className="btn-ghost" onClick={clear}><FilterX size={16} /> ล้างตัวกรอง</button>}
        {perm('stock.edit') && <button className="btn-ghost" onClick={() => setModal({ kind: 'import' })}><Upload size={16} /> นำเข้า</button>}
        {perm('stock.edit') && <button className="btn-primary" onClick={() => setModal({ kind: 'product' })}><Plus size={16} /> เพิ่มสินค้า</button>}
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm min-w-[760px]">
          <thead className="text-xs text-slate-400">
            <tr className="border-b border-bg-line"><th className="text-left p-3">สินค้า</th><th className="p-3">เจ้าของสินค้า</th><th className="p-3">หมวดหมู่</th><th className="p-3">คงเหลือ</th><th className="p-3">สถานะ</th><th className="p-3 text-right">จัดการ</th></tr>
            <tr className="border-b border-bg-line">
              <th className="px-2 pb-2"><input className={fi} placeholder="ค้นหา SKU / ชื่อสินค้า" value={q} onChange={e => setQ(e.target.value)} /></th>
              <th className="px-2 pb-2">{cid ? null : <select className={fi} value={own} onChange={e => setOwn(e.target.value)}><option value="">ทั้งหมด</option>{customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>}</th>
              <th className="px-2 pb-2"><input className={fi} placeholder="หมวดหมู่" value={cat} onChange={e => setCat(e.target.value)} /></th>
              <th className="px-2 pb-2"><div className="flex gap-1">
                <input className={fi} type="number" placeholder="ต่ำสุด" value={min} onChange={e => setMin(e.target.value)} />
                <input className={fi} type="number" placeholder="สูงสุด" value={max} onChange={e => setMax(e.target.value)} /></div></th>
              <th className="px-2 pb-2"><select className={fi} value={status} onChange={e => setStatus(e.target.value)}>
                <option value="">ทั้งหมด</option><option value="normal">ปกติ</option><option value="low">ใกล้หมด</option><option value="out">หมดสต็อก</option></select></th>
              <th className="px-2 pb-2" />
            </tr>
          </thead>
          <tbody>
            {loading && Array.from({ length: 5 }).map((_, i) => <tr key={i}><td colSpan="6" className="p-3"><div className="skeleton h-10" /></td></tr>)}
            {!loading && rows.length === 0 && <tr><td colSpan="6" className="p-10 text-center text-slate-500"><Package className="mx-auto mb-2" />ไม่พบสินค้า</td></tr>}
            {!loading && rows.map(p => (
              <tr key={p.id} className="border-b border-bg-line/60 hover:bg-white/[0.02]">
                <td className="p-3"><div className="flex items-center gap-3">
                  {p.image_url ? <img src={p.image_url} loading="lazy" className="w-10 h-10 rounded-lg object-cover" /> : <div className="w-10 h-10 rounded-lg bg-white/5 grid place-items-center"><Package size={16} /></div>}
                  <div><div className="font-semibold">{p.name}</div><div className="text-xs text-slate-400">{p.sku}{p.zone ? ` • ${p.zone}` : ''}</div></div>
                </div></td>
                <td className="p-3 text-center text-xs">{p.customers?.name || '-'}</td>
                <td className="p-3 text-center">{p.category && <span className="badge bg-sky-500/20 text-sky-300">{p.category}</span>}</td>
                <td className="p-3 text-center font-bold">{p.stock.toLocaleString()} <span className="text-xs text-slate-400 font-normal">{p.unit}</span></td>
                <td className="p-3 text-center">{stockBadge(p)}</td>
                <td className="p-3"><div className="flex justify-end gap-1">
                  {perm('tx.create') && <button className="btn-ghost px-2" title="รับ/เบิก" onClick={() => setModal({ kind: 'tx', product: p })}><ArrowLeftRight size={15} /></button>}
                  {perm('stock.edit') && <button className="btn-ghost px-2" title="แก้ไข" onClick={() => setModal({ kind: 'product', product: p })}><Pencil size={15} /></button>}
                  {perm('stock.delete') && <button className="btn-ghost px-2" title="ล็อก/ปลดล็อก" onClick={() => toggleLock(p)}>{p.locked ? <Lock size={15} className="text-amber-400" /> : <Unlock size={15} />}</button>}
                  {perm('stock.delete') && <button className="btn-ghost px-2 text-rose-400" title="ลบ" onClick={() => remove(p)}><Trash2 size={15} /></button>}
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

      {modal?.kind === 'product' && <ProductModal product={modal.product} onClose={() => setModal(null)} onSaved={load} />}
      {modal?.kind === 'import' && <ImportModal onClose={() => setModal(null)} onSaved={load} />}
      {modal?.kind === 'tx' && <TxModal product={modal.product} onClose={() => setModal(null)} onSaved={load} />}
    </div>
  )
}
