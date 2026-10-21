import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from './supabase'
import { useAuth } from './auth.jsx'

const Ctx = createContext({ shop: { shop_name: 'Fulfillment', logo_url: null, integrations: {} }, reload: () => {} })
export const useShop = () => useContext(Ctx)

// ค่าตั้งค่า Drive ให้ lib/drive.js อ่านได้โดยไม่ต้องใช้ hook
export let driveCfg = {}

export function ShopProvider({ children }) {
  const { session } = useAuth()
  const [shop, setShop] = useState({ shop_name: 'Fulfillment', logo_url: null, integrations: {}, company: {}, permissions: {} })
  const reload = useCallback(async () => {
    const { data } = await supabase.from('settings').select('shop_name,logo_url,integrations,company,permissions').eq('id', 1).single()
    if (data) { setShop(data); driveCfg = data.integrations?.drive || {} }
  }, [])
  useEffect(() => { if (session) reload() }, [session, reload])
  return <Ctx.Provider value={{ shop, reload }}>{children}</Ctx.Provider>
}
