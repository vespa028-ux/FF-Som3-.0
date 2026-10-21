import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from './supabase'

const Ctx = createContext(null)
export const useAuth = () => useContext(Ctx)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  const loadProfile = useCallback(async (uid) => {
    const { data } = await supabase.from('profiles')
      .select('id,email,username,nickname,department,avatar_url,role,customer_id').eq('id', uid).single()
    setProfile(data)
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      // ถ้าไม่ได้ติ๊ก "จดจำการเข้าสู่ระบบ" ให้ออกจากระบบเมื่อเปิดเบราว์เซอร์ใหม่
      if (data.session && localStorage.getItem('ff_keep') === '0' && !sessionStorage.getItem('ff_alive')) {
        await supabase.auth.signOut(); setSession(null); setLoading(false); return
      }
      setSession(data.session)
      if (data.session) await loadProfile(data.session.user.id)
      setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s)
      if (s) loadProfile(s.user.id); else setProfile(null)
    })
    return () => sub.subscription.unsubscribe()
  }, [loadProfile])

  const role = profile?.role
  // สิทธิ์ฝั่ง UI (ฝั่ง DB บังคับซ้ำด้วย RLS)
  const can = {
    transact: role === 'manager' || role === 'staff',   // เพิ่มสินค้า / รับเข้า / เบิกออก / ตีกลับ
    manage: role === 'manager'                           // ลบ ล็อก ผู้ใช้ ตั้งค่า
  }

  return (
    <Ctx.Provider value={{ session, profile, role, can, loading, reloadProfile: () => loadProfile(session.user.id) }}>
      {children}
    </Ctx.Provider>
  )
}
