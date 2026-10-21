import Swal from 'sweetalert2'
const base = { background: '#0f1626', color: '#e2e8f0', confirmButtonColor: '#0C7C82' }
export const ok = (title) => Swal.fire({ ...base, icon: 'success', title, timer: 1400, showConfirmButton: false })
export const fail = (title, text) => Swal.fire({ ...base, icon: 'error', title, text })
export const confirm = (title, text, btn = 'ยืนยัน') =>
  Swal.fire({ ...base, icon: 'warning', title, text, showCancelButton: true,
    confirmButtonText: btn, cancelButtonText: 'ยกเลิก', confirmButtonColor: '#EF5350' }).then(r => r.isConfirmed)
export const busy = (title = 'กำลังดำเนินการ...') =>
  Swal.fire({ ...base, title, allowOutsideClick: false, didOpen: () => Swal.showLoading() })
export const done = () => Swal.close()
// ครอบงานที่ต้องรอ: แสดง loading spin → ปิด → แจ้งผล
export async function run(fn, successMsg) {
  busy()
  try { const r = await fn(); done(); if (successMsg) await ok(successMsg); return { data: r } }
  catch (e) { done(); await fail('เกิดข้อผิดพลาด', e.message); return { error: e } }
}
export const ask = (title, placeholder = '') =>
  Swal.fire({ ...base, title, input: 'text', inputPlaceholder: placeholder, showCancelButton: true,
    confirmButtonText: 'เพิ่ม', cancelButtonText: 'ยกเลิก' }).then(r => (r.isConfirmed ? (r.value || '').trim() : ''))
export const confirmRevert = (title) =>
  Swal.fire({ ...base, icon: 'warning', title, showDenyButton: true, showCancelButton: true,
    confirmButtonText: 'ลบและคืนยอดสต็อก', denyButtonText: 'ลบเฉพาะบันทึก', cancelButtonText: 'ยกเลิก',
    confirmButtonColor: '#EF5350', denyButtonColor: '#64748b' }).then(r => (r.isConfirmed ? 'revert' : r.isDenied ? 'keep' : null))
