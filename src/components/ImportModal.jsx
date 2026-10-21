import { useState } from 'react'
import Modal, { Field } from './Modal.jsx'
import { supabase } from '../lib/supabase'
import { useCustomer } from '../lib/customer.jsx'
import { run } from '../lib/ui'

const MAP = {
  sku: ['รหัสสินค้า', 'sku', 'SKU', 'รหัส'], name: ['ชื่อสินค้า', 'name', 'ชื่อ'], category: ['หมวดหมู่', 'category'],
  stock: ['สต็อกคงเหลือ', 'stock', 'คงเหลือ'], reorder_point: ['จุดสั่งซื้อขั้นต่ำ', 'reorder_point', 'จุดสั่งซื้อ'], unit: ['หน่วยนับ', 'unit', 'หน่วย']
}
const pick = (row, keys) => { for (const k of keys) if (row[k] !== undefined && row[k] !== '') return row[k] }

// นำเข้าสินค้าจากไฟล์ Excel/CSV (หัวคอลัมน์ตามไฟล์เดิม: รหัสสินค้า, ชื่อสินค้า, หมวดหมู่, สต็อกคงเหลือ, จุดสั่งซื้อขั้นต่ำ, หน่วยนับ)
export default function ImportModal({ onClose, onSaved }) {
  const { cid, customers } = useCustomer()
  const [customer, setCustomer] = useState(cid || (customers.length === 1 ? customers[0].id : ''))
  const [items, setItems] = useState([])
  const [fileName, setFileName] = useState('')

  async function onFile(e) {
    const file = e.target.files?.[0]; if (!file) return
    setFileName(file.name)
    const XLSX = await import('xlsx')
    const wb = XLSX.read(await file.arrayBuffer())
    const sheet = wb.SheetNames.find(n => /product|สินค้า/i.test(n)) || wb.SheetNames[0]
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheet], { defval: '' })
    setItems(rows.map(r => ({
      sku: String(pick(r, MAP.sku) ?? '').trim(), name: String(pick(r, MAP.name) ?? '').trim(),
      category: pick(r, MAP.category) || null, unit: pick(r, MAP.unit) || 'ชิ้น',
      stock: Number(pick(r, MAP.stock)) || 0, reorder_point: Number(pick(r, MAP.reorder_point)) || 10
    })).filter(r => r.sku && r.name))
  }
  async function save() {
    if (!customer) return run(async () => { throw new Error('เลือกลูกค้า') })
    if (!items.length) return run(async () => { throw new Error('ยังไม่มีข้อมูลที่นำเข้าได้') })
    const { error } = await run(async () => {
      for (let i = 0; i < items.length; i += 200) {
        const chunk = items.slice(i, i + 200).map(x => ({ ...x, customer_id: customer }))
        const { error } = await supabase.from('products').upsert(chunk, { onConflict: 'customer_id,sku' })
        if (error) throw error
      }
    }, `นำเข้า ${items.length} รายการแล้ว`)
    if (!error) { onSaved(); onClose() }
  }
  return (
    <Modal title="นำเข้าสินค้าจากไฟล์ Excel / CSV" onClose={onClose}
      footer={<><button className="btn-ghost" onClick={onClose}>ยกเลิก</button><button className="btn-primary" onClick={save} disabled={!items.length}>นำเข้า {items.length || ''} รายการ</button></>}>
      <Field label="ลูกค้าเจ้าของสินค้า *">
        <select className="input" value={customer} onChange={e => setCustomer(e.target.value)}>
          <option value="">-- เลือกลูกค้า --</option>{customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </Field>
      <Field label="ไฟล์ (.xlsx / .csv)"><input type="file" accept=".xlsx,.xls,.csv" className="input" onChange={onFile} /></Field>
      {fileName && <p className="text-xs text-slate-400">{fileName} — พบสินค้า {items.length} รายการ</p>}
      {items.length > 0 && (
        <div className="card overflow-x-auto"><table className="w-full text-xs">
          <thead className="text-slate-400"><tr><th className="p-2 text-left">SKU</th><th className="p-2 text-left">ชื่อ</th><th className="p-2">คงเหลือ</th></tr></thead>
          <tbody>{items.slice(0, 5).map(r => <tr key={r.sku}><td className="p-2">{r.sku}</td><td className="p-2">{r.name}</td><td className="p-2 text-center">{r.stock}</td></tr>)}</tbody>
        </table>{items.length > 5 && <div className="p-2 text-xs text-slate-500">... และอีก {items.length - 5} รายการ</div>}</div>)}
      <p className="text-xs text-slate-500">SKU ที่มีอยู่แล้วของลูกค้ารายนี้จะถูกอัปเดต (รวมยอดคงเหลือตามไฟล์) ส่วน SKU ใหม่จะถูกเพิ่ม</p>
    </Modal>
  )
}
