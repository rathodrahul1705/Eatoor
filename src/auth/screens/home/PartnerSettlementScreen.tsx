import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  StatusBar,
  Modal,
  Dimensions,
  ActivityIndicator,
  Alert,
  Linking,
  RefreshControl,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import {
  exportSettlementReport,
  getSettlementDashboard,
  getSettlementTransactions,
  type SettlementDashboardResponse,
  type SettlementFilter,
} from '../../../api/payout';

const { width: screenWidth } = Dimensions.get('window');

// ---------- Helper: Date Utilities ----------
const getDateRange = (filter: string, customStart: Date, customEnd: Date) => {
  const now = new Date();
  const start = new Date(now);
  const end = new Date(now);
  let range = { start, end };

  switch (filter) {
    case 'thisWeek': {
      const day = now.getDay();
      const diff = day === 0 ? 6 : day - 1;
      start.setDate(now.getDate() - diff);
      start.setHours(0, 0, 0, 0);
      end.setDate(start.getDate() + 6);
      end.setHours(23, 59, 59, 999);
      range = { start, end };
      break;
    }
    case 'lastWeek': {
      const day = now.getDay();
      const diff = (day === 0 ? 6 : day - 1) + 7;
      start.setDate(now.getDate() - diff);
      start.setHours(0, 0, 0, 0);
      end.setDate(start.getDate() + 6);
      end.setHours(23, 59, 59, 999);
      range = { start, end };
      break;
    }
    case 'thisMonth': {
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      end.setMonth(now.getMonth() + 1, 0);
      end.setHours(23, 59, 59, 999);
      range = { start, end };
      break;
    }
    case 'lastMonth': {
      start.setMonth(now.getMonth() - 1, 1);
      start.setHours(0, 0, 0, 0);
      end.setMonth(now.getMonth(), 0);
      end.setHours(23, 59, 59, 999);
      range = { start, end };
      break;
    }
    case 'custom': {
      const s = new Date(customStart);
      s.setHours(0, 0, 0, 0);
      const e = new Date(customEnd);
      e.setHours(23, 59, 59, 999);
      range = { start: s, end: e };
      break;
    }
    default:
      break;
  }
  return range;
};

const toIsoDate = (d: Date) => d.toISOString().split('T')[0];

const mapUiFilterToApiFilter = (ui: string): SettlementFilter => {
  switch (ui) {
    case 'thisWeek':
      return 'this_week';
    case 'lastWeek':
      return 'last_week';
    case 'thisMonth':
      return 'this_month';
    case 'lastMonth':
      return 'last_month';
    case 'custom':
    default:
      return 'custom';
  }
};

// Helper to format currency
const formatCurrency = (amount: number): string =>
  `₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// ---------- Define DaySummary type (matches updated API) ----------
interface DaySummary {
  date: string;
  total_orders: number;
  gross_sales: number;               // subtotal
  total_delivery_fee: number;       // added
  tax: number;                      // added
  commission: number;
  net_pay: number;
  average_order_value: number;
}

// ---------- Main Component ----------
type SettlementScreenProps = { navigation: any; route: any };
const SettlementScreen = ({ navigation, route }: SettlementScreenProps) => {
  const restaurantId: string | undefined = route?.params?.restaurantId;

  const [selectedFilter, setSelectedFilter] = useState('thisWeek');
  const [customStartDate, setCustomStartDate] = useState(new Date());
  const [customEndDate, setCustomEndDate] = useState(new Date());
  const [appliedStartDate, setAppliedStartDate] = useState(new Date());
  const [appliedEndDate, setAppliedEndDate] = useState(new Date());

  const [isStartDatePickerVisible, setStartDatePickerVisible] = useState(false);
  const [isEndDatePickerVisible, setEndDatePickerVisible] = useState(false);
  const [isDetailsModalVisible, setDetailsModalVisible] = useState(false);

  const [dashboardRes, setDashboardRes] = useState<SettlementDashboardResponse | null>(null);
  const [loadingDashboard, setLoadingDashboard] = useState(false);
  const [loadingTransactions, setLoadingTransactions] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [restaurantInfo, setRestaurantInfo] = useState<{
    name: string;
    address: string;
    phone: string;
    email: string;
  } | null>(null);

  // NEW: state for transaction totals (now includes delivery fee and tax)
  const [transactionTotals, setTransactionTotals] = useState<{
    total_orders: number;
    gross_sales: number;
    total_delivery_fee: number;
    total_tax: number;
    commission: number;
    net_pay: number;
  } | null>(null);

  // Pagination state
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [allDays, setAllDays] = useState<DaySummary[]>([]);
  const loadingMoreRef = useRef(false);

  // Pull-to-refresh state
  const [refreshing, setRefreshing] = useState(false);

  const apiFilter = useMemo(() => mapUiFilterToApiFilter(selectedFilter), [selectedFilter]);
  const customRange = useMemo(
    () => getDateRange('custom', appliedStartDate, appliedEndDate),
    [appliedStartDate, appliedEndDate]
  );

  const effectiveRange = useMemo(
    () => getDateRange(selectedFilter, appliedStartDate, appliedEndDate),
    [selectedFilter, appliedStartDate, appliedEndDate]
  );

  // Fetch dashboard
  const fetchDashboard = useCallback(async () => {
    if (!restaurantId) return;
    setLoadingDashboard(true);
    try {
      const params: any = { restaurant_id: restaurantId, filter: apiFilter };
      if (apiFilter === 'custom') {
        params.start_date = toIsoDate(customRange.start);
        params.end_date = toIsoDate(customRange.end);
      }
      const res = await getSettlementDashboard(params);
      setDashboardRes(res.data);
      if (res.data?.data?.restaurant) {
        setRestaurantInfo(res.data.data.restaurant);
      }
      setErrorMessage(null);
    } catch (e: any) {
      setErrorMessage(e?.message || 'Failed to load settlement dashboard');
    } finally {
      setLoadingDashboard(false);
    }
  }, [apiFilter, customRange, restaurantId]);

  // Fetch day summaries
  const fetchDaySummaries = useCallback(
    async (pageNum: number, append: boolean = false) => {
      if (!restaurantId) return;
      if (loadingMoreRef.current && append) return;
      if (append) loadingMoreRef.current = true;

      if (pageNum === 1) setLoadingTransactions(true);
      else setLoadingMore(true);

      try {
        const params: any = {
          restaurant_id: restaurantId,
          filter: apiFilter,
          page: pageNum,
          page_size: 20,
        };
        if (apiFilter === 'custom') {
          params.start_date = toIsoDate(customRange.start);
          params.end_date = toIsoDate(customRange.end);
        }
        const res = await getSettlementTransactions(params);
        const items: DaySummary[] = res.data?.data?.items || [];
        const pagination = res.data?.data?.pagination;
        const totalPages = pagination?.total_pages || 1;
        const currentPage = pagination?.page || pageNum;

        // Update transaction totals – includes new fields
        if (res.data?.data?.totals) {
          setTransactionTotals({
            total_orders: res.data.data.totals.total_orders ?? 0,
            gross_sales: res.data.data.totals.gross_sales ?? 0,
            total_delivery_fee: res.data.data.totals.total_delivery_fee ?? 0,
            total_tax: res.data.data.totals.total_tax ?? 0,
            commission: res.data.data.totals.commission ?? 0,
            net_pay: res.data.data.totals.net_pay ?? 0,
          });
        }

        if (append) {
          setAllDays((prev) => [...prev, ...items]);
        } else {
          setAllDays(items);
        }

        setHasMore(currentPage < totalPages);
        setErrorMessage(null);
        if (!restaurantInfo && res.data?.data?.restaurant) {
          setRestaurantInfo(res.data.data.restaurant);
        }
      } catch (e: any) {
        setErrorMessage(e?.message || 'Failed to load settlement data');
      } finally {
        if (pageNum === 1) setLoadingTransactions(false);
        else setLoadingMore(false);
        loadingMoreRef.current = false;
      }
    },
    [apiFilter, customRange, restaurantId, restaurantInfo]
  );

  // Initial load
  useEffect(() => {
    if (!restaurantId) return;
    setPage(1);
    setAllDays([]);
    setHasMore(true);
    setLoadingMore(false);
    loadingMoreRef.current = false;
    setTransactionTotals(null); // reset totals

    fetchDashboard();
    fetchDaySummaries(1, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFilter, appliedStartDate, appliedEndDate, restaurantId]);

  // Load more
  const loadMore = useCallback(() => {
    if (loadingMoreRef.current || loadingMore || !hasMore || loadingTransactions) return;
    const nextPage = page + 1;
    setPage(nextPage);
    fetchDaySummaries(nextPage, true);
  }, [loadingMore, hasMore, loadingTransactions, page, fetchDaySummaries]);

  // Pull-to-refresh
  const refreshData = useCallback(async () => {
    setPage(1);
    setAllDays([]);
    setHasMore(true);
    setLoadingMore(false);
    loadingMoreRef.current = false;
    setTransactionTotals(null);
    await fetchDashboard();
    await fetchDaySummaries(1, false);
  }, [fetchDashboard, fetchDaySummaries]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    refreshData().finally(() => setRefreshing(false));
  }, [refreshData]);

  // Totals from transaction API (used for summary metrics)
  const totals = useMemo(() => {
    if (!transactionTotals) {
      return {
        totalOrders: 0,
        totalRevenue: 0,
        totalCommission: 0,
        totalNet: 0,
      };
    }
    return {
      totalOrders: transactionTotals.total_orders ?? 0,
      totalRevenue: transactionTotals.gross_sales ?? 0,      // subtotal
      totalCommission: transactionTotals.commission ?? 0,
      totalNet: transactionTotals.net_pay ?? 0,
    };
  }, [transactionTotals]);

  const currentCycle = dashboardRes?.data?.current_cycle;
  const payoutStatus = (() => {
    if (!currentCycle?.status) return 'Pending';
    if (currentCycle.status === 'paid') return 'Completed';
    if (currentCycle.status === 'processing') return 'Processing';
    return 'Pending';
  })();
  const payoutStatusColor =
    payoutStatus === 'Completed'
      ? '#2e7d32'
      : payoutStatus === 'Processing'
      ? '#1976d2'
      : '#e65100';
  const payoutStatusIcon =
    payoutStatus === 'Completed'
      ? 'checkmark-circle'
      : payoutStatus === 'Processing'
      ? 'sync-outline'
      : 'time-outline';

  const handleFilterPress = (filter: string) => {
    setSelectedFilter(filter);
    if (filter === 'custom') {
      setCustomStartDate(appliedStartDate);
      setCustomEndDate(appliedEndDate);
    }
  };

  const showStartDatePicker = () => setStartDatePickerVisible(true);
  const hideStartDatePicker = () => setStartDatePickerVisible(false);
  const handleStartDateConfirm = (date: Date) => {
    setCustomStartDate(date);
    hideStartDatePicker();
  };

  const showEndDatePicker = () => setEndDatePickerVisible(true);
  const hideEndDatePicker = () => setEndDatePickerVisible(false);
  const handleEndDateConfirm = (date: Date) => {
    setCustomEndDate(date);
    hideEndDatePicker();
  };

  const applyCustomDate = () => {
    setAppliedStartDate(customStartDate);
    setAppliedEndDate(customEndDate);
  };

  // Export
  const handleExport = async () => {
    if (!restaurantId) {
      Alert.alert('Missing restaurant', 'Restaurant id not found for settlement export.');
      return;
    }

    try {
      const range = effectiveRange;
      const payload = {
        restaurant_id: restaurantId,
        filter: apiFilter,
        start_date: toIsoDate(range.start),
        end_date: toIsoDate(range.end),
        format: 'csv' as const,
        timezone: 'Asia/Kolkata',
      };

      const res = await exportSettlementReport(payload);
      const fileUrl = res?.data?.data?.file_url;
      if (fileUrl) {
        const can = await Linking.canOpenURL(fileUrl);
        if (can) await Linking.openURL(fileUrl);
        else Alert.alert('Export ready', fileUrl);
      } else {
        Alert.alert('Export', 'Export generated, but file url is missing.');
      }
    } catch (e: any) {
      Alert.alert('Export failed', e?.message || 'Unable to export report');
    }
  };

  // ---------- Render Helpers ----------
  const renderFilterButton = (label: string, filterKey: string) => (
    <TouchableOpacity
      style={[styles.filterButton, selectedFilter === filterKey && styles.filterButtonActive]}
      onPress={() => handleFilterPress(filterKey)}
    >
      <Text
        style={[styles.filterButtonText, selectedFilter === filterKey && styles.filterButtonTextActive]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );

  const renderCompactMetric = (
    label: string,
    value: number | string,
    iconName: string,
    prefix = '',
    color = '#FF7F4D'
  ) => (
    <View style={styles.compactMetricCard}>
      <View style={[styles.compactMetricIcon, { backgroundColor: color + '15' }]}>
        <Icon name={iconName} size={18} color={color} />
      </View>
      <View style={styles.compactMetricInfo}>
        <Text style={styles.compactMetricValue}>
          {prefix}
          {typeof value === 'number' ? value.toLocaleString('en-IN') : value}
        </Text>
        <Text style={styles.compactMetricLabel}>{label}</Text>
      </View>
    </View>
  );

  // Preview item for a single day summary
  const renderDayPreview = (day: DaySummary) => (
    <TouchableOpacity
      key={day.date}
      style={styles.previewItem}
      activeOpacity={0.7}
      onPress={() => setDetailsModalVisible(true)}
    >
      <View style={styles.previewItemLeft}>
        <Text style={styles.previewOrderId}>{day.date}</Text>
        <Text style={styles.previewDate}>{day.total_orders} orders</Text>
      </View>
      <View style={styles.previewItemCenter}>
        <Text style={styles.previewType}>Avg: {formatCurrency(day.average_order_value)}</Text>
      </View>
      <Text style={styles.previewAmount}>{formatCurrency(day.net_pay)}</Text>
    </TouchableOpacity>
  );

  // Table row for day summary (uses the new fields)
  const renderSummaryRow = (day: DaySummary) => (
    <View style={styles.summaryRow} key={day.date}>
      <Text style={[styles.summaryCell, styles.colDate]}>{day.date}</Text>
      <Text style={[styles.summaryCell, styles.colOrderId]}>{day.total_orders}</Text>
      <Text style={[styles.summaryCell, styles.colCustomer]}>{formatCurrency(day.gross_sales)}</Text>
      <Text style={[styles.summaryCell, styles.colType]}>{formatCurrency(day.commission)}</Text>
      <Text style={[styles.summaryCell, styles.colPayment]}>{formatCurrency(day.net_pay)}</Text>
      <Text style={[styles.summaryCell, styles.colOrders]}>{formatCurrency(day.average_order_value)}</Text>
    </View>
  );

  // Modal item for day summary (show gross and net)
  const renderModalDayItem = (day: DaySummary) => (
    <View style={styles.modalTransactionItem} key={day.date}>
      <View style={styles.modalTransactionLeft}>
        <Text style={styles.modalTransactionDate}>{day.date}</Text>
        <Text style={styles.modalTransactionOrderId}>Orders: {day.total_orders}</Text>
        <View style={styles.modalTransactionRow}>
          <Text style={styles.modalTransactionDetail}>Gross: {formatCurrency(day.gross_sales)}</Text>
          <Text style={styles.modalTransactionDetail}>Net: {formatCurrency(day.net_pay)}</Text>
        </View>
      </View>
      <View style={styles.modalTransactionRight}>
        <Text style={styles.modalTransactionAmount}>{formatCurrency(day.net_pay)}</Text>
        <Text style={styles.modalTransactionType}>Avg: {formatCurrency(day.average_order_value)}</Text>
      </View>
    </View>
  );

  // ---------- Render ----------
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="arrow-back" size={24} color="#1A1A2E" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settlement</Text>
        <TouchableOpacity style={styles.exportButton} onPress={handleExport}>
          {/* <Icon name="download-outline" size={24} color="#FF7F4D" /> */}
        </TouchableOpacity>
      </View>

      {!restaurantId && (
        <View style={styles.bannerWarning}>
          <Text style={styles.bannerWarningTitle}>Restaurant not selected</Text>
          <Text style={styles.bannerWarningText}>
            Please go back and select a restaurant to view settlements.
          </Text>
        </View>
      )}

      {!!errorMessage && (
        <View style={styles.bannerError}>
          <Text style={styles.bannerErrorTitle}>Error</Text>
          <Text style={styles.bannerErrorText}>{errorMessage}</Text>
        </View>
      )}

      {/* Main vertical ScrollView with RefreshControl */}
      <ScrollView
        style={styles.verticalScroll}
        contentContainerStyle={styles.verticalScrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#FF7F4D']}
            tintColor="#FF7F4D"
          />
        }
        onScroll={({ nativeEvent }) => {
          const { contentOffset, contentSize, layoutMeasurement } = nativeEvent;
          const paddingToBottom = 20;
          if (contentOffset.y + layoutMeasurement.height >= contentSize.height - paddingToBottom) {
            loadMore();
          }
        }}
        scrollEventThrottle={16}
      >
        {/* Restaurant Card */}
        <View style={styles.restaurantCard}>
          <View style={styles.restaurantHeader}>
            <View style={styles.restaurantLogo}>
              <Icon name="restaurant-outline" size={40} color="#FF7F4D" />
            </View>
            <View style={styles.restaurantDetails}>
              <Text style={styles.restaurantName}>
                {restaurantInfo?.name || 'Restaurant Name'}
              </Text>
              <Text style={styles.restaurantAddress}>
                {restaurantInfo?.address || 'Address not available'}
              </Text>
              <Text style={styles.restaurantContact}>
                {restaurantInfo?.phone || ''} {restaurantInfo?.email ? `| ${restaurantInfo.email}` : ''}
              </Text>
            </View>
          </View>
        </View>

        {/* Payout Cycle Card */}
        <View style={styles.payoutCard}>
          <View style={styles.payoutHeader}>
            <View style={styles.payoutHeaderLeft}>
              <Icon name="calendar-outline" size={22} color="#FF7F4D" />
              <Text style={styles.payoutTitle}>Current Cycle</Text>
            </View>
            <View style={styles.payoutStatusContainer}>
              <Icon name={payoutStatusIcon} size={16} color={payoutStatusColor} />
              <Text style={[styles.payoutStatus, { color: payoutStatusColor }]}>
                {payoutStatus}
              </Text>
            </View>
          </View>

          <View style={styles.payoutDates}>
            <View style={styles.payoutDateItem}>
              <Text style={styles.payoutDateLabel}>Week</Text>
              <Text style={styles.payoutDateValue}>
                {currentCycle?.cycle_start_date
                  ? new Date(currentCycle.cycle_start_date).toLocaleDateString('en-IN')
                  : '--'}{' '}
                -{' '}
                {currentCycle?.cycle_end_date
                  ? new Date(currentCycle.cycle_end_date).toLocaleDateString('en-IN')
                  : '--'}
              </Text>
            </View>
            <View style={styles.payoutDateItem}>
              <Text style={styles.payoutDateLabel}>Payout Date</Text>
              <Text style={styles.payoutDateValue}>
                {currentCycle?.payout_date
                  ? new Date(currentCycle.payout_date).toLocaleDateString('en-IN')
                  : '--'}
              </Text>
            </View>
          </View>

          <View style={styles.payoutSummary}>
            <View style={styles.payoutSummaryItem}>
              <Text style={styles.payoutSummaryLabel}>Orders</Text>
              <Text style={styles.payoutSummaryValue}>{currentCycle?.orders ?? 0}</Text>
            </View>
            <View style={styles.payoutSummaryItem}>
              <Text style={styles.payoutSummaryLabel}>Revenue</Text>
              <Text style={styles.payoutSummaryValue}>
                ₹{(currentCycle?.revenue ?? 0).toLocaleString('en-IN')}
              </Text>
            </View>
            <View style={styles.payoutSummaryItem}>
              <Text style={styles.payoutSummaryLabel}>Net Pay</Text>
              <Text style={styles.payoutSummaryValue}>
                ₹{(currentCycle?.net_pay ?? 0).toLocaleString('en-IN')}
              </Text>
            </View>
            <View style={styles.payoutSummaryItem}>
              <Text style={styles.payoutSummaryLabel}>Commission</Text>
              <Text style={styles.payoutSummaryValue}>
                ₹{(currentCycle?.commission ?? 0).toLocaleString('en-IN')}
              </Text>
            </View>
          </View>

          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${currentCycle?.progress_percent ?? 0}%` },
                ]}
              />
            </View>
            <Text style={styles.progressLabel}>
              {payoutStatus === 'Completed'
                ? 'Cycle Completed'
                : payoutStatus === 'Processing'
                ? 'Processing Payout'
                : 'Week in Progress'}
            </Text>
          </View>
        </View>

        {/* Filter Buttons */}
        <View style={styles.filterWrapper}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterScroll}
          >
            {renderFilterButton('This Week', 'thisWeek')}
            {renderFilterButton('Last Week', 'lastWeek')}
            {renderFilterButton('This Month', 'thisMonth')}
            {renderFilterButton('Last Month', 'lastMonth')}
            {renderFilterButton('Custom', 'custom')}
          </ScrollView>
        </View>

        {selectedFilter === 'custom' && (
          <View style={styles.customDateContainer}>
            <View style={styles.customDateRow}>
              <TouchableOpacity onPress={showStartDatePicker} style={styles.dateButton}>
                <Icon name="calendar-outline" size={18} color="#FF7F4D" />
                <Text style={styles.dateButtonText}>
                  Start: {customStartDate.toLocaleDateString('en-IN')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={showEndDatePicker} style={styles.dateButton}>
                <Icon name="calendar-outline" size={18} color="#FF7F4D" />
                <Text style={styles.dateButtonText}>
                  End: {customEndDate.toLocaleDateString('en-IN')}
                </Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={styles.applyButton} onPress={applyCustomDate}>
              <Text style={styles.applyButtonText}>Apply</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Compact Summary Metrics - now using transaction totals (subtotal based) */}
        <View style={styles.sectionTitle}>
          <Icon name="stats-chart-outline" size={20} color="#FF7F4D" />
          <Text style={styles.sectionTitleText}>Summary</Text>
        </View>
        <View style={styles.compactMetricsRow}>
          {renderCompactMetric('Orders', totals.totalOrders, 'receipt-outline', '', '#1A1A2E')}
          {renderCompactMetric('Gross', totals.totalRevenue, 'cash-outline', '₹', '#2e7d32')}
          {renderCompactMetric('Net', totals.totalNet, 'wallet-outline', '₹', '#FF7F4D')}
          {renderCompactMetric('Commission', totals.totalCommission, 'pie-chart-outline', '₹', '#d32f2f')}
        </View>

        {/* Daily Summary Preview List */}
        {/* <View style={styles.previewSection}>
          <View style={styles.previewHeader}>
            <Icon name="list-outline" size={20} color="#FF7F4D" />
            <Text style={styles.previewTitle}>Daily Summary</Text>
            {allDays.length > 0 && (
              <TouchableOpacity onPress={() => setDetailsModalVisible(true)}>
                <Text style={styles.viewAllLink}>View All</Text>
              </TouchableOpacity>
            )}
          </View>
          {loadingTransactions ? (
            <ActivityIndicator size="small" color="#FF7F4D" style={{ marginVertical: 20 }} />
          ) : allDays.length === 0 ? (
            <Text style={styles.emptyText}>No data found for the selected period.</Text>
          ) : (
            <>
              {allDays.slice(0, 5).map((day) => renderDayPreview(day))}
              {allDays.length > 5 && (
                <TouchableOpacity
                  style={styles.showMoreButton}
                  onPress={() => setDetailsModalVisible(true)}
                >
                  <Text style={styles.showMoreText}>Show all {allDays.length} days</Text>
                </TouchableOpacity>
              )}
            </>
          )}
        </View> */}

        {/* Table section - horizontally scrollable */}
        <View style={styles.tableContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={true}>
            <View style={{ width: 600 }}>
              {/* Table Header */}
              <View style={styles.summaryHeader}>
                <Text style={[styles.summaryHeaderText, styles.colDate]}>Date</Text>
                <Text style={[styles.summaryHeaderText, styles.colOrderId]}>Orders</Text>
                <Text style={[styles.summaryHeaderText, styles.colCustomer]}>Gross</Text>
                <Text style={[styles.summaryHeaderText, styles.colType]}>Commission</Text>
                <Text style={[styles.summaryHeaderText, styles.colPayment]}>Net</Text>
                <Text style={[styles.summaryHeaderText, styles.colOrders]}>Avg Order</Text>
              </View>

              {/* Table Rows */}
              {allDays.map((day) => renderSummaryRow(day))}
              {allDays.length === 0 && !loadingTransactions && (
                <View style={styles.emptyTableRow}>
                  <Text style={styles.emptyText}>No data to display</Text>
                </View>
              )}
            </View>
          </ScrollView>
        </View>

        {/* Loading more indicator */}
        {loadingMore && (
          <View style={styles.loadingMoreContainer}>
            <ActivityIndicator size="small" color="#FF7F4D" />
            <Text style={styles.loadingMoreText}>Loading more...</Text>
          </View>
        )}
        {!hasMore && allDays.length > 0 && (
          <Text style={styles.endMessage}>No more data</Text>
        )}
        {allDays.length === 0 && !loadingTransactions && !loadingDashboard && (
          <Text style={styles.emptyText}>No settlements found.</Text>
        )}
        <View style={{ height: 20 }} />
      </ScrollView>

      {/* Modal */}
      <Modal
        visible={isDetailsModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setDetailsModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Daily Summary</Text>
              <TouchableOpacity onPress={() => setDetailsModalVisible(false)}>
                <Icon name="close" size={28} color="#333" />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              {allDays.map((day) => renderModalDayItem(day))}
              {allDays.length === 0 && (
                <Text style={styles.emptyText}>No data available.</Text>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <DateTimePickerModal
        isVisible={isStartDatePickerVisible}
        mode="date"
        onConfirm={handleStartDateConfirm}
        onCancel={hideStartDatePicker}
        date={customStartDate}
      />
      <DateTimePickerModal
        isVisible={isEndDatePickerVisible}
        mode="date"
        onConfirm={handleEndDateConfirm}
        onCancel={hideEndDatePicker}
        date={customEndDate}
      />
    </SafeAreaView>
  );
};

// ---------- Styles (unchanged) ----------
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FC',
  },
  verticalScroll: {
    flex: 1,
  },
  verticalScrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 30,
    paddingTop: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#EEF0F4',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
  },
  backButton: { padding: 4 },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#1A1A2E', letterSpacing: 0.3 },
  exportButton: { padding: 4 },

  restaurantCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#EEF0F4',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  restaurantHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  restaurantLogo: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FFF0EE',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  restaurantDetails: { flex: 1 },
  restaurantName: { fontSize: 18, fontWeight: '700', color: '#1A1A2E' },
  restaurantAddress: { fontSize: 13, color: '#8E8EA0', marginTop: 2 },
  restaurantContact: { fontSize: 13, color: '#8E8EA0', marginTop: 2 },

  payoutCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#EEF0F4',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 4,
  },
  payoutHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F4F8',
    paddingBottom: 12,
  },
  payoutHeaderLeft: { flexDirection: 'row', alignItems: 'center' },
  payoutTitle: { fontSize: 16, fontWeight: '700', color: '#1A1A2E', marginLeft: 8 },
  payoutStatusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F2F4F8',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
  },
  payoutStatus: { fontSize: 13, fontWeight: '600', marginLeft: 4 },
  payoutDates: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 14 },
  payoutDateItem: { flex: 1 },
  payoutDateLabel: {
    fontSize: 12,
    color: '#8E8EA0',
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  payoutDateValue: { fontSize: 12, fontWeight: '600', color: '#1A1A2E', marginTop: 2 },
  payoutSummary: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 6,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F2F4F8',
    flexWrap: 'wrap',
  },
  payoutSummaryItem: { alignItems: 'center', marginHorizontal: 4 },
  payoutSummaryLabel: {
    fontSize: 11,
    color: '#8E8EA0',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  payoutSummaryValue: { fontSize: 15, fontWeight: '700', color: '#FF7F4D', marginTop: 2 },
  progressContainer: { marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#F2F4F8' },
  progressBar: { height: 6, backgroundColor: '#F0F0F5', borderRadius: 6, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#FF7F4D', borderRadius: 6 },
  progressLabel: { fontSize: 12, color: '#8E8EA0', marginTop: 6, textAlign: 'center', fontWeight: '500' },

  sectionTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    marginTop: 8,
  },
  sectionTitleText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A2E',
    marginLeft: 8,
  },

  compactMetricsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  compactMetricCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    width: '48%',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#F0F2F6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 4,
    elevation: 1,
  },
  compactMetricIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  compactMetricInfo: {
    flex: 1,
  },
  compactMetricValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1A2E',
  },
  compactMetricLabel: {
    fontSize: 11,
    color: '#8E8EA0',
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },

  filterWrapper: { marginVertical: 8 },
  filterScroll: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4 },
  filterButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: '#DDDFE6',
    backgroundColor: '#FFFFFF',
    marginRight: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 4,
    elevation: 1,
  },
  filterButtonActive: {
    backgroundColor: '#FF7F4D',
    borderColor: '#FF7F4D',
    shadowColor: '#FF7F4D',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
  },
  filterButtonText: { fontSize: 14, fontWeight: '600', color: '#4A4A5A' },
  filterButtonTextActive: { color: '#FFFFFF' },

  customDateContainer: {
    marginBottom: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: '#F0F2F6',
  },
  customDateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 30,
    borderWidth: 1.5,
    borderColor: '#FF7F4D',
    flex: 0.48,
    justifyContent: 'center',
  },
  dateButtonText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#1A1A2E',
    marginLeft: 6,
  },
  applyButton: {
    backgroundColor: '#FF7F4D',
    borderRadius: 30,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FF7F4D',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
  },
  applyButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },

  previewSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#F0F2F6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  previewTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1A2E',
    marginLeft: 8,
    flex: 1,
  },
  viewAllLink: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FF7F4D',
  },
  previewItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F6FA',
  },
  previewItemLeft: {
    flex: 1,
  },
  previewOrderId: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A2E',
  },
  previewDate: {
    fontSize: 12,
    color: '#8E8EA0',
    marginTop: 2,
  },
  previewItemCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 8,
  },
  previewType: {
    fontSize: 12,
    color: '#4A4A5A',
    marginRight: 6,
  },
  previewAmount: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FF7F4D',
  },
  showMoreButton: {
    marginTop: 10,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 30,
    backgroundColor: '#F8F9FC',
    borderWidth: 1,
    borderColor: '#EEF0F4',
  },
  showMoreText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FF7F4D',
  },

  tableContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 3,
    marginTop: 6,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#F0F2F6',
  },
  summaryHeader: {
    flexDirection: 'row',
    backgroundColor: '#F8F9FC',
    paddingVertical: 14,
    paddingHorizontal: 10,
    borderBottomWidth: 2,
    borderBottomColor: '#FF7F4D',
  },
  summaryHeaderText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1A1A2E',
    textAlign: 'center',
  },
  summaryRow: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F4F8',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
  },
  summaryCell: {
    textAlign: 'center',
    fontSize: 13,
    color: '#1A1A2E',
  },
  colDate: { width: 100 },
  colOrderId: { width: 80 },
  colCustomer: { width: 90 },
  colType: { width: 100 },
  colPayment: { width: 90 },
  colOrders: { width: 90 },

  emptyTableRow: {
    padding: 20,
    alignItems: 'center',
  },

  emptyText: {
    textAlign: 'center',
    padding: 20,
    color: '#A0A0B0',
    fontSize: 16,
  },
  loadingMoreContainer: {
    paddingVertical: 16,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  loadingMoreText: { marginLeft: 8, color: '#8E8EA0', fontSize: 14 },
  endMessage: { textAlign: 'center', paddingVertical: 16, color: '#8E8EA0', fontSize: 14 },

  bannerWarning: {
    padding: 12,
    backgroundColor: '#fff3e0',
    borderRadius: 12,
    marginBottom: 12,
    marginHorizontal: 16,
  },
  bannerWarningTitle: { color: '#e65100', fontWeight: '700' },
  bannerWarningText: { color: '#8E8EA0', marginTop: 4 },
  bannerError: {
    padding: 12,
    backgroundColor: '#ffebee',
    borderRadius: 12,
    marginBottom: 12,
    marginHorizontal: 16,
  },
  bannerErrorTitle: { color: '#b71c1c', fontWeight: '700' },
  bannerErrorText: { color: '#8E8EA0', marginTop: 4 },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    width: '92%',
    maxHeight: '80%',
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#EEF0F4',
    paddingBottom: 14,
    marginBottom: 14,
  },
  modalTitle: { fontSize: 20, fontWeight: '700', color: '#1A1A2E' },
  modalTransactionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F6FA',
  },
  modalTransactionLeft: { flex: 1, marginRight: 8 },
  modalTransactionDate: { fontSize: 14, fontWeight: '600', color: '#1A1A2E' },
  modalTransactionOrderId: { fontSize: 12, color: '#8E8EA0', marginTop: 2 },
  modalTransactionRow: { flexDirection: 'row', justifyContent: 'flex-start', marginTop: 2 },
  modalTransactionDetail: { fontSize: 12, color: '#5A5A6E', marginRight: 12 },
  modalTransactionRight: { alignItems: 'flex-end' },
  modalTransactionAmount: { fontSize: 16, fontWeight: '700', color: '#1A1A2E', marginBottom: 4 },
  modalTransactionType: { fontSize: 11, color: '#8E8EA0', marginTop: 2 },
});

export default SettlementScreen;