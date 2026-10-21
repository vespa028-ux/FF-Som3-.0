import { useCallback, useEffect, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { confirm, run } from '../lib/ui'
import { money } from '../lib/invoice'

// รายการที่จะวางในบิล (บันทึกไว้เลือกซ้ำได้ในหน้าสร้างใบแจ้งหนี้)
export default function BillItemsSettings() {
  const [rows, setRows] = useState([])
  const [name, setName] = useState('')
  const [price, setPrice] = useState('')
  const load = useCallback(async () => {
    const { data } = await supabase.from('bill_items').select('id,name,unit_price').order('name')
    setRows(data || [])
  }, [])
  useEffect(() => { load() }, [load])

  async function add() {
    if (!name.trim()) return
    const { error } = await run(async () => {
      const { error } = await supabase.from('bill_items').insert({ name: name.trim(), unit_price: Number(price) || 0 })
      if (error) throw error
    })
    if (!error) { setName(''); setPrice(''); load() }
  }
  async function update(id, patch) { await supabase.from('bill_items').update(patch).eq('id', id); load() }
  async function del(r) {
    if (!(await confirm(`ลบ "${r.name}"?`, '', 'ลบ'))) return
    await run(async () => { const { error } = await supabase.from('bill_items').delete().eq('id', r.id); if (error) throw error })
    load()
  }
  return (
    <div className="card p-4 space-y-3">
      <h3 className="font-bold">รายการในบิล (บันทึกไว้เลือกซ้ำ)</h3>
      <div className="space-y-2">
        {rows.map(r => (
          <div key={r.id} className="flex gap-2">
            <input className="input" defaultValue={r.name} onBlur={e => e.target.value !== r.name && update(r.id, { name: e.target.value })} />
            <input className="input !w-28 text-right" type="number" step="0.01" defaultValue={r.unit_price} onBlur={e => Number(e.target.value) !== Number(r.unit_price) && update(r.id, { unit_price: Number(e.target.value) || 0 })} />
            <button className="text-rose-400 px-1" onClick={() => del(r)}><Trash2 size={15} /></button>
          </div>))}
        {rows.length === 0 && <p className="text-xs text-slate-500">ยังไม่มีรายการ เช่น ค่าเช่าพื้นที่จัดเก็บ ค่าขนส่ง ค่าบริการเพิ่ม</p>}
      </div>
      <div className="flex gap-2">
        <input className="input" placeholder="ชื่อรายการ เช่น ค่าเช่าพื้นที่จัดเก็บ" value={name} onChange={e => setName(e.target.value)} />
        <input className="input !w-28 text-right" type="number" step="0.01" placeholder={money(0)} value={price} onChange={e => setPrice(e.target.value)} />
        <button className="btn-primary" onClick={add}><Plus size={16} /></button>
      </div>
      <p className="text-xs text-slate-500">แก้ชื่อหรือราคาได้โดยตรง (บันทึกอัตโนมัติเมื่อออกจากช่อง) • ในหน้าสร้างบิลก็กดไอคอนบุ๊กมาร์กที่แถวรายการเพื่อบันทึกเพิ่มได้</p>
    </div>
  )
}
