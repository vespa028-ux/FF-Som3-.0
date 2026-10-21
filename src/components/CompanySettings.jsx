import { useState } from 'react'
import { Save, Building } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useShop } from '../lib/shop.jsx'
import { run } from '../lib/ui'

const FIELDS = [
  ['name', 'ชื่อบริษัท / ชื่อผู้ให้บริการ'], ['tax_id', 'เลขประจำตัวผู้เสียภาษี'], ['branch', 'สาขา (เช่น สำนักงานใหญ่)'],
  ['phone', 'เบอร์โทร'], ['email', 'อีเมล'], ['bank_name', 'ธนาคาร'], ['bank_account_no', 'เลขที่บัญชี'], ['bank_account_name', 'ชื่อบัญชี'], ['signer', 'ชื่อผู้ออกเอกสาร (ลายเซ็น)']
]

// ข้อมูลบริษัทสำหรับออกใบแจ้งหนี้
export default function CompanySettings() {
  const { shop, reload } = useShop()
  const [c, setC] = useState({ ...(shop.company || {}) })
  const set = (k) => (e) => setC({ ...c, [k]: e.target.value })
  async function save() {
    await run(async () => {
      const { error } = await supabase.from('settings').update({ company: c, updated_at: new Date().toISOString() }).eq('id', 1)
      if (error) throw error
      await reload()
    }, 'บันทึกข้อมูลบริษัทแล้ว')
  }
  return (
    <div className="card p-4 space-y-3">
      <h3 className="font-bold flex items-center gap-2"><Building size={18} /> ข้อมูลบริษัท (สำหรับออกใบแจ้งหนี้)</h3>
      <div className="grid sm:grid-cols-2 gap-3">
        {FIELDS.map(([k, l]) => (
          <label key={k} className="block text-xs text-slate-400">{l}<input className="input mt-1" value={c[k] || ''} onChange={set(k)} /></label>
        ))}
      </div>
      <label className="block text-xs text-slate-400">ที่อยู่<textarea rows="2" className="input mt-1" value={c.address || ''} onChange={set('address')} /></label>
      <label className="block text-xs text-slate-400">หมายเหตุท้ายใบแจ้งหนี้ (เช่น เงื่อนไขการชำระเงิน)<textarea rows="2" className="input mt-1" value={c.footer_note || ''} onChange={set('footer_note')} /></label>
      <button className="btn-primary" onClick={save}><Save size={16} /> บันทึกข้อมูลบริษัท</button>
      <p className="text-xs text-slate-500">โลโก้ในใบแจ้งหนี้ใช้โลโก้ร้านจากส่วน "ข้อมูลร้าน" ด้านบน</p>
    </div>
  )
}
