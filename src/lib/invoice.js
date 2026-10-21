export const money = (n) => Number(n || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

// หัก ณ ที่จ่ายคิดจากยอดก่อน VAT (หลังหักส่วนลด)
export function calc(items = [], discount = 0, vatRate = 0, whtRate = 0) {
  const subtotal = items.reduce((a, i) => a + (Number(i.qty) || 0) * (Number(i.price) || 0), 0)
  const after = Math.max(0, subtotal - (Number(discount) || 0))
  const vat = Math.round(after * (Number(vatRate) || 0)) / 100
  const wht = Math.round(after * (Number(whtRate) || 0)) / 100
  const total = after + vat
  return { subtotal, after, vat, wht, total, net: total - wht }
}

// จำนวนเงินตัวอักษรภาษาไทย
export function bahtText(amount) {
  const num = ['ศูนย์', 'หนึ่ง', 'สอง', 'สาม', 'สี่', 'ห้า', 'หก', 'เจ็ด', 'แปด', 'เก้า']
  const pos = ['', 'สิบ', 'ร้อย', 'พัน', 'หมื่น', 'แสน']
  const read6 = (s) => {
    let out = ''; const len = s.length
    for (let i = 0; i < len; i++) {
      const d = +s[i], p = len - i - 1
      if (!d) continue
      if (p === 1 && d === 1) out += 'สิบ'
      else if (p === 1 && d === 2) out += 'ยี่สิบ'
      else if (p === 0 && d === 1 && len > 1 && +s[len - 2] !== 0) out += 'เอ็ด'
      else out += num[d] + pos[p]
    }
    return out
  }
  const readInt = (s) => {
    s = s.replace(/^0+/, ''); if (!s) return 'ศูนย์'
    const parts = []; while (s.length > 6) { parts.unshift(s.slice(-6)); s = s.slice(0, -6) } parts.unshift(s)
    return parts.map(read6).join('ล้าน')
  }
  const [i, d] = (Math.round((Number(amount) || 0) * 100) / 100).toFixed(2).split('.')
  return readInt(i) + 'บาท' + (d === '00' ? 'ถ้วน' : readInt(d) + 'สตางค์')
}
