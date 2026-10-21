import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from './supabase'
import { useAuth } from './auth.jsx'
import { useRealtime } from './realtime'

const Ctx = createContext({ cid: '', setCid: () => {}, customers: [], canPick: false })
export const useCustomer = () => useContext(Ctx)

export function CustomerProvider({ children }) {
  const { profile } = useAuth()
  const [customers, setCustomers] = useState([])
  const [pick, setPick] = useState(localStorage.getItem('cid') || '')
  const canPick = profile?.role === 'manager' || profile?.role === 'staff'

  const load = useCallback(async () => {
    const { data } = await supabase.from('customers').select('id,name').order('name')
    setCustomers(data || [])
  }, [])
  useEffect(() => { if (profile) load() }, [profile, load])
  useRealtime(['customers'], load)

  // ผู้เยี่ยมชมถูกล็อกที่ลูกค้าของตัวเองเสมอ
  const cid = canPick ? pick : (profile?.customer_id || '')
  const setCid = (v) => { setPick(v); v ? localStorage.setItem('cid', v) : localStorage.removeItem('cid') }
  return <Ctx.Provider value={{ cid, setCid, customers, canPick, reloadCustomers: load }}>{children}</Ctx.Provider>
}
