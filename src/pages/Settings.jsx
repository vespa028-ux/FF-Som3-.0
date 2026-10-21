import { useEffect, useState } from 'react'
import { Save, ExternalLink, FileSpreadsheet, FolderOpen } from 'lucide-react'
import { supabase, api, apiUrl } from '../lib/supabase'
import { useShop } from '../lib/shop.jsx'
import { run, ok } from '../lib/ui'
import { folderIdOf } from '../lib/drive'
import ImageUpload from '../components/ImageUpload.jsx'
import CompanySettings from '../components/CompanySettings.jsx'
import ListsSettings from '../components/ListsSettings.jsx'
import BillItemsSettings from '../components/BillItemsSettings.jsx'

export default function Settings() {
  const { shop, reload } = useShop()
  const [name, setName] = useState(shop.shop_name)
  const [logo, setLogo] = useState(shop.logo_url || '')
  const [folder, setFolder] = useState(shop.integrations?.drive?.folder || '')
  const [sheetUrl, setSheetUrl] = useState('')
  const [api2, setApi2] = useState(localStorage.getItem('api_url') || '')
  const folderId = folderIdOf(folder)

  useEffect(() => { api('info').then(r => setSheetUrl(r.data?.sheetUrl || '')) }, [])

  async function save() {
    await run(async () => {
      const { error } = await supabase.from('settings').update({
        shop_name: name.trim() || 'Fulfillment', logo_url: logo || null,
        integrations: { ...(shop.integrations || {}), drive: { ...(shop.integrations?.drive || {}), folder } }, updated_at: new Date().toISOString()
      }).eq('id', 1)
      if (error) throw new Error(error.message)
      await reload()
    }, 'บันทึกการตั้งค่าแล้ว')
  }
  function saveApi() {
    api2 ? localStorage.setItem('api_url', api2.trim()) : localStorage.removeItem('api_url')
    ok('บันทึกแล้ว รีเฟรชหน้าเพื่อใช้ค่าใหม่')
  }

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="card p-4 space-y-3">
        <h3 className="font-bold">ข้อมูลร้าน</h3>
        <label className="block text-xs text-slate-400">ชื่อร้าน / ระบบ<input className="input mt-1" value={name} onChange={e => setName(e.target.value)} /></label>
        <div className="text-xs text-slate-400">โลโก้ร้าน (preview)</div>
        <ImageUpload value={logo} onChange={setLogo} sub="logo" />
      </div>

      <div className="card p-4 space-y-3">
        <h3 className="font-bold flex items-center gap-2"><FileSpreadsheet size={18} /> ฐานข้อมูล: Google Sheets</h3>
        <p className="text-xs text-slate-400">ข้อมูลทั้งหมด (สินค้า รายการสต็อก ลูกค้า ใบแจ้งหนี้ ผู้ใช้) เก็บในไฟล์ Google Sheets ของคุณ แยกเป็นแผ่นตามชนิดข้อมูล เปิดดูหรือสำรองได้ แต่ไม่ควรแก้ตรงๆ ขณะมีคนใช้งาน</p>
        {sheetUrl ? <a className="btn-ghost w-fit" href={sheetUrl} target="_blank" rel="noreferrer"><ExternalLink size={15} /> เปิดไฟล์ Google Sheets</a> : <p className="text-xs text-slate-500">ลิงก์ไฟล์แสดงให้ผู้จัดการเท่านั้น</p>}
      </div>

      <div className="card p-4 space-y-3">
        <h3 className="font-bold flex items-center gap-2"><FolderOpen size={18} /> Google Drive (โฟลเดอร์เก็บรูปและ PDF)</h3>
        <input className="input" placeholder="ลิงก์โฟลเดอร์ Drive (https://drive.google.com/drive/folders/...) — เว้นว่างให้สร้าง FF-Portal-Uploads อัตโนมัติ" value={folder} onChange={e => setFolder(e.target.value)} />
        {folder && !folderId && <p className="text-xs text-rose-400">อ่านรหัสโฟลเดอร์จากลิงก์ไม่ได้</p>}
        {folderId && <a className="text-xs text-brand-light inline-flex items-center gap-1" href={`https://drive.google.com/drive/folders/${folderId}`} target="_blank" rel="noreferrer"><ExternalLink size={12} /> เปิดโฟลเดอร์</a>}
        <p className="text-xs text-slate-500">โฟลเดอร์ต้องเป็นของบัญชี Google เดียวกับที่ติดตั้ง Apps Script</p>
      </div>

      <CompanySettings />
      <ListsSettings />
      <BillItemsSettings />

      <button className="btn-primary" onClick={save}><Save size={16} /> บันทึกการตั้งค่า</button>

      <div className="card p-4 space-y-3">
        <h3 className="font-bold">การเชื่อมต่อ API (เฉพาะเครื่องนี้)</h3>
        <p className="text-xs text-slate-400">ค่าปัจจุบัน: <span className="break-all">{apiUrl() || '-'}</span><br />เว้นว่างเพื่อใช้ค่าจากไฟล์ public/config.js ถ้ากรอก จะใช้ค่านี้แทนในเบราว์เซอร์นี้</p>
        <input className="input" placeholder="https://script.google.com/macros/s/.../exec" value={api2} onChange={e => setApi2(e.target.value)} />
        <button className="btn-ghost" onClick={saveApi}>บันทึกค่าเชื่อมต่อ</button>
      </div>
    </div>
  )
}
