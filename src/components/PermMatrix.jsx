import { Fragment, useState } from 'react'
import { Save, Lock } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useShop } from '../lib/shop.jsx'
import { PERM_TREE, DEFAULT_PERMS } from '../lib/perms'
import { run } from '../lib/ui'

// ตารางติ๊กสิทธิ์ แยกตามบทบาท (ผู้จัดการมีสิทธิ์เต็มเสมอ)
export default function PermMatrix() {
  const { shop, reload } = useShop()
  const merge = (role) => ({ ...DEFAULT_PERMS[role], ...(shop.permissions?.[role] || {}) })
  const [perms, setPerms] = useState({ staff: merge('staff'), viewer: merge('viewer') })
  const toggle = (role, key) => setPerms(p => ({ ...p, [role]: { ...p[role], [key]: !p[role][key] } }))

  async function save() {
    await run(async () => {
      const { error } = await supabase.from('settings').update({ permissions: perms, updated_at: new Date().toISOString() }).eq('id', 1)
      if (error) throw error
      await reload()
    }, 'บันทึกสิทธิ์แล้ว')
  }
  const Cell = ({ role, k }) => <td className="p-2 text-center"><input type="checkbox" className="w-4 h-4 accent-teal-500" checked={!!perms[role][k]} onChange={() => toggle(role, k)} /></td>

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="card p-4 flex items-center justify-between gap-3">
        <div><h2 className="font-bold">สิทธิ์การใช้งานตามบทบาท</h2>
          <p className="text-xs text-slate-400">ติ๊กเพื่ออนุญาต ระบบบังคับสิทธิ์ที่ฐานข้อมูลด้วย ไม่ใช่แค่ซ่อนปุ่ม • ผู้เยี่ยมชมเห็นเฉพาะข้อมูลของลูกค้าที่ผูกบัญชีไว้เสมอ</p></div>
        <button className="btn-primary shrink-0" onClick={save}><Save size={16} /> บันทึกสิทธิ์</button>
      </div>
      <div className="card overflow-x-auto">
        <table className="w-full text-sm min-w-[480px]">
          <thead className="text-xs text-slate-400 border-b border-bg-line">
            <tr><th className="text-left p-3">สิทธิ์</th><th className="p-3 w-24">ผู้จัดการ</th><th className="p-3 w-24">พนักงาน</th><th className="p-3 w-24">ลูกค้า</th></tr></thead>
          <tbody>
            {PERM_TREE.map(g => (<Fragment key={g.group}>
              <tr className="bg-white/[0.03]"><td colSpan="4" className="p-2 px-3 font-semibold text-brand-light">{g.group}</td></tr>
              {g.items.map(([k, label]) => (
                <tr key={k} className="border-b border-bg-line/50">
                  <td className="p-2 pl-6">{label}</td>
                  <td className="p-2 text-center"><Lock size={13} className="inline text-slate-500" /></td>
                  <Cell role="staff" k={k} /><Cell role="viewer" k={k} />
                </tr>))}
            </Fragment>))}
            <tr className="bg-white/[0.03]"><td colSpan="4" className="p-2 px-3 font-semibold text-brand-light">ผู้ใช้งาน / ตั้งค่าระบบ</td></tr>
            <tr><td className="p-2 pl-6">จัดการผู้ใช้ สิทธิ์ และตั้งค่าระบบ</td><td className="p-2 text-center"><Lock size={13} className="inline text-slate-500" /></td>
              <td className="p-2 text-center text-xs text-slate-500">เฉพาะผู้จัดการ</td><td className="p-2 text-center text-xs text-slate-500">เฉพาะผู้จัดการ</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
