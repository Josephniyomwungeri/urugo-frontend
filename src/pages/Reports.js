import React, { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { API_URL, useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import './Reports.css';

/* ---------- helpers ---------- */
const formatCellValue = (key, value) => {
  if (value === null || value === undefined || value === '') return '—';
  if (key.includes('date') || key.includes('_at')) {
    try { const d = new Date(value); if (isNaN(d.getTime())) return String(value); return d.toLocaleString(); }
    catch { return String(value); }
  }
  if (['total_value','unit_price','closing_value'].includes(key)) {
    const n = Number(value); if (!isNaN(n)) return n.toFixed(2);
  }
  return String(value);
};
const humanizeKey = (key) => {
  const map = {
    received_by_name:'Received By', issued_to:'Issued To', approved_by_name:'Approved By',
    created_at:'Created At', updated_at:'Updated At', unit_price:'Unit Price',
    total_value:'Total Value', product_name:'Product', staff_name:'Staff',
    reviewer_name:'Reviewer', opening_stock:'Opening', received_stock:'Received',
    stock_in:'Stock In', stock_in_only:'Regular In', stock_out:'Stock Out',
    closing_stock:'Closing', closing_value:'Closing Value',
    requested:'Requested', issued:'Issued', used:'Used', damaged:'Damaged',
    remaining:'Remaining', losses:'Losses',
  };
  if (map[key]) return map[key];
  return key.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
};
const COLUMN_ORDER = {
  out: ['id','created_at','product_name','quantity','unit','issued_to','department','received_by_name','approved_by_name','notes'],
  in:  ['id','created_at','product_name','quantity','unit','donor_supplier','batch_number','expiry_date','received_by_name','notes'],
};
const sortColumns = (columns, tabKey) => {
  const order = COLUMN_ORDER[tabKey];
  if (!order) return columns;
  const known = order.filter((c) => columns.includes(c));
  const extras = columns.filter((c) => !order.includes(c));
  return [...known, ...extras];
};
const PERIODS = [
  { key:'daily', label:'Daily', icon:'bi-calendar-day' },
  { key:'monthly', label:'Monthly', icon:'bi-calendar-month' },
  { key:'annual', label:'Annual', icon:'bi-calendar-range' },
];
const FLOW_PERIODS = [
  { key:'daily', label:'Daily', icon:'bi-calendar-day' },
  { key:'weekly', label:'Weekly', icon:'bi-calendar-week' },
  { key:'monthly', label:'Monthly', icon:'bi-calendar-month' },
  { key:'annual', label:'Annual', icon:'bi-calendar-range' },
];

/* IndexedDB — remember folder handle */
const IDB_NAME = 'urugo_woc'; const IDB_STORE = 'handles'; const IDB_KEY = 'logistic_reports_folder';
function openDB() { return new Promise((resolve, reject) => {
  const req = indexedDB.open(IDB_NAME, 1);
  req.onupgradeneeded = () => { const db = req.result;
    if (!db.objectStoreNames.contains(IDB_STORE)) db.createObjectStore(IDB_STORE); };
  req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error);
});}
async function idbGet(key) { try { const db = await openDB();
  return new Promise((resolve, reject) => { const tx = db.transaction(IDB_STORE, 'readonly');
    const req = tx.objectStore(IDB_STORE).get(key);
    req.onsuccess = () => resolve(req.result || null); req.onerror = () => reject(req.error);
  });} catch { return null; }}
async function idbSet(key, value) { try { const db = await openDB();
  return new Promise((resolve, reject) => { const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).put(value, key);
    tx.oncomplete = () => resolve(true); tx.onerror = () => reject(tx.error);
  });} catch { return false; }}
async function getOrCreateFolder() {
  if (!window.showDirectoryPicker) return { folder: null, kind: 'download' };
  try { const saved = await idbGet(IDB_KEY);
    if (saved) { const perm = await saved.queryPermission({ mode: 'readwrite' });
      if (perm === 'granted') return { folder: saved, kind: 'fs' };
      try { const ask = await saved.requestPermission({ mode: 'readwrite' });
        if (ask === 'granted') return { folder: saved, kind: 'fs' }; } catch {}
    }} catch {}
  try { const docs = await window.showDirectoryPicker({ mode: 'readwrite' });
    const folder = await docs.getDirectoryHandle('Logistic Reports', { create: true });
    await idbSet(IDB_KEY, folder); return { folder, kind: 'fs' };
  } catch (err) { return { folder: null, kind: 'download' }; }
}
async function saveBlobToFolder(blob, filename, folder) {
  if (!folder) return false;
  const fileHandle = await folder.getFileHandle(filename, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(blob); await writable.close(); return true;
}
function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob); const a = document.createElement('a');
  a.href = url; a.download = filename; document.body.appendChild(a); a.click();
  document.body.removeChild(a); setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export default function Reports() {
  const { user } = useAuth();
  const { showToast } = useNotifications();

  const [report, setReport] = useState(null);
  const [tab, setTab] = useState('inventory');
  const [period, setPeriod] = useState('monthly');
  const [exporting, setExporting] = useState(false);
  const [loading, setLoading] = useState(true);

  const [showAutoModal, setShowAutoModal] = useState(false);
  const [autoPeriod, setAutoPeriod] = useState('daily');
  const [autoTime, setAutoTime] = useState('08:00');
  const [autoStep, setAutoStep] = useState(1);
  const [savingSchedule, setSavingSchedule] = useState(false);

  const [editSchedule, setEditSchedule] = useState(null);
  const [editPeriod, setEditPeriod] = useState('daily');
  const [editTime, setEditTime] = useState('08:00');
  const [savingEdit, setSavingEdit] = useState(false);

  const [confirmDelete, setConfirmDelete] = useState(null);
  const [deletingSchedule, setDeletingSchedule] = useState(false);
  const [schedules, setSchedules] = useState([]);
  const folderRef = useRef(null);

  /* Department Flow */
  const [dfPeriod, setDfPeriod] = useState('monthly');
  const [dfDept, setDfDept] = useState('');
  const [dfDepts, setDfDepts] = useState([]);
  const [dfData, setDfData] = useState(null);
  const [dfLoading, setDfLoading] = useState(false);

  /* Per-Product */
  const [prPeriod, setPrPeriod] = useState('monthly');
  const [prProductId, setPrProductId] = useState('');
  const [prData, setPrData] = useState(null);
  const [prLoading, setPrLoading] = useState(false);

  /* Opening/Closing */
  const [ocPeriod, setOcPeriod] = useState('daily');
  const [ocDate, setOcDate] = useState(() => {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}-${String(n.getDate()).padStart(2,'0')}`;
  });
  const [ocMonth, setOcMonth] = useState(() => {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}`;
  });
  const [ocData, setOcData] = useState(null);
  const [ocLoading, setOcLoading] = useState(false);

  /* ---------------- loaders ---------------- */
  const load = async () => {
    try { setLoading(true);
      const res = await axios.get(`${API_URL}/reports/advanced`, { params: { period } });
      setReport(res.data);
    } catch { showToast('Failed to load report', 'error'); }
    finally { setLoading(false); }
  };
  const loadSchedules = async () => { try { const res = await axios.get(`${API_URL}/reports/schedule`); setSchedules(res.data); } catch {} };
  const loadDepts = async () => { try { const res = await axios.get(`${API_URL}/departments`); setDfDepts(res.data); if (res.data.length > 0 && !dfDept) setDfDept(res.data[0]); } catch {} };

  useEffect(() => { load(); loadSchedules(); loadDepts(); }, [period]);
  useEffect(() => {
    const handler = () => { load(); loadSchedules(); };
    window.addEventListener('uw:refresh', handler);
    return () => window.removeEventListener('uw:refresh', handler);
  }, [period]);

  if (loading && !report) return <div className="uw-loading">Loading reports...</div>;
  if (!report) return <div className="uw-loading">No report data</div>;

  const tabs = [
    { key:'inventory', label:'Inventory', icon:'bi-box-seam',             data: report.inventory || [] },
    { key:'in',        label:'Stock In',  icon:'bi-box-arrow-in-down',    data: report.stockIn   || [] },
    { key:'out',       label:'Stock Out', icon:'bi-box-arrow-up',         data: report.stockOut  || [] },
    { key:'losses',    label:'Losses',    icon:'bi-exclamation-triangle', data: report.losses    || [] },
    { key:'usage',     label:'Usage',     icon:'bi-clipboard-data',       data: report.usage     || [] },
  ];

  const activeTab  = tabs.find((t) => t.key === tab);
  const activeData = activeTab.data;
  const rawColumns = activeData.length > 0 ? Array.from(new Set(activeData.flatMap((r) => Object.keys(r)))) : [];
  const columns = sortColumns(rawColumns, activeTab.key);

  const buildFilename = (prefix, ext) => {
    const now = new Date(); const pad = (n) => String(n).padStart(2, '0');
    const stamp = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}`;
    const userPart = (user?.full_name || 'User').replace(/\s+/g, '_');
    return `${prefix}_${userPart}_${stamp}.${ext}`;
  };

  const persistFile = async (blob, filename) => {
    let folder = folderRef.current;
    if (!folder) { const target = await getOrCreateFolder();
      if (target && target.kind === 'fs') { folder = target.folder; folderRef.current = folder; } }
    let saved = false;
    if (folder) {
      try { saved = await saveBlobToFolder(blob, filename, folder); }
      catch { folderRef.current = null;
        const target = await getOrCreateFolder();
        if (target && target.kind === 'fs') {
          folderRef.current = target.folder;
          try { saved = await saveBlobToFolder(blob, filename, target.folder); } catch { saved = false; }
        } }
    }
    if (!saved) downloadBlob(blob, filename);
    return saved;
  };

  const logGenerated = async ({ fileName, format, savedToPc, payload }) => {
    try {
      await axios.post(`${API_URL}/reports/generated`, {
        report_type: period,
        title: `Logistic Report — ${period.charAt(0).toUpperCase() + period.slice(1)}`,
        file_name: fileName, file_format: format,
        saved_to_pc: savedToPc ? 1 : 0, payload: payload || null,
      });
    } catch {}
  };

  /* TAB: Excel/PDF/Print */
  const exportExcel = async () => {
    if (!activeData || activeData.length === 0) { showToast('No data to export', 'warning'); return; }
    try {
      const headers = columns.map((h) => humanizeKey(h));
      const rows = activeData.map((row) => columns.map((h) => formatCellValue(h, row[h])));
      const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
      ws['!cols'] = headers.map((h, i) => ({ wch: Math.min(Math.max(h.length, ...rows.map((r) => String(r[i] ?? '').length)) + 2, 40) }));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, activeTab.label.slice(0, 30));
      const fileName = buildFilename(`Logistic_${period}_${activeTab.key}`, 'xlsx');
      const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const saved = await persistFile(blob, fileName);
      await logGenerated({ fileName, format: 'xlsx', savedToPc: saved, payload: { tab: activeTab.key, count: activeData.length } });
      showToast(saved ? `Saved: Logistic Reports/${fileName}` : 'Excel downloaded', 'success');
    } catch (err) { showToast('Excel export failed: ' + err.message, 'error'); }
  };

  const exportPDF = async () => {
    if (!activeData || activeData.length === 0) { showToast('No data to export', 'warning'); return; }
    try {
      setExporting(true);
      const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
      doc.setFontSize(18); doc.setTextColor(10, 31, 68); doc.setFont('helvetica', 'bold');
      doc.text('URUGO WOMEN OPPORTUNITY CENTER, LLC', 40, 40);
      doc.setFontSize(14); doc.text('Logistic Report', 40, 62);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(90, 90, 90);
      doc.text(`Period: ${period.charAt(0).toUpperCase() + period.slice(1)}`, 40, 82);
      doc.text(`Generated by: ${user?.full_name || '—'} (${user?.role || ''})`, 40, 96);
      doc.text(`Generated on: ${new Date().toLocaleString()}`, 40, 110);
      doc.text(`Table: ${activeTab.label} — ${activeData.length} record(s)`, 40, 124);
      if (report.totals) {
        const t = report.totals;
        doc.setFontSize(10); doc.setTextColor(10, 31, 68); doc.setFont('helvetica', 'bold');
        doc.text(`Total Inventory Value: ${Number(t.inventoryValue).toFixed(2)}  |  Stock In: ${t.stockIn}  |  Stock Out: ${t.stockOut}  |  Losses: ${t.losses}  |  Received: ${t.received || 0}`, 40, 142);
      }
      autoTable(doc, {
        head: [columns.map((h) => humanizeKey(h))],
        body: activeData.map((row) => columns.map((h) => formatCellValue(h, row[h]))),
        startY: 160,
        styles: { fontSize: 8, cellPadding: 4, lineColor: [200, 200, 200], lineWidth: 0.5, textColor: [30, 30, 30] },
        headStyles: { fillColor: [10, 31, 68], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'left' },
        alternateRowStyles: { fillColor: [246, 248, 251] },
        margin: { top: 160, left: 30, right: 30, bottom: 40 },
        theme: 'grid',
        didDrawPage: () => {
          const ps = doc.internal.pageSize;
          doc.setFontSize(9); doc.setTextColor(150);
          doc.text(`Urugo Woc Logistic System — Page ${doc.internal.getCurrentPageInfo().pageNumber}`,
            ps.width / 2, ps.height - 20, { align: 'center' });
        },
      });
      const fileName = buildFilename(`Logistic_${period}_${activeTab.key}`, 'pdf');
      const pdfBlob = doc.output('blob');
      const saved = await persistFile(pdfBlob, fileName);
      await logGenerated({ fileName, format: 'pdf', savedToPc: saved, payload: { tab: activeTab.key, count: activeData.length } });
      showToast(saved ? `Saved: Logistic Reports/${fileName}` : 'PDF downloaded', 'success');
    } catch (err) { showToast('PDF export failed: ' + err.message, 'error'); }
    finally { setExporting(false); }
  };

  const printReport = () => window.print();

  /* AUTO REPORT */
  const openAutoModal = () => { setAutoStep(1); setAutoPeriod('daily'); setAutoTime('08:00'); setShowAutoModal(true); };
  const saveAutomaticSchedule = async () => {
    setSavingSchedule(true);
    try {
      const res = await axios.post(`${API_URL}/reports/schedule`, { report_type: autoPeriod, report_time: autoTime });
      showToast(`Automatic ${autoPeriod} report scheduled for ${autoTime}`, 'success');
      setShowAutoModal(false); loadSchedules();
      await generateAutomaticReportNow(autoPeriod, res.data.id);
    } catch (err) { showToast(err.response?.data?.error || 'Failed to schedule', 'error'); }
    finally { setSavingSchedule(false); }
  };

  const generateAutomaticReportNow = async (reportPeriod, scheduleId) => {
    try {
      const res = await axios.get(`${API_URL}/reports/advanced`, { params: { period: reportPeriod } });
      const data = res.data;
      const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
      doc.setFontSize(18); doc.setFont('helvetica', 'bold'); doc.setTextColor(10, 31, 68);
      doc.text('URUGO WOMEN OPPORTUNITY CENTER, LLC', 40, 40);
      doc.setFontSize(14); doc.text('Logistic Report', 40, 62);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(90, 90, 90);
      doc.text(`Auto Report — ${reportPeriod.charAt(0).toUpperCase() + reportPeriod.slice(1)}`, 40, 82);
      doc.text(`Generated by: ${user?.full_name || '—'}`, 40, 96);
      doc.text(`Generated on: ${new Date().toLocaleString()}`, 40, 110);
      doc.text(`Schedule ID: #${scheduleId}`, 40, 124);
      const t = data.totals;
      doc.setFont('helvetica', 'bold'); doc.setTextColor(10, 31, 68);
      doc.text(`Total Inventory Value: ${Number(t.inventoryValue).toFixed(2)}  |  Stock In: ${t.stockIn}  |  Stock Out: ${t.stockOut}  |  Losses: ${t.losses}  |  Received: ${t.received || 0}`, 40, 142);
      const invRows = data.inventory.map((p) => [
        p.name, p.category, p.unit, p.quantity,
        Number(p.unit_price).toFixed(2), p.currency, Number(p.total_value).toFixed(2),
        p.received_stock || 0, p.supplier || '—',
      ]);
      autoTable(doc, {
        head: [['Product','Category','Unit','Qty','Price','Currency','Value','Received','Supplier']],
        body: invRows, startY: 160,
        styles: { fontSize: 8, cellPadding: 4 },
        headStyles: { fillColor: [10, 31, 68], textColor: 255, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [246, 248, 251] },
        margin: { top: 160, left: 30, right: 30, bottom: 40 }, theme: 'grid',
      });
      const now = new Date(); const pad = (n) => String(n).padStart(2, '0');
      const stamp = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}`;
      const userPart = (user?.full_name || 'User').replace(/\s+/g, '_');
      const fileName = `Logistic_${reportPeriod}_Report_${userPart}_${stamp}.pdf`;
      const pdfBlob = doc.output('blob');
      const saved = await persistFile(pdfBlob, fileName);
      await logGenerated({ fileName, format: 'pdf', savedToPc: saved, payload: { automatic: true, scheduleId, period: reportPeriod } });
      showToast(saved ? `Auto report saved: ${fileName}` : `Auto report downloaded: ${fileName}`, 'success');
    } catch (err) { showToast('Auto report failed: ' + err.message, 'error'); }
  };

  /* SCHEDULE EDIT/DELETE */
  const askDeleteSchedule = (s) => setConfirmDelete(s);
  const cancelDelete = () => { if (deletingSchedule) return; setConfirmDelete(null); };
  const confirmDeleteSchedule = async () => {
    if (!confirmDelete) return;
    setDeletingSchedule(true);
    try {
      await axios.delete(`${API_URL}/reports/schedule/${confirmDelete.id}`);
      showToast(`Schedule deleted — ${confirmDelete.report_type} at ${confirmDelete.report_time}`, 'success');
      setConfirmDelete(null); loadSchedules();
    } catch (err) { showToast(err.response?.data?.error || 'Failed to delete', 'error'); }
    finally { setDeletingSchedule(false); }
  };
  const openEditSchedule = (s) => { setEditSchedule(s); setEditPeriod(s.report_type); setEditTime(s.report_time); };
  const closeEditSchedule = () => { setEditSchedule(null); setSavingEdit(false); };
  const saveEditedSchedule = async () => {
    if (!editSchedule) return;
    setSavingEdit(true);
    try {
      await axios.put(`${API_URL}/reports/schedule/${editSchedule.id}`, { report_type: editPeriod, report_time: editTime });
      showToast(`Schedule updated: ${editPeriod} at ${editTime}`, 'success');
      closeEditSchedule(); loadSchedules();
    } catch (err) { showToast(err.response?.data?.error || 'Failed to update', 'error'); }
    finally { setSavingEdit(false); }
  };

  /* ================== DEPARTMENT FLOW ================== */
  const loadDF = async () => {
    if (!dfDept) { showToast('Select a department', 'warning'); return; }
    setDfLoading(true);
    try {
      const res = await axios.get(`${API_URL}/reports/department-flow`, { params: { period: dfPeriod, department: dfDept } });
      setDfData(res.data);
    } catch (err) { showToast(err.response?.data?.error || 'Failed to load', 'error'); }
    finally { setDfLoading(false); }
  };

  const dfExportExcel = async () => {
    if (!dfData) return;
    const wb = XLSX.utils.book_new();
    if (dfData.rows && dfData.rows.length > 0) {
      const headers = ['Period','Requested','Received','Issued','Used','Damaged','Remaining'];
      const rows = dfData.rows.map((r) => [r.period, r.requested, r.received, r.issued, r.used, r.damaged, r.remaining]);
      const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
      ws['!cols'] = headers.map(() => ({ wch: 16 }));
      XLSX.utils.book_append_sheet(wb, ws, 'Timeline');
    }
    if (dfData.products && dfData.products.length > 0) {
      const headers = ['Product','Unit','Requested','Received','Issued','Used','Damaged','Remaining'];
      const rows = dfData.products.map((p) => [p.product_name, p.product_unit, p.requested, p.received, p.issued, p.used, p.damaged, p.remaining]);
      const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
      ws['!cols'] = headers.map(() => ({ wch: 16 }));
      XLSX.utils.book_append_sheet(wb, ws, 'By Product');
    }
    if (wb.SheetNames.length === 0) { showToast('No data to export', 'warning'); return; }
    const fileName = buildFilename(`DeptFlow_${dfDept.replace(/\s+/g,'_')}_${dfPeriod}`, 'xlsx');
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const saved = await persistFile(blob, fileName);
    showToast(saved ? `Saved: Logistic Reports/${fileName}` : 'Excel downloaded', 'success');
  };

  const dfExportPDF = async () => {
    if (!dfData) return;
    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
    doc.setFontSize(18); doc.setFont('helvetica', 'bold'); doc.setTextColor(10, 31, 68);
    doc.text('URUGO WOMEN OPPORTUNITY CENTER, LLC', 40, 40);
    doc.setFontSize(14); doc.text('Department Stock Flow Report', 40, 62);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(90, 90, 90);
    doc.text(`Department: ${dfData.department}`, 40, 82);
    doc.text(`Period: ${dfData.period.toUpperCase()}`, 40, 96);
    doc.text(`Generated by: ${dfData.generatedBy}`, 40, 110);
    doc.text(`Generated on: ${new Date(dfData.generatedAt).toLocaleString()}`, 40, 124);
    doc.setFont('helvetica', 'bold'); doc.setTextColor(10, 31, 68);
    doc.text(`Totals — Requested: ${dfData.totals.requested} | Received: ${dfData.totals.received} | Issued: ${dfData.totals.issued} | Used: ${dfData.totals.used} | Damaged: ${dfData.totals.damaged} | Remaining: ${dfData.totals.remaining}`, 40, 142);
    let cursorY = 160; let added = false;
    if (dfData.rows && dfData.rows.length > 0) {
      doc.setFontSize(11); doc.text('Timeline', 40, cursorY);
      autoTable(doc, {
        head: [['Period','Requested','Received','Issued','Used','Damaged','Remaining']],
        body: dfData.rows.map((r) => [r.period, r.requested, r.received, r.issued, r.used, r.damaged, r.remaining]),
        startY: cursorY + 10,
        styles: { fontSize: 9, cellPadding: 4 },
        headStyles: { fillColor: [10, 31, 68], textColor: 255, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [246, 248, 251] },
        margin: { left: 30, right: 30 }, theme: 'grid',
      });
      cursorY = doc.lastAutoTable.finalY + 20; added = true;
    }
    if (dfData.products && dfData.products.length > 0) {
      doc.setFontSize(11); doc.text('Breakdown by Product', 40, cursorY);
      autoTable(doc, {
        head: [['Product','Unit','Requested','Received','Issued','Used','Damaged','Remaining']],
        body: dfData.products.map((p) => [p.product_name, p.product_unit, p.requested, p.received, p.issued, p.used, p.damaged, p.remaining]),
        startY: cursorY + 10,
        styles: { fontSize: 9, cellPadding: 4 },
        headStyles: { fillColor: [10, 31, 68], textColor: 255, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [246, 248, 251] },
        margin: { left: 30, right: 30 }, theme: 'grid',
      });
      added = true;
    }
    if (!added) { showToast('No data to export', 'warning'); return; }
    const fileName = buildFilename(`DeptFlow_${dfDept.replace(/\s+/g,'_')}_${dfPeriod}`, 'pdf');
    const pdfBlob = doc.output('blob');
    const saved = await persistFile(pdfBlob, fileName);
    showToast(saved ? `Saved: Logistic Reports/${fileName}` : 'PDF downloaded', 'success');
  };

  const dfPrint = () => {
    if (!dfData) { showToast('Load the report first', 'warning'); return; }
    const w = window.open('', '_blank');
    const timelineHtml = (dfData.rows && dfData.rows.length > 0) ? `
      <h3>Timeline</h3>
      <table><thead><tr><th>Period</th><th>Requested</th><th>Received</th><th>Issued</th><th>Used</th><th>Damaged</th><th>Remaining</th></tr></thead>
      <tbody>${dfData.rows.map((r) => `<tr>
        <td>${r.period}</td><td>${r.requested}</td><td>${r.received}</td><td>${r.issued}</td>
        <td>${r.used}</td><td>${r.damaged}</td><td>${r.remaining}</td>
      </tr>`).join('')}</tbody></table>` : '';
    const productsHtml = (dfData.products && dfData.products.length > 0) ? `
      <h3>Breakdown by Product</h3>
      <table><thead><tr><th>Product</th><th>Unit</th><th>Requested</th><th>Received</th><th>Issued</th><th>Used</th><th>Damaged</th><th>Remaining</th></tr></thead>
      <tbody>${dfData.products.map((p) => `<tr>
        <td>${p.product_name}</td><td>${p.product_unit}</td>
        <td>${p.requested}</td><td>${p.received}</td><td>${p.issued}</td>
        <td>${p.used}</td><td>${p.damaged}</td><td>${p.remaining}</td>
      </tr>`).join('')}</tbody></table>` : '';
    w.document.write(`
      <html><head><title>Department Flow — ${dfData.department}</title>
      <style>
        body{font-family:Arial,sans-serif;padding:20px;color:#111}
        h1{color:#0a1f44;font-size:20px;margin:0 0 4px}
        h2{color:#333;font-size:14px;margin:0 0 12px;font-weight:normal}
        h3{color:#0a1f44;font-size:14px;margin-top:20px}
        .meta{font-size:11px;color:#555;margin-bottom:10px}
        .totals{font-weight:bold;margin:8px 0 16px;color:#0a1f44;font-size:12px}
        table{width:100%;border-collapse:collapse;font-size:10px;margin-top:6px}
        th{background:#0a1f44;color:#fff;padding:6px;text-align:left;border:1px solid #444}
        td{padding:5px;border:1px solid #ccc}
        tr:nth-child(even) td{background:#f6f8fb}
      </style></head><body>
      <h1>URUGO WOMEN OPPORTUNITY CENTER, LLC</h1>
      <h2>Department Stock Flow Report</h2>
      <div class="meta">Department: <b>${dfData.department}</b> | Period: <b>${dfData.period.toUpperCase()}</b> | Generated: ${new Date(dfData.generatedAt).toLocaleString()} | By: ${dfData.generatedBy}</div>
      <div class="totals">Requested: ${dfData.totals.requested} | Received: ${dfData.totals.received} | Issued: ${dfData.totals.issued} | Used: ${dfData.totals.used} | Damaged: ${dfData.totals.damaged} | Remaining: ${dfData.totals.remaining}</div>
      ${timelineHtml}${productsHtml}
      <script>window.onload=()=>window.print()</script>
      </body></html>`);
    w.document.close();
  };

  /* ================== PER-PRODUCT ================== */
  const loadPR = async () => {
    if (!prProductId) { showToast('Select a product', 'warning'); return; }
    setPrLoading(true);
    try {
      const res = await axios.get(`${API_URL}/reports/product-report`, { params: { period: prPeriod, product_id: prProductId } });
      setPrData(res.data);
    } catch (err) { showToast(err.response?.data?.error || 'Failed to load', 'error'); }
    finally { setPrLoading(false); }
  };

  const prExportExcel = async () => {
    if (!prData) return;
    const wb = XLSX.utils.book_new();
    const infoRows = [
      ['Product', prData.product.name], ['Category', prData.product.category],
      ['Unit', prData.product.unit], ['Current Stock', prData.product.quantity],
      ['Unit Price', prData.product.unit_price], ['Currency', prData.product.currency],
      ['Min Stock', prData.product.min_stock], ['Supplier', prData.product.supplier || '—'],
      ['Batch Number', prData.product.batch_number || '—'],
      ['Expiry Date', prData.product.expiry_date ? String(prData.product.expiry_date).slice(0, 10) : '—'],
      ['Period', prData.period], ['Generated By', prData.generatedBy],
      ['Generated At', new Date(prData.generatedAt).toLocaleString()],
    ];
    const wsInfo = XLSX.utils.aoa_to_sheet([['Field','Value'], ...infoRows]);
    wsInfo['!cols'] = [{ wch: 20 }, { wch: 30 }];
    XLSX.utils.book_append_sheet(wb, wsInfo, 'Product Info');
    if (prData.rows && prData.rows.length > 0) {
      const headers = ['Period','Received','Stock In','Stock Out','Losses','Used','Damaged','Remaining'];
      const rows = prData.rows.map((r) => [r.period, r.received_stock, r.stock_in, r.stock_out, r.losses, r.used, r.damaged, r.remaining]);
      const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
      ws['!cols'] = headers.map(() => ({ wch: 14 }));
      XLSX.utils.book_append_sheet(wb, ws, 'Timeline');
    }
    const d = prData.details || {};
    const appendDetail = (arr, name, cols) => {
      if (!arr || arr.length === 0) return;
      const rows = arr.map((r) => cols.map((c) => r[c] ?? ''));
      const ws = XLSX.utils.aoa_to_sheet([cols.map(humanizeKey), ...rows]);
      ws['!cols'] = cols.map(() => ({ wch: 16 }));
      XLSX.utils.book_append_sheet(wb, ws, name);
    };
    appendDetail(d.stockIn, 'Stock In', ['id','created_at','quantity','donor_supplier','batch_number','expiry_date','received_by_name']);
    appendDetail(d.stockOut, 'Stock Out', ['id','created_at','quantity','issued_to','department','received_by_name','approved_by_name','notes']);
    appendDetail(d.losses, 'Losses', ['id','created_at','quantity','reason','reported_by_name']);
    appendDetail(d.usage, 'Usage', ['id','created_at','used_quantity','damaged_quantity','remaining_quantity','staff_name','staff_department','notes']);
    if (wb.SheetNames.length === 0) { showToast('No data to export', 'warning'); return; }
    const fileName = buildFilename(`Product_${prData.product.name.replace(/\s+/g,'_')}_${prData.period}`, 'xlsx');
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const saved = await persistFile(blob, fileName);
    showToast(saved ? `Saved: Logistic Reports/${fileName}` : 'Excel downloaded', 'success');
  };

  const prExportPDF = async () => {
    if (!prData) return;
    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
    doc.setFontSize(18); doc.setFont('helvetica', 'bold'); doc.setTextColor(10, 31, 68);
    doc.text('URUGO WOMEN OPPORTUNITY CENTER, LLC', 40, 40);
    doc.setFontSize(14); doc.text(`Product Report — ${prData.product.name}`, 40, 62);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(90, 90, 90);
    doc.text(`Category: ${prData.product.category} | Unit: ${prData.product.unit} | Current Stock: ${prData.product.quantity}`, 40, 82);
    doc.text(`Unit Price: ${prData.product.unit_price} ${prData.product.currency} | Min Stock: ${prData.product.min_stock}`, 40, 96);
    doc.text(`Period: ${prData.period.toUpperCase()} | By: ${prData.generatedBy} | ${new Date(prData.generatedAt).toLocaleString()}`, 40, 110);
    const t = prData.totals || {};
    doc.setFont('helvetica', 'bold'); doc.setTextColor(10, 31, 68);
    doc.text(`Totals — Received: ${t.received_stock || 0} | In: ${t.stock_in || 0} | Out: ${t.stock_out || 0} | Losses: ${t.losses || 0} | Used: ${t.used || 0} | Damaged: ${t.damaged || 0} | Remaining: ${t.remaining || 0}`, 40, 128);
    let cursorY = 146; let added = false;
    if (prData.rows && prData.rows.length > 0) {
      doc.setFontSize(11); doc.text('Timeline', 40, cursorY);
      autoTable(doc, {
        head: [['Period','Received','Stock In','Stock Out','Losses','Used','Damaged','Remaining']],
        body: prData.rows.map((r) => [r.period, r.received_stock, r.stock_in, r.stock_out, r.losses, r.used, r.damaged, r.remaining]),
        startY: cursorY + 10,
        styles: { fontSize: 9, cellPadding: 4 },
        headStyles: { fillColor: [10, 31, 68], textColor: 255, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [246, 248, 251] },
        margin: { left: 30, right: 30 }, theme: 'grid',
      });
      cursorY = doc.lastAutoTable.finalY + 20; added = true;
    }
    const d = prData.details || {};
    if (d.stockIn && d.stockIn.length > 0) {
      doc.setFontSize(11); doc.text('Stock In Details', 40, cursorY);
      autoTable(doc, {
        head: [['Date','Qty','Supplier','Batch','Expiry','Received By']],
        body: d.stockIn.map((r) => [
          new Date(r.created_at).toLocaleDateString(), r.quantity,
          r.donor_supplier || '—', r.batch_number || '—',
          r.expiry_date ? String(r.expiry_date).slice(0, 10) : '—',
          r.received_by_name || '—',
        ]),
        startY: cursorY + 10, styles: { fontSize: 8, cellPadding: 3 },
        headStyles: { fillColor: [10, 31, 68], textColor: 255 },
        margin: { left: 30, right: 30 }, theme: 'grid',
      });
      cursorY = doc.lastAutoTable.finalY + 20; added = true;
    }
    if (d.stockOut && d.stockOut.length > 0) {
      doc.setFontSize(11); doc.text('Stock Out Details', 40, cursorY);
      autoTable(doc, {
        head: [['Date','Qty','Issued To','Department','Received By','Approved By']],
        body: d.stockOut.map((r) => [
          new Date(r.created_at).toLocaleDateString(), r.quantity,
          r.issued_to || '—', r.department || '—',
          r.received_by_name || '—', r.approved_by_name || '—',
        ]),
        startY: cursorY + 10, styles: { fontSize: 8, cellPadding: 3 },
        headStyles: { fillColor: [10, 31, 68], textColor: 255 },
        margin: { left: 30, right: 30 }, theme: 'grid',
      });
      cursorY = doc.lastAutoTable.finalY + 20; added = true;
    }
    if (d.usage && d.usage.length > 0) {
      doc.setFontSize(11); doc.text('Usage Details', 40, cursorY);
      autoTable(doc, {
        head: [['Date','Staff','Dept','Used','Damaged','Remaining']],
        body: d.usage.map((r) => [
          new Date(r.created_at).toLocaleDateString(),
          r.staff_name || '—', r.staff_department || '—',
          r.used_quantity, r.damaged_quantity, r.remaining_quantity,
        ]),
        startY: cursorY + 10, styles: { fontSize: 8, cellPadding: 3 },
        headStyles: { fillColor: [10, 31, 68], textColor: 255 },
        margin: { left: 30, right: 30 }, theme: 'grid',
      });
      added = true;
    }
    if (!added) { showToast('No data to export', 'warning'); return; }
    const fileName = buildFilename(`Product_${prData.product.name.replace(/\s+/g,'_')}_${prData.period}`, 'pdf');
    const pdfBlob = doc.output('blob');
    const saved = await persistFile(pdfBlob, fileName);
    showToast(saved ? `Saved: Logistic Reports/${fileName}` : 'PDF downloaded', 'success');
  };

  const prPrint = () => {
    if (!prData) { showToast('Load the report first', 'warning'); return; }
    const w = window.open('', '_blank'); const d = prData.details;
    const timelineHtml = (prData.rows && prData.rows.length > 0) ? `
      <h3>Timeline</h3>
      <table><thead><tr><th>Period</th><th>Received</th><th>Stock In</th><th>Stock Out</th><th>Losses</th><th>Used</th><th>Damaged</th><th>Remaining</th></tr></thead>
      <tbody>${prData.rows.map((r) => `<tr>
        <td>${r.period}</td><td>${r.received_stock}</td><td>${r.stock_in}</td><td>${r.stock_out}</td>
        <td>${r.losses}</td><td>${r.used}</td><td>${r.damaged}</td><td>${r.remaining}</td>
      </tr>`).join('')}</tbody></table>` : '';
    const inHtml = (d.stockIn && d.stockIn.length > 0) ? `
      <h3>Stock In</h3><table><thead><tr><th>Date</th><th>Qty</th><th>Supplier</th><th>Batch</th><th>Expiry</th><th>Received By</th></tr></thead>
      <tbody>${d.stockIn.map((r) => `<tr>
        <td>${new Date(r.created_at).toLocaleDateString()}</td><td>${r.quantity}</td>
        <td>${r.donor_supplier || '—'}</td><td>${r.batch_number || '—'}</td>
        <td>${r.expiry_date ? String(r.expiry_date).slice(0,10) : '—'}</td><td>${r.received_by_name || '—'}</td>
      </tr>`).join('')}</tbody></table>` : '';
    const outHtml = (d.stockOut && d.stockOut.length > 0) ? `
      <h3>Stock Out</h3><table><thead><tr><th>Date</th><th>Qty</th><th>Issued To</th><th>Department</th><th>Approved By</th></tr></thead>
      <tbody>${d.stockOut.map((r) => `<tr>
        <td>${new Date(r.created_at).toLocaleDateString()}</td><td>${r.quantity}</td>
        <td>${r.issued_to || '—'}</td><td>${r.department || '—'}</td><td>${r.approved_by_name || '—'}</td>
      </tr>`).join('')}</tbody></table>` : '';
    const usageHtml = (d.usage && d.usage.length > 0) ? `
      <h3>Usage</h3><table><thead><tr><th>Date</th><th>Staff</th><th>Dept</th><th>Used</th><th>Damaged</th><th>Remaining</th></tr></thead>
      <tbody>${d.usage.map((r) => `<tr>
        <td>${new Date(r.created_at).toLocaleDateString()}</td>
        <td>${r.staff_name || '—'}</td><td>${r.staff_department || '—'}</td>
        <td>${r.used_quantity}</td><td>${r.damaged_quantity}</td><td>${r.remaining_quantity}</td>
      </tr>`).join('')}</tbody></table>` : '';
    w.document.write(`
      <html><head><title>Product Report — ${prData.product.name}</title>
      <style>
        body{font-family:Arial,sans-serif;padding:20px;color:#111}
        h1{color:#0a1f44;font-size:20px;margin:0 0 4px}
        h2{color:#333;font-size:14px;margin:0 0 12px;font-weight:normal}
        h3{color:#0a1f44;font-size:13px;margin-top:18px}
        .meta{font-size:11px;color:#555;margin-bottom:10px}
        .totals{font-weight:bold;margin:8px 0 16px;color:#0a1f44;font-size:12px}
        table{width:100%;border-collapse:collapse;font-size:10px;margin-top:6px}
        th{background:#0a1f44;color:#fff;padding:6px;text-align:left;border:1px solid #444}
        td{padding:5px;border:1px solid #ccc}
        tr:nth-child(even) td{background:#f6f8fb}
      </style></head><body>
      <h1>URUGO WOMEN OPPORTUNITY CENTER, LLC</h1>
      <h2>Product Report — ${prData.product.name}</h2>
      <div class="meta">Category: ${prData.product.category} | Unit: ${prData.product.unit} | Current Stock: ${prData.product.quantity} | Price: ${prData.product.unit_price} ${prData.product.currency} | Period: ${prData.period.toUpperCase()} | By: ${prData.generatedBy} | ${new Date(prData.generatedAt).toLocaleString()}</div>
      <div class="totals">Received: ${prData.totals.received_stock} | In: ${prData.totals.stock_in} | Out: ${prData.totals.stock_out} | Losses: ${prData.totals.losses} | Used: ${prData.totals.used} | Damaged: ${prData.totals.damaged} | Remaining: ${prData.totals.remaining}</div>
      ${timelineHtml}${inHtml}${outHtml}${usageHtml}
      <script>window.onload=()=>window.print()</script>
      </body></html>`);
    w.document.close();
  };

  /* ================== OPENING/CLOSING ================== */
  const loadOC = async () => {
    setOcLoading(true);
    try {
      const params = { period: ocPeriod };
      params.date = ocPeriod === 'daily' ? ocDate : ocMonth;
      const res = await axios.get(`${API_URL}/reports/opening-closing`, { params });
      setOcData(res.data);
    } catch (err) { showToast(err.response?.data?.error || 'Failed to load', 'error'); }
    finally { setOcLoading(false); }
  };

  const ocExportExcel = async () => {
    if (!ocData || ocData.rows.length === 0) { showToast('No data to export', 'warning'); return; }
    const headers = ['Product','Category','Unit','Opening Stock','Received Stock','Stock In','Stock Out','Losses','Closing Stock','Unit Price','Currency','Closing Value','Min Stock'];
    const rows = ocData.rows.map((r) => [
      r.name, r.category, r.unit, r.opening_stock, r.received_stock, r.stock_in, r.stock_out,
      r.losses, r.closing_stock, r.unit_price, r.currency, r.closing_value, r.min_stock,
    ]);
    const totalsRow = ['TOTAL','','', ocData.totals.opening, ocData.totals.received, ocData.totals.stockIn, ocData.totals.stockOut, ocData.totals.losses, ocData.totals.closing, '', '', ocData.totals.value, ''];
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows, [], totalsRow]);
    ws['!cols'] = headers.map(() => ({ wch: 16 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Opening-Closing');
    const fileName = buildFilename(`OpeningClosing_${ocData.label}`, 'xlsx');
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const saved = await persistFile(blob, fileName);
    showToast(saved ? `Saved: Logistic Reports/${fileName}` : 'Excel downloaded', 'success');
  };

  const ocExportPDF = async () => {
    if (!ocData || ocData.rows.length === 0) { showToast('No data to export', 'warning'); return; }
    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
    doc.setFontSize(18); doc.setFont('helvetica', 'bold'); doc.setTextColor(10, 31, 68);
    doc.text('URUGO WOMEN OPPORTUNITY CENTER, LLC', 40, 40);
    doc.setFontSize(14); doc.text(`Opening & Closing Stock Report — ${ocData.period.toUpperCase()}`, 40, 62);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(90, 90, 90);
    doc.text(`Period: ${ocData.label}`, 40, 82);
    doc.text(`Generated: ${new Date(ocData.generatedAt).toLocaleString()} | By: ${ocData.generatedBy}`, 40, 96);
    doc.text(`Items: ${ocData.rows.length}`, 40, 110);
    doc.setFont('helvetica', 'bold'); doc.setTextColor(10, 31, 68);
    doc.text(`Totals — Opening: ${ocData.totals.opening} | Received: ${ocData.totals.received} | In: ${ocData.totals.stockIn} | Out: ${ocData.totals.stockOut} | Losses: ${ocData.totals.losses} | Closing: ${ocData.totals.closing} | Value: ${ocData.totals.value.toFixed(2)}`, 40, 128);
    autoTable(doc, {
      head: [['Product','Category','Unit','Opening','Received','In','Out','Losses','Closing','Price','Cur','Value','Min']],
      body: ocData.rows.map((r) => [
        r.name, r.category, r.unit, r.opening_stock, r.received_stock, r.stock_in, r.stock_out,
        r.losses, r.closing_stock, Number(r.unit_price).toFixed(2), r.currency,
        Number(r.closing_value).toFixed(2), r.min_stock,
      ]),
      foot: [['TOTAL','','', ocData.totals.opening, ocData.totals.received, ocData.totals.stockIn, ocData.totals.stockOut, ocData.totals.losses, ocData.totals.closing, '', '', ocData.totals.value.toFixed(2), '']],
      startY: 146,
      styles: { fontSize: 8, cellPadding: 4 },
      headStyles: { fillColor: [10, 31, 68], textColor: 255, fontStyle: 'bold' },
      footStyles: { fillColor: [230, 236, 245], textColor: 20, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [246, 248, 251] },
      margin: { top: 146, left: 30, right: 30, bottom: 40 }, theme: 'grid',
    });
    const fileName = buildFilename(`OpeningClosing_${ocData.label}`, 'pdf');
    const pdfBlob = doc.output('blob');
    const saved = await persistFile(pdfBlob, fileName);
    showToast(saved ? `Saved: Logistic Reports/${fileName}` : 'PDF downloaded', 'success');
  };

  const ocPrint = () => {
    if (!ocData || ocData.rows.length === 0) { showToast('No data to print', 'warning'); return; }
    const w = window.open('', '_blank');
    w.document.write(`
      <html><head><title>Opening & Closing — ${ocData.label}</title>
      <style>
        body{font-family:Arial,sans-serif;padding:20px;color:#111}
        h1{color:#0a1f44;font-size:20px;margin:0 0 4px}
        h2{color:#333;font-size:14px;margin:0 0 12px;font-weight:normal}
        .meta{font-size:11px;color:#555;margin-bottom:10px}
        .totals{font-weight:bold;margin:8px 0 16px;color:#0a1f44;font-size:12px}
        table{width:100%;border-collapse:collapse;font-size:10px}
        th{background:#0a1f44;color:#fff;padding:6px;text-align:left;border:1px solid #444}
        td{padding:5px;border:1px solid #ccc}
        tr:nth-child(even) td{background:#f6f8fb}
        tfoot td{background:#e6ecf5;font-weight:bold}
        .footer{margin-top:20px;font-size:10px;color:#888;text-align:center}
      </style></head><body>
      <h1>URUGO WOMEN OPPORTUNITY CENTER, LLC</h1>
      <h2>Opening & Closing Stock Report — ${ocData.period.toUpperCase()}</h2>
      <div class="meta">Period: <b>${ocData.label}</b> | Generated: ${new Date(ocData.generatedAt).toLocaleString()} | By: ${ocData.generatedBy}</div>
      <div class="totals">Opening: ${ocData.totals.opening} | Received: ${ocData.totals.received} | In: ${ocData.totals.stockIn} | Out: ${ocData.totals.stockOut} | Losses: ${ocData.totals.losses} | Closing: ${ocData.totals.closing} | Value: ${ocData.totals.value.toFixed(2)}</div>
      <table><thead><tr>
        <th>#</th><th>Product</th><th>Category</th><th>Unit</th>
        <th>Opening</th><th>Received</th><th>In</th><th>Out</th><th>Losses</th>
        <th>Closing</th><th>Price</th><th>Cur</th><th>Value</th><th>Min</th>
      </tr></thead><tbody>
      ${ocData.rows.map((r, i) => `<tr>
        <td>${i+1}</td><td>${r.name}</td><td>${r.category}</td><td>${r.unit}</td>
        <td>${r.opening_stock}</td><td>${r.received_stock}</td><td>${r.stock_in}</td>
        <td>${r.stock_out}</td><td>${r.losses}</td><td>${r.closing_stock}</td>
        <td>${Number(r.unit_price).toFixed(2)}</td><td>${r.currency}</td>
        <td>${Number(r.closing_value).toFixed(2)}</td><td>${r.min_stock}</td>
      </tr>`).join('')}
      </tbody><tfoot><tr>
        <td colspan="4">TOTAL</td>
        <td>${ocData.totals.opening}</td><td>${ocData.totals.received}</td>
        <td>${ocData.totals.stockIn}</td><td>${ocData.totals.stockOut}</td>
        <td>${ocData.totals.losses}</td><td>${ocData.totals.closing}</td>
        <td></td><td></td><td>${ocData.totals.value.toFixed(2)}</td><td></td>
      </tr></tfoot></table>
      <div class="footer">Urugo Woc Logistic System — Confidential</div>
      <script>window.onload=()=>window.print()</script>
      </body></html>`);
    w.document.close();
  };

  /* ============ RENDER ============ */
  return (
    <div className="uw-rp">
      <div className="uw-page-header uw-no-print">
        <h2 className="uw-page-title"><i className="bi bi-file-earmark-bar-graph"></i> Reports</h2>
        <div className="uw-header-actions">
          <button className="uw-btn-secondary" onClick={printReport}><i className="bi bi-printer"></i> Print</button>
          <button className="uw-btn-secondary" onClick={exportPDF} disabled={exporting}>
            <i className="bi bi-file-earmark-pdf"></i> {exporting ? 'Generating…' : 'Export PDF'}
          </button>
          <button className="uw-btn-primary" onClick={exportExcel}><i className="bi bi-file-earmark-excel"></i> Export Excel</button>
          <button className="uw-btn-primary uw-btn-auto" onClick={openAutoModal} title="Set up an automatic report">
            <i className="bi bi-alarm"></i> Automatic Report
          </button>
        </div>
      </div>

      <div className="uw-period-tabs uw-no-print">
        <span className="uw-period-label">Period:</span>
        {PERIODS.map((p) => (
          <button key={p.key} className={`uw-period-btn ${period === p.key ? 'active' : ''}`} onClick={() => setPeriod(p.key)}>
            <i className={`bi ${p.icon}`}></i> {p.label}
          </button>
        ))}
        <span className="uw-period-info">
          {report.startDate ? `From ${new Date(report.startDate).toLocaleDateString()} → today` : 'All records'}
        </span>
      </div>

      <div className="uw-report-summary">
        <div className="uw-summary-card"><div className="uw-summary-icon blue"><i className="bi bi-cash-stack"></i></div>
          <div><div className="uw-summary-label">Inventory Value</div>
            <div className="uw-summary-value">{Number(report.totals?.inventoryValue || 0).toFixed(2)}</div></div></div>
        <div className="uw-summary-card"><div className="uw-summary-icon green"><i className="bi bi-arrow-down-circle"></i></div>
          <div><div className="uw-summary-label">Received</div>
            <div className="uw-summary-value">{report.totals?.received || 0}</div></div></div>
        <div className="uw-summary-card"><div className="uw-summary-icon green"><i className="bi bi-box-arrow-in-down"></i></div>
          <div><div className="uw-summary-label">Stock In</div>
            <div className="uw-summary-value">{report.totals?.stockIn || 0}</div></div></div>
        <div className="uw-summary-card"><div className="uw-summary-icon orange"><i className="bi bi-box-arrow-up"></i></div>
          <div><div className="uw-summary-label">Stock Out</div>
            <div className="uw-summary-value">{report.totals?.stockOut || 0}</div></div></div>
        <div className="uw-summary-card"><div className="uw-summary-icon red"><i className="bi bi-exclamation-triangle"></i></div>
          <div><div className="uw-summary-label">Losses</div>
            <div className="uw-summary-value">{report.totals?.losses || 0}</div></div></div>
      </div>

      <div className="uw-report-tabs uw-no-print">
        {tabs.map((t) => (
          <button key={t.key} className={`uw-report-tab ${tab === t.key ? 'active' : ''}`} onClick={() => setTab(t.key)}>
            <i className={`bi ${t.icon}`}></i> {t.label}
            <span className="uw-tab-count">{t.data.length}</span>
          </button>
        ))}
      </div>

      <div className="uw-print-header">
        <div className="uw-print-title">Urugo Woc Logistics System</div>
        <div className="uw-print-subtitle">Logistic Report — {period.charAt(0).toUpperCase() + period.slice(1)} — {new Date().toLocaleString()}</div>
      </div>

      <div className="uw-table-wrap uw-print-table-wrap">
        <table className="uw-excel-table uw-print-table">
          <thead><tr>{columns.map((k) => <th key={k}>{humanizeKey(k)}</th>)}</tr></thead>
          <tbody>
            {activeData.map((row, i) => (
              <tr key={i}>{columns.map((k) => <td key={k}>{formatCellValue(k, row[k])}</td>)}</tr>
            ))}
            {activeData.length === 0 && (<tr><td className="uw-no-data" colSpan={columns.length || 1}>No data</td></tr>)}
          </tbody>
        </table>
      </div>

      <div className="uw-print-footer">
        <span>Urugo Woc Logistic System — Confidential</span>
        <span>{new Date().toLocaleDateString()}</span>
      </div>

      {/* 3-COLUMN GRID FOR REPORTS */}
      <div className="uw-reports-grid uw-no-print">
        
        {/* OPENING / CLOSING */}
        <div className="uw-report-card">
          <h4><i className="bi bi-bar-chart-line"></i> Opening & Closing</h4>
          <div className="uw-form-row">
            <div>
              <label>Period</label>
              <select className="form-control" value={ocPeriod} onChange={(e) => setOcPeriod(e.target.value)}>
                <option value="daily">Daily</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>
            <div>
              <label>{ocPeriod === 'daily' ? 'Date' : 'Month'}</label>
              {ocPeriod === 'daily' ? (
                <input type="date" className="form-control" value={ocDate} onChange={(e) => setOcDate(e.target.value)} />
              ) : (
                <input type="month" className="form-control" value={ocMonth} onChange={(e) => setOcMonth(e.target.value)} />
              )}
            </div>
          </div>
          <button className="uw-btn-primary" onClick={loadOC} disabled={ocLoading} style={{ width: '100%' }}>
            <i className="bi bi-search"></i> {ocLoading ? 'Loading…' : 'Generate'}
          </button>

          {ocData && ocData.rows.length === 0 && (<p className="uw-no-data" style={{ marginTop: 12, fontSize: '0.8rem' }}>No movements.</p>)}

          {ocData && ocData.rows.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <div className="uw-card-actions">
                <button className="uw-btn-secondary" onClick={ocPrint}><i className="bi bi-printer"></i> Print</button>
                <button className="uw-btn-secondary" onClick={ocExportPDF}><i className="bi bi-file-earmark-pdf"></i> PDF</button>
                <button className="uw-btn-primary" onClick={ocExportExcel}><i className="bi bi-file-earmark-excel"></i> Excel</button>
              </div>

              <div className="uw-table-wrap" style={{ maxHeight: 220, overflow: 'auto', marginTop: 8 }}>
                <table className="uw-excel-table" style={{ fontSize: '0.75rem' }}>
                  <thead><tr>
                    <th>Product</th>
                    <th>Unit Price</th>
                    <th>Opening</th><th>Received</th><th>In</th><th>Out</th><th>Closing</th>
                  </tr></thead>
                  <tbody>
                    {ocData.rows.map((r) => (
                      <tr key={r.product_id}>
                        <td className="uw-bold">{r.name}</td>
                        
                        <td>{r.opening_stock}</td>
                        <td style={{ color: '#0a7c4a', fontWeight: 'bold' }}>{r.received_stock}</td>
                        <td>{r.stock_in}</td><td>{r.stock_out}</td>
                        <td>{Number(r.unit_price).toFixed(2)} {r.currency}</td>
                        <td className="uw-bold">{r.closing_stock}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* DEPARTMENT FLOW */}
        <div className="uw-report-card">
          <h4><i className="bi bi-building"></i> Department Flow</h4>
          <div className="uw-form-row">
            <div style={{ flex: 2 }}>
              <label>Department</label>
              <select className="form-control" value={dfDept} onChange={(e) => setDfDept(e.target.value)}>
                <option value="">— select —</option>
                {dfDepts.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label>Period</label>
              <select className="form-control" value={dfPeriod} onChange={(e) => setDfPeriod(e.target.value)}>
                {FLOW_PERIODS.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
              </select>
            </div>
          </div>
          <button className="uw-btn-primary" onClick={loadDF} disabled={dfLoading} style={{ width: '100%' }}>
            <i className="bi bi-search"></i> {dfLoading ? 'Loading…' : 'Generate'}
          </button>

          {dfData && dfData.rows.length === 0 && dfData.products.length === 0 && (<p className="uw-no-data" style={{ marginTop: 12, fontSize: '0.8rem' }}>No activity.</p>)}

          {dfData && (dfData.rows.length > 0 || dfData.products.length > 0) && (
            <div style={{ marginTop: 12 }}>
              <div className="uw-card-actions">
                <button className="uw-btn-secondary" onClick={dfPrint}><i className="bi bi-printer"></i> Print</button>
                <button className="uw-btn-secondary" onClick={dfExportPDF}><i className="bi bi-file-earmark-pdf"></i> PDF</button>
                <button className="uw-btn-primary" onClick={dfExportExcel}><i className="bi bi-file-earmark-excel"></i> Excel</button>
              </div>

              {dfData.rows.length > 0 && (
                <div className="uw-table-wrap" style={{ maxHeight: 180, overflow: 'auto', marginTop: 8 }}>
                  <table className="uw-excel-table" style={{ fontSize: '0.75rem' }}>
                    <thead><tr>
                      <th>Period</th><th>Req</th><th>Rec</th><th>Iss</th><th>Used</th>
                    </tr></thead>
                    <tbody>
                      {dfData.rows.map((r) => (
                        <tr key={r.period}>
                          <td className="uw-bold">{r.period}</td>
                          <td>{r.requested}</td><td>{r.received}</td><td>{r.issued}</td><td>{r.used}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        {/* PER-PRODUCT */}
        <div className="uw-report-card">
          <h4><i className="bi bi-box"></i> Per-Product Report</h4>
          <div className="uw-form-row">
            <div style={{ flex: 2 }}>
              <label>Product</label>
              <select className="form-control" value={prProductId} onChange={(e) => setPrProductId(e.target.value)}>
                <option value="">— select product —</option>
                {(report.inventory || []).map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label>Period</label>
              <select className="form-control" value={prPeriod} onChange={(e) => setPrPeriod(e.target.value)}>
                {FLOW_PERIODS.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
              </select>
            </div>
          </div>
          <button className="uw-btn-primary" onClick={loadPR} disabled={prLoading} style={{ width: '100%' }}>
            <i className="bi bi-search"></i> {prLoading ? 'Loading…' : 'Generate'}
          </button>

          {prData && (
            <div style={{ marginTop: 12 }}>
              <div className="uw-card-actions">
                <button className="uw-btn-secondary" onClick={prPrint}><i className="bi bi-printer"></i> Print</button>
                <button className="uw-btn-secondary" onClick={prExportPDF}><i className="bi bi-file-earmark-pdf"></i> PDF</button>
                <button className="uw-btn-primary" onClick={prExportExcel}><i className="bi bi-file-earmark-excel"></i> Excel</button>
              </div>

              {prData.rows.length > 0 && (
                <div className="uw-table-wrap" style={{ maxHeight: 180, overflow: 'auto', marginTop: 8 }}>
                  <table className="uw-excel-table" style={{ fontSize: '0.75rem' }}>
                    <thead><tr>
                      <th>Period</th><th>Rec</th><th>In</th><th>Out</th><th>Used</th>
                    </tr></thead>
                    <tbody>
                      {prData.rows.map((r) => (
                        <tr key={r.period}>
                          <td className="uw-bold">{r.period}</td>
                          <td>{r.received_stock}</td><td>{r.stock_in}</td><td>{r.stock_out}</td><td>{r.used}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

      </div>

      {/* SCHEDULES */}
      {schedules.length > 0 && (
        <div className="uw-schedules uw-no-print">
          <h4 className="uw-schedules-title"><i className="bi bi-alarm"></i> Automatic Report Schedules</h4>
          <div className="uw-schedules-list">
            {schedules.map((s) => (
              <div key={s.id} className="uw-schedule-item">
                <span className={`uw-schedule-badge ${s.report_type}`}>{s.report_type}</span>
                <span className="uw-schedule-time"><i className="bi bi-clock"></i> {s.report_time}</span>
                <span className="uw-schedule-next">Next: {s.next_run_at ? new Date(s.next_run_at).toLocaleString() : '—'}</span>
                <button className="uw-icon-btn purple" onClick={() => openEditSchedule(s)} title="Edit schedule">
                  <i className="bi bi-pencil-fill"></i>
                </button>
                <button className="uw-icon-btn red" onClick={() => askDeleteSchedule(s)} title="Delete schedule">
                  <i className="bi bi-trash"></i>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* AUTO MODAL */}
      {showAutoModal && (
        <div className="uw-modal-overlay" onClick={() => setShowAutoModal(false)}>
          <div className="uw-modal" onClick={(e) => e.stopPropagation()}>
            <div className="uw-modal-head">
              <h4><i className="bi bi-alarm"></i> Automatic Report</h4>
              <button onClick={() => setShowAutoModal(false)}><i className="bi bi-x-lg"></i></button>
            </div>
            <div className="uw-modal-body">
              {autoStep === 1 && (
                <>
                  <p className="uw-auto-q">How often should the report be generated?</p>
                  <div className="uw-auto-options">
                    {PERIODS.map((p) => (
                      <button key={p.key} className={`uw-auto-option ${autoPeriod === p.key ? 'active' : ''}`} onClick={() => setAutoPeriod(p.key)}>
                        <i className={`bi ${p.icon}`}></i> {p.label}
                      </button>
                    ))}
                  </div>
                </>
              )}
              {autoStep === 2 && (
                <>
                  <p className="uw-auto-q">At what time should the <strong>{autoPeriod}</strong> report be generated?</p>
                  <input type="time" className="form-control" value={autoTime} onChange={(e) => setAutoTime(e.target.value)} />
                  <p className="uw-auto-hint">The report will be sent to your <strong>Documents/Logistic Reports</strong> folder and saved to the system.</p>
                </>
              )}
              {autoStep === 3 && (
                <>
                  <p className="uw-auto-q">Confirm the schedule</p>
                  <div className="uw-auto-confirm">
                    <div><strong>Frequency:</strong> {autoPeriod}</div>
                    <div><strong>Time:</strong> {autoTime}</div>
                    <div><strong>Recipient:</strong> {user?.full_name}</div>
                    <div><strong>Folder:</strong> Documents/Logistic Reports</div>
                  </div>
                </>
              )}
              <div className="uw-modal-actions">
                {autoStep > 1 && (
                  <button className="uw-btn-secondary" onClick={() => setAutoStep(autoStep - 1)} disabled={savingSchedule}>
                    <i className="bi bi-arrow-left"></i> Back
                  </button>
                )}
                {autoStep < 3 && (
                  <button className="uw-btn-primary" onClick={() => setAutoStep(autoStep + 1)}>Next <i className="bi bi-arrow-right"></i></button>
                )}
                {autoStep === 3 && (
                  <button className="uw-btn-primary" onClick={saveAutomaticSchedule} disabled={savingSchedule}>
                    <i className="bi bi-check2-circle"></i> {savingSchedule ? 'Saving…' : 'Save & Generate'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* EDIT SCHEDULE */}
      {editSchedule && (
        <div className="uw-modal-overlay" onClick={closeEditSchedule}>
          <div className="uw-modal" onClick={(e) => e.stopPropagation()}>
            <div className="uw-modal-head">
              <h4><i className="bi bi-pencil-square"></i> Edit Schedule #{editSchedule.id}</h4>
              <button onClick={closeEditSchedule}><i className="bi bi-x-lg"></i></button>
            </div>
            <div className="uw-modal-body">
              <p className="uw-auto-q">Frequency</p>
              <div className="uw-auto-options">
                {PERIODS.map((p) => (
                  <button key={p.key} className={`uw-auto-option ${editPeriod === p.key ? 'active' : ''}`} onClick={() => setEditPeriod(p.key)}>
                    <i className={`bi ${p.icon}`}></i> {p.label}
                  </button>
                ))}
              </div>
              <p className="uw-auto-q" style={{ marginTop: 16 }}>Time</p>
              <input type="time" className="form-control" value={editTime} onChange={(e) => setEditTime(e.target.value)} />
              <p className="uw-auto-hint">
                <strong>Current:</strong> {editSchedule.report_type} at {editSchedule.report_time}<br />
                <strong>New:</strong> {editPeriod} at {editTime}
              </p>
              <div className="uw-modal-actions">
                <button className="uw-btn-secondary" onClick={closeEditSchedule} disabled={savingEdit}>Cancel</button>
                <button className="uw-btn-primary" onClick={saveEditedSchedule} disabled={savingEdit}>
                  <i className="bi bi-check2-circle"></i> {savingEdit ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DELETE CONFIRM */}
      {confirmDelete && (
        <div className="uw-modal-overlay" onClick={cancelDelete}>
          <div className="uw-modal uw-modal-danger" onClick={(e) => e.stopPropagation()}>
            <div className="uw-modal-head uw-modal-head-danger">
              <h4><i className="bi bi-exclamation-triangle-fill"></i> Delete Schedule?</h4>
              <button onClick={cancelDelete}><i className="bi bi-x-lg"></i></button>
            </div>
            <div className="uw-modal-body">
              <p className="uw-confirm-q">Are you sure you want to delete this automatic report schedule?</p>
              <div className="uw-confirm-details">
                <div><strong>Frequency:</strong> <span className={`uw-schedule-badge ${confirmDelete.report_type}`}>{confirmDelete.report_type}</span></div>
                <div><strong>Time:</strong> {confirmDelete.report_time}</div>
                <div><strong>Next run:</strong> {confirmDelete.next_run_at ? new Date(confirmDelete.next_run_at).toLocaleString() : '—'}</div>
              </div>
              <p className="uw-confirm-warn"><i className="bi bi-info-circle"></i> This action cannot be undone.</p>
              <div className="uw-modal-actions">
                <button className="uw-btn-secondary" onClick={cancelDelete} disabled={deletingSchedule}>Cancel</button>
                <button className="uw-btn-danger" onClick={confirmDeleteSchedule} disabled={deletingSchedule}>
                  <i className="bi bi-trash"></i> {deletingSchedule ? 'Deleting…' : 'Delete Schedule'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}