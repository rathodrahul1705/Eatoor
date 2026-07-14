import API from './httpClient';

// ---------------------------------------------------------------------------
// Settlement / Payout API (Partner Settlement Screen)
// Style reference: src/api/offer.tsx
// ---------------------------------------------------------------------------

export type SettlementFilter = 'this_week' | 'last_week' | 'this_month' | 'last_month' | 'custom';
export type SettlementStatus = 'paid' | 'pending' | 'processing' | 'failed' | 'on_hold';
export type SettlementOrderType = 'dine_in' | 'delivery' | 'takeaway';
export type SettlementPaymentMethod = 'card' | 'cash' | 'upi' | 'wallet';
export type SettlementSortBy = 'date' | 'net' | 'revenue' | 'order_id';
export type SettlementSortOrder = 'asc' | 'desc';
export type SettlementExportFormat = 'csv' | 'xlsx' | 'pdf';


export const getRestaurantList = (user_id: string) =>
  API.get(`/restaurants/status/${user_id}/`);

export const SETTLEMENT_ENDPOINTS = {
  dashboard: `/partner/settlements/dashboard/`,
  transactions: `/partner/settlements/transactions/`,
  export: `/partner/settlements/export/`,
  transactionDetail: (transactionId: string) =>
    `/partner/settlements/transactions/${transactionId}/`,
} as const;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SettlementSummary {
  total_orders: number;
  gross_sales: number;
  commission: number;
  net_pay: number;
}

export interface SettlementCurrentCycle {
  cycle_start_date: string; // YYYY-MM-DD
  cycle_end_date: string; // YYYY-MM-DD
  payout_date: string; // YYYY-MM-DD
  status: SettlementStatus;
  orders: number;
  revenue: number;
  commission: number;
  net_pay: number;
  progress_percent: number; // 0..100
}

export interface SettlementDashboardResponse {
  success: boolean;
  message?: string;
  data: {
    summary: SettlementSummary;
    current_cycle: SettlementCurrentCycle;
  };
}

export interface SettlementDashboardParams {
  restaurant_id: string;
  filter: SettlementFilter;
  start_date?: string; // required when filter=custom
  end_date?: string; // required when filter=custom
  timezone?: string; // default Asia/Kolkata
}

export interface SettlementTransaction {
  id: string;
  date: string; // YYYY-MM-DD
  order_id: string; // ORD-xxxx
  customer: string;
  order_type: SettlementOrderType;
  payment_method: SettlementPaymentMethod;
  items_count: number;
  revenue: number;
  discount: number;
  tax: number;
  tip: number;
  commission: number;
  net: number;
  status: SettlementStatus;
}

export interface SettlementTransactionsParams {
  restaurant_id: string;
  filter: SettlementFilter;
  start_date?: string; // required when filter=custom
  end_date?: string; // required when filter=custom
  timezone?: string;
  status?: SettlementStatus;
  page?: number;
  page_size?: number; // max 100
  sort_by?: SettlementSortBy;
  sort_order?: SettlementSortOrder;
}

export interface SettlementTransactionsResponse {
  success: boolean;
  message?: string;
  data: {
    items: SettlementTransaction[];
    totals: SettlementSummary;
    pagination: {
      page: number;
      page_size: number;
      total_items: number;
      total_pages: number;
    };
  };
}

export interface SettlementExportBody {
  restaurant_id: string;
  filter: SettlementFilter;
  start_date: string; // YYYY-MM-DD
  end_date: string; // YYYY-MM-DD
  format: SettlementExportFormat;
  timezone?: string;
}

export interface SettlementExportResponse {
  success: boolean;
  message?: string;
  data: {
    file_url: string;
    expires_at: string; // ISO datetime
  };
}

// ---------------------------------------------------------------------------
// API calls
// ---------------------------------------------------------------------------

export const getSettlementDashboard = (params: SettlementDashboardParams) =>
  API.get<SettlementDashboardResponse>(SETTLEMENT_ENDPOINTS.dashboard, { params });

export const getSettlementTransactions = (params: SettlementTransactionsParams) =>
  API.get<SettlementTransactionsResponse>(SETTLEMENT_ENDPOINTS.transactions, { params });

export const exportSettlementReport = (payload: SettlementExportBody) =>
  API.post<SettlementExportResponse>(SETTLEMENT_ENDPOINTS.export, payload);

export const getSettlementTransactionDetail = (transactionId: string) =>
  API.get<{ success: boolean; message?: string; data: SettlementTransaction }>(
    SETTLEMENT_ENDPOINTS.transactionDetail(transactionId),
  );
