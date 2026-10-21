import { useEffect, useRef, useState } from 'react'
import { LogIn, Loader2, Boxes, Eye, EyeOff, History } from 'lucide-react'
import { supabase, api } from '../lib/supabase'
import { fail } from '../lib/ui'

// ล็อกอินด้วย "ชื่อผู้ใช้" หรืออีเมล + รหัสผ่าน (ทุกบทบาท) พร้อมจดจำล็อกอินล่าสุดบนเครื่องนี้
export default function Login() {
  const [last, setLast] = useState(localStorage.getItem('ff_last_user') || '')
  const [id, setId] = useState(last)
  const [pw, setPw] = useState('')
  const [show, setShow] = useState(false)
  const [keep, setKeep] = useState(localStorage.getItem('ff_keep') !== '0')
  const [busy, setBusy] = useState(false)
  const [gid, setGid] = useState('')
  const gbtn = useRef(null)
  const keepRef = useRef(keep)
  keepRef.current = keep

  // ล็อกอินด้วย Google (Gmail ที่ผู้จัดการลงทะเบียนไว้)
  async function onCredential(resp) {
    setBusy(true)
    localStorage.setItem('ff_keep', keepRef.current ? '1' : '0')
    sessionStorage.setItem('ff_alive', '1')
    const { data, error } = await supabase.auth.signInWithGoogle(resp.credential)
    setBusy(false)
    if (error) return fail('เข้าสู่ระบบด้วย Google ไม่สำเร็จ', error.message)
    localStorage.setItem('ff_last_user', data.user.email || '')
  }
  useEffect(() => { api('public.config').then(r => setGid(r.data?.googleClientId || '')) }, [])
  useEffect(() => {
    if (!gid) return
    const init = () => {
      window.google.accounts.id.initialize({ client_id: gid, callback: onCredential })
      window.google.accounts.id.renderButton(gbtn.current, { theme: 'filled_black', size: 'large', width: 320, text: 'signin_with', locale: 'th' })
    }
    if (window.google?.accounts?.id) init()
    else {
      const sc = document.createElement('script'); sc.src = 'https://accounts.google.com/gsi/client'; sc.async = true; sc.onload = init
      document.head.appendChild(sc)
    }
  }, [gid])

  async function submit(e) {
    e.preventDefault(); setBusy(true)
    try {
      localStorage.setItem('ff_keep', keep ? '1' : '0')
      sessionStorage.setItem('ff_alive', '1')
      const { data, error } = await supabase.auth.signInWithPassword({ email: id.trim(), password: pw })
      if (error) throw new Error(error.message)
      localStorage.setItem('ff_last_user', id.trim())
      supabase.from('profiles').update({ last_login_at: new Date().toISOString() }).eq('id', data.user.id).then(() => {})
    } catch (err) { fail('เข้าสู่ระบบไม่สำเร็จ', err.message) }
    setBusy(false)
  }

  return (
    <div className="min-h-screen grid place-items-center p-4">
      <form onSubmit={submit} className="card w-full max-w-sm p-6 space-y-4">
        <div className="flex items-center gap-3"><div className="p-2 rounded-xl bg-brand"><Boxes size={22} /></div>
          <div><div className="font-bold">Fulfillment Portal</div><div className="text-xs text-slate-400">เข้าสู่ระบบด้วยชื่อผู้ใช้และรหัสผ่าน</div></div></div>

        {last && (
          <button type="button" onClick={() => { setLast(''); setId(''); localStorage.removeItem('ff_last_user') }}
            className="w-full flex items-center gap-2 text-xs text-slate-400 border border-bg-line rounded-xl px-3 py-2 hover:bg-white/5">
            <History size={14} /> ล็อกอินล่าสุดบนเครื่องนี้: <b className="text-slate-200 truncate">{last}</b>
            <span className="ml-auto text-brand-light">ใช้บัญชีอื่น</span>
          </button>)}

        <input className="input" placeholder="ชื่อผู้ใช้ หรือ อีเมล" autoComplete="username" autoCapitalize="none" value={id} onChange={e => setId(e.target.value)} required />
        <div className="relative">
          <input className="input pr-10" type={show ? 'text' : 'password'} placeholder="รหัสผ่าน" autoComplete="current-password" value={pw} onChange={e => setPw(e.target.value)} required autoFocus={Boolean(last)} />
          <button type="button" className="absolute right-3 top-2.5 text-slate-400" onClick={() => setShow(!show)}>{show ? <EyeOff size={16} /> : <Eye size={16} />}</button>
        </div>
        <label className="flex items-center gap-2 text-xs text-slate-400"><input type="checkbox" checked={keep} onChange={e => setKeep(e.target.checked)} /> จดจำการเข้าสู่ระบบบนเครื่องนี้</label>
        <button className="btn-primary w-full" disabled={busy}>{busy ? <Loader2 size={16} className="spin" /> : <LogIn size={16} />} เข้าสู่ระบบ</button>
        {gid && (<>
          <div className="flex items-center gap-3 text-[11px] text-slate-500"><div className="flex-1 h-px bg-bg-line" />หรือ<div className="flex-1 h-px bg-bg-line" /></div>
          <div ref={gbtn} className="flex justify-center min-h-[44px]" />
          <p className="text-[11px] text-slate-500 text-center">ใช้ Gmail ที่ผู้จัดการลงทะเบียนไว้ให้</p>
        </>)}
        <p className="text-[11px] text-slate-500 text-center">ลืมรหัสผ่าน? ติดต่อผู้จัดการเพื่อตั้งรหัสผ่านใหม่</p>
      </form>
    </div>
  )
}
