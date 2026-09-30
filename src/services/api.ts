/**
 * Centralized API Service for Dheeksha Trade
 * Automatically resolves and normalizes backend base URL from Vite environment variables.
 */

const getApiBaseUrl = (): string => {
  // Check for standard VITE_API_URL or legacy VITE_API_BASE_URL
  const rawUrl = (
    import.meta.env.VITE_API_URL ||
    import.meta.env.VITE_API_BASE_URL ||
    ''
  ).trim();

  if (rawUrl) {
    // Strip trailing slashes
    const sanitized = rawUrl.replace(/\/+$/, '');
    // Ensure /api path is present
    return sanitized.endsWith('/api') ? sanitized : `${sanitized}/api`;
  }

  // Safe development fallback: ONLY used during local `vite dev`
  if (import.meta.env.DEV) {
    return 'http://localhost:5004/api';
  }

  // In production builds when no environment variable is provided,
  // use relative '/api' endpoint rather than failing or targeting localhost
  return '/api';
};

export const API_BASE_URL = getApiBaseUrl();

export interface ApiResponse<T> {
  success: boolean;
  count?: number;
  data: T;
  error?: string;
  message?: string;
}

// Generic Request Helper
async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const url = `${API_BASE_URL}${normalizedEndpoint}`;

  // Retrieve auth token if stored
  const token = typeof window !== 'undefined' ? localStorage.getItem('dheeksha_auth_token') : null;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...((options.headers as Record<string, string>) || {}),
  };

  try {
    const response = await fetch(url, {
      ...options,
      headers,
    });

    let json: any = {};
    const text = await response.text();
    if (text) {
      try {
        json = JSON.parse(text);
      } catch {
        json = { error: text };
      }
    }

    if (!response.ok) {
      throw new Error(json.error || json.message || `HTTP error! Status: ${response.status}`);
    }

    return json.data !== undefined ? json.data : json;
  } catch (error) {
    console.error(`[API Error] Request to ${endpoint} failed:`, error);
    throw error;
  }
}

// Customers API
export const CustomersApi = {
  getAll: () => request<any[]>('/customers'),
  getById: (id: string) => request<any>(`/customers/${id}`),
  create: (data: any) => request<any>('/customers', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: any) => request<any>(`/customers/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: string) => request<any>(`/customers/${id}`, { method: 'DELETE' }),
};

// Companies API
export const CompaniesApi = {
  getAll: () => request<any[]>('/companies'),
  getById: (id: string) => request<any>(`/companies/${id}`),
  create: (data: any) => request<any>('/companies', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: any) => request<any>(`/companies/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: string) => request<any>(`/companies/${id}`, { method: 'DELETE' }),
};

// Products API
export const ProductsApi = {
  getAll: () => request<any[]>('/products'),
  getById: (id: string) => request<any>(`/products/${id}`),
  create: (data: any) => request<any>('/products', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: any) => request<any>(`/products/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: string) => request<any>(`/products/${id}`, { method: 'DELETE' }),
};

// Particulars API
export const ParticularsApi = {
  getAll: (customerName?: string) =>
    request<any[]>(`/particulars${customerName && customerName !== 'ALL' ? `?customerName=${encodeURIComponent(customerName)}` : ''}`),
  getNextBillNo: () => request<{ nextBillNo: string }>('/particulars/next-bill-no'),
  getById: (id: string) => request<any>(`/particulars/${id}`),
  create: (data: any) => request<any>('/particulars', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: any) => request<any>(`/particulars/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: string) => request<any>(`/particulars/${id}`, { method: 'DELETE' }),
  uploadPdf: (id: string, pdfData: string, pdfName: string) =>
    request<any>(`/particulars/${id}/pdf`, {
      method: 'POST',
      body: JSON.stringify({ pdfData, pdfName }),
    }),
  deletePdf: (id: string) =>
    request<any>(`/particulars/${id}/pdf`, {
      method: 'DELETE',
    }),
};

// Account / Ledger API
export const AccountsApi = {
  getAll: (customerName?: string) =>
    request<any[]>(`/accounts${customerName && customerName !== 'ALL' ? `?customerName=${encodeURIComponent(customerName)}` : ''}`),
  addCredit: (data: {
    customerId?: string;
    customerName: string;
    companyName?: string;
    creditAmount: string | number;
    date: string;
    paymentMode?: string;
    reference?: string;
    notes?: string;
  }) => request<any>('/accounts/credit', { method: 'POST', body: JSON.stringify(data) }),
  delete: (id: string) => request<any>(`/accounts/${id}`, { method: 'DELETE' }),
};

// Performas API
export const PerformasApi = {
  getAll: (params?: {
    customerName?: string;
    customerId?: string;
    companyName?: string;
    status?: string;
    search?: string;
    startDate?: string;
    endDate?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }) => {
    const searchParams = new URLSearchParams();
    if (params?.customerName && params.customerName !== 'ALL') searchParams.append('customerName', params.customerName);
    if (params?.customerId) searchParams.append('customerId', params.customerId);
    if (params?.companyName && params.companyName !== 'ALL') searchParams.append('companyName', params.companyName);
    if (params?.status && params.status !== 'ALL') searchParams.append('status', params.status);
    if (params?.search) searchParams.append('search', params.search);
    if (params?.startDate) searchParams.append('startDate', params.startDate);
    if (params?.endDate) searchParams.append('endDate', params.endDate);
    if (params?.sortBy) searchParams.append('sortBy', params.sortBy);
    if (params?.sortOrder) searchParams.append('sortOrder', params.sortOrder);
    const queryStr = searchParams.toString();
    return request<{ data: any[]; summary: any } | any[]>(`/performas${queryStr ? `?${queryStr}` : ''}`);
  },
  getNextNumber: () => request<{ nextPerformaNumber: string }>('/performas/next-number'),
  getById: (id: string) => request<any>(`/performas/${id}`),
  create: (data: any) => request<any>('/performas', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: any) => request<any>(`/performas/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: string) => request<any>(`/performas/${id}`, { method: 'DELETE' }),
  cancel: (id: string) => request<any>(`/performas/${id}/cancel`, { method: 'PATCH' }),
  addAdvance: (data: {
    customerId?: string;
    customerName: string;
    performaId?: string;
    amount: number | string;
    date?: string;
    reference?: string;
    notes?: string;
  }) => request<any>('/performas/advance', { method: 'POST', body: JSON.stringify(data) }),
  getCustomerSummary: (customerId: string) =>
    request<any>(`/performas/customer/${encodeURIComponent(customerId)}/summary`),
  getCustomerAudit: (customerId: string) =>
    request<any[]>(`/performas/customer/${encodeURIComponent(customerId)}/audit`),
};

// Auth API
export const AuthApi = {
  login: (credentials: { username: string; password: string }) =>
    request<{ token: string; user: { username: string; role: string } }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    }),
  getMe: () => request<any>('/auth/me'),
};

// Health Check API
export const HealthApi = {
  check: () => request<{ status: string; message: string; timestamp: string }>('/health'),
};
