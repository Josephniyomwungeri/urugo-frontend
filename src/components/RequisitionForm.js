import React, { useRef } from 'react';
import jsPDF from 'jspdf';
import './RequisitionForm.css';

/**
 * Requisition Form Modal
 * Props:
 *   request   – the request object with names + timestamps
 *   onClose   – callback to close
 */
export default function RequisitionForm({ request, onClose }) {
  const printRef = useRef(null);

  if (!request) return null;

  // ===== Auto-generate Ref No =====
  const department = request.staff_department || request.department || 'General';
  const deptPrefix = department.replace(/\s+/g, '').slice(0, 4).toUpperCase();
  const refNo = `REQ-${deptPrefix}-${String(request.id).padStart(5, '0')}`;

  // ===== Date helpers =====
  const fmtDate = (d) => {
    if (!d) return '—';
    try {
      const dt = new Date(d);
      if (isNaN(dt.getTime())) return '—';
      return dt.toLocaleDateString('en-GB', {
        day: '2-digit', month: '2-digit', year: 'numeric',
      });
    } catch { return '—'; }
  };
  const fmtDateTime = (d) => {
    if (!d) return '—';
    try {
      const dt = new Date(d);
      if (isNaN(dt.getTime())) return '—';
      return dt.toLocaleString('en-GB', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      });
    } catch { return '—'; }
  };

  const createdStr = fmtDate(request.created_at);
  const approvedStr = fmtDate(request.reviewed_at);
  const completedStr = fmtDate(request.completed_at);
  const receivedStr = fmtDate(request.received_at);
  const createdFullStr = fmtDateTime(request.created_at);

  // ===== Quantities =====
  const requestedQty = request.quantity;
  const receivedQty =
    request.received_quantity != null ? request.received_quantity : request.quantity;
  const unit = request.requested_unit || request.product_unit || request.unit || '';

  // ===== Requisition Reason =====
  const requisitionReason = request.reason || '—';

  // ===== Names =====
  const requesterName = request.staff_name || '—';
  const approverName = request.approved_by_name || request.reviewer_name || '—';
  const deliveredName = request.completed_by_name || request.stock_manager_name || '—';
  const receiverName = request.received_by_name || request.staff_name || '—';

  // =====================================================
  // Print via browser
  // =====================================================
  const handlePrint = () => {
    const printable = printRef.current;
    if (!printable) return;

    const win = window.open('', '_blank', 'width=900,height=1200');
    if (!win) { window.print(); return; }

    const styles = `
      <style>
        * { box-sizing: border-box; }
        body { font-family: 'Segoe UI', Tahoma, sans-serif; margin: 30px; color: #0a1f44; }
        .rf-wrapper { max-width: 800px; margin: 0 auto; border: 2px solid #0a1f44; padding: 20px 24px; }
        .rf-header { display: flex; align-items: center; gap: 16px; justify-content: center; text-align: center; margin-bottom: 14px; }
        .rf-logo { height: 60px; width: 60px; object-fit: contain; }
        .rf-header-text h1 { margin: 0; font-size: 18px; letter-spacing: 0.5px; }
        .rf-header-text h2 { margin: 2px 0 0; font-size: 14px; color: #333; }
        .rf-meta { display: flex; justify-content: space-between; font-size: 13px; margin: 18px 0 12px; }
        .rf-meta span { min-width: 200px; }
        table { width: 100%; border-collapse: collapse; margin-top: 6px; }
        th, td { border: 1px solid #333; padding: 8px 10px; text-align: left; font-size: 13px; }
        th { background: #0a1f44; color: #fff; font-weight: 700; }
        .rf-total-row td { font-weight: 700; background: #f2f5fb; }
        .rf-signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 34px; margin-top: 40px; font-size: 13px; }
        .rf-sig-block { display: flex; flex-direction: column; gap: 34px; }
        .rf-sig-line { display: flex; flex-direction: column; gap: 4px; }
        .rf-sig-line .lbl { font-weight: 700; color: #0a1f44; font-size: 12.5px; }
        .rf-sig-line .name { color: #0d6efd; font-weight: 700; font-size: 13px; min-height: 18px; }
        .rf-sig-line .sigdate { color: #333; font-size: 11.5px; }
        .rf-sig-line .dotted { border-top: 1px dotted #333; padding-top: 4px; font-size: 11px; color: #666; }
        .rf-footer { text-align: center; font-size: 11px; margin-top: 30px; color: #666; border-top: 1px solid #ccc; padding-top: 8px; }
      </style>
    `;
    win.document.open();
    win.document.write(
      `<!DOCTYPE html><html><head><title>Requisition ${refNo}</title>${styles}</head><body>`
      + printable.outerHTML +
      `</body></html>`
    );
    win.document.close();
    win.focus();
    setTimeout(() => {
      win.print();
      win.onafterprint = () => win.close();
    }, 300);
  };

  // =====================================================
  // Export as PDF
  // =====================================================
  const handleExportPDF = () => {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();
    let y = 40;

    try { doc.addImage('/urugo-logo.png', 'PNG', pageW / 2 - 30, y, 60, 60); } catch { /* ignore */ }
    y += 72;

    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('URUGO WOMEN OPPORTUNITY CENTER, LLC', pageW / 2, y, { align: 'center' });
    y += 18;
    doc.setFontSize(13);
    doc.text('GOOD REQUISITION FORM', pageW / 2, y, { align: 'center' });
    y += 30;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`LOCATION: Kayonza-Urugo Woc`, 40, y);
    doc.text(`REF NO: ${refNo}`, pageW - 40, y, { align: 'right' });
    y += 16;
    doc.text(`STAFF: ${requesterName}`, 40, y);
    doc.text(`DATE: ${createdStr}`, pageW - 40, y, { align: 'right' });
    y += 22;

    // ✅ New column layout — added Requisition Reason after Qty Received
    const colX = [40, 75, 260, 340, 430, 500];

    doc.setFillColor(10, 31, 68);
    doc.setTextColor(255, 255, 255);
    doc.rect(40, y, pageW - 80, 22, 'F');
    doc.text('NO', colX[0] + 10, y + 15);
    doc.text('Item Name', colX[1] + 6, y + 15);
    doc.text('Quantity', colX[2] + 6, y + 15);
    doc.text('Qty Received', colX[3] + 6, y + 15);
    doc.text('Requisition Reason', colX[4] + 6, y + 15);
    y += 22;

    doc.setTextColor(0, 0, 0);
    doc.rect(40, y, pageW - 80, 22);
    doc.text('1', colX[0] + 12, y + 15);
    doc.text(String(request.product_name || '').slice(0, 28), colX[1] + 6, y + 15);
    doc.text(`${requestedQty} ${unit}`, colX[2] + 6, y + 15);
    doc.text(`${receivedQty} ${unit}`, colX[3] + 6, y + 15);
    doc.text(String(requisitionReason).slice(0, 30), colX[4] + 6, y + 15);
    y += 22;

    // Draw vertical column lines
    [colX[1], colX[2], colX[3], colX[4], colX[5]].forEach((x) => doc.line(x, y - 44, x, y));
    doc.rect(40, y - 44, pageW - 80, 44);

    y += 40;

    // === Signatures with names + dates ===
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Order Requested by:', 40, y);
    doc.text('Order Delivered by:', pageW / 2 + 10, y);
    y += 14;
    doc.setTextColor(13, 110, 253);
    doc.setFont('helvetica', 'normal');
    doc.text(requesterName, 40, y);
    doc.text(deliveredName, pageW / 2 + 10, y);
    y += 12;
    doc.setFontSize(9);
    doc.setTextColor(90, 90, 90);
    doc.text(`Date: ${createdStr}`, 40, y);
    doc.text(`Date: ${completedStr}`, pageW / 2 + 10, y);
    doc.setTextColor(0, 0, 0);
    y += 12;
    doc.setFontSize(9);
    doc.text('Signature: ..................................................', 40, y);
    doc.text('Signature: ................................................', pageW / 2 + 10, y);
    y += 34;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Order Approved by:', 40, y);
    doc.text('Order Received by:', pageW / 2 + 10, y);
    y += 14;
    doc.setTextColor(13, 110, 253);
    doc.setFont('helvetica', 'normal');
    doc.text(approverName, 40, y);
    doc.text(receiverName, pageW / 2 + 10, y);
    y += 12;
    doc.setFontSize(9);
    doc.setTextColor(90, 90, 90);
    doc.text(`Date: ${approvedStr}`, 40, y);
    doc.text(`Date: ${receivedStr}`, pageW / 2 + 10, y);
    doc.setTextColor(0, 0, 0);
    y += 12;
    doc.setFontSize(9);
    doc.text('Signature: ..................................................', 40, y);
    doc.text('Signature: ................................................', pageW / 2 + 10, y);

    y += 34;
    doc.setFontSize(8);
    doc.setTextColor(120);
    doc.text(
      `Generated by Urugo Woc Logistic System • ${new Date().toLocaleString()}`,
      pageW / 2, y, { align: 'center' }
    );

    doc.save(`Requisition_${refNo}.pdf`);
  };

  return (
    <div className="rf-overlay" onClick={onClose}>
      <div className="rf-modal" onClick={(e) => e.stopPropagation()}>
        <div className="rf-modal-head">
          <h4><i className="bi bi-file-earmark-text"></i> Requisition Form — {refNo}</h4>
          <button onClick={onClose}><i className="bi bi-x-lg"></i></button>
        </div>

        <div className="rf-modal-body">
          <div className="rf-wrapper" ref={printRef}>
            <div className="rf-header">
              <img src="/urugo-logo.png" alt="Urugo Logo" className="rf-logo" />
              <div className="rf-header-text">
                <h1>URUGO WOMEN OPPORTUNITY CENTER, LLC</h1>
                <h2>GOOD REQUISITION FORM</h2>
              </div>
            </div>

            <div className="rf-meta">
              <span><strong>LOCATION:</strong> Kayonza-Urugo Woc</span>
              <span><strong>REF NO:</strong> {refNo}</span>
            </div>
            <div className="rf-meta" style={{ marginTop: -8 }}>
              <span><strong>STAFF:</strong> {requesterName}</span>
              <span><strong>DATE:</strong> {createdStr}</span>
            </div>

            <table>
              <thead>
                <tr>
                  <th style={{ width: '40px' }}>NO</th>
                  <th style={{ width: '90px' }}>Item Name</th>
                  <th style={{ width: '40px' }}>Quantity</th>
                  <th style={{ width: '45px' }}>Qty Received</th>
                  <th style={{ width: '140px' }}>Requisition Reason</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>1</td>
                  <td>{request.product_name}</td>
                  <td>{requestedQty} {unit}</td>
                  <td>{receivedQty} {unit}</td>
                  <td>{requisitionReason}</td>
                </tr>
                {[2, 3, 4, 5].map((n) => (
                  <tr key={n}>
                    <td>{n}</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td>
                  </tr>
                ))}
                <tr className="rf-total-row">
                  <td colSpan="2" style={{ textAlign: 'right' }}>TOTAL</td>
                  <td>{requestedQty} {unit}</td>
                  <td>{receivedQty} {unit}</td>
                  <td>&nbsp;</td>
                </tr>
              </tbody>
            </table>

            {/* ===== Signatures with names + dates ===== */}
            <div className="rf-signatures">
              <div className="rf-sig-block">
                <div className="rf-sig-line">
                  <span className="lbl">Order Requested by:</span>
                  <span className="name">{requesterName}</span>
                  <span className="sigdate">Date: {createdStr}</span>
                  <span className="dotted">Signature</span>
                </div>
                <div className="rf-sig-line">
                  <span className="lbl">Order Approved by:</span>
                  <span className="name">{approverName}</span>
                  <span className="sigdate">Date: {approvedStr}</span>
                  <span className="dotted">Signature</span>
                </div>
              </div>
              <div className="rf-sig-block">
                <div className="rf-sig-line">
                  <span className="lbl">Order Delivered by:</span>
                  <span className="name">{deliveredName}</span>
                  <span className="sigdate">Date: {completedStr}</span>
                  <span className="dotted">Signature</span>
                </div>
                <div className="rf-sig-line">
                  <span className="lbl">Order Received by:</span>
                  <span className="name">{receiverName}</span>
                  <span className="sigdate">Date: {receivedStr}</span>
                  <span className="dotted">Signature</span>
                </div>
              </div>
            </div>

            <div className="rf-footer">
              Generated by Urugo Woc Logistic System • Request #{request.id} • {createdFullStr}
            </div>
          </div>
        </div>

        <div className="rf-modal-actions">
          <button className="rf-btn-secondary" onClick={onClose}>
            <i className="bi bi-x-lg"></i> Close
          </button>
          <button className="rf-btn-secondary" onClick={handlePrint}>
            <i className="bi bi-printer"></i> Print
          </button>
          <button className="rf-btn-primary" onClick={handleExportPDF}>
            <i className="bi bi-file-earmark-pdf"></i> Export PDF
          </button>
        </div>
      </div>
    </div>
  );
}