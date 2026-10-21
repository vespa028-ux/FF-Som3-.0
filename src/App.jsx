import { useState } from 'react'
import { useAuth } from './lib/auth.jsx'
import { configured } from './lib/supabase'
import Login from './components/Login.jsx'
import Layout from './components/Layout.jsx'
import Stock from './pages/Stock.jsx'
import TxPage from './pages/TxPage.jsx'
import Soon from './pages/Soon.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Users from './pages/Users.jsx'
import Settings from './pages/Settings.jsx'
import Customers from './pages/Customers.jsx'
import Billing from './pages/Billing.jsx'
import Portal from './pages/Portal.jsx'
import SetupApi from './components/SetupApi.jsx'

export default function App() {
  const { session, profile, loading } = useAuth()
  const [page, setPage] = useState('dashboard')

  if (!configured) return <SetupApi />
  const portal = location.hash.match(/^#\/c\/([0-9a-fA-F-]{36})/)
  if (portal) return <Portal token={portal[1]} />
  if (loading) return <div className="min-h-screen grid place-items-center"><div className="skeleton w-40 h-6" /></div>
  if (!session) return <Login />
  if (!profile) return <div className="p-8">กำลังโหลดโปรไฟล์...</div>

  const pages = {
    dashboard: <Dashboard />,
    stock: <Stock />,
    in: <TxPage type="in" title="รายงานสินค้าเข้า (Stock In)" />,
    out: <TxPage type="out" title="รายงานสินค้าออก (Stock Out)" />,
    return: <TxPage type="return" title="รายงานสินค้าตีกลับ (Returns)" />,
    billing: <Billing />,
    customers: <Customers />,
    users: <Users />,
    settings: <Settings />
  }
  return <Layout page={page} setPage={setPage}>{pages[page]}</Layout>
}
