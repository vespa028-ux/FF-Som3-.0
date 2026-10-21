import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, Printer, Download, Cloud, ExternalLink } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useShop } from '../lib/shop.jsx'
import { usePerm } from '../lib/usePerm'
import { useDataUrl } from '../lib/useDataUrl'
import { makePdf, pdfBase64, printDoc } from '../lib/pdf'
import { uploadPdf } from '../lib/drive'
import { run } from '../lib/ui'
import InvoiceView from './InvoiceView.jsx'

export default function DocModal({ kind, inv, onClose, onSaved }) {
  const { shop } = useShop()
  const perm = usePerm()
  const logo = useDataUrl(shop.logo_url)
  const [cust, setCust] = useState({})
  const [pdfUrl, setPdfUrl] = useState(kind === 'receipt' ? inv.receipt_pdf_url : inv.pdf_url)
  const no = kind === 'receipt' ? inv.receipt_no : inv.invoice_no
  const scale = Math.min(0.75, (window.innerWidth - 40) / 794)

  useEffect(() => { supabase.from('customers').select('*').eq('id', inv.customer_id).single().then(({ data }) => data && setCust(data)) }, [inv.customer_id])

  const download = () => run(async () => { (await makePdf(document.getElementById('invoice-capture'))).save(`${no}.pdf`) })
  const toDrive = async () => {
    const { error } = await run(async () => {
      const pdf = await makePdf(document.getElementById('invoice-capture'))
      const url = await uploadPdf(pdfBase64(pdf), `${no}.pdf`)
      const col = kind === 'receipt' ? 'receipt_pdf_url' : 'pdf_url'
      const { error } = await supabase.from('invoices').update({ [col]: url }).eq('id', inv.id)
      if (error) throw error
      setPdfUrl(url)
    }, 'บันทึก PDF ขึ้น Drive แล้ว')
    if (!error) onSaved?.()
  }

  const props = { kind, inv, cust, company: shop.company || {}, logo }
  return (
    <div className="fixed inset-0 z-[60] bg-black/80 overflow-auto p-3" onClick={onClose}>
      <div className="max-w-fit mx-auto" onClick={e => e.stopPropagation()}>
        <div className="card p-2 mb-2 flex flex-wrap items-center gap-2 sticky top-0 z-10">
          <b className="px-2">{kind === 'receipt' ? 'ใบเสร็จรับเงิน' : 'ใบแจ้งหนี้'} {no}</b>
          <button className="btn-ghost !py-1 ml-auto" onClick={printDoc}><Printer size={15} /> พิมพ์ A4</button>
          <button className="btn-ghost !py-1" onClick={download}><Download size={15} /> PDF</button>
          {perm('bill.edit') && <button className="btn-ghost !py-1" onClick={toDrive}><Cloud size={15} /> บันทึกขึ้น Drive</button>}
          {pdfUrl && <a className="btn-ghost !py-1" href={pdfUrl} target="_blank" rel="noreferrer"><ExternalLink size={15} /> ไฟล์ใน Drive</a>}
          <button className="btn-ghost !py-1 px-2" onClick={onClose}><X size={16} /></button>
        </div>
        <div style={{ width: 794 * scale, height: 1123 * scale, overflow: 'hidden', background: '#fff' }}>
          <div style={{ transform: `scale(${scale})`, transformOrigin: 'top left' }}><InvoiceView {...props} /></div>
        </div>
      </div>
      {createPortal(<div className="print-area"><InvoiceView id="invoice-capture" {...props} /></div>, document.body)}
    </div>
  )
}
