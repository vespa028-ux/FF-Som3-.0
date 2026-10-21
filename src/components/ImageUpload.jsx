import { useRef, useState } from 'react'
import { Upload, Camera, Loader2, X } from 'lucide-react'
import { uploadImage } from '../lib/drive'
import { fail } from '../lib/ui'

export default function ImageUpload({ value, onChange, sub = 'misc', round = false }) {
  const pick = useRef(null), cam = useRef(null)
  const [busy, setBusy] = useState(false)

  async function handle(e) {
    const file = e.target.files?.[0]; e.target.value = ''
    if (!file) return
    setBusy(true)
    try { onChange(await uploadImage(file, sub)) } catch (err) { fail('อัปโหลดรูปไม่สำเร็จ', err.message) }
    setBusy(false)
  }
  return (
    <div className="flex items-center gap-3">
      <div className={`relative w-20 h-20 shrink-0 bg-white/5 border border-bg-line grid place-items-center overflow-hidden ${round ? 'rounded-full' : 'rounded-xl'}`}>
        {value ? <img src={value} className="w-full h-full object-cover" /> : <Upload size={18} className="text-slate-500" />}
        {busy && <div className="absolute inset-0 bg-black/60 grid place-items-center"><Loader2 className="spin" size={20} /></div>}
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn-ghost" disabled={busy} onClick={() => pick.current.click()}><Upload size={15} /> เลือกรูป</button>
        <button type="button" className="btn-ghost" disabled={busy} onClick={() => cam.current.click()}><Camera size={15} /> ถ่ายภาพ</button>
        {value && <button type="button" className="btn-ghost text-rose-400" onClick={() => onChange('')}><X size={15} /></button>}
      </div>
      <input ref={pick} type="file" accept="image/*" hidden onChange={handle} />
      <input ref={cam} type="file" accept="image/*" capture="environment" hidden onChange={handle} />
    </div>
  )
}
