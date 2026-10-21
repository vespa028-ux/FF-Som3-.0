// สร้าง PDF A4 จาก element (ตัดแบ่งหน้าอัตโนมัติ) และสั่งพิมพ์
export async function makePdf(el) {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import('html2canvas'), import('jspdf')])
  if (document.fonts?.ready) await document.fonts.ready
  const canvas = await html2canvas(el, { scale: 2, backgroundColor: '#ffffff', useCORS: true })
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' })
  const w = 210, h = canvas.height * w / canvas.width, img = canvas.toDataURL('image/jpeg', 0.92)
  let left = h, pos = 0
  pdf.addImage(img, 'JPEG', 0, pos, w, h); left -= 297
  while (left > 1) { pos -= 297; pdf.addPage(); pdf.addImage(img, 'JPEG', 0, pos, w, h); left -= 297 }
  return pdf
}
export const pdfBase64 = (pdf) => pdf.output('datauristring').split(',')[1]
export function printDoc() {
  document.body.classList.add('printing-invoice')
  const done = () => { document.body.classList.remove('printing-invoice'); window.removeEventListener('afterprint', done) }
  window.addEventListener('afterprint', done)
  window.print()
}
