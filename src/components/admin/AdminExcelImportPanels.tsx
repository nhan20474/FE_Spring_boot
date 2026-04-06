import React, { useState } from 'react';
import {
  adminDownloadProductImportTemplate,
  adminDownloadUserImportTemplate,
  adminImportProductsExcel,
  adminImportUsersExcel,
  type ExcelImportResult,
} from '@/services/backend';

const fileAccept = '.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

function ExcelImportResultBlock({ result }: { result: ExcelImportResult | null }) {
  if (!result) return null;
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 text-sm">
      <p className="font-bold text-slate-800 mb-2">Kết quả import</p>
      <p className="text-slate-600">
        Đã xử lý: <strong>{result.totalRows}</strong> dòng — thành công:{' '}
        <strong className="text-emerald-600">{result.successCount}</strong>, lỗi:{' '}
        <strong className="text-red-600">{result.errorCount}</strong>
      </p>
      {result.errors.length > 0 && (
        <ul className="mt-2 max-h-48 overflow-y-auto space-y-1 text-xs text-red-800">
          {result.errors.map((e, i) => (
            <li key={i}>
              {e.row > 0 ? `Dòng ${e.row}: ` : ''}
              {e.message}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const toolbarBtnSecondary =
  'inline-flex items-center justify-center px-3 py-2 rounded-xl bg-slate-100 text-slate-800 text-sm font-semibold hover:bg-slate-200 shrink-0';
const toolbarBtnPrimary =
  'inline-flex items-center justify-center px-3 py-2 rounded-xl bg-primary text-white text-sm font-semibold disabled:opacity-50 shrink-0';

// ——— Products ———

export function useAdminProductExcelImport(onImportSuccess?: () => void) {
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<ExcelImportResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const downloadTemplate = () => {
    adminDownloadProductImportTemplate().catch((e) => setErr(String(e)));
  };

  const runImport = async () => {
    if (!file) {
      setErr('Chọn file .xlsx');
      return;
    }
    setErr(null);
    setResult(null);
    setLoading(true);
    try {
      const r = await adminImportProductsExcel(file);
      setResult(r);
      if (r.successCount > 0) onImportSuccess?.();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Lỗi import');
    } finally {
      setLoading(false);
    }
  };

  return { file, setFile, result, err, loading, downloadTemplate, runImport, setErr };
}

export type AdminProductExcelImport = ReturnType<typeof useAdminProductExcelImport>;

export const AdminProductExcelImportToolbar: React.FC<AdminProductExcelImport> = ({
  file,
  setFile,
  loading,
  downloadTemplate,
  runImport,
}) => (
  <div className="flex flex-wrap items-center gap-2">
    <button type="button" onClick={downloadTemplate} className={toolbarBtnSecondary}>
      Tải mẫu Excel
    </button>
    <input
      type="file"
      accept={fileAccept}
      onChange={(e) => setFile(e.target.files?.[0] ?? null)}
      className="text-sm max-w-[200px] sm:max-w-none"
    />
    <button type="button" disabled={loading} onClick={() => void runImport()} className={toolbarBtnPrimary}>
      {loading ? 'Đang import…' : 'Import SP'}
    </button>
  </div>
);

export const AdminProductExcelImportMeta: React.FC<AdminProductExcelImport> = ({ err, result }) => (
  <div className="space-y-3">
    {err && <p className="text-sm text-red-600">{err}</p>}
    <ExcelImportResultBlock result={result} />
  </div>
);

// ——— Users ———

export function useAdminUserExcelImport(onImportSuccess?: () => void) {
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<ExcelImportResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const downloadTemplate = () => {
    adminDownloadUserImportTemplate().catch((e) => setErr(String(e)));
  };

  const runImport = async () => {
    if (!file) {
      setErr('Chọn file .xlsx');
      return;
    }
    setErr(null);
    setResult(null);
    setLoading(true);
    try {
      const r = await adminImportUsersExcel(file);
      setResult(r);
      if (r.successCount > 0) onImportSuccess?.();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Lỗi import');
    } finally {
      setLoading(false);
    }
  };

  return { file, setFile, result, err, loading, downloadTemplate, runImport, setErr };
}

export type AdminUserExcelImport = ReturnType<typeof useAdminUserExcelImport>;

export const AdminUserExcelImportToolbar: React.FC<AdminUserExcelImport> = ({
  setFile,
  loading,
  downloadTemplate,
  runImport,
}) => (
  <div className="flex flex-wrap items-center gap-2">
    <button type="button" onClick={downloadTemplate} className={toolbarBtnSecondary}>
      Tải mẫu Excel
    </button>
    <input
      type="file"
      accept={fileAccept}
      onChange={(e) => setFile(e.target.files?.[0] ?? null)}
      className="text-sm max-w-[200px] sm:max-w-none"
    />
    <button type="button" disabled={loading} onClick={() => void runImport()} className={toolbarBtnPrimary}>
      {loading ? 'Đang import…' : 'Import user'}
    </button>
  </div>
);

export const AdminUserExcelImportMeta: React.FC<AdminUserExcelImport> = ({ err, result }) => (
  <div className="space-y-3">
    {err && <p className="text-sm text-red-600">{err}</p>}
    <ExcelImportResultBlock result={result} />
  </div>
);
