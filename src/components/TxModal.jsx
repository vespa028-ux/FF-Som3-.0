import { useEffect, useState } from 'react'
import { ArrowDownToLine, ArrowUpFromLine, Undo2 } from 'lucide-react'
import Modal, { Field } from './Modal.jsx'
import ImageUpload from './ImageUpload.jsx'
import { supabase } from '../lib/supabase'
import { useCustomer } from '../lib/customer.jsx'
import { useLists } from '../lib/lists'
import { run, ask, fail } from '../lib/ui'

const TYPES = [
  { id: 'in', label: 'รับเข้า (+)', icon: ArrowDownToLine, btn: 'bg-emerald-600' },
  { id: 'out', label: 'เบิกจ่าย (-)', icon: ArrowUpFromLine, btn: 'bg-rose-600' },
  { id: 'return', label: 'ตีกลับ', icon: Undo2, btn: 'bg-amber-500' }
]
export const BOXES = ['00/0+4']
const RETURN_CAUSES = ['ลูกค้าเปลี่ยนใจ / ขอยกเลิก', 'สินค้าชำรุด / เสียหาย', 'ส่งผิด / ไม่ตรงปก', 'ขนส่งตีกลับ (ส่งไม่สำเร็จ)']
const RETURN_CONDITIONS = ['สภาพดี 100% (นำเข้าสต็อกพร้อมขาย)', 'มีตำหนิ / ต้องตรวจสอบ', 'ชำรุด (ไม่นำเข้าสต็อก)']
const today = () => new Date().toISOString().slice(0, 10)

const initialF = (tx) => tx ? {
  date: tx.tx_date, qty: tx.qty, ref: tx.ref_no || '', reason: tx.reason || '', note: tx.note || '', evidence: tx.evidence_url || '',
  channel: tx.channel || 'TikTok', orders: tx.orders || 1, box: tx.box_size || '00/0+4',
  cause: tx.return_cause || RETURN_CAUSES[0], condition: tx.return_condition || RETURN_CONDITIONS[0]
} : { date: today(), qty: 1, ref: '', reason: '', note: '', evidence: '', channel: 'TikTok', orders: 1, box: '00/0+4', cause: RETURN_CAUSES[0], condition: RETURN_CONDITIONS[0] }

// สร้างรายการใหม่ (tx ไม่ส่ง) หรือแก้ไขรายการเดิม (ส่ง tx)
export default function TxModal({ initialType = 'in', product, tx, onClose, onSaved }) {
  const { cid } = useCustomer()
  const { channels, boxes, reload: reloadLists } = useLists()
  const editing = Boolean(tx)
  const [type, setType] = useState(tx?.type || initialType)
  const [products, setProducts] = useState([])
  const [productId, setProductId] = useState(tx?.product_id || product?.id || '')
  const [f, setF] = useState(initialF(tx))
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const cur = products.find(p => p.id === productId)

  useEffect(() => {
    let q = supabase.from('products').select('id,sku,name,stock,image_url').order('name')
    q = editing ? q.eq('id', tx.product_id) : (cid ? q.eq('customer_id', cid) : q)
    q.then(({ data }) => setProducts(data || []))
  }, [cid, editing, tx?.product_id])

  async function addChannel() {
    const n = await ask('เพิ่มช่องทางสั่งซื้อ', 'เช่น Line, หน้าร้าน')
    if (!n) return
    const { error } = await supabase.from('channels').insert({ name: n, sort: 99 })
    if (error && error.code !== '23505') return fail('เพิ่มไม่สำเร็จ', error.message)
    await reloadLists(); setF(x => ({ ...x, channel: n }))
  }

  async function save() {
    const { error } = await run(async () => {
      if (!productId) throw new Error('เลือกสินค้า')
      const qty = Number(f.qty)
      if (!qty || qty < 1) throw new Error('จำนวนต้องมากกว่า 0')
      const delta = editing ? qty - tx.qty : qty
      if (type === 'out' && cur && delta > cur.stock) throw new Error(`สต็อกไม่พอ (คงเหลือ ${cur.stock})`)
      const common = {
        p_qty: qty, p_date: f.date, p_ref: f.ref || null, p_reason: f.reason || null, p_note: f.note || null, p_evidence: f.evidence || null,
        p_channel: type === 'out' ? f.channel : null, p_orders: type === 'out' ? Number(f.orders) || 1 : null, p_box: type === 'out' ? f.box : null,
        p_return_cause: type === 'return' ? f.cause : null, p_return_condition: type === 'return' ? f.condition : null
      }
      const { error } = editing
        ? await supabase.rpc('update_transaction', { p_id: tx.id, ...common })
        : await supabase.rpc('record_transaction', { p_product: productId, p_type: type, ...common })
      if (error) throw error
    }, editing ? 'บันทึกการแก้ไขแล้ว' : 'บันทึกรายการแล้ว')
    if (!error) { onSaved(); onClose() }
  }

  const delta = editing ? (+f.qty || 0) - tx.qty : (+f.qty || 0)
  const after = cur ? (type === 'out' ? cur.stock - delta : cur.stock + delta) : null
  const active = TYPES.find(t => t.id === type)

  return (
    <Modal title={editing ? `แก้ไขรายการ (${active.label.split(' ')[0]})` : 'ทำรายการสต็อก'} onClose={onClose}
      footer={<><button className="btn-ghost" onClick={onClose}>ยกเลิก</button>
        <button className={`btn text-white ${active.btn}`} onClick={save}>{editing ? 'บันทึกการแก้ไข' : `ยืนยัน${active.label.split(' ')[0]}`}</button></>}>
      {!editing && (
        <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-black/30">
          {TYPES.map(t => (
            <button key={t.id} onClick={() => setType(t.id)}
              className={`rounded-lg py-2 text-xs font-semibold flex items-center justify-center gap-1 ${type === t.id ? t.btn + ' text-white' : 'text-slate-400'}`}>
              <t.icon size={14} /> {t.label}
            </button>
          ))}
        </div>)}

      <div className="grid grid-cols-2 gap-3">
        <Field label="วันที่ทำรายการ"><input className="input" type="date" value={f.date} onChange={set('date')} /></Field>
        <Field label="เลขที่เอกสารอ้างอิง"><input className="input" value={f.ref} onChange={set('ref')} placeholder="PO / SO / RET" /></Field>
      </div>

      {type === 'out' && (
        <Field label="ช่องทางสั่งซื้อ *">
          <div className="flex flex-wrap gap-2">
            {channels.map(c => <button key={c} type="button" onClick={() => setF({ ...f, channel: c })}
              className={`badge border ${f.channel === c ? 'bg-white text-black' : 'border-bg-line'}`}>{c}</button>)}
            <button type="button" onClick={addChannel} className="badge border border-dashed border-brand-light text-brand-light">+ เพิ่ม</button>
          </div>
        </Field>
      )}

      <Field label="สินค้า *">
        <select className="input" value={productId} onChange={e => setProductId(e.target.value)} disabled={editing}>
          <option value="">-- เลือกสินค้า --</option>
          {products.map(p => <option key={p.id} value={p.id}>{p.name} | {p.sku}</option>)}
        </select>
      </Field>
      {cur && <div className="card p-3 flex justify-between text-sm">
        <span>คงเหลือ <b>{cur.stock.toLocaleString()}</b></span><span>→</span>
        <span className={after < 0 ? 'text-rose-400' : 'text-emerald-400'}>หลังทำรายการ <b>{after.toLocaleString()}</b></span>
      </div>}

      <Field label="จำนวน (ชิ้น) *">
        <div className="flex gap-2">
          <input className="input" type="number" min="1" value={f.qty} onChange={set('qty')} />
          {[1, 5, 10, 50].map(n => <button key={n} className="btn-ghost px-2" onClick={() => setF({ ...f, qty: (+f.qty || 0) + n })}>+{n}</button>)}
        </div>
      </Field>

      {type === 'out' && (
        <div className="space-y-3">
          <Field label="จำนวนออเดอร์"><input className="input" type="number" min="1" value={f.orders} onChange={set('orders')} /></Field>
          <Field label="ขนาดกล่อง (กดเลือกด่วน)">
            <div className="flex flex-wrap gap-2">
              {boxes.map(b => <button key={b} type="button" onClick={() => setF({ ...f, box: b })}
                className={`badge border font-mono ${f.box === b ? 'bg-cyan-400/20 border-cyan-300 text-cyan-200' : 'border-bg-line text-slate-400'}`}>{b}</button>)}
            </div>
          </Field>
        </div>
      )}
      {type === 'return' && (
        <div className="grid grid-cols-2 gap-3">
          <Field label="สาเหตุการตีกลับ"><select className="input" value={f.cause} onChange={set('cause')}>{RETURN_CAUSES.map(b => <option key={b}>{b}</option>)}</select></Field>
          <Field label="สภาพสินค้า"><select className="input" value={f.condition} onChange={set('condition')}>{RETURN_CONDITIONS.map(b => <option key={b}>{b}</option>)}</select></Field>
        </div>
      )}

      <Field label="เหตุผล / รายละเอียด"><input className="input" value={f.reason} onChange={set('reason')} /></Field>
      <Field label="บันทึกเพิ่มเติม"><textarea className="input" rows="2" value={f.note} onChange={set('note')} /></Field>
      <Field label="รูปหลักฐาน (รูปสินค้าจริง / ใบเสร็จ)"><ImageUpload value={f.evidence} onChange={u => setF(x => ({ ...x, evidence: u }))} sub="evidence" /></Field>
    </Modal>
  )
}
