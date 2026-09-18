export interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string | null;
  role: string;
}

export type PipelineStatus =
  | 'Uncalled'
  | 'In Progress'
  | 'Top Baits'
  | 'Reported / Down'
  | 'New'
  | 'Qualified'
  | 'Proposition'
  | 'Won'
  | 'New Scammer'
  | 'Actively baiting'
  | 'Payment Pending'
  | 'Revealed / Reported';

export type CanonicalStatus = 'Uncalled' | 'In Progress' | 'Top Baits' | 'Reported / Down';

export function toCanonicalStatus(status?: string | null): CanonicalStatus {
  if (!status) return 'Uncalled';
  const s = status.trim().toLowerCase();
  if (s === 'uncalled' || s === 'new' || s.includes('uncall') || s.includes('lead') || s.includes('new')) return 'Uncalled';
  if (s === 'in progress' || s === 'qualified' || s.includes('progress') || s.includes('qualif') || s.includes('bait')) return 'In Progress';
  if (s === 'top baits' || s === 'proposition' || s.includes('top') || s.includes('prop') || s.includes('payment') || s.includes('pend')) return 'Top Baits';
  if (s === 'reported / down' || s === 'won' || s.includes('won') || s.includes('reveal') || s.includes('report') || s.includes('down') || s.includes('close')) return 'Reported / Down';
  return 'Uncalled';
}

export interface CallLog {
  id: string;
  scammerId: string;
  date: string;
  durationMinutes: number;
  notes?: string | null;
  audioRecordingUrl?: string | null;
  audioRecordingName?: string | null;
  victimPersonaUsed?: string | null;
  infoGiven?: string | null;
  outcome?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface FraudAccount {
  id: string;
  scammerId: string;
  accountType: string; // bank_account, crypto_wallet, zelle, wire, gift_card, paypal, cashapp
  accountDetails: string;
  institution?: string | null;
  holderName?: string | null;
  reportedToBank: boolean;
  createdAt: string;
}

export interface Scammer {
  id: string;
  fullName: string;
  alias?: string | null;
  phoneNumber: string;
  status: PipelineStatus;
  carrier?: string | null;
  location?: string | null;
  scamType: string;
  organization?: string | null;
  flagged: boolean;
  dangerLevel: 'low' | 'medium' | 'high' | 'critical';
  targetValue?: number; // target deal or fraud amount in dollars
  priority?: number; // 1-3 star priority rating
  victimGivenInfo?: string | null;
  remoteAccessId?: string | null;
  ipAddress?: string | null;
  notes?: string | null;
  totalTimeSpent: number; // minutes
  todayTimeSpent?: number; // minutes spent today
  createdAt: string;
  updatedAt: string;
  user?: { id: string; name: string; email: string } | null;
  calls: CallLog[];
  fraudAccounts: FraudAccount[];
}

export interface ManagedUser {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string | null;
  role: string;
  googleId?: string | null;
  createdAt: string;
  updatedAt: string;
  scammersCount: number;
}

export interface AdminStats {
  totalUsers: number;
  totalAdmins: number;
  totalScammers: number;
  totalCalls: number;
  totalBaitTimeMinutes: number;
}

export interface MonthlyDataPoint {
  month: string;
  minutes: number;
  hours: number;
  callsCount: number;
  estimatedSavings: number;
}

export interface WeeklyDataPoint {
  weekLabel: string;
  minutes: number;
  hours: number;
  callsCount: number;
}

export interface ScamTypeStat {
  type: string;
  count: number;
  minutes: number;
  hours: number;
  percentage: number;
}

export interface TopBaitedScammer {
  id: string;
  fullName: string;
  alias?: string | null;
  phoneNumber: string;
  status: string;
  scamType: string;
  totalTimeSpent: number;
  callsCount: number;
  organization?: string | null;
}

export interface AnalyticsSummary {
  todayTotalMinutes: number;
  todayCallsCount: number;
  weekTotalMinutes: number;
  weekCallsCount: number;
  monthTotalMinutes: number;
  monthCallsCount: number;
  totalWastedMinutes: number;
  totalWastedHours: number;
  totalScammers: number;
  pipelineCounts: Record<PipelineStatus, number>;
  totalFraudAccounts: number;
  reportedFraudAccounts: number;
  flaggedScammersCount: number;
  averageCallDurationMinutes: number;
  estimatedLossPreventedTotal: number;
  scamTypeBreakdown?: ScamTypeStat[];
  topBaitedScammers?: TopBaitedScammer[];
  weeklyBreakdown?: WeeklyDataPoint[];
}

export interface CarrierIntel {
  phoneNumber: string;
  carrier: string;
  lineType: string;
  location: string;
  spoofRisk: 'Low' | 'Medium' | 'High' | 'Very High';
  scamPatterns: string[];
  summary: string;
  recommendedAction: string;
}
