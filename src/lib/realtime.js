import { useEffect, useRef } from 'react'
import { supabase } from './supabase'

// ฟังการเปลี่ยนแปลง (เพิ่ม/แก้/ลบ) จากทุกเครื่อง แล้วเรียก onChange (หน่วง 0.5 วิ รวมหลายเหตุการณ์เป็นครั้งเดียว ลด egress)
export function useRealtime(tables, onChange) {
  const cb = useRef(onChange); cb.current = onChange
  const key = tables.join(',')
  useEffect(() => {
    let t
    const ch = supabase.channel('rt-' + key + '-' + Math.random().toString(36).slice(2, 7))
    key.split(',').forEach(table =>
      ch.on('postgres_changes', { event: '*', schema: 'public', table }, () => {
        clearTimeout(t); t = setTimeout(() => cb.current(), 500)
      }))
    ch.subscribe()
    return () => { clearTimeout(t); supabase.removeChannel(ch) }
  }, [key])
}
