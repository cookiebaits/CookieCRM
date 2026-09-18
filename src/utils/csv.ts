import type { Scammer, CanonicalStatus } from '../types.ts';
import { toCanonicalStatus } from '../types.ts';

export const CSV_HEADERS = [
  'Full Name',
  'Alias',
  'Phone Number',
  'Status',
  'Target Value',
  'Priority',
  'Scam Type',
  'Organization',
  'Carrier',
  'Location',
  'Danger Level',
  'Flagged',
  'Total Time Spent (mins)',
  'Notes',
  'Victim Given Info',
  'Remote Access ID',
  'IP Address',
] as const;

/**
 * Escapes a cell value for standard RFC-4180 CSV compliance
 */
function escapeCSV(val: unknown): string {
  if (val === null || val === undefined) return '""';
  const str = String(val);
  // If it contains quote, comma, carriage return or newline, wrap in quotes and escape quotes
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return `"${str}"`;
}

/**
 * Converts a list of Scammers into an RFC-4180 compliant CSV string
 */
export function generateCSV(scammers: Scammer[]): string {
  const headerLine = CSV_HEADERS.map((h) => escapeCSV(h)).join(',');

  const rows = scammers.map((s) => {
    return [
      escapeCSV(s.fullName || ''),
      escapeCSV(s.alias || ''),
      escapeCSV(s.phoneNumber || ''),
      escapeCSV(toCanonicalStatus(s.status)),
      escapeCSV(s.targetValue ?? 0),
      escapeCSV(s.priority ?? 1),
      escapeCSV(s.scamType || 'Tech Support'),
      escapeCSV(s.organization || ''),
      escapeCSV(s.carrier || ''),
      escapeCSV(s.location || ''),
      escapeCSV(s.dangerLevel || 'medium'),
      escapeCSV(s.flagged ? 'TRUE' : 'FALSE'),
      escapeCSV(s.totalTimeSpent ?? 0),
      escapeCSV(s.notes || ''),
      escapeCSV(s.victimGivenInfo || ''),
      escapeCSV(s.remoteAccessId || ''),
      escapeCSV(s.ipAddress || ''),
    ].join(',');
  });

  return [headerLine, ...rows].join('\r\n');
}

/**
 * Triggers a client-side download of the CSV data
 */
export function downloadCSV(csvContent: string, filename: string = 'scambaiter_pipeline.csv'): void {
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Robust CSV parser handling RFC-4180 quotes, multiline values, and commas
 */
export function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentVal = '';
  let insideQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        currentVal += '"';
        i++; // skip escaped quote
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (char === ',' && !insideQuotes) {
      currentRow.push(currentVal.trim());
      currentVal = '';
    } else if ((char === '\r' || char === '\n') && !insideQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++; // skip \n
      }
      currentRow.push(currentVal.trim());
      if (currentRow.length > 0 && currentRow.some((col) => col.length > 0)) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentVal = '';
    } else {
      currentVal += char;
    }
  }

  // Final column / row if file didn't end with newline
  if (currentVal.length > 0 || currentRow.length > 0) {
    currentRow.push(currentVal.trim());
    if (currentRow.some((col) => col.length > 0)) {
      rows.push(currentRow);
    }
  }

  return rows;
}

/**
 * Normalizes header string for robust matching
 */
function normalizeHeaderKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]/g, '');
}

export interface ParsedScammerRow {
  fullName: string;
  alias?: string;
  phoneNumber: string;
  status: CanonicalStatus;
  targetValue: number;
  priority: number;
  scamType: string;
  organization?: string;
  carrier?: string;
  location?: string;
  dangerLevel: 'low' | 'medium' | 'high' | 'critical';
  flagged: boolean;
  totalTimeSpent: number;
  notes?: string;
  victimGivenInfo?: string;
  remoteAccessId?: string;
  ipAddress?: string;
}

/**
 * Parses raw CSV text into validated scammer items matching the exact export schema
 */
export function parseScammersFromCSV(csvText: string): {
  items: ParsedScammerRow[];
  errors: string[];
  totalRowsParsed: number;
} {
  const rows = parseCSV(csvText);
  const errors: string[] = [];
  const items: ParsedScammerRow[] = [];

  if (rows.length < 2) {
    return {
      items: [],
      errors: ['The provided CSV file appears to be empty or missing data rows.'],
      totalRowsParsed: 0,
    };
  }

  const rawHeaders = rows[0];
  const headerMap: Record<string, number> = {};
  rawHeaders.forEach((h, index) => {
    headerMap[normalizeHeaderKey(h)] = index;
  });

  const getCol = (row: string[], keys: string[]): string => {
    for (const k of keys) {
      const idx = headerMap[normalizeHeaderKey(k)];
      if (idx !== undefined && row[idx] !== undefined) {
        return row[idx].trim();
      }
    }
    return '';
  };

  const dataRows = rows.slice(1);

  dataRows.forEach((row, rowIndex) => {
    const rowNum = rowIndex + 2; // 1-indexed including header
    const fullName = getCol(row, ['Full Name', 'Name', 'FullName', 'Scammer Name', 'Contact']);
    const phoneNumber = getCol(row, ['Phone Number', 'Phone', 'PhoneNumber', 'Mobile', 'Tel']);

    if (!fullName && !phoneNumber) {
      // Empty row, ignore
      return;
    }

    if (!fullName) {
      errors.push(`Row ${rowNum}: Missing required field 'Full Name'.`);
      return;
    }

    if (!phoneNumber) {
      errors.push(`Row ${rowNum} (${fullName}): Missing required field 'Phone Number'.`);
      return;
    }

    const rawStatus = getCol(row, ['Status', 'Pipeline Status', 'Stage']);
    const status = toCanonicalStatus(rawStatus);

    const rawVal = getCol(row, ['Target Value', 'TargetValue', 'Value', 'Amount', 'Deal Value']);
    const cleanVal = rawVal.replace(/[^0-9.]/g, '');
    const targetValue = Math.max(0, Math.round(Number(cleanVal) || 0));

    const rawPriority = getCol(row, ['Priority', 'Rating', 'Stars']);
    const parsedPriority = Number(rawPriority.replace(/[^0-9]/g, '')) || 1;
    const priority = Math.min(3, Math.max(1, parsedPriority));

    const scamType = getCol(row, ['Scam Type', 'Type', 'Category']) || 'Tech Support';
    const organization = getCol(row, ['Organization', 'Company', 'Org', 'Enterprise']) || undefined;
    const alias = getCol(row, ['Alias', 'Moniker', 'Fake Name']) || undefined;
    const carrier = getCol(row, ['Carrier', 'Provider', 'VoIP Provider']) || undefined;
    const location = getCol(row, ['Location', 'City', 'Country']) || undefined;

    const rawDanger = getCol(row, ['Danger Level', 'Danger', 'Threat Level']).toLowerCase();
    const dangerLevel: 'low' | 'medium' | 'high' | 'critical' =
      rawDanger === 'low' || rawDanger === 'medium' || rawDanger === 'high' || rawDanger === 'critical'
        ? rawDanger
        : 'medium';

    const rawFlagged = getCol(row, ['Flagged', 'Fraudulent', 'Flag']).toUpperCase();
    const flagged = rawFlagged === 'TRUE' || rawFlagged === 'YES' || rawFlagged === '1';

    const rawTime = getCol(row, ['Total Time Spent (mins)', 'Time Spent', 'Total Time', 'Minutes']);
    const totalTimeSpent = Math.max(0, Math.round(Number(rawTime.replace(/[^0-9]/g, '')) || 0));

    const notes = getCol(row, ['Notes', 'Description', 'Details']) || undefined;
    const victimGivenInfo = getCol(row, ['Victim Given Info', 'Victim Info', 'Bait Info']) || undefined;
    const remoteAccessId = getCol(row, ['Remote Access ID', 'Remote ID', 'AnyDesk', 'UltraViewer']) || undefined;
    const ipAddress = getCol(row, ['IP Address', 'IP', 'IPAddress']) || undefined;

    items.push({
      fullName,
      alias,
      phoneNumber,
      status,
      targetValue,
      priority,
      scamType,
      organization,
      carrier,
      location,
      dangerLevel,
      flagged,
      totalTimeSpent,
      notes,
      victimGivenInfo,
      remoteAccessId,
      ipAddress,
    });
  });

  return {
    items,
    errors,
    totalRowsParsed: dataRows.length,
  };
}

/**
 * Sample CSV template for user reference
 */
export function getSampleCSVTemplate(): string {
  const sampleScammers: Scammer[] = [
    {
      id: 'sample-1',
      fullName: 'Office Design Project (Alex Watson)',
      alias: 'David from Geek Squad Support',
      phoneNumber: '+1 (888) 529-8834',
      status: 'New',
      targetValue: 24000,
      priority: 2,
      scamType: 'Tech Support',
      organization: 'Deco Addict',
      carrier: 'Bandwidth.com VoIP',
      location: 'Los Angeles DID / Kolkata',
      dangerLevel: 'high',
      flagged: true,
      totalTimeSpent: 75,
      notes: 'Demands victim go to store for gift card refund reversal.',
      victimGivenInfo: 'Fed fake checking account Metro CU #8839440192',
      remoteAccessId: 'UltraViewer 489 122 094',
      ipAddress: '103.212.144.18',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      calls: [],
      fraudAccounts: [],
    },
    {
      id: 'sample-2',
      fullName: 'Interest in your products (Rahul Verma)',
      alias: 'Officer Robert Wilson #4092',
      phoneNumber: '+1 (844) 332-9011',
      status: 'Qualified',
      targetValue: 2000,
      priority: 1,
      scamType: 'Federal Warrant & Asset Seizure',
      organization: 'The Jackson Group',
      carrier: 'Onvoy LLC VoIP',
      location: 'Dallas Gateway',
      dangerLevel: 'critical',
      flagged: true,
      totalTimeSpent: 120,
      notes: 'Warrant extortion claiming Bitcoin transfer required.',
      victimGivenInfo: 'Fake Bitcoin ATM receipt with $12,500 balance',
      remoteAccessId: 'AnyDesk 948 102 331',
      ipAddress: '117.202.14.99',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      calls: [],
      fraudAccounts: [],
    },
    {
      id: 'sample-3',
      fullName: 'Open Space Design (James Miller)',
      alias: 'PayPal Fraud Agent',
      phoneNumber: '+1 (800) 419-7221',
      status: 'Proposition',
      targetValue: 11000,
      priority: 3,
      scamType: 'PayPal Invoice Fraud',
      organization: 'Deco Addict',
      carrier: 'Peerless Network',
      location: 'Mumbai Outbound',
      dangerLevel: 'medium',
      flagged: false,
      totalTimeSpent: 30,
      notes: 'Fake crypto invoice bait call in progress.',
      victimGivenInfo: 'Fake PayPal login credentials',
      remoteAccessId: 'AnyDesk 551 229 018',
      ipAddress: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      calls: [],
      fraudAccounts: [],
    },
    {
      id: 'sample-4',
      fullName: 'Distributor Contract (Michael Anderson)',
      alias: 'Senior Tech Lead Steve',
      phoneNumber: '+1 (877) 629-1140',
      status: 'Won',
      targetValue: 19800,
      priority: 2,
      scamType: 'Bank Wire Fraud',
      organization: 'Gemini Furniture',
      carrier: 'Twilio Cloud',
      location: 'Chicago Hub',
      dangerLevel: 'low',
      flagged: true,
      totalTimeSpent: 180,
      notes: 'Scammer fully revealed, bait recordings sent to FTC.',
      victimGivenInfo: 'Fake wire routing number',
      remoteAccessId: 'TeamViewer 129 883 401',
      ipAddress: '49.36.128.4',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      calls: [],
      fraudAccounts: [],
    },
  ];

  return generateCSV(sampleScammers);
}
