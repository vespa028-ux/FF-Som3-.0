import { X } from 'lucide-react'
export default function Modal({ title, onClose, children, footer }) {
  return (
    <div className="fixed inset-0 z-[60] bg-black/70 grid place-items-center p-3" onClick={onClose}>
      <div className="card w-full max-w-lg max-h-[92vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-bg-line">
          <h3 className="font-bold">{title}</h3><button onClick={onClose}><X size={18} /></button>
        </div>
        <div className="p-4 overflow-y-auto space-y-3">{children}</div>
        {footer && <div className="p-4 border-t border-bg-line flex justify-end gap-2">{footer}</div>}
      </div>
    </div>
  )
}
export const Field = ({ label, children }) => (
  <label className="block"><span className="text-xs text-slate-400">{label}</span><div className="mt-1">{children}</div></label>
)
