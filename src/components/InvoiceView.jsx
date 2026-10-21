import { calc, money, bahtText } from '../lib/invoice'
import { thDateLong } from '../lib/dates'

const C = '#0C7C82'
const th = { padding: '8px 10px', fontWeight: 600, fontSize: 12, color: '#fff', background: C }
const td = { padding: '9px 10px', borderBottom: '1px solid #e2e8f0', verticalAlign: 'top' }

// หน้า A4 (794 x 1123 px) ใช้ทั้งใบแจ้งหนี้ (kind="invoice") และใบเสร็จรับเงิน (kind="receipt")
export default function InvoiceView({ id, kind = 'invoice', inv, cust = {}, company = {}, logo }) {
  const receipt = kind === 'receipt'
  const t = calc(inv.items, inv.discount, inv.vat_rate, inv.wht_rate)
  const rows = inv.items || []
  const metaRows = receipt
    ? [['เลขที่ใบเสร็จ', inv.receipt_no || '-'], ['วันที่ชำระ', thDateLong((inv.paid_at || '').slice(0, 10))], ['อ้างอิงใบแจ้งหนี้', inv.invoice_no], ['ช่องทางชำระ', 'โอนเงิน (แนบสลิป)']]
    : [['เลขที่', inv.invoice_no], ['วันที่ออก', thDateLong(inv.issue_date)], ['ครบกำหนด', thDateLong(inv.due_date)],
       ['รอบบริการ', inv.period_from ? `${thDateLong(inv.period_from)} - ${thDateLong(inv.period_to)}` : '-']]
  const totals = [['รวมเป็นเงิน', money(t.subtotal)],
    inv.discount > 0 && ['ส่วนลด', `-${money(inv.discount)}`],
    inv.vat_rate > 0 && [`ภาษีมูลค่าเพิ่ม ${inv.vat_rate}%`, money(t.vat)],
    inv.wht_rate > 0 && [`หัก ณ ที่จ่าย ${inv.wht_rate}%`, `-${money(t.wht)}`]].filter(Boolean)
  const payable = t.net

  return (
    <div id={id} style={{ width: 794, minHeight: 1123, padding: '46px 52px 40px', background: '#fff', color: '#1e293b', fontFamily: 'Sarabun, sans-serif', fontSize: 13, lineHeight: 1.55, boxSizing: 'border-box', position: 'relative' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 9, background: `linear-gradient(90deg, ${C}, #35B4B0)` }} />

      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 24 }}>
        <div style={{ display: 'flex', gap: 14, maxWidth: 440 }}>
          {logo && <img src={logo} alt="" style={{ width: 62, height: 62, objectFit: 'contain', borderRadius: 10 }} />}
          <div>
            <div style={{ fontSize: 17, fontWeight: 700 }}>{company.name || 'ชื่อบริษัท (ตั้งค่าที่เมนูตั้งค่า)'}</div>
            <div style={{ whiteSpace: 'pre-line', color: '#475569', fontSize: 12 }}>{company.address}</div>
            <div style={{ color: '#475569', fontSize: 12 }}>
              {company.tax_id && <>เลขประจำตัวผู้เสียภาษี {company.tax_id} {company.branch && `(${company.branch})`}<br /></>}
              {[company.phone && `โทร ${company.phone}`, company.email].filter(Boolean).join(' • ')}
            </div>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: C }}>{receipt ? 'ใบเสร็จรับเงิน' : 'ใบแจ้งหนี้'}</div>
          <div style={{ fontSize: 12, color: '#64748b' }}>{receipt ? 'Receipt' : 'Invoice / ใบเรียกเก็บค่าบริการ'}</div>
          {!receipt && inv.status === 'paid' && <div style={{ marginTop: 6, display: 'inline-block', border: '2px solid #16a34a', color: '#16a34a', borderRadius: 6, padding: '1px 10px', fontWeight: 700 }}>ชำระแล้ว</div>}
          {!receipt && inv.status === 'cancelled' && <div style={{ marginTop: 6, display: 'inline-block', border: '2px solid #dc2626', color: '#dc2626', borderRadius: 6, padding: '1px 10px', fontWeight: 700 }}>ยกเลิก</div>}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 14, marginTop: 24 }}>
        <div style={{ flex: 1.4, background: '#f1f7f7', borderRadius: 10, padding: '12px 14px' }}>
          <div style={{ fontSize: 11, color: C, fontWeight: 700 }}>{receipt ? 'ได้รับเงินจาก' : 'เรียกเก็บจาก'}</div>
          <div style={{ fontWeight: 600 }}>{cust.company_name || cust.name || '-'}</div>
          <div style={{ whiteSpace: 'pre-line', fontSize: 12, color: '#475569' }}>{cust.address}</div>
          <div style={{ fontSize: 12, color: '#475569' }}>
            {cust.tax_id && <>เลขประจำตัวผู้เสียภาษี {cust.tax_id}<br /></>}
            {[cust.contact_name, cust.phone].filter(Boolean).join(' • ')}
          </div>
        </div>
        <div style={{ flex: 1, background: '#f1f7f7', borderRadius: 10, padding: '12px 14px', fontSize: 12 }}>
          {metaRows.map(([k, v]) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}><span style={{ color: '#64748b' }}>{k}</span><b style={{ textAlign: 'right' }}>{v}</b></div>))}
        </div>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 22 }}>
        <thead><tr>
          <th style={{ ...th, width: 34, textAlign: 'center', borderRadius: '8px 0 0 0' }}>#</th>
          <th style={{ ...th, textAlign: 'left' }}>รายการ</th>
          <th style={{ ...th, width: 70, textAlign: 'right' }}>จำนวน</th>
          <th style={{ ...th, width: 100, textAlign: 'right' }}>ราคา/หน่วย</th>
          <th style={{ ...th, width: 110, textAlign: 'right', borderRadius: '0 8px 0 0' }}>จำนวนเงิน</th>
        </tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              <td style={{ ...td, textAlign: 'center', color: '#64748b' }}>{i + 1}</td>
              <td style={td}>{r.desc}{r.detail && <div style={{ fontSize: 11, color: '#64748b' }}>{r.detail}</div>}</td>
              <td style={{ ...td, textAlign: 'right' }}>{Number(r.qty || 0).toLocaleString()}</td>
              <td style={{ ...td, textAlign: 'right' }}>{money(r.price)}</td>
              <td style={{ ...td, textAlign: 'right', fontWeight: 600 }}>{money((Number(r.qty) || 0) * (Number(r.price) || 0))}</td>
            </tr>))}
          {rows.length === 0 && <tr><td colSpan="5" style={{ ...td, textAlign: 'center', color: '#94a3b8', padding: 30 }}>ยังไม่มีรายการ</td></tr>}
        </tbody>
      </table>

      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 24, marginTop: 18 }}>
        <div style={{ flex: 1, fontSize: 12 }}>
          <div style={{ background: '#f1f7f7', borderRadius: 8, padding: '8px 12px', fontWeight: 600, color: C }}>({bahtText(payable)})</div>
          {inv.note && <div style={{ marginTop: 10, whiteSpace: 'pre-line', color: '#475569' }}><b>หมายเหตุ:</b> {inv.note}</div>}
        </div>
        <div style={{ width: 260, fontSize: 13 }}>
          {totals.map(([k, v]) => <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}><span style={{ color: '#475569' }}>{k}</span><span>{v}</span></div>)}
          {inv.wht_rate > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', borderTop: '1px dashed #cbd5e1', marginTop: 3 }}><span style={{ color: '#475569' }}>ยอดรวมก่อนหัก ณ ที่จ่าย</span><span>{money(t.total)}</span></div>}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, padding: '10px 12px', borderRadius: 8, background: C, color: '#fff', fontWeight: 700, fontSize: 15 }}>
            <span>{receipt ? 'จำนวนเงินที่ได้รับ' : inv.wht_rate > 0 ? 'ยอดชำระสุทธิ' : 'ยอดรวมสุทธิ'}</span><span>฿ {money(payable)}</span></div>
        </div>
      </div>

      <div style={{ position: 'absolute', left: 52, right: 52, bottom: 40 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 24 }}>
          <div style={{ fontSize: 12, color: '#475569' }}>
            {receipt ? <div>ขอบคุณที่ใช้บริการ ได้รับเงินตามจำนวนข้างต้นไว้ถูกต้องแล้ว</div> : <>
              {(company.bank_name || company.bank_account_no) && <>
                <div style={{ fontWeight: 700, color: C }}>ช่องทางชำระเงิน</div>
                <div>{company.bank_name} เลขที่ {company.bank_account_no}</div>
                <div>ชื่อบัญชี {company.bank_account_name}</div></>}
              {company.footer_note && <div style={{ marginTop: 6, whiteSpace: 'pre-line', fontSize: 11 }}>{company.footer_note}</div>}</>}
          </div>
          <div style={{ textAlign: 'center', width: 200, fontSize: 12 }}>
            <div style={{ borderBottom: '1px solid #94a3b8', height: 44 }} />
            <div style={{ marginTop: 4 }}>{company.signer ? `(${company.signer})` : receipt ? 'ผู้รับเงิน' : 'ผู้ออกเอกสาร'}</div>
            <div style={{ color: '#64748b' }}>{receipt ? 'ผู้รับเงิน' : 'ผู้ออกเอกสาร'}</div>
          </div>
        </div>
      </div>
    </div>
  )
}
