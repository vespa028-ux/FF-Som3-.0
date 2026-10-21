import { useCallback, useEffect, useState } from 'react'
import { UserPlus, Pencil, Copy, KeyRound, Link2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth.jsx'
import { run, ok, fail } from '../lib/ui'
import Modal, { Field } from '../components/Modal.jsx'
import PermMatrix from '../components/PermMatrix.jsx'

const ROLES = [['manager', 'ผู้จัดการ', 'ทำได้ทุกอย่าง'], ['staff', 'พนักงาน', 'รับ/เบิก/ตีกลับ ใบแจ้งหนี้ ไม่ลบ'], ['viewer', 'ลูกค้า', 'ดู + ส่งสลิป (เฉพาะของตัวเอง)']]
const BADGE = { manager: 'bg-amber-500/20 text-amber-300', staff: 'bg-sky-500/20 text-sky-300', viewer: 'bg-violet-500/20 text-violet-300' }
const USERNAME_RE = /^[a-z0-9._-]{3,30}$/
const loginLink = () => location.origin + location.pathname

function UserModal({ user, customers, onClose, onSaved }) {
  const { profile } = useAuth()
  const editing = Boolean(user)
  const [f, setF] = useState({ username: '', email: '', nickname: '', department: '', role: 'viewer', customer_id: customers[0]?.id || '', ...user })
  const [pw, setPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const self = editing && user.id === profile.id

  async function save() {
    const username = (f.username || '').trim().toLowerCase()
    const { error } = await run(async () => {
      if (username && !USERNAME_RE.test(username)) throw new Error('ชื่อผู้ใช้ใช้ได้เฉพาะ a-z 0-9 . _ - ความยาว 3–30 ตัว')
      if (!editing && !username && !f.email.trim()) throw new Error('กรอกอีเมล Gmail (หรือชื่อผู้ใช้)')
      if (!editing && !pw && !f.email.trim()) throw new Error('ถ้าไม่ตั้งรหัสผ่าน ต้องกรอกอีเมล Gmail เพื่อให้เข้าด้วย Google')
      if (f.role === 'viewer' && !f.customer_id) throw new Error('ลูกค้าต้องผูกกับบริษัทลูกค้า')
      let id = user?.id
      if (!editing) {
        if (pw && pw.length < 6) throw new Error('รหัสผ่านเริ่มต้นต้องมีอย่างน้อย 6 ตัวอักษร')
        const { data, error } = await supabase.rpc('admin_create_user', { email: f.email.trim(), username, password: pw })
        if (error) throw new Error(error.message)
        id = data.id
      }
      const { error: e2 } = await supabase.from('profiles').update({
        ...(editing && f.email?.trim() ? { email: f.email.trim().toLowerCase() } : {}),
        username: username || null, nickname: f.nickname || null, department: f.department || null,
        role: self ? user.role : f.role, customer_id: f.role === 'viewer' ? f.customer_id : (f.customer_id || null)
      }).eq('id', id)
      if (e2) throw new Error(e2.code === '23505' ? 'ชื่อผู้ใช้นี้ถูกใช้แล้ว' : e2.message)
    }, 'บันทึกผู้ใช้แล้ว')
    if (!error) { onSaved(); onClose() }
  }

  async function resetPw() {
    if (newPw.length < 6) return fail('รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร')
    const { error } = await run(async () => {
      const { error } = await supabase.rpc('admin_set_password', { p_user: user.id, p_password: newPw })
      if (error) throw error
    }, 'ตั้งรหัสผ่านใหม่แล้ว')
    if (!error) setNewPw('')
  }

  return (
    <Modal title={editing ? 'แก้ไขข้อมูลผู้ใช้งาน' : 'เพิ่มผู้ใช้งานและกำหนดสิทธิ์'} onClose={onClose}
      footer={<><button className="btn-ghost" onClick={onClose}>ยกเลิก</button><button className="btn-primary" onClick={save}>บันทึก</button></>}>
      <Field label="อีเมล Gmail (ใช้กดเข้าสู่ระบบด้วย Google)">
        <input className="input" autoCapitalize="none" value={f.email || ''} onChange={set('email')} placeholder="somchai@gmail.com" /></Field>
      <Field label="ชื่อผู้ใช้ (ไม่บังคับ — ใช้ล็อกอินด้วยรหัสผ่านแทน Google)"><input className="input" autoCapitalize="none" placeholder="เช่น somchai" value={f.username || ''} onChange={set('username')} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="ชื่อเรียก"><input className="input" value={f.nickname || ''} onChange={set('nickname')} /></Field>
        <Field label="แผนก / ฝ่ายงาน"><input className="input" value={f.department || ''} onChange={set('department')} /></Field>
      </div>
      {!editing && <Field label="รหัสผ่านเริ่มต้น (เว้นว่าง = เข้าด้วย Google เท่านั้น)"><input className="input" value={pw} onChange={e => setPw(e.target.value)} /></Field>}
      <Field label="ระดับสิทธิ์">
        <div className="grid grid-cols-3 gap-2">
          {ROLES.map(([k, l, d]) => (
            <button key={k} type="button" disabled={self} onClick={() => setF({ ...f, role: k })}
              className={`rounded-xl border p-2 text-center ${f.role === k ? 'border-brand-light bg-brand/20' : 'border-bg-line'} disabled:opacity-50`}>
              <div className="text-sm font-semibold">{l}</div><div className="text-[10px] text-slate-400">{d}</div>
            </button>))}
        </div>
      </Field>
      <Field label={f.role === 'viewer' ? 'บริษัทลูกค้าที่ผูกบัญชี *' : 'ลูกค้า (ไม่บังคับ)'}>
        <select className="input" value={f.customer_id || ''} onChange={set('customer_id')}>
          <option value="">-- ไม่ผูก --</option>{customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </Field>
      {editing && (
        <div className="card p-3 space-y-2">
          <div className="text-sm font-semibold flex items-center gap-2"><KeyRound size={15} /> ตั้งรหัสผ่านใหม่ให้ผู้ใช้นี้</div>
          <div className="flex gap-2"><input className="input" type="text" placeholder="รหัสผ่านใหม่ (อย่างน้อย 6 ตัว)" value={newPw} onChange={e => setNewPw(e.target.value)} />
            <button className="btn-ghost shrink-0" onClick={resetPw}>ตั้งรหัสผ่าน</button></div>
          <p className="text-[11px] text-slate-500">แจ้งรหัสใหม่ให้ผู้ใช้ แล้วให้เขาเปลี่ยนเองได้ที่เมนูโปรไฟล์</p>
        </div>)}
    </Modal>
  )
}

function UsersTab() {
  const [rows, setRows] = useState([])
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    const [p, c] = await Promise.all([
      supabase.from('profiles').select('id,email,username,nickname,department,role,customer_id,avatar_url,last_login_at').order('created_at'),
      supabase.from('customers').select('id,name').order('name')
    ])
    setRows(p.data || []); setCustomers(c.data || []); setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])
  const cname = (id) => customers.find(c => c.id === id)?.name || '-'
  const copy = async (text, msg) => { await navigator.clipboard.writeText(text); ok(msg) }
  const invite = (u) => `เข้าสู่ระบบ: ${loginLink()}\nกดปุ่ม "Sign in with Google" ด้วย Gmail: ${u.email}${u.username ? `\n(หรือชื่อผู้ใช้: ${u.username} + รหัสผ่านที่ผู้จัดการแจ้ง)` : ''}`

  return (
    <div className="space-y-4">
      <div className="card p-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-bold">จัดการผู้ใช้งานและสิทธิ์</h2>
          <button className="btn-primary" onClick={() => setModal({})}><UserPlus size={16} /> เพิ่มผู้ใช้</button>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Link2 size={15} className="text-brand-light shrink-0" />
          <span className="text-slate-400 shrink-0">ลิงก์เข้าสู่ระบบ (ทุกคนใช้ลิงก์เดียวกัน):</span>
          <input readOnly className="input !py-1 text-xs" value={loginLink()} onFocus={e => e.target.select()} />
          <button className="btn-ghost !py-1 shrink-0" onClick={() => copy(loginLink(), 'คัดลอกลิงก์แล้ว')}><Copy size={14} /></button>
        </div>
        <p className="text-[11px] text-slate-500">ลิงก์นี้ใช้งานจริงเมื่อนำแอปขึ้นออนไลน์แล้ว (ตอนนี้เป็น localhost) • บัญชีที่สร้างโดยไม่กรอกอีเมล ระบบตั้งอีเมลภายในให้เอง</p>
      </div>
      <div className="card overflow-x-auto">
        <table className="w-full text-sm min-w-[720px]">
          <thead className="text-xs text-slate-400 border-b border-bg-line"><tr><th className="text-left p-3">ผู้ใช้</th><th className="p-3">แผนก</th><th className="p-3">สิทธิ์</th><th className="p-3">ลูกค้า</th><th className="p-3">ล็อกอินล่าสุด</th><th className="p-3"></th></tr></thead>
          <tbody>
            {loading && Array.from({ length: 3 }).map((_, i) => <tr key={i}><td colSpan="6" className="p-3"><div className="skeleton h-9" /></td></tr>)}
            {!loading && rows.map(u => (
              <tr key={u.id} className="border-b border-bg-line/60">
                <td className="p-3"><div className="font-semibold">{u.nickname || '-'} <span className="text-xs text-slate-400 font-normal">@{u.username || 'ยังไม่ตั้งชื่อผู้ใช้'}</span></div><div className="text-xs text-slate-400">{u.email}</div></td>
                <td className="p-3 text-center text-xs">{u.department || '-'}</td>
                <td className="p-3 text-center"><span className={`badge ${BADGE[u.role]}`}>{ROLES.find(r => r[0] === u.role)?.[1]}</span></td>
                <td className="p-3 text-center text-xs">{cname(u.customer_id)}</td>
                <td className="p-3 text-center text-xs text-slate-400 whitespace-nowrap">{u.last_login_at ? new Date(u.last_login_at).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' }) : '-'}</td>
                <td className="p-3"><div className="flex justify-end gap-1">
                  <button className="btn-ghost px-2" title="คัดลอกข้อความเชิญ (ลิงก์ + ชื่อผู้ใช้)" onClick={() => copy(invite(u), 'คัดลอกข้อความเชิญแล้ว')}><Copy size={15} /></button>
                  <button className="btn-ghost px-2" onClick={() => setModal({ user: u })}><Pencil size={15} /></button>
                </div></td>
              </tr>))}
          </tbody>
        </table>
      </div>
      {modal && <UserModal user={modal.user} customers={customers} onClose={() => setModal(null)} onSaved={load} />}
    </div>
  )
}

export default function Users() {
  const [tab, setTab] = useState('users')
  return (
    <div className="space-y-4">
      <div className="flex rounded-xl overflow-hidden border border-bg-line w-fit">
        {[['users', 'ผู้ใช้งาน'], ['perms', 'สิทธิ์การใช้งาน']].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={`px-4 py-2 text-sm ${tab === k ? 'bg-brand text-white' : 'text-slate-400 hover:bg-white/5'}`}>{l}</button>))}
      </div>
      {tab === 'users' ? <UsersTab /> : <PermMatrix />}
    </div>
  )
}
