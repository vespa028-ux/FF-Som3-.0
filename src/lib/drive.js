import { api } from './supabase'

// ย่อรูปในเครื่องก่อนอัปโหลด (ประหยัดทั้งแบนด์วิดท์และพื้นที่ Drive)
function resize(file, max = 900, quality = 0.8) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height))
      const c = document.createElement('canvas')
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k)
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height)
      resolve(c.toDataURL('image/jpeg', quality).split(',')[1])
    }
    img.onerror = () => reject(new Error('อ่านไฟล์รูปไม่ได้'))
    img.src = URL.createObjectURL(file)
  })
}

export const folderIdOf = (s = '') => (s.match(/folders\/([a-zA-Z0-9_-]+)/) || [, /^[a-zA-Z0-9_-]{20,}$/.test(s) ? s : ''])[1]
export const driveUrl = (id, w = 800) => `https://drive.google.com/thumbnail?id=${id}&sz=w${w}`

export async function uploadImage(file, sub = 'misc') {
  const data = await resize(file)
  const r = await api('upload', { sub, mime: 'image/jpeg', name: `${sub}_${Date.now()}.jpg`, data })
  if (r.error) throw new Error(r.error.message)
  return driveUrl(r.data.id)
}

export async function uploadPdf(base64, name) {
  const r = await api('upload', { sub: 'invoices', mime: 'application/pdf', name, data: base64 })
  if (r.error) throw new Error(r.error.message)
  return `https://drive.google.com/file/d/${r.data.id}/view`
}

// แปลงรูปบน Drive เป็น data URL (เลี่ยงปัญหา CORS ตอนแสดงโลโก้ในใบแจ้งหนี้/PDF)
const cache = new Map()
export async function toDataUrl(url) {
  if (!url || url.startsWith('data:')) return url
  const id = (url.match(/[?&]id=([\w-]+)/) || url.match(/\/d\/([\w-]+)/) || [])[1]
  if (!id) return url
  if (cache.has(id)) return cache.get(id)
  const r = await api('image', { id })
  if (r.error) throw new Error(r.error.message)
  const data = `data:${r.data.mime};base64,${r.data.data}`
  cache.set(id, data)
  return data
}
