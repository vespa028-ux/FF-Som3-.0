import { useState } from 'react'
import { LayoutDashboard, Package, ArrowDownToLine, ArrowUpFromLine, Undo2, ShieldCheck, Settings, Building2, Receipt, Menu, X, LogOut, UserCircle } from 'lucide-react'
import { useAuth } from '../lib/auth.jsx'
import { supabase } from '../lib/supabase'
import { confirm } from '../lib/ui'
import ProfileModal from './ProfileModal.jsx'
import FooterTracker from './FooterTracker.jsx'
import TopBar from './TopBar.jsx'
import { useShop } from '../lib/shop.jsx'
import { usePerm } from '../lib/usePerm'

const MENU = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, color: 'bg-sky-500', perm: 'dashboard.view' },
  { id: 'stock', label: 'สต็อกสินค้า', icon: Package, color: 'bg-emerald-500', perm: 'stock.view' },
  { id: 'in', label: 'สินค้าเข้า', icon: ArrowDownToLine, color: 'bg-teal-500', perm: 'in.view' },
  { id: 'out', label: 'สินค้าออก', icon: ArrowUpFromLine, color: 'bg-rose-500', perm: 'out.view' },
  { id: 'return', label: 'ตีกลับ', icon: Undo2, color: 'bg-amber-500', perm: 'return.view' },
  { id: 'billing', label: 'ใบแจ้งหนี้', icon: Receipt, color: 'bg-indigo-500', perm: 'bill.view' },
  { id: 'customers', label: 'ลูกค้า', icon: Building2, color: 'bg-pink-500', perm: 'cust.view' },
  { id: 'users', label: 'จัดการสิทธิ์', icon: ShieldCheck, color: 'bg-violet-500', manager: true },
  { id: 'settings', label: 'ตั้งค่า', icon: Settings, color: 'bg-slate-500', manager: true }
]
const ROLE_LABEL = { manager: 'ผู้จัดการ', staff: 'พนักงาน', viewer: 'ลูกค้า' }

export default function Layout({ page, setPage, children }) {
  const { profile, can } = useAuth()
  const { shop } = useShop()
  const perm = usePerm()
  const [open, setOpen] = useState(false)
  const [showProfile, setShowProfile] = useState(false)
  const items = MENU.filter(m => m.manager ? can.manage : perm(m.perm))

  async function logout() {
    if (await confirm('ออกจากระบบ?', 'คุณต้องการออกจากระบบใช่หรือไม่', 'ออกจากระบบ')) supabase.auth.signOut()
  }
  const go = (id) => { setPage(id); setOpen(false) }

  const nav = (
    <nav className="space-y-1">
      {items.map(m => (
        <button key={m.id} onClick={() => go(m.id)}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition ${page === m.id ? 'bg-brand text-white' : 'hover:bg-white/5 text-slate-300'}`}>
          <m.icon size={18} /> {m.label}
        </button>
      ))}
    </nav>
  )

  return (
    <div className="min-h-screen lg:flex">
      {/* Sidebar desktop */}
      <aside className="hidden lg:flex flex-col w-60 shrink-0 border-r border-bg-line p-4 sticky top-0 h-screen">
        <Brand />{nav}
        <User profile={profile} onProfile={() => setShowProfile(true)} onLogout={logout} />
      </aside>

      {/* Drawer mobile */}
      {open && <div className="fixed inset-0 z-40 bg-black/60 lg:hidden" onClick={() => setOpen(false)} />}
      <aside className={`fixed z-50 inset-y-0 left-0 w-64 bg-bg-card p-4 flex flex-col transition-transform lg:hidden ${open ? 'translate-x-0' : '-translate-x-full'}`}>
        <button className="absolute right-3 top-3" onClick={() => setOpen(false)}><X size={20} /></button>
        <Brand />{nav}
        <User profile={profile} onProfile={() => { setOpen(false); setShowProfile(true) }} onLogout={logout} />
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="lg:hidden flex items-center gap-3 p-3 border-b border-bg-line sticky top-0 bg-bg z-30">
          <button onClick={() => setOpen(true)}><Menu size={22} /></button>
          <span className="font-bold">{shop.shop_name}</span>
        </header>
        <main className="flex-1 p-4 lg:p-6 pb-28 lg:pb-6 overflow-x-hidden"><TopBar />{children}</main>
        <FooterTracker roleLabel={ROLE_LABEL[profile.role]} />
      </div>

      {/* Bottom nav + ทางลัดไอคอนสี (มือถือเท่านั้น) */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-bg-card/95 backdrop-blur border-t border-bg-line flex justify-around px-1 pt-2"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 8px)' }}>
        {items.slice(0, 5).map(m => (
          <button key={m.id} onClick={() => go(m.id)} className="flex flex-col items-center gap-1 w-16">
            <span className={`${m.color} rounded-2xl p-2 text-white ${page === m.id ? 'ring-2 ring-white/70' : 'opacity-80'}`}><m.icon size={18} /></span>
            <span className={`text-[10px] ${page === m.id ? 'text-white' : 'text-slate-400'}`}>{m.label}</span>
          </button>
        ))}
      </nav>
      {showProfile && <ProfileModal onClose={() => setShowProfile(false)} />}
    </div>
  )
}

function Brand() {
  const { shop } = useShop()
  return (
    <div className="flex items-center gap-2 font-bold text-lg mb-6 mt-1 min-w-0">
      {shop.logo_url ? <img src={shop.logo_url} className="w-8 h-8 rounded-lg object-cover" /> : <Package className="text-brand-light" />}
      <span className="truncate">{shop.shop_name}</span>
    </div>
  )
}

function User({ profile, onProfile, onLogout }) {
  return (
    <div className="mt-auto pt-4 border-t border-bg-line">
      <button onClick={onProfile} className="flex items-center gap-3 w-full text-left hover:bg-white/5 rounded-xl p-2">
        {profile.avatar_url ? <img src={profile.avatar_url} className="w-9 h-9 rounded-full object-cover" /> : <UserCircle size={36} className="text-slate-400" />}
        <div className="min-w-0"><div className="text-sm font-semibold truncate">{profile.nickname || profile.email}</div>
          <div className="text-xs text-slate-400">{ROLE_LABEL[profile.role]}</div></div>
      </button>
      <button onClick={onLogout} className="btn-ghost w-full mt-2 text-rose-400"><LogOut size={16} /> ออกจากระบบ</button>
    </div>
  )
}
