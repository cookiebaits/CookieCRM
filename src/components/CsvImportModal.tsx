import React, { useState, useRef } from 'react';
import {
  Upload,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle2,
  X,
  Download,
  ArrowRight,
  Shield,
  DollarSign,
  Star,
} from 'lucide-react';
import { parseScammersFromCSV, downloadCSV, getSampleCSVTemplate, type ParsedScammerRow } from '../utils/csv.ts';
import { api } from '../api.ts';
import type { Scammer } from '../types.ts';

interface CsvImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportSuccess: (importedScammers: Scammer[]) => void;
}

export const CsvImportModal: React.FC<CsvImportModalProps> = ({
  isOpen,
  onClose,
  onImportSuccess,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedScammerRow[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileProcess = (selectedFile: File) => {
    if (!selectedFile.name.toLowerCase().endsWith('.csv')) {
      setSubmitError('Please select a valid .csv file.');
      return;
    }

    setFile(selectedFile);
    setSubmitError(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (!text) {
        setSubmitError('The selected file appears to be empty.');
        return;
      }

      const { items, errors } = parseScammersFromCSV(text);
      setParsedRows(items);
      setParseErrors(errors);
    };

    reader.onerror = () => {
      setSubmitError('Failed to read the selected CSV file.');
    };

    reader.readAsText(selectedFile);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileProcess(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFileProcess(e.target.files[0]);
    }
  };

  const handleDownloadTemplate = () => {
    const template = getSampleCSVTemplate();
    downloadCSV(template, 'scambaiter_pipeline_template.csv');
  };

  const handleConfirmImport = async () => {
    if (parsedRows.length === 0) return;

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const res = await api.bulkImportScammers(parsedRows);
      if (res.success) {
        onImportSuccess(res.scammers);
        onClose();
      } else {
        setSubmitError('Bulk import failed. Please check your data and try again.');
      }
    } catch (err: any) {
      console.error('Import error:', err);
      setSubmitError(err.message || 'An error occurred during CSV import.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetSelection = () => {
    setFile(null);
    setParsedRows([]);
    setParseErrors([]);
    setSubmitError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div
      id="csv-import-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto"
    >
      <div
        id="csv-import-modal-card"
        className="relative w-full max-w-3xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden my-8"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center shadow-lg shadow-emerald-950/30">
              <FileSpreadsheet className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                Import Pipeline Cases from CSV
                <span className="text-[11px] font-normal px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  Exact Export Format Supported
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Upload or drag & drop your exported CSV to populate or restore your CRM pipeline.
              </p>
            </div>
          </div>

          <button
            type="button"
            id="close-csv-modal-btn"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          {/* Top helper & sample template button */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-950/50 rounded-xl border border-slate-800/80 text-xs">
            <div className="flex items-center gap-2 text-slate-300">
              <Shield className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>
                Supports all fields: <strong>Full Name</strong>, <strong>Phone</strong>, <strong>Status</strong>,{' '}
                <strong>Target Value</strong>, <strong>Priority</strong>, <strong>Carrier</strong>, etc.
              </span>
            </div>
            <button
              type="button"
              id="download-template-csv-btn"
              onClick={handleDownloadTemplate}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium flex items-center gap-1.5 transition text-xs border border-slate-700 shadow-sm"
            >
              <Download className="w-3.5 h-3.5 text-emerald-400" />
              <span>Download Sample Template</span>
            </button>
          </div>

          {/* Upload Dropzone */}
          {!file ? (
            <div
              id="csv-drag-dropzone"
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition flex flex-col items-center justify-center gap-3 ${
                isDragging
                  ? 'border-emerald-500 bg-emerald-950/20'
                  : 'border-slate-700 bg-slate-950/30 hover:border-slate-600 hover:bg-slate-950/50'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                onChange={handleFileChange}
                className="hidden"
                id="csv-file-input"
              />

              <div className="w-14 h-14 rounded-2xl bg-slate-800/80 flex items-center justify-center border border-slate-700 text-slate-300 shadow-inner">
                <Upload className="w-7 h-7 text-emerald-400 animate-pulse" />
              </div>

              <div>
                <p className="text-sm font-semibold text-slate-200">
                  Drop your <span className="text-emerald-400 font-bold">.CSV</span> file here, or click to browse
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  Supports UTF-8 CSV files up to 10MB generated by Export CSV or custom spreadsheets
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Selected file banner */}
              <div className="flex items-center justify-between p-3.5 bg-slate-950 rounded-xl border border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
                    <FileSpreadsheet className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-200">{file.name}</div>
                    <div className="text-[11px] text-slate-400">
                      {(file.size / 1024).toFixed(1)} KB • {parsedRows.length} valid cases detected
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={resetSelection}
                  className="px-2.5 py-1 text-xs text-rose-400 hover:text-rose-300 rounded hover:bg-rose-950/30 transition border border-rose-900/50"
                >
                  Change File
                </button>
              </div>

              {/* Validation errors/warnings */}
              {parseErrors.length > 0 && (
                <div className="p-3 bg-amber-950/30 border border-amber-800/50 rounded-xl text-xs text-amber-300 space-y-1">
                  <div className="font-semibold flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4 text-amber-400" />
                    <span>{parseErrors.length} row(s) skipped due to missing fields:</span>
                  </div>
                  <ul className="list-disc list-inside space-y-0.5 max-h-24 overflow-y-auto text-[11px] text-amber-400/90 pl-1">
                    {parseErrors.slice(0, 5).map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                    {parseErrors.length > 5 && (
                      <li>...and {parseErrors.length - 5} more issues</li>
                    )}
                  </ul>
                </div>
              )}

              {/* Rows preview table */}
              {parsedRows.length > 0 ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-300 font-semibold px-1">
                    <span>Parsed Preview ({parsedRows.length} Records)</span>
                    <span className="text-[11px] text-slate-400">Showing first {Math.min(parsedRows.length, 5)} rows</span>
                  </div>

                  <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/40">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800">
                        <tr>
                          <th className="px-3 py-2 font-medium">Full Name & Alias</th>
                          <th className="px-3 py-2 font-medium">Phone Number</th>
                          <th className="px-3 py-2 font-medium">Pipeline Stage</th>
                          <th className="px-3 py-2 font-medium">Target Value</th>
                          <th className="px-3 py-2 font-medium">Priority</th>
                          <th className="px-3 py-2 font-medium">Organization</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 text-slate-200">
                        {parsedRows.slice(0, 5).map((row, idx) => (
                          <tr key={idx} className="hover:bg-slate-800/30">
                            <td className="px-3 py-2">
                              <div className="font-semibold text-white">{row.fullName}</div>
                              {row.alias && <div className="text-[10px] text-slate-400">{row.alias}</div>}
                            </td>
                            <td className="px-3 py-2 font-mono text-[11px] text-slate-300">
                              {row.phoneNumber}
                            </td>
                            <td className="px-3 py-2">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  row.status === 'New'
                                    ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                                    : row.status === 'Qualified'
                                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                    : row.status === 'Proposition'
                                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                    : 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                                }`}
                              >
                                {row.status}
                              </span>
                            </td>
                            <td className="px-3 py-2 font-semibold text-emerald-400">
                              ${row.targetValue?.toLocaleString() || 0}
                            </td>
                            <td className="px-3 py-2">
                              <div className="flex text-amber-400 text-xs">
                                {'★'.repeat(row.priority || 1)}
                                {'☆'.repeat(3 - (row.priority || 1))}
                              </div>
                            </td>
                            <td className="px-3 py-2 text-[11px] text-slate-400 truncate max-w-[120px]">
                              {row.organization || '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-slate-950 rounded-xl text-center text-xs text-rose-400 border border-rose-900/40">
                  No valid scammer rows could be found in this CSV. Please verify column headers.
                </div>
              )}
            </div>
          )}

          {submitError && (
            <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-800 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{submitError}</span>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between gap-3">
          <button
            type="button"
            id="cancel-csv-btn"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            Cancel
          </button>

          <button
            type="button"
            id="submit-csv-import-btn"
            disabled={parsedRows.length === 0 || isSubmitting}
            onClick={handleConfirmImport}
            className={`px-5 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition shadow-lg ${
              parsedRows.length === 0 || isSubmitting
                ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-emerald-950/50'
            }`}
          >
            {isSubmitting ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Importing Cases...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>Confirm & Import {parsedRows.length} Cases</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
