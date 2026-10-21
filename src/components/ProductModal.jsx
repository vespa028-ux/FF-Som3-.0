import { useEffect, useState } from 'react'
import Modal, { Field } from './Modal.jsx'
import { supabase } from '../lib/supabase'
import { run } from '../lib/ui'
import ImageUpload from './ImageUpload.jsx'
import { useCustomer } from '../lib/customer.jsx'

// เพิ่ม/แก้ไขสินค้า (สต็อกคงเหลือเปลี่ยนผ่านรายการรับเข้า/เบิกออกเท่านั้น ยกเว้นตอนสร้างครั้งแรก)
export default function ProductModal({ product, onClose, onSaved }) {
  const { cid } = useCustomer()
  const editing = Boolean(product)
  const [customers, setCustomers] = useState([])
  const [f, setF] = useState(product || { customer_id: '', sku: '', name: '', category: '', unit: 'ชิ้น', image_url: '', zone: '', stock: 0, reorder_point: 10 })
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })

  useEffect(() => {
    supabase.from('customers').select('id,name').order('name').then(({ data }) => {
      setCustomers(data || [])
      if (!editing) { const pick = cid || (data?.length === 1 ? data[0].id : ''); if (pick) setF(x => ({ ...x, customer_id: pick })) }
    })
  }, [editing])

  async function save() {
    if (!f.sku || !f.name || !f.customer_id) return run(async () => { throw new Error('กรอก ลูกค้า / SKU / ชื่อสินค้า ให้ครบ') })
    const payload = { customer_id: f.customer_id, sku: f.sku.trim(), name: f.name.trim(), category: f.category || null,
      unit: f.unit || 'ชิ้น', image_url: f.image_url || null, zone: f.zone || null, reorder_point: Number(f.reorder_point) || 0 }
    const { error } = await run(async () => {
      const q = editing
        ? supabase.from('products').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', product.id)
        : supabase.from('products').insert({ ...payload, stock: Number(f.stock) || 0 })
      const { error } = await q
      if (error) throw error
    }, 'บันทึกสินค้าแล้ว')
    if (!error) { onSaved(); onClose() }
  }

  return (
    <Modal title={editing ? 'แก้ไขสินค้า' : 'เพิ่มสินค้าใหม่'} onClose={onClose}
      footer={<><button className="btn-ghost" onClick={onClose}>ยกเลิก</button><button className="btn-primary" onClick={save}>บันทึก</button></>}>
      <Field label="ลูกค้า *">
        <select className="input" value={f.customer_id} onChange={set('customer_id')} disabled={editing}>
          <option value="">-- เลือกลูกค้า --</option>{customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="รหัส SKU *"><input className="input" value={f.sku} onChange={set('sku')} /></Field>
        <Field label="หมวดหมู่"><input className="input" value={f.category || ''} onChange={set('category')} /></Field>
      </div>
      <Field label="ชื่อสินค้า *"><input className="input" value={f.name} onChange={set('name')} /></Field>
      <div className="grid grid-cols-3 gap-3">
        <Field label="หน่วย"><input className="input" value={f.unit || ''} onChange={set('unit')} /></Field>
        <Field label="โซน"><input className="input" value={f.zone || ''} onChange={set('zone')} /></Field>
        <Field label="จุดสั่งซื้อ"><input className="input" type="number" value={f.reorder_point} onChange={set('reorder_point')} /></Field>
      </div>
      {!editing && <Field label="สต็อกเริ่มต้น"><input className="input" type="number" value={f.stock} onChange={set('stock')} /></Field>}
      <Field label="รูปสินค้า"><ImageUpload value={f.image_url || ''} onChange={u => setF(x => ({ ...x, image_url: u }))} sub="products" /></Field>
    </Modal>
  )
}
