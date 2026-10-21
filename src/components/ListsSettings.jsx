import { Plus, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useLists } from '../lib/lists'
import { ask, confirm, run } from '../lib/ui'

function Chips({ title, items, table, reload, hint }) {
  async function add() {
    const name = await ask(`เพิ่ม${title}`, hint)
    if (!name) return
    await run(async () => { const { error } = await supabase.from(table).insert({ name, sort: 99 }); if (error) throw new Error(error.code === '23505' ? 'มีรายการนี้แล้ว' : error.message) }, 'เพิ่มแล้ว')
    reload()
  }
  async function del(name) {
    if (!(await confirm(`ลบ "${name}"?`, 'รายการเดิมที่เคยบันทึกไว้จะไม่ถูกลบ', 'ลบ'))) return
    await run(async () => { const { error } = await supabase.from(table).delete().eq('name', name); if (error) throw error }, 'ลบแล้ว')
    reload()
  }
  return (
    <div>
      <div className="text-xs text-slate-400 mb-2">{title}</div>
      <div className="flex flex-wrap gap-2">
        {items.map(n => (
          <span key={n} className="badge border border-bg-line bg-white/5 flex items-center gap-1.5">{n}
            <button onClick={() => del(n)} className="text-slate-500 hover:text-rose-400"><X size={12} /></button></span>))}
        <button onClick={add} className="badge border border-dashed border-brand-light text-brand-light flex items-center gap-1"><Plus size={12} /> เพิ่ม</button>
      </div>
    </div>
  )
}

export default function ListsSettings() {
  const { channels, boxes, reload } = useLists()
  return (
    <div className="card p-4 space-y-4">
      <h3 className="font-bold">ช่องทางสั่งซื้อ & ขนาดกล่อง</h3>
      <Chips title="ช่องทางสั่งซื้อ" items={channels} table="channels" reload={reload} hint="เช่น Line, หน้าร้าน" />
      <Chips title="ขนาดกล่อง" items={boxes} table="box_sizes" reload={reload} hint="เช่น D, E+3" />
      <p className="text-xs text-slate-500">ราคาค่าแพ็คของแต่ละขนาดกล่องตั้งได้ที่เมนู "ลูกค้า" (ราคาแตกต่างกันตามลูกค้า)</p>
    </div>
  )
}
