import type {
  User,
  Scammer,
  CallLog,
  FraudAccount,
  MonthlyDataPoint,
  AnalyticsSummary,
  CarrierIntel,
  ManagedUser,
  AdminStats,
} from './types.ts';

const TOKEN_KEY = 'scambaiter_crm_token';
const USER_KEY = 'scambaiter_crm_user';

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function getStoredUser(): User | null {
  const data = localStorage.getItem(USER_KEY);
  if (!data) return null;
  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
}

export function setSession(token: string, user: User) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getStoredToken();
  const headers = new Headers(options.headers || {});
  headers.set('Content-Type', 'application/json');
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(endpoint, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error: any = new Error(data.error || `Request failed with status ${response.status}`);
    error.data = data;
    error.requiresActivation = data.requiresActivation;
    error.email = data.email;
    throw error;
  }

  return data as T;
}

export const api = {
  // Auth
  async login(email: string, password: string): Promise<{ user: User; token: string }> {
    const res = await request<{ user: User; token: string }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    setSession(res.token, res.user);
    return res;
  },

  async register(
    email: string,
    password: string,
    name: string
  ): Promise<{ message: string; requiresActivation?: boolean; email?: string; user?: User; token?: string; simulated?: boolean; activationUrl?: string }> {
    const res = await request<{
      message: string;
      requiresActivation?: boolean;
      email?: string;
      user?: User;
      token?: string;
      simulated?: boolean;
      activationUrl?: string;
    }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, name }),
    });
    if (res.token && res.user) {
      setSession(res.token, res.user);
    }
    return res;
  },

  async activateAccount(token: string): Promise<{ message: string; user: User; token: string }> {
    const res = await request<{ message: string; user: User; token: string }>('/api/auth/activate', {
      method: 'POST',
      body: JSON.stringify({ token }),
    });
    setSession(res.token, res.user);
    return res;
  },

  async resendActivation(email: string): Promise<{ message: string; simulated?: boolean; activationUrl?: string }> {
    return request<{ message: string; simulated?: boolean; activationUrl?: string }>('/api/auth/resend-activation', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  },

  async googleAuth(params: {
    credential?: string;
    accessToken?: string;
    code?: string;
    redirectUri?: string;
    email?: string;
    name?: string;
    avatarUrl?: string;
    googleId?: string;
  }): Promise<{ user: User; token: string }> {
    const res = await request<{ user: User; token: string }>('/api/auth/google', {
      method: 'POST',
      body: JSON.stringify(params),
    });
    setSession(res.token, res.user);
    return res;
  },

  async acceptTerms(): Promise<{ user: User; message: string }> {
    const res = await request<{ user: User; message: string }>('/api/auth/accept-terms', {
      method: 'POST',
    });
    const storedUser = getStoredUser();
    const token = getStoredToken();
    if (storedUser && token) {
      setSession(token, { ...storedUser, hasAcceptedTerms: true });
    }
    return res;
  },

  async getMe(): Promise<{ user: User }> {
    return request<{ user: User }>('/api/auth/me');
  },

  // Public
  async getPublicScammer(id: string): Promise<{ scammer: Scammer }> {
    return request<{ scammer: Scammer }>(`/api/public/scammers/${id}`);
  },

  // Scammers
  async getScammers(): Promise<{ scammers: Scammer[] }> {
    return request<{ scammers: Scammer[] }>('/api/scammers');
  },

  async createScammer(data: {
    fullName: string;
    alias?: string;
    phoneNumber: string;
    status?: string;
    scamType?: string;
    organization?: string;
    notes?: string;
    targetValue?: number;
    priority?: number;
    carrier?: string;
    location?: string;
    dangerLevel?: string;
    flagged?: boolean;
    totalTimeSpent?: number;
  }): Promise<{ scammer: Scammer }> {
    return request<{ scammer: Scammer }>('/api/scammers', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async bulkImportScammers(items: any[]): Promise<{
    success: boolean;
    importedCount: number;
    scammers: Scammer[];
    errors?: string[];
  }> {
    return request<{
      success: boolean;
      importedCount: number;
      scammers: Scammer[];
      errors?: string[];
    }>('/api/scammers/bulk-import', {
      method: 'POST',
      body: JSON.stringify({ items }),
    });
  },

  async updateScammer(id: string, data: Partial<Scammer>): Promise<{ scammer: Scammer }> {
    return request<{ scammer: Scammer }>(`/api/scammers/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async deleteScammer(id: string): Promise<{ success: boolean }> {
    return request<{ success: boolean }>(`/api/scammers/${id}`, {
      method: 'DELETE',
    });
  },

  // Calls
  async addCall(
    scammerId: string,
    data: {
      durationMinutes: number;
      notes?: string;
      audioRecordingUrl?: string;
      audioRecordingName?: string;
      victimPersonaUsed?: string;
      infoGiven?: string;
      outcome?: string;
      date?: string;
    }
  ): Promise<{ call: CallLog; scammerTotalMinutes: number; todayMinutes: number }> {
    return request(`/api/scammers/${scammerId}/calls`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async updateCall(
    scammerId: string,
    callId: string,
    data: {
      durationMinutes?: number;
      notes?: string;
      audioRecordingUrl?: string;
      audioRecordingName?: string;
      victimPersonaUsed?: string;
      infoGiven?: string;
      outcome?: string;
      date?: string;
    }
  ): Promise<{ call: CallLog; scammerTotalMinutes: number; todayMinutes: number }> {
    return request(`/api/scammers/${scammerId}/calls/${callId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async deleteCall(scammerId: string, callId: string): Promise<{ success: boolean; totalMinutes: number }> {
    return request(`/api/scammers/${scammerId}/calls/${callId}`, {
      method: 'DELETE',
    });
  },

  // Fraudulent Accounts
  async addFraudAccount(
    scammerId: string,
    data: {
      accountType: string;
      accountDetails: string;
      institution?: string;
      holderName?: string;
      reportedToBank?: boolean;
    }
  ): Promise<{ account: FraudAccount }> {
    return request(`/api/scammers/${scammerId}/fraud-accounts`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async deleteFraudAccount(scammerId: string, accId: string): Promise<{ success: boolean }> {
    return request(`/api/scammers/${scammerId}/fraud-accounts/${accId}`, {
      method: 'DELETE',
    });
  },

  // Analytics
  async getMonthlyAnalytics(): Promise<{
    monthlyData: MonthlyDataPoint[];
    summary: AnalyticsSummary;
  }> {
    return request('/api/analytics/monthly');
  },


  async getConfig(): Promise<{
    googleClientId: string;
    googleOAuthEnabled: boolean;
    adminUser: string;
    testerUser?: string;
    dbSource: string;
    appUrl: string;
  }> {
    return request('/api/config');
  },

  // Admin User Management
  async getAdminUsers(): Promise<{ users: ManagedUser[]; stats: AdminStats }> {
    return request('/api/admin/users');
  },

  async createAdminUser(data: {
    name: string;
    email: string;
    password: string;
    role: string;
  }): Promise<{ user: ManagedUser }> {
    return request('/api/admin/users', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async updateAdminUser(
    id: string,
    data: { name?: string; email?: string; role?: string; password?: string }
  ): Promise<{ user: ManagedUser }> {
    return request(`/api/admin/users/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  async deleteAdminUser(id: string): Promise<{ success: boolean }> {
    return request(`/api/admin/users/${id}`, {
      method: 'DELETE',
    });
  },
};
