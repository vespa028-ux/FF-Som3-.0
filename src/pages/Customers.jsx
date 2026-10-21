import { useCallback, useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, Building2, Copy, Link2, RefreshCw } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useCustomer } from '../lib/customer.jsx'
import { useRealtime } from '../lib/realtime'
import { usePerm } from '../lib/usePerm'
import { useLists } from '../lib/lists'
import { confirm, run, ok } from '../lib/ui'
import Modal, { Field } from '../components/Modal.jsx'

const EMPTY = { name: '', company_name: '', address: '', tax_id: '', phone: '', email: '', contact_name: '', note: '', pack_prices: {}, share_enabled: false, share_token: '' }
export const shareLink = (t) => `${location.origin}${location.pathname}#/c/${t}`

function CustomerModal({ customer, onClose, onSaved }) {
  const { boxes } = useLists()
  const [f, setF] = useState({ ...EMPTY, ...customer, pack_prices: { ...(customer?.pack_prices || {}) } })
  const editing = Boolean(customer?.id)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })

  async function save() {
    if (!f.name.trim()) return run(async () => { throw new Error('กรอกชื่อลูกค้า') })
    const prices = {}
    Object.entries(f.pack_prices).forEach(([k, v]) => { if (v !== '' && !isNaN(+v)) prices[k] = +v })
    const payload = { name: f.name.trim(), company_name: f.company_name || null, address: f.address || null, tax_id: f.tax_id || null,
      phone: f.phone || null, email: f.email || null, contact_name: f.contact_name || null, note: f.note || null, pack_prices: prices }
    const { error } = await run(async () => {
      const q = editing ? supabase.from('customers').update(payload).eq('id', customer.id) : supabase.from('customers').insert(payload)
      const { error } = await q
      if (error) throw error
    }, 'บันทึกลูกค้าแล้ว')
    if (!error) { onSaved(); onClose() }
  }
  async function toggleShare() {
    const v = !f.share_enabled
    const { error } = await run(async () => { const { error } = await supabase.from('customers').update({ share_enabled: v }).eq('id', customer.id); if (error) throw error })
    if (!error) { setF({ ...f, share_enabled: v }); onSaved() }
  }
  async function regen() {
    if (!(await confirm('สร้างลิงก์ใหม่?', 'ลิงก์เดิมจะใช้ไม่ได้ทันที', 'สร้างลิงก์ใหม่'))) return
    const t = crypto.randomUUID()
    const { error } = await run(async () => { const { error } = await supabase.from('customers').update({ share_token: t }).eq('id', customer.id); if (error) throw error }, 'สร้างลิงก์ใหม่แล้ว')
    if (!error) { setF({ ...f, share_token: t }); onSaved() }
  }
  const copy = async () => { await navigator.clipboard.writeText(shareLink(f.share_token)); ok('คัดลอกลิงก์แล้ว') }

  return (
    <Modal title={editing ? 'แก้ไขข้อมูลลูกค้า' : 'เพิ่มลูกค้าใหม่'} onClose={onClose}
      footer={<><button className="btn-ghost" onClick={onClose}>ยกเลิก</button><button className="btn-primary" onClick={save}>บันทึก</button></>}>
      <Field label="ชื่อลูกค้า / ชื่อเรียก *"><input className="input" value={f.name} onChange={set('name')} /></Field>
      <Field label="ชื่อบริษัท (ตามที่ออกบิล)"><input className="input" value={f.company_name || ''} onChange={set('company_name')} /></Field>
      <Field label="ที่อยู่"><textarea rows="2" className="input" value={f.address || ''} onChange={set('address')} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="เลขจดทะเบียน / เลขผู้เสียภาษี"><input className="input" value={f.tax_id || ''} onChange={set('tax_id')} /></Field>
        <Field label="เบอร์โทร"><input className="input" value={f.phone || ''} onChange={set('phone')} /></Field>
        <Field label="อีเมล"><input className="input" value={f.email || ''} onChange={set('email')} /></Field>
        <Field label="ชื่อผู้ติดต่อ"><input className="input" value={f.contact_name || ''} onChange={set('contact_name')} /></Field>
      </div>
      <Field label="ราคาค่าแพ็คต่อออเดอร์ (บาท) แยกตามขนาดกล่อง">
        <div className="grid grid-cols-2 gap-2">
          {boxes.map(b => (
            <label key={b} className="card p-2 text-xs"><div className="text-slate-400 mb-1 truncate" title={b}>{b}</div>
              <input type="number" min="0" step="0.01" className="input !py-1" value={f.pack_prices[b] ?? ''}
                onChange={e => setF({ ...f, pack_prices: { ...f.pack_prices, [b]: e.target.value } })} /></label>))}
        </div>
      </Field>
      <Field label="อื่นๆ / หมายเหตุ"><textarea rows="2" className="input" value={f.note || ''} onChange={set('note')} /></Field>

      {editing && (
        <div className="card p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold flex items-center gap-2"><Link2 size={15} /> ลิงก์ให้ลูกค้าดูข้อมูลของตัวเอง</span>
            <button onClick={toggleShare} className={`badge ${f.share_enabled ? 'bg-emerald-500/20 text-emerald-300' : 'bg-white/10 text-slate-400'}`}>{f.share_enabled ? 'เปิดใช้งาน' : 'ปิดอยู่'}</button>
          </div>
          {f.share_enabled && <>
            <input readOnly className="input text-xs" value={shareLink(f.share_token)} onFocus={e => e.target.select()} />
            <div className="flex gap-2"><button className="btn-ghost" onClick={copy}><Copy size={14} /> คัดลอก</button>
              <button className="btn-ghost" onClick={regen}><RefreshCw size={14} /> สร้างลิงก์ใหม่</button></div>
            <p className="text-xs text-slate-500">ใครมีลิงก์นี้ก็ดูข้อมูลของลูกค้ารายนี้ได้ (อ่านอย่างเดียว) ลิงก์จะใช้งานได้จริงเมื่อนำแอปขึ้นออนไลน์แล้ว</p>
          </>}
        </div>)}
    </Modal>
  )
}

export default function Customers() {
  const { reloadCustomers } = useCustomer()
  const perm = usePerm()
  const [rows, setRows] = useState([])
  const [modal, setModal] = useState(null)

  const load = useCallback(async () => {
    const { data } = await supabase.from('customers').select('*').order('name')
    setRows(data || [])
  }, [])
  useEffect(() => { load() }, [load])
  useRealtime(['customers'], load)
  const refresh = () => { load(); reloadCustomers() }

  async function remove(c) {
    if (!(await confirm(`ลบลูกค้า "${c.name}"?`, 'ลบได้เฉพาะลูกค้าที่ไม่มีสินค้าหรือรายการผูกอยู่', 'ลบลูกค้า'))) return
    await run(async () => {
      const { error } = await supabase.from('customers').delete().eq('id', c.id)
      if (error) throw new Error(error.code === '23503' ? 'ลูกค้ารายนี้มีสินค้า/รายการผูกอยู่ ลบไม่ได้' : error.message)
    }, 'ลบแล้ว')
    refresh()
  }

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="card p-4 flex items-center justify-between">
        <h2 className="font-bold">จัดการลูกค้า</h2>
        {perm('cust.edit') && <button className="btn-primary" onClick={() => setModal({})}><Plus size={16} /> เพิ่มลูกค้า</button>}
      </div>
      <div className="card divide-y divide-bg-line">
        {rows.length === 0 && <div className="p-10 text-center text-slate-500">ยังไม่มีลูกค้า</div>}
        {rows.map(c => (
          <div key={c.id} className="p-3 flex items-center gap-3">
            <div className="p-2 rounded-xl bg-brand/20 text-brand-light"><Building2 size={18} /></div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold truncate">{c.name}</div>
              <div className="text-xs text-slate-400 truncate">{[c.company_name, c.phone, c.tax_id && `เลขผู้เสียภาษี ${c.tax_id}`].filter(Boolean).join(' • ') || 'ยังไม่มีรายละเอียด'}</div>
            </div>
            {c.share_enabled && <span className="badge bg-emerald-500/20 text-emerald-300 hidden sm:inline">ลิงก์เปิดอยู่</span>}
            {perm('cust.edit') && <button className="btn-ghost px-2" onClick={() => setModal(c)}><Pencil size={15} /></button>}
            {perm('cust.delete') && <button className="btn-ghost px-2 text-rose-400" onClick={() => remove(c)}><Trash2 size={15} /></button>}
          </div>))}
      </div>
      {modal && <CustomerModal customer={modal.id ? modal : null} onClose={() => setModal(null)} onSaved={refresh} />}
    </div>
  )
}
