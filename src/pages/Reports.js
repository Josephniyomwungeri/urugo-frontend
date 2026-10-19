import React, { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { API_URL, useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import './Reports.css';

/* ------------------------------------------------------------------
   Helpers
   ------------------------------------------------------------------ */
const formatCellValue = (key, value) => {
  if (value === null || value === undefined || value === '') return '—';
  if (key.includes('date') || key.includes('_at')) {
    try {
      const d = new Date(value);
      if (isNaN(d.getTime())) return String(value);
      return d.toLocaleString();
    } catch {
      return String(value);
    }
  }
  if (key === 'total_value' || key === 'unit_price') {
    const n = Number(value);
    if (!isNaN(n)) return n.toFixed(2);
  }
  return String(value);
};

const humanizeKey = (key) => {
  // Special-case names so they read nicely
  const map = {
    received_by_name: 'Received By',
    issued_to: 'Issued To',
    approved_by_name: 'Approved By',
    received_by: 'Received By (ID)',
    approved_by: 'Approved By (ID)',
    created_at: 'Created At',
    updated_at: 'Updated At',
    unit_price: 'Unit Price',
    total_value: 'Total Value',
    product_name: 'Product',
    staff_name: 'Staff',
    reviewer_name: 'Reviewer',
  };
  if (map[key]) return map[key];
  return key.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
};

/* Preferred column ordering per tab so related columns stay together */
const COLUMN_ORDER = {
  out: [
    'id', 'created_at', 'product_name', 'quantity', 'unit',
    'issued_to', 'department', 'received_by_name',
    'approved_by_name', 'notes',
  ],
  in: [
    'id', 'created_at', 'product_name', 'quantity', 'unit',
    'donor_supplier', 'batch_number', 'expiry_date',
    'received_by_name', 'notes',
  ],
};

const sortColumns = (columns, tabKey) => {
  const order = COLUMN_ORDER[tabKey];
  if (!order) return columns;
  const known = order.filter((c) => columns.includes(c));
  const extras = columns.filter((c) => !order.includes(c));
  return [...known, ...extras];
};

const PERIODS = [
  { key: 'daily',   label: 'Daily',   icon: 'bi-calendar-day' },
  { key: 'monthly', label: 'Monthly', icon: 'bi-calendar-month' },
  { key: 'annual',  label: 'Annual',  icon: 'bi-calendar-range' },
];

/* ------------------------------------------------------------------
   IndexedDB — remember the "Logistic Reports" folder handle
   ------------------------------------------------------------------ */
const IDB_NAME = 'urugo_woc';
const IDB_STORE = 'handles';
const IDB_KEY = 'logistic_reports_folder';

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbGet(key) {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const req = tx.objectStore(IDB_STORE).get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

async function idbSet(key, value) {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).put(value, key);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------------
   Folder access
   ------------------------------------------------------------------ */
async function getOrCreateFolder() {
  if (!window.showDirectoryPicker) {
    return { folder: null, kind: 'download' };
  }

  try {
    const saved = await idbGet(IDB_KEY);
    if (saved) {
      const perm = await saved.queryPermission({ mode: 'readwrite' });
      if (perm === 'granted') {
        return { folder: saved, kind: 'fs' };
      }
      try {
        const ask = await saved.requestPermission({ mode: 'readwrite' });
        if (ask === 'granted') {
          return { folder: saved, kind: 'fs' };
        }
      } catch { /* user denied — fall through */ }
    }
  } catch { /* ignore */ }

  try {
    const docs = await window.showDirectoryPicker({ mode: 'readwrite' });
    const folder = await docs.getDirectoryHandle('Logistic Reports', {
      create: true,
    });
    await idbSet(IDB_KEY, folder);
    return { folder, kind: 'fs' };
  } catch (err) {
    if (err.name === 'AbortError') {
      return { folder: null, kind: 'download' };
    }
    return { folder: null, kind: 'download' };
  }
}

async function saveBlobToFolder(blob, filename, folder) {
  if (!folder) return false;
  const fileHandle = await folder.getFileHandle(filename, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(blob);
  await writable.close();
  return true;
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

/* ------------------------------------------------------------------
   Component
   ------------------------------------------------------------------ */
export default function Reports() {
  const { user } = useAuth();
  const { showToast } = useNotifications();

  const [report, setReport] = useState(null);
  const [tab, setTab] = useState('inventory');
  const [period, setPeriod] = useState('monthly');
  const [exporting, setExporting] = useState(false);
  const [loading, setLoading] = useState(true);

  /* --- Automatic report (create) --- */
  const [showAutoModal, setShowAutoModal] = useState(false);
  const [autoPeriod, setAutoPeriod] = useState('daily');
  const [autoTime, setAutoTime] = useState('08:00');
  const [autoStep, setAutoStep] = useState(1);
  const [savingSchedule, setSavingSchedule] = useState(false);

  /* --- Edit schedule --- */
  const [editSchedule, setEditSchedule] = useState(null);
  const [editPeriod, setEditPeriod] = useState('daily');
  const [editTime, setEditTime] = useState('08:00');
  const [savingEdit, setSavingEdit] = useState(false);

  /* --- Delete confirmation modal --- */
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [deletingSchedule, setDeletingSchedule] = useState(false);

  /* --- Existing schedules --- */
  const [schedules, setSchedules] = useState([]);

  /* --- Folder handle cache (in-memory) --- */
  const folderRef = useRef(null);

  /* ---------------- Load ---------------- */
  const load = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_URL}/reports/advanced`, {
        params: { period },
      });
      setReport(res.data);
    } catch {
      showToast('Failed to load report', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadSchedules = async () => {
    try {
      const res = await axios.get(`${API_URL}/reports/schedule`);
      setSchedules(res.data);
    } catch { /* silent */ }
  };

  useEffect(() => {
    load();
    loadSchedules();
  }, [period]);

  useEffect(() => {
    const handler = () => { load(); loadSchedules(); };
    window.addEventListener('uw:refresh', handler);
    return () => window.removeEventListener('uw:refresh', handler);
  }, [period]);

  if (loading && !report) return <div className="uw-loading">Loading reports...</div>;
  if (!report) return <div className="uw-loading">No report data</div>;

  const tabs = [
    { key: 'inventory', label: 'Inventory', icon: 'bi-box-seam',             data: report.inventory || [] },
    { key: 'in',        label: 'Stock In',  icon: 'bi-box-arrow-in-down',    data: report.stockIn   || [] },
    { key: 'out',       label: 'Stock Out', icon: 'bi-box-arrow-up',         data: report.stockOut  || [] },
    { key: 'losses',    label: 'Losses',    icon: 'bi-exclamation-triangle', data: report.losses    || [] },
    { key: 'usage',     label: 'Usage',     icon: 'bi-clipboard-data',       data: report.usage     || [] },
  ];

  const activeTab  = tabs.find((t) => t.key === tab);
  const activeData = activeTab.data;

  /* Build a nicely-ordered column list, including the new received_by_name */
  const rawColumns =
    activeData.length > 0
      ? Array.from(new Set(activeData.flatMap((row) => Object.keys(row))))
      : [];
  const columns = sortColumns(rawColumns, activeTab.key);

  /* ---------------- Filename + title ---------------- */
  const buildFilename = (ext) => {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const stamp =
      `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}` +
      `_${pad(now.getHours())}-${pad(now.getMinutes())}`;
    const userPart = (user?.full_name || 'User').replace(/\s+/g, '_');
    return `Logistic_${period}_Report_${userPart}_${stamp}.${ext}`;
  };

  const buildTitle = () =>
    `Logistic Report — ${period.charAt(0).toUpperCase() + period.slice(1)}`;

  /* ---------------- Log to backend ---------------- */
  const logGenerated = async ({ fileName, format, savedToPc, payload }) => {
    try {
      await axios.post(`${API_URL}/reports/generated`, {
        report_type: period,
        title: buildTitle(),
        file_name: fileName,
        file_format: format,
        saved_to_pc: savedToPc ? 1 : 0,
        payload: payload || null,
      });
    } catch { /* silent */ }
  };

  /* ---------------- Save or download ---------------- */
  const persistFile = async (blob, filename) => {
    let folder = folderRef.current;

    if (!folder) {
      const target = await getOrCreateFolder();
      if (target && target.kind === 'fs') {
        folder = target.folder;
        folderRef.current = folder;
      }
    }

    let saved = false;
    if (folder) {
      try {
        saved = await saveBlobToFolder(blob, filename, folder);
      } catch (err) {
        folderRef.current = null;
        const target = await getOrCreateFolder();
        if (target && target.kind === 'fs') {
          folderRef.current = target.folder;
          try {
            saved = await saveBlobToFolder(blob, filename, target.folder);
          } catch { saved = false; }
        }
      }
    }

    if (!saved) downloadBlob(blob, filename);
    return saved;
  };

  /* ============ EXPORT EXCEL ============ */
  const exportExcel = async () => {
    if (!activeData || activeData.length === 0) {
      showToast('No data to export', 'warning');
      return;
    }
    try {
      const headers = columns.map((h) => humanizeKey(h));
      const rows = activeData.map((row) =>
        columns.map((h) => formatCellValue(h, row[h]))
      );
      const aoa = [headers, ...rows];
      const ws = XLSX.utils.aoa_to_sheet(aoa);

      ws['!cols'] = headers.map((h, i) => ({
        wch: Math.min(
          Math.max(h.length, ...rows.map((r) => String(r[i] ?? '').length)) + 2,
          40
        ),
      }));
      ws['!freeze'] = { xSplit: 0, ySplit: 1 };

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, activeTab.label.slice(0, 30));

      const fileName = buildFilename('xlsx');
      const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([wbout], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });

      const saved = await persistFile(blob, fileName);

      await logGenerated({
        fileName,
        format: 'xlsx',
        savedToPc: saved,
        payload: { tab: activeTab.key, count: activeData.length },
      });

      showToast(
        saved
          ? `Saved to Documents/Logistic Reports/${fileName}`
          : 'Excel downloaded',
        'success'
      );
    } catch (err) {
      showToast('Excel export failed: ' + err.message, 'error');
    }
  };

  /* ============ EXPORT PDF ============ */
  const exportPDF = async () => {
    if (!activeData || activeData.length === 0) {
      showToast('No data to export', 'warning');
      return;
    }
    try {
      setExporting(true);
      const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });

      doc.setFontSize(18);
      doc.setTextColor(10, 31, 68);
      doc.setFont('helvetica', 'bold');
      doc.text('URUGO WOMEN OPPORTUNITY CENTER, LLC', 40, 40);
      doc.setFontSize(14);
      doc.text('Logistic Report', 40, 62);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(90, 90, 90);
      doc.text(`Period: ${period.charAt(0).toUpperCase() + period.slice(1)}`, 40, 82);
      doc.text(`Generated by: ${user?.full_name || '—'} (${user?.role || ''})`, 40, 96);
      doc.text(`Generated on: ${new Date().toLocaleString()}`, 40, 110);
      doc.text(`Table: ${activeTab.label} — ${activeData.length} record(s)`, 40, 124);

      if (report.totals) {
        const t = report.totals;
        doc.setFontSize(10);
        doc.setTextColor(10, 31, 68);
        doc.setFont('helvetica', 'bold');
        doc.text(
          `Total Inventory Value: ${Number(t.inventoryValue).toFixed(2)}  |  ` +
          `Stock In: ${t.stockIn}  |  Stock Out: ${t.stockOut}  |  Losses: ${t.losses}`,
          40, 142
        );
      }

      autoTable(doc, {
        head: [columns.map((h) => humanizeKey(h))],
        body: activeData.map((row) =>
          columns.map((h) => formatCellValue(h, row[h]))
        ),
        startY: 160,
        styles: {
          fontSize: 8,
          cellPadding: 4,
          lineColor: [200, 200, 200],
          lineWidth: 0.5,
          textColor: [30, 30, 30],
        },
        headStyles: {
          fillColor: [10, 31, 68],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          halign: 'left',
        },
        alternateRowStyles: { fillColor: [246, 248, 251] },
        margin: { top: 160, left: 30, right: 30, bottom: 40 },
        theme: 'grid',
        didDrawPage: () => {
          const pageSize = doc.internal.pageSize;
          const pageHeight = pageSize.height || pageSize.getHeight();
          doc.setFontSize(9);
          doc.setTextColor(150);
          doc.text(
            `Urugo Woc Logistic System — Logistic Report — Page ` +
            `${doc.internal.getCurrentPageInfo().pageNumber}`,
            pageSize.width / 2,
            pageHeight - 20,
            { align: 'center' }
          );
        },
      });

      const fileName = buildFilename('pdf');
      const pdfBlob = doc.output('blob');

      const saved = await persistFile(pdfBlob, fileName);

      await logGenerated({
        fileName,
        format: 'pdf',
        savedToPc: saved,
        payload: { tab: activeTab.key, count: activeData.length },
      });

      showToast(
        saved
          ? `Saved to Documents/Logistic Reports/${fileName}`
          : 'PDF downloaded',
        'success'
      );
    } catch (err) {
      showToast('PDF export failed: ' + err.message, 'error');
    } finally {
      setExporting(false);
    }
  };

  /* ============ PRINT ============ */
  const printReport = () => window.print();

  /* ============ AUTOMATIC REPORT — CREATE ============ */
  const openAutoModal = () => {
    setAutoStep(1);
    setAutoPeriod('daily');
    setAutoTime('08:00');
    setShowAutoModal(true);
  };

  const saveAutomaticSchedule = async () => {
    setSavingSchedule(true);
    try {
      const res = await axios.post(`${API_URL}/reports/schedule`, {
        report_type: autoPeriod,
        report_time: autoTime,
      });
      showToast(
        `Automatic ${autoPeriod} report scheduled for ${autoTime}`,
        'success'
      );
      setShowAutoModal(false);
      loadSchedules();
      await generateAutomaticReportNow(autoPeriod, res.data.id);
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to schedule', 'error');
    } finally {
      setSavingSchedule(false);
    }
  };

  const generateAutomaticReportNow = async (reportPeriod, scheduleId) => {
    try {
      const res = await axios.get(`${API_URL}/reports/advanced`, {
        params: { period: reportPeriod },
      });
      const data = res.data;

      const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(10, 31, 68);
      doc.text('URUGO WOMEN OPPORTUNITY CENTER, LLC', 40, 40);
      doc.setFontSize(14);
      doc.text('Logistic Report', 40, 62);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(90, 90, 90);
      doc.text(
        `Auto Report — ${reportPeriod.charAt(0).toUpperCase() + reportPeriod.slice(1)}`,
        40, 82
      );
      doc.text(`Generated by: ${user?.full_name || '—'}`, 40, 96);
      doc.text(`Generated on: ${new Date().toLocaleString()}`, 40, 110);
      doc.text(`Schedule ID: #${scheduleId}`, 40, 124);

      const t = data.totals;
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(10, 31, 68);
      doc.text(
        `Total Inventory Value: ${Number(t.inventoryValue).toFixed(2)}  |  ` +
        `Stock In: ${t.stockIn}  |  Stock Out: ${t.stockOut}  |  Losses: ${t.losses}`,
        40, 142
      );

      const invRows = data.inventory.map((p) => [
        p.name, p.category, p.unit, p.quantity,
        Number(p.unit_price).toFixed(2), p.currency,
        Number(p.total_value).toFixed(2), p.supplier || '—',
      ]);
      autoTable(doc, {
        head: [[
          'Product', 'Category', 'Unit', 'Qty',
          'Unit Price', 'Currency', 'Total Value', 'Supplier',
        ]],
        body: invRows,
        startY: 160,
        styles: { fontSize: 8, cellPadding: 4 },
        headStyles: { fillColor: [10, 31, 68], textColor: 255, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [246, 248, 251] },
        margin: { top: 160, left: 30, right: 30, bottom: 40 },
        theme: 'grid',
      });

      const now = new Date();
      const pad = (n) => String(n).padStart(2, '0');
      const stamp =
        `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}` +
        `_${pad(now.getHours())}-${pad(now.getMinutes())}`;
      const userPart = (user?.full_name || 'User').replace(/\s+/g, '_');
      const fileName =
        `Logistic_${reportPeriod}_Report_${userPart}_${stamp}.pdf`;

      const pdfBlob = doc.output('blob');
      const saved = await persistFile(pdfBlob, fileName);

      await logGenerated({
        fileName,
        format: 'pdf',
        savedToPc: saved,
        payload: { automatic: true, scheduleId, period: reportPeriod },
      });

      showToast(
        saved
          ? `Auto report saved: Logistic Reports/${fileName}`
          : `Auto report downloaded: ${fileName}`,
        'success'
      );
    } catch (err) {
      showToast('Auto report failed: ' + err.message, 'error');
    }
  };

  /* ============ SCHEDULE — DELETE ============ */
  const askDeleteSchedule = (s) => {
    setConfirmDelete(s);
  };

  const cancelDelete = () => {
    if (deletingSchedule) return;
    setConfirmDelete(null);
  };

  const confirmDeleteSchedule = async () => {
    if (!confirmDelete) return;
    setDeletingSchedule(true);
    try {
      await axios.delete(`${API_URL}/reports/schedule/${confirmDelete.id}`);
      showToast(
        `Schedule deleted — ${confirmDelete.report_type} at ${confirmDelete.report_time}`,
        'success'
      );
      setConfirmDelete(null);
      loadSchedules();
    } catch (err) {
      showToast(
        err.response?.data?.error || 'Failed to delete schedule',
        'error'
      );
    } finally {
      setDeletingSchedule(false);
    }
  };

  /* ============ SCHEDULE — EDIT ============ */
  const openEditSchedule = (s) => {
    setEditSchedule(s);
    setEditPeriod(s.report_type);
    setEditTime(s.report_time);
  };

  const closeEditSchedule = () => {
    setEditSchedule(null);
    setSavingEdit(false);
  };

  const saveEditedSchedule = async () => {
    if (!editSchedule) return;
    setSavingEdit(true);
    try {
      await axios.put(`${API_URL}/reports/schedule/${editSchedule.id}`, {
        report_type: editPeriod,
        report_time: editTime,
      });
      showToast(
        `Schedule updated: ${editPeriod} at ${editTime}`,
        'success'
      );
      closeEditSchedule();
      loadSchedules();
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to update', 'error');
    } finally {
      setSavingEdit(false);
    }
  };

  /* ============ RENDER ============ */
  return (
    <div className="uw-rp">
      {/* Header */}
      <div className="uw-page-header uw-no-print">
        <h2 className="uw-page-title">
          <i className="bi bi-file-earmark-bar-graph"></i> Reports
        </h2>
        <div className="uw-header-actions">
          <button className="uw-btn-secondary" onClick={printReport}>
            <i className="bi bi-printer"></i> Print
          </button>
          <button
            className="uw-btn-secondary"
            onClick={exportPDF}
            disabled={exporting}
          >
            <i className="bi bi-file-earmark-pdf"></i>{' '}
            {exporting ? 'Generating…' : 'Export PDF'}
          </button>
          <button className="uw-btn-primary" onClick={exportExcel}>
            <i className="bi bi-file-earmark-excel"></i> Export Excel
          </button>
          <button
            className="uw-btn-primary uw-btn-auto"
            onClick={openAutoModal}
            title="Set up an automatic report"
          >
            <i className="bi bi-alarm"></i> Automatic Report
          </button>
        </div>
      </div>

      {/* Period selector */}
      <div className="uw-period-tabs uw-no-print">
        <span className="uw-period-label">Period:</span>
        {PERIODS.map((p) => (
          <button
            key={p.key}
            className={`uw-period-btn ${period === p.key ? 'active' : ''}`}
            onClick={() => setPeriod(p.key)}
          >
            <i className={`bi ${p.icon}`}></i> {p.label}
          </button>
        ))}
        <span className="uw-period-info">
          {report.startDate
            ? `From ${new Date(report.startDate).toLocaleDateString()} → today`
            : 'All records'}
        </span>
      </div>

      {/* Summary cards */}
      <div className="uw-report-summary">
        <div className="uw-summary-card">
          <div className="uw-summary-icon blue"><i className="bi bi-cash-stack"></i></div>
          <div>
            <div className="uw-summary-label">Inventory Value</div>
            <div className="uw-summary-value">
              {Number(report.totals?.inventoryValue || 0).toFixed(2)}
            </div>
          </div>
        </div>
        <div className="uw-summary-card">
          <div className="uw-summary-icon green"><i className="bi bi-box-arrow-in-down"></i></div>
          <div>
            <div className="uw-summary-label">Stock In</div>
            <div className="uw-summary-value">{report.totals?.stockIn || 0}</div>
          </div>
        </div>
        <div className="uw-summary-card">
          <div className="uw-summary-icon orange"><i className="bi bi-box-arrow-up"></i></div>
          <div>
            <div className="uw-summary-label">Stock Out</div>
            <div className="uw-summary-value">{report.totals?.stockOut || 0}</div>
          </div>
        </div>
        <div className="uw-summary-card">
          <div className="uw-summary-icon red"><i className="bi bi-exclamation-triangle"></i></div>
          <div>
            <div className="uw-summary-label">Losses</div>
            <div className="uw-summary-value">{report.totals?.losses || 0}</div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="uw-report-tabs uw-no-print">
        {tabs.map((t) => (
          <button
            key={t.key}
            className={`uw-report-tab ${tab === t.key ? 'active' : ''}`}
            onClick={() => setTab(t.key)}
          >
            <i className={`bi ${t.icon}`}></i> {t.label}
            <span className="uw-tab-count">{t.data.length}</span>
          </button>
        ))}
      </div>

      {/* Print-only header */}
      <div className="uw-print-header">
        <div className="uw-print-title">Urugo Woc Logistics System</div>
        <div className="uw-print-subtitle">
          Logistic Report — {period.charAt(0).toUpperCase() + period.slice(1)} — {new Date().toLocaleString()}
        </div>
      </div>

      {/* Table */}
      <div className="uw-table-wrap uw-print-table-wrap">
        <table className="uw-excel-table uw-print-table">
          <thead>
            <tr>
              {columns.map((k) => (
                <th key={k}>{humanizeKey(k)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {activeData.map((row, i) => (
              <tr key={i}>
                {columns.map((k) => (
                  <td key={k}>{formatCellValue(k, row[k])}</td>
                ))}
              </tr>
            ))}
            {activeData.length === 0 && (
              <tr>
                <td className="uw-no-data" colSpan={columns.length || 1}>
                  No data
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Print-only footer */}
      <div className="uw-print-footer">
        <span>Urugo Woc Logistics System — Confidential</span>
        <span>{new Date().toLocaleDateString()}</span>
      </div>

      {/* Existing schedules */}
      {schedules.length > 0 && (
        <div className="uw-schedules uw-no-print">
          <h4 className="uw-schedules-title">
            <i className="bi bi-alarm"></i> Automatic Report Schedules
          </h4>
          <div className="uw-schedules-list">
            {schedules.map((s) => (
              <div key={s.id} className="uw-schedule-item">
                <span className={`uw-schedule-badge ${s.report_type}`}>
                  {s.report_type}
                </span>
                <span className="uw-schedule-time">
                  <i className="bi bi-clock"></i> {s.report_time}
                </span>
                <span className="uw-schedule-next">
                  Next: {s.next_run_at ? new Date(s.next_run_at).toLocaleString() : '—'}
                </span>
                <button
                  className="uw-icon-btn purple"
                  onClick={() => openEditSchedule(s)}
                  title="Edit schedule"
                >
                  <i className="bi bi-pencil-fill"></i>
                </button>
                <button
                  className="uw-icon-btn red"
                  onClick={() => askDeleteSchedule(s)}
                  title="Delete schedule"
                >
                  <i className="bi bi-trash"></i>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ============ CREATE Automatic Report Modal ============ */}
      {showAutoModal && (
        <div className="uw-modal-overlay" onClick={() => setShowAutoModal(false)}>
          <div className="uw-modal" onClick={(e) => e.stopPropagation()}>
            <div className="uw-modal-head">
              <h4>
                <i className="bi bi-alarm"></i> Automatic Report
              </h4>
              <button onClick={() => setShowAutoModal(false)}>
                <i className="bi bi-x-lg"></i>
              </button>
            </div>
            <div className="uw-modal-body">
              {autoStep === 1 && (
                <>
                  <p className="uw-auto-q">
                    How often should the report be generated?
                  </p>
                  <div className="uw-auto-options">
                    {PERIODS.map((p) => (
                      <button
                        key={p.key}
                        className={`uw-auto-option ${autoPeriod === p.key ? 'active' : ''}`}
                        onClick={() => setAutoPeriod(p.key)}
                      >
                        <i className={`bi ${p.icon}`}></i> {p.label}
                      </button>
                    ))}
                  </div>
                </>
              )}

              {autoStep === 2 && (
                <>
                  <p className="uw-auto-q">
                    At what time should the <strong>{autoPeriod}</strong> report be generated?
                  </p>
                  <input
                    type="time"
                    className="form-control"
                    value={autoTime}
                    onChange={(e) => setAutoTime(e.target.value)}
                  />
                  <p className="uw-auto-hint">
                    The report will be sent to your <strong>Documents/Logistic Reports</strong> folder and saved to the system.
                  </p>
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
                  <button
                    className="uw-btn-secondary"
                    onClick={() => setAutoStep(autoStep - 1)}
                    disabled={savingSchedule}
                  >
                    <i className="bi bi-arrow-left"></i> Back
                  </button>
                )}
                {autoStep < 3 && (
                  <button
                    className="uw-btn-primary"
                    onClick={() => setAutoStep(autoStep + 1)}
                  >
                    Next <i className="bi bi-arrow-right"></i>
                  </button>
                )}
                {autoStep === 3 && (
                  <button
                    className="uw-btn-primary"
                    onClick={saveAutomaticSchedule}
                    disabled={savingSchedule}
                  >
                    <i className="bi bi-check2-circle"></i>{' '}
                    {savingSchedule ? 'Saving…' : 'Save & Generate'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============ EDIT Schedule Modal ============ */}
      {editSchedule && (
        <div className="uw-modal-overlay" onClick={closeEditSchedule}>
          <div className="uw-modal" onClick={(e) => e.stopPropagation()}>
            <div className="uw-modal-head">
              <h4>
                <i className="bi bi-pencil-square"></i> Edit Schedule #{editSchedule.id}
              </h4>
              <button onClick={closeEditSchedule}>
                <i className="bi bi-x-lg"></i>
              </button>
            </div>
            <div className="uw-modal-body">
              <p className="uw-auto-q">Frequency</p>
              <div className="uw-auto-options">
                {PERIODS.map((p) => (
                  <button
                    key={p.key}
                    className={`uw-auto-option ${editPeriod === p.key ? 'active' : ''}`}
                    onClick={() => setEditPeriod(p.key)}
                  >
                    <i className={`bi ${p.icon}`}></i> {p.label}
                  </button>
                ))}
              </div>

              <p className="uw-auto-q" style={{ marginTop: 16 }}>
                Time
              </p>
              <input
                type="time"
                className="form-control"
                value={editTime}
                onChange={(e) => setEditTime(e.target.value)}
              />

              <p className="uw-auto-hint">
                <strong>Current:</strong> {editSchedule.report_type} at {editSchedule.report_time}
                <br />
                <strong>New:</strong> {editPeriod} at {editTime}
              </p>

              <div className="uw-modal-actions">
                <button
                  className="uw-btn-secondary"
                  onClick={closeEditSchedule}
                  disabled={savingEdit}
                >
                  Cancel
                </button>
                <button
                  className="uw-btn-primary"
                  onClick={saveEditedSchedule}
                  disabled={savingEdit}
                >
                  <i className="bi bi-check2-circle"></i>{' '}
                  {savingEdit ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============ DELETE Confirmation Modal ============ */}
      {confirmDelete && (
        <div className="uw-modal-overlay" onClick={cancelDelete}>
          <div
            className="uw-modal uw-modal-danger"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="uw-modal-head uw-modal-head-danger">
              <h4>
                <i className="bi bi-exclamation-triangle-fill"></i> Delete Schedule?
              </h4>
              <button onClick={cancelDelete}>
                <i className="bi bi-x-lg"></i>
              </button>
            </div>
            <div className="uw-modal-body">
              <p className="uw-confirm-q">
                Are you sure you want to delete this automatic report schedule?
              </p>
              <div className="uw-confirm-details">
                <div>
                  <strong>Frequency:</strong>{' '}
                  <span className={`uw-schedule-badge ${confirmDelete.report_type}`}>
                    {confirmDelete.report_type}
                  </span>
                </div>
                <div>
                  <strong>Time:</strong> {confirmDelete.report_time}
                </div>
                <div>
                  <strong>Next run:</strong>{' '}
                  {confirmDelete.next_run_at
                    ? new Date(confirmDelete.next_run_at).toLocaleString()
                    : '—'}
                </div>
              </div>
              <p className="uw-confirm-warn">
                <i className="bi bi-info-circle"></i> This action cannot be undone.
              </p>

              <div className="uw-modal-actions">
                <button
                  className="uw-btn-secondary"
                  onClick={cancelDelete}
                  disabled={deletingSchedule}
                >
                  Cancel
                </button>
                <button
                  className="uw-btn-danger"
                  onClick={confirmDeleteSchedule}
                  disabled={deletingSchedule}
                >
                  <i className="bi bi-trash"></i>{' '}
                  {deletingSchedule ? 'Deleting…' : 'Delete Schedule'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}