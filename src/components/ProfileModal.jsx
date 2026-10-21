import { useState } from 'react'
import Modal, { Field } from './Modal.jsx'
import ImageUpload from './ImageUpload.jsx'
import { useAuth } from '../lib/auth.jsx'
import { supabase } from '../lib/supabase'
import { run } from '../lib/ui'

// ทุกบทบาท (ผู้จัดการ พนักงาน ลูกค้า) แก้ชื่อเล่น รูป และรหัสผ่านของตัวเองได้
export default function ProfileModal({ onClose }) {
  const { profile, reloadProfile } = useAuth()
  const [nickname, setNickname] = useState(profile.nickname || '')
  const [avatar, setAvatar] = useState(profile.avatar_url || '')
  const [cur, setCur] = useState('')
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')

  async function save() {
    const { error } = await run(async () => {
      if (pw || pw2 || cur) {
        if (!cur) throw new Error('กรอกรหัสผ่านปัจจุบัน')
        if (pw.length < 6) throw new Error('รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร')
        if (pw !== pw2) throw new Error('รหัสผ่านใหม่และช่องยืนยันไม่ตรงกัน')
        const { error: e0 } = await supabase.auth.signInWithPassword({ email: profile.email, password: cur })
        if (e0) throw new Error('รหัสผ่านปัจจุบันไม่ถูกต้อง')
        const { error: e2 } = await supabase.auth.updateUser({ password: pw })
        if (e2) throw e2
      }
      const { error: e1 } = await supabase.from('profiles').update({ nickname, avatar_url: avatar || null }).eq('id', profile.id)
      if (e1) throw e1
      await reloadProfile()
    }, 'บันทึกแล้ว')
    if (!error) onClose()
  }
  return (
    <Modal title="ข้อมูลส่วนตัว & รหัสผ่าน" onClose={onClose}
      footer={<><button className="btn-ghost" onClick={onClose}>ยกเลิก</button><button className="btn-primary" onClick={save}>บันทึก</button></>}>
      <div className="text-xs text-slate-400">ชื่อผู้ใช้: <b className="text-slate-200">{profile.username || '-'}</b> • {profile.email}</div>
      <Field label="ชื่อเล่น"><input className="input" value={nickname} onChange={e => setNickname(e.target.value)} /></Field>
      <Field label="รูปโปรไฟล์"><ImageUpload round value={avatar} onChange={setAvatar} sub="avatars" /></Field>
      <div className="card p-3 space-y-3">
        <div className="text-sm font-semibold">เปลี่ยนรหัสผ่าน <span className="text-xs text-slate-500 font-normal">(เว้นว่างถ้าไม่เปลี่ยน)</span></div>
        <Field label="รหัสผ่านปัจจุบัน"><input className="input" type="password" autoComplete="current-password" value={cur} onChange={e => setCur(e.target.value)} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="รหัสผ่านใหม่"><input className="input" type="password" autoComplete="new-password" value={pw} onChange={e => setPw(e.target.value)} /></Field>
          <Field label="ยืนยันรหัสผ่านใหม่"><input className="input" type="password" autoComplete="new-password" value={pw2} onChange={e => setPw2(e.target.value)} /></Field>
        </div>
      </div>
    </Modal>
  )
}
