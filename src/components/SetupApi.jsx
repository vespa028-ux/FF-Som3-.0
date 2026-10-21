import { useState } from 'react'
import { Boxes } from 'lucide-react'

export default function SetupApi() {
  const [url, setUrl] = useState('')
  const ok = /^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(url.trim())
  return (
    <div className="min-h-screen grid place-items-center p-4">
      <div className="card w-full max-w-md p-6 space-y-4">
        <div className="flex items-center gap-3"><div className="p-2 rounded-xl bg-brand"><Boxes size={22} /></div>
          <div><div className="font-bold">ตั้งค่าครั้งแรก</div><div className="text-xs text-slate-400">เชื่อมต่อกับ Google Apps Script</div></div></div>
        <p className="text-sm text-slate-400">วาง Web app URL ของ Apps Script (ลงท้ายด้วย /exec) หรือผู้ดูแลแก้ไฟล์ <code>public/config.js</code> เพื่อให้ทุกเครื่องใช้ค่าเดียวกัน</p>
        <input className="input" placeholder="https://script.google.com/macros/s/.../exec" value={url} onChange={e => setUrl(e.target.value)} />
        <button className="btn-primary w-full" disabled={!ok} onClick={() => { localStorage.setItem('api_url', url.trim()); location.reload() }}>บันทึกและเริ่มใช้งาน</button>
      </div>
    </div>
  )
}
