// โครงสร้างสิทธิ์ (ตารางติ๊กในหน้า "จัดการสิทธิ์")
export const PERM_TREE = [
  { group: 'Dashboard', items: [['dashboard.view', 'ดู Dashboard']] },
  { group: 'สต็อกสินค้า', items: [['stock.view', 'เปิดหน้าสต็อกสินค้า'], ['stock.edit', 'เพิ่ม / แก้ไข / นำเข้าสินค้า'], ['stock.delete', 'ลบ / ล็อกสินค้า']] },
  { group: 'สินค้าเข้า / ออก / ตีกลับ', items: [['in.view', 'เปิดหน้าสินค้าเข้า'], ['out.view', 'เปิดหน้าสินค้าออก'], ['return.view', 'เปิดหน้าตีกลับ'],
    ['tx.create', 'ทำรายการ รับเข้า / เบิกออก / ตีกลับ'], ['tx.edit', 'แก้ไขรายการ'], ['tx.delete', 'ลบรายการ']] },
  { group: 'ใบแจ้งหนี้ / ใบเสร็จ', items: [['bill.view', 'เปิดหน้าใบแจ้งหนี้'], ['bill.edit', 'สร้าง / แก้ไขใบแจ้งหนี้'], ['bill.delete', 'ลบใบแจ้งหนี้'], ['bill.slip', 'อัปโหลดสลิปชำระเงิน']] },
  { group: 'ลูกค้า', items: [['cust.view', 'เปิดหน้าลูกค้า'], ['cust.edit', 'เพิ่ม / แก้ไขลูกค้า'], ['cust.delete', 'ลบลูกค้า']] }
]
export const DEFAULT_PERMS = {
  staff: { 'dashboard.view': true, 'stock.view': true, 'stock.edit': true, 'stock.delete': false, 'in.view': true, 'out.view': true, 'return.view': true,
    'tx.create': true, 'tx.edit': true, 'tx.delete': false, 'bill.view': true, 'bill.edit': true, 'bill.delete': false, 'bill.slip': true,
    'cust.view': true, 'cust.edit': true, 'cust.delete': false },
  viewer: { 'dashboard.view': true, 'stock.view': false, 'stock.edit': false, 'stock.delete': false, 'in.view': true, 'out.view': true, 'return.view': true,
    'tx.create': false, 'tx.edit': false, 'tx.delete': false, 'bill.view': true, 'bill.edit': false, 'bill.delete': false, 'bill.slip': true,
    'cust.view': false, 'cust.edit': false, 'cust.delete': false }
}
export function hasPerm(role, perms, key) {
  if (role === 'manager') return true
  const p = perms?.[role]
  if (p && key in p) return !!p[key]
  return !!DEFAULT_PERMS[role]?.[key]
}
