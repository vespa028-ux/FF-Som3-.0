import { Building2 } from 'lucide-react'
import { useCustomer } from '../lib/customer.jsx'

export default function TopBar() {
  const { cid, setCid, customers, canPick } = useCustomer()
  return (
    <div className="flex items-center justify-end gap-3 mb-4 no-print">
      <span className="flex items-center gap-1.5 text-xs text-emerald-400"><span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" /> Realtime</span>
      <div className="flex items-center gap-2">
        <Building2 size={16} className="text-slate-400" />
        {canPick ? (
          <select className="input !w-auto !py-1.5" value={cid} onChange={e => setCid(e.target.value)}>
            <option value="">ทุกลูกค้า</option>
            {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        ) : <span className="text-sm font-semibold">{customers.find(c => c.id === cid)?.name || 'ลูกค้า'}</span>}
      </div>
    </div>
  )
}
