import API from './httpClient';

// ---------------------------------------------------------------------------
// Types (aligned with component usage and backend expectations)
// ---------------------------------------------------------------------------

export type SettlementFilter = 'this_week' | 'last_week' | 'this_month' | 'last_month' | 'custom';
export type SettlementStatus = 'paid' | 'pending' | 'processing' | 'failed' | 'on_hold';
export type SettlementExportFormat = 'csv' | 'xlsx' | 'pdf';

// Response shape for dashboard (simplified)
export interface SettlementDashboardResponse {
  data: {
    restaurant?: {
      id: string;
      name: string;
      address: string;
      phone: string;
      email: string;
      profile_image?: string | null;
    };
    // other dashboard fields if any
  };
}

// Response shape for transactions list
export interface SettlementTransactionsResponse {
  data: {
    items: Array<{
      date: string;                // "YYYY-MM-DD"
      total_orders: number;
      item_gross_sale: number;
      gross_sale: number;
      total_delivery_fee: number;
      tax: number;
      eatoor_commission: number;
      restaurant_net_pay: number;
      average_order_value: number;
      settlement_id: string;       // settlement_number from backend
      status: string;              // 'pending' | 'approved' | 'paid' | 'failed'
      restaurant_name: string;
    }>;
    totals: {
      total_orders: number;
      item_gross_sale: number;
      gross_sale: number;
      total_delivery_fee: number;
      total_tax: number;
      eatoor_commission: number;
      restaurant_net_pay: number;
    };
    pagination: {
      page: number;
      page_size: number;
      total_pages: number;
      total_items: number;
    };
    restaurant?: {
      id: string;
      name: string;
      address: string;
      phone: string;
      email: string;
      profile_image?: string | null;
    };
  };
}

// ---------------------------------------------------------------------------
// API Functions (used in SettlementDashboardScreen)
// ---------------------------------------------------------------------------

/**
 * Fetch restaurant list (only live restaurants)
 * @param user_id - The user ID (e.g., '2')
 */
export const getRestaurantList = (user_id: string) =>
  API.get(`/restaurants/status/${user_id}/`);

/**
 * Get settlement dashboard summary data.
 * Used to show the restaurant info (name, address, etc.) for the selected filter.
 *
 * @param params.filter - One of 'this_week', 'last_week', 'this_month', 'last_month', 'custom'
 * @param params.restaurant_id - Optional restaurant ID (omit for all restaurants)
 * @param params.start_date - Required if filter === 'custom', format YYYY-MM-DD
 * @param params.end_date   - Required if filter === 'custom', format YYYY-MM-DD
 * @param params.status     - Optional status filter ('pending', 'approved', 'paid', 'failed')
 *
 * @returns Promise with SettlementDashboardResponse
 */
export const getSettlementDashboard = (params: {
  filter: SettlementFilter;
  restaurant_id?: string;
  start_date?: string; // YYYY-MM-DD
  end_date?: string;   // YYYY-MM-DD
  status?: string;     // added status filter
}) => {
  return API.get<{ data: SettlementDashboardResponse['data'] }>(
    '/admin/settlements/dashboard/',
    { params }
  );
};


export const settlementStatusUpdate = (params: {
  settlement_id?: string;
  status?: string;
}) => {
  return API.get<{ data: SettlementDashboardResponse['data'] }>(
    'admin/settlements/transactions/status/update/',
    { params }
  );
};

/**
 * Get paginated list of daily settlement transactions.
 * Used to populate the table and totals.
 *
 * @param params.filter       - One of 'this_week', 'last_week', 'this_month', 'last_month', 'custom'
 * @param params.restaurant_id - Optional restaurant ID
 * @param params.start_date   - Required if filter === 'custom'
 * @param params.end_date     - Required if filter === 'custom'
 * @param params.page         - Page number (default 1)
 * @param params.page_size    - Items per page (default 20)
 * @param params.status       - Optional status filter
 *
 * @returns Promise with SettlementTransactionsResponse
 */
export const getSettlementTransactions = (params: {
  filter: SettlementFilter;
  restaurant_id?: string;
  start_date?: string;
  end_date?: string;
  page?: number;
  page_size?: number;
  status?: string; // added
}) => {
  return API.get<{ data: SettlementTransactionsResponse['data'] }>(
    '/admin/settlements/transactions/',
    { params }
  );
};

/**
 * Export settlement report as CSV, XLSX, or PDF.
 * The exported file URL is returned in the response.
 *
 * @param payload.filter      - One of 'this_week', 'last_week', 'this_month', 'last_month', 'custom'
 * @param payload.start_date  - Start date in YYYY-MM-DD format
 * @param payload.end_date    - End date in YYYY-MM-DD format
 * @param payload.format      - 'csv', 'xlsx', or 'pdf'
 * @param payload.timezone    - Optional timezone string (e.g., 'Asia/Kolkata')
 * @param payload.restaurant_id - Optional restaurant ID
 * @param payload.status      - Optional status filter
 *
 * @returns Promise with { data: { file_url: string } }
 */
export const exportSettlementReport = (payload: {
  filter: SettlementFilter;
  start_date: string;
  end_date: string;
  format: SettlementExportFormat;
  timezone?: string;
  restaurant_id?: string;
  status?: string; // added
}) => {
  return API.post<{ data: { file_url: string } }>(
    '/admin/settlements/export/',
    payload
  );
};