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
  TextInput,
  FlatList,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import {
  getRestaurantList,
  settlementStatusUpdate,
  exportSettlementReport,
  getSettlementDashboard,
  getSettlementTransactions,
  type SettlementDashboardResponse,
  type SettlementFilter,
} from '../../../api/admin_settle';

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

const toLocalDateString = (d: Date): string => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

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

const formatCurrency = (amount: number): string =>
  `₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const formatDate = (dateStr: string): string => {
  if (!dateStr) return '—';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);
  const d = new Date(year, month, day);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

// ---------- Status Mapping ----------
const STATUS_MAP = {
  1: { label: 'Pending', color: '#f57c00', icon: 'time-outline' },
  2: { label: 'Approved', color: '#1976d2', icon: 'checkmark-circle-outline' },
  3: { label: 'Paid', color: '#2e7d32', icon: 'cash-outline' },
  4: { label: 'Cancelled', color: '#c62828', icon: 'close-circle-outline' },
} as const;

type StatusKey = keyof typeof STATUS_MAP; // 1|2|3|4

// UI filter keys mapping to status numbers
const STATUS_FILTER_MAP = {
  pending: 1,
  approved: 2,
  paid: 3,
  cancelled: 4,
} as const;

// Reverse mapping: numeric status -> UI filter key
const STATUS_NUM_TO_UI: Record<StatusKey, UiStatusFilter> = {
  1: 'pending',
  2: 'approved',
  3: 'paid',
  4: 'cancelled',
};

type UiStatusFilter = keyof typeof STATUS_FILTER_MAP | 'all';

// ---------- Types ----------
interface DaySummary {
  date?: string;
  total_orders: number;
  item_gross_sale: number;
  gross_sale: number;
  total_delivery_fee: number;
  tax: number;
  eatoor_commission: number;
  restaurant_net_pay: number;
  average_order_value: number;
  settlement_id: string;
  status: number; // now numeric 1-4
  restaurant_name: string;
  start_date: string;
  end_date: string;
  payout_date: string;
  settlement_file?: string | null; // NEW: invoice URL
}

interface Restaurant {
  id: string;
  name: string;
  profile_image?: string | null;
}

// ---------- Constants ----------
const ALL_RESTAURANTS_ID = 'all';

// ---------- Main Component ----------
type SettlementScreenProps = { navigation: any; route: any };
const SettlementDashboardScreen = ({ navigation, route }: SettlementScreenProps) => {
  const initialRestaurantId: string | undefined = route?.params?.restaurantId;

  // ---------- State ----------
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [selectedRestaurantId, setSelectedRestaurantId] = useState<string | null>(
    initialRestaurantId || ALL_RESTAURANTS_ID
  );
  const [isRestaurantPickerVisible, setIsRestaurantPickerVisible] = useState(false);

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
    profile_image?: string | null;
  } | null>(null);

  const [transactionTotals, setTransactionTotals] = useState<{
    total_orders: number;
    item_gross_sale: number;
    gross_sale: number;
    total_delivery_fee: number;
    total_tax: number;
    eatoor_commission: number;
    restaurant_net_pay: number;
  } | null>(null);

  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [allDays, setAllDays] = useState<DaySummary[]>([]);
  const loadingMoreRef = useRef(false);

  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState<UiStatusFilter>('all');
  const [settlementNumberFilter, setSettlementNumberFilter] = useState('');

  // State for tracking which settlement IDs are currently updating status
  const [updatingSettlementIds, setUpdatingSettlementIds] = useState<Set<string>>(new Set());

  const apiFilter = useMemo(() => mapUiFilterToApiFilter(selectedFilter), [selectedFilter]);
  const customRange = useMemo(
    () => getDateRange('custom', appliedStartDate, appliedEndDate),
    [appliedStartDate, appliedEndDate]
  );
  const effectiveRange = useMemo(
    () => getDateRange(selectedFilter, appliedStartDate, appliedEndDate),
    [selectedFilter, appliedStartDate, appliedEndDate]
  );

  // Refs to prevent duplicate calls
  const initialLoadDone = useRef(false);
  const isFetching = useRef(false);
  const mounted = useRef(true);

  // ---------- Fetch restaurants ----------
  const fetchRestaurants = useCallback(async () => {
    try {
      const res = await getRestaurantList('2');
      const data = (res as any)?.data || res;
      const liveRestaurants = data.live_restaurants || [];
      const mappedRestaurants: Restaurant[] = liveRestaurants.map((item: any) => ({
        id: item.restaurant_id,
        name: item.restaurant_name,
        profile_image: item.profile_image || null,
      }));
      setRestaurants(mappedRestaurants);
      if (!initialRestaurantId) {
        setSelectedRestaurantId(ALL_RESTAURANTS_ID);
      }
    } catch (e) {
      console.error('Failed to fetch restaurants', e);
      Alert.alert('Error', 'Could not load restaurant list');
    }
  }, [initialRestaurantId]);

  useEffect(() => {
    fetchRestaurants();
  }, [fetchRestaurants]);

  // ---------- Fetch dashboard ----------
  const fetchDashboard = useCallback(async () => {
    if (!selectedRestaurantId) return;
    setLoadingDashboard(true);
    try {
      const params: any = { filter: apiFilter };
      if (selectedRestaurantId !== ALL_RESTAURANTS_ID) {
        params.restaurant_id = selectedRestaurantId;
      }
      if (apiFilter === 'custom') {
        params.start_date = toLocalDateString(customRange.start);
        params.end_date = toLocalDateString(customRange.end);
      }
      // Status filter: convert to number if not 'all'
      if (statusFilter !== 'all') {
        params.status = STATUS_FILTER_MAP[statusFilter];
      }

      const res = await getSettlementDashboard(params);
      if (!mounted.current) return;
      setDashboardRes(res.data);
      if (res.data?.data?.restaurant) {
        const { id, name, address, phone, email, profile_image } = res.data.data.restaurant;
        setRestaurantInfo({
          name: name || 'Restaurant Name',
          address: address || 'Address not available',
          phone: phone || '',
          email: email || '',
          profile_image: profile_image || null,
        });
      } else {
        setRestaurantInfo(null);
      }
      setErrorMessage(null);
    } catch (e: any) {
      if (!mounted.current) return;
      setErrorMessage(e?.message || 'Failed to load settlement dashboard');
    } finally {
      if (mounted.current) setLoadingDashboard(false);
    }
  }, [apiFilter, customRange, selectedRestaurantId, statusFilter]);

  // ---------- Fetch day summaries ----------
  const fetchDaySummaries = useCallback(
    async (pageNum: number, append: boolean = false) => {
      if (!selectedRestaurantId) return;
      if (loadingMoreRef.current && append) return;
      if (append) loadingMoreRef.current = true;

      if (pageNum === 1) setLoadingTransactions(true);
      else setLoadingMore(true);

      try {
        const params: any = {
          filter: apiFilter,
          page: pageNum,
          page_size: 20,
        };
        if (selectedRestaurantId !== ALL_RESTAURANTS_ID) {
          params.restaurant_id = selectedRestaurantId;
        }
        if (apiFilter === 'custom') {
          params.start_date = toLocalDateString(customRange.start);
          params.end_date = toLocalDateString(customRange.end);
        }
        // Status filter: convert to number if not 'all'
        if (statusFilter !== 'all') {
          params.status = STATUS_FILTER_MAP[statusFilter];
        }

        const res = await getSettlementTransactions(params);
        if (!mounted.current) return;

        const items: DaySummary[] = (res.data?.data?.items || []).map((item: any) => ({
          date: item.date || item.start_date,
          total_orders: Number(item.total_orders),
          item_gross_sale: Number(item.item_gross_sale),
          gross_sale: Number(item.gross_sale),
          total_delivery_fee: Number(item.total_delivery_fee),
          tax: Number(item.tax),
          eatoor_commission: Number(item.eatoor_commission),
          restaurant_net_pay: Number(item.restaurant_net_pay),
          average_order_value: Number(item.average_order_value),
          settlement_id: item.settlement_id || `SET-${String(items.length + 1).padStart(4, '0')}`,
          status: Number(item.status), // ensure numeric
          restaurant_name: item.restaurant_name || restaurantInfo?.name || 'Restaurant',
          start_date: item.start_date || '',
          end_date: item.end_date || '',
          payout_date: item.payout_date || '',
          settlement_file: item.settlement_file || null, // NEW: include the file URL
        }));

        const pagination = res.data?.data?.pagination;
        const totalPages = pagination?.total_pages || 1;
        const currentPage = pagination?.page || pageNum;

        if (res.data?.data?.totals) {
          setTransactionTotals({
            total_orders: res.data.data.totals.total_orders ?? 0,
            item_gross_sale: res.data.data.totals.item_gross_sale ?? 0,
            gross_sale: res.data.data.totals.gross_sale ?? 0,
            total_delivery_fee: res.data.data.totals.total_delivery_fee ?? 0,
            total_tax: res.data.data.totals.total_tax ?? 0,
            eatoor_commission: res.data.data.totals.eatoor_commission ?? 0,
            restaurant_net_pay: res.data.data.totals.restaurant_net_pay ?? 0,
          });
        }

        if (append) {
          setAllDays((prev) => [...prev, ...items]);
        } else {
          setAllDays(items);
        }

        setHasMore(currentPage < totalPages);
        setErrorMessage(null);

        if (res.data?.data?.restaurant && selectedRestaurantId !== ALL_RESTAURANTS_ID) {
          const { id, name, address, phone, email, profile_image } = res.data.data.restaurant;
          setRestaurantInfo({
            name: name || 'Restaurant Name',
            address: address || 'Address not available',
            phone: phone || '',
            email: email || '',
            profile_image: profile_image || null,
          });
        } else if (selectedRestaurantId === ALL_RESTAURANTS_ID) {
          setRestaurantInfo(null);
        }
      } catch (e: any) {
        if (!mounted.current) return;
        setErrorMessage(e?.message || 'Failed to load settlement data');
        if (pageNum === 1 && !append) {
          setAllDays([]);
          setTransactionTotals(null);
        }
      } finally {
        if (pageNum === 1) setLoadingTransactions(false);
        else setLoadingMore(false);
        loadingMoreRef.current = false;
      }
    },
    [apiFilter, customRange, selectedRestaurantId, statusFilter, restaurantInfo?.name]
  );

  // ---------- Fetch both dashboard and transactions ----------
  const fetchData = useCallback(async () => {
    if (!selectedRestaurantId || isFetching.current) return;
    isFetching.current = true;
    setPage(1);
    setAllDays([]);
    setHasMore(true);
    setLoadingMore(false);
    loadingMoreRef.current = false;
    setTransactionTotals(null);

    try {
      await Promise.all([fetchDashboard(), fetchDaySummaries(1, false)]);
    } finally {
      isFetching.current = false;
    }
  }, [selectedRestaurantId, fetchDashboard, fetchDaySummaries]);

  // ---------- Initial load and filter changes ----------
  useEffect(() => {
    if (!mounted.current) return;
    fetchData();
  }, [fetchData]);

  // Cleanup
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // ---------- Load more ----------
  const loadMore = useCallback(() => {
    if (loadingMoreRef.current || loadingMore || !hasMore || loadingTransactions) return;
    const nextPage = page + 1;
    setPage(nextPage);
    fetchDaySummaries(nextPage, true);
  }, [loadingMore, hasMore, loadingTransactions, page, fetchDaySummaries]);

  // ---------- Pull-to-refresh ----------
  const refreshData = useCallback(async () => {
    if (!selectedRestaurantId || isFetching.current) return;
    isFetching.current = true;
    setPage(1);
    setAllDays([]);
    setHasMore(true);
    setLoadingMore(false);
    loadingMoreRef.current = false;
    setTransactionTotals(null);
    try {
      await Promise.all([fetchDashboard(), fetchDaySummaries(1, false)]);
    } finally {
      isFetching.current = false;
    }
  }, [fetchDashboard, fetchDaySummaries, selectedRestaurantId]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    refreshData().finally(() => setRefreshing(false));
  }, [refreshData]);

  // ---------- Status update ----------
  const handleStatusChange = useCallback(
    async (item: DaySummary, newStatus: number) => {
      // Prevent if already updating this settlement
      if (updatingSettlementIds.has(item.settlement_id)) return;

      Alert.alert(
        'Change Status',
        `Update settlement ${item.settlement_id} status to ${STATUS_MAP[newStatus as StatusKey]?.label || 'Unknown'}?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Update',
            onPress: async () => {
              // Add to updating set
              setUpdatingSettlementIds((prev) => new Set(prev).add(item.settlement_id));
              try {
                await settlementStatusUpdate({
                  settlement_id: item.settlement_id,
                  status: newStatus, // send number
                });
                Alert.alert('Success', 'Status updated successfully');
                // Apply the new status as the filter so next API call uses it
                const uiFilter = STATUS_NUM_TO_UI[newStatus as StatusKey];
                if (uiFilter) {
                  setStatusFilter(uiFilter);
                }
              } catch (e: any) {
                Alert.alert('Error', e?.message || 'Failed to update status');
              } finally {
                // Remove from updating set
                setUpdatingSettlementIds((prev) => {
                  const newSet = new Set(prev);
                  newSet.delete(item.settlement_id);
                  return newSet;
                });
              }
            },
          },
        ]
      );
    },
    [updatingSettlementIds]
  );

  // ---------- Export ----------
  const handleExport = useCallback(async () => {
    if (!selectedRestaurantId) {
      Alert.alert('Missing restaurant', 'Please select a restaurant first.');
      return;
    }
    try {
      const range = effectiveRange;
      const payload: any = {
        filter: apiFilter,
        start_date: toLocalDateString(range.start),
        end_date: toLocalDateString(range.end),
        format: 'csv' as const,
        timezone: 'Asia/Kolkata',
      };
      if (selectedRestaurantId !== ALL_RESTAURANTS_ID) {
        payload.restaurant_id = selectedRestaurantId;
      }
      if (statusFilter !== 'all') {
        payload.status = STATUS_FILTER_MAP[statusFilter];
      }
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
  }, [selectedRestaurantId, effectiveRange, apiFilter, statusFilter]);

  // ---------- Derived data ----------
  const settlementItems = allDays;

  const statusCounts = useMemo(() => {
    const counts: Record<StatusKey, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
    settlementItems.forEach((item) => {
      const s = item.status as StatusKey;
      if (s in counts) counts[s]++;
    });
    return counts;
  }, [settlementItems]);

  const filteredItems = useMemo(() => {
    let items = settlementItems;
    if (settlementNumberFilter.trim()) {
      items = items.filter((item) =>
        String(item.settlement_id)
          .toLowerCase()
          .includes(settlementNumberFilter.trim().toLowerCase())
      );
    }
    return items;
  }, [settlementItems, settlementNumberFilter]);

  // ---------- Render Helpers ----------
  const renderStatusCard = (
    label: string,
    count: number,
    statusKey: UiStatusFilter, // 'pending'|'approved'|'paid'|'cancelled'
    icon: string,
    color: string
  ) => (
    <TouchableOpacity
      style={[styles.sdaStatusCard, statusFilter === statusKey && styles.sdaStatusCardActive]}
      onPress={() => setStatusFilter(statusFilter === statusKey ? 'all' : statusKey)}
      activeOpacity={0.8}
    >
      <View style={[styles.sdaStatusIconContainer, { backgroundColor: color + '15' }]}>
        <Icon name={icon} size={18} color={color} />
      </View>
      <Text style={styles.sdaStatusCount}>{count}</Text>
      <Text style={styles.sdaStatusLabel}>{label}</Text>
    </TouchableOpacity>
  );

  const renderSettlementItem = ({ item }: { item: DaySummary }) => {
    const statusNum = item.status as StatusKey;
    const statusInfo = STATUS_MAP[statusNum] || { label: 'Unknown', color: '#8E8EA0' };
    const { label, color } = statusInfo;
    const isUpdating = updatingSettlementIds.has(item.settlement_id);

    return (
      <View style={styles.sdaSettlementRow}>
        <Text style={[styles.sdaSettlementCell, styles.sdaColSettlementId]}>
          {String(item.settlement_id ?? '—')}
        </Text>
        <Text style={[styles.sdaSettlementCell, styles.sdaColStartDate]}>
          {formatDate(item.start_date)}
        </Text>
        <Text style={[styles.sdaSettlementCell, styles.sdaColEndDate]}>
          {formatDate(item.end_date)}
        </Text>
        <Text style={[styles.sdaSettlementCell, styles.sdaColPayoutDate]}>
          {formatDate(item.payout_date)}
        </Text>
        <Text style={[styles.sdaSettlementCell, styles.sdaColRestaurant]}>
          {item.restaurant_name || '—'}
        </Text>
        <Text style={[styles.sdaSettlementCell, styles.sdaColAmount]}>
          {formatCurrency(item.restaurant_net_pay)}
        </Text>
        <View style={[styles.sdaSettlementCell, styles.sdaColStatus]}>
          <View style={[styles.sdaStatusBadge, { backgroundColor: color + '20' }]}>
            <Text style={[styles.sdaStatusBadgeText, { color }]}>{label}</Text>
          </View>
        </View>
        {/* Invoice column */}
        <View style={[styles.sdaSettlementCell, styles.sdaColInvoice]}>
          {item.settlement_file ? (
            <TouchableOpacity
              onPress={() => {
                Linking.openURL(item.settlement_file).catch(() =>
                  Alert.alert('Error', 'Unable to open the file')
                );
              }}
              style={styles.sdaInvoiceButton}
            >
              <Icon name="download-outline" size={20} color="#FF7F4D" />
            </TouchableOpacity>
          ) : (
            <Text style={{ color: '#A0A0B0' }}>—</Text>
          )}
        </View>
        {/* Action column */}
        <View style={[styles.sdaSettlementCell, styles.sdaColActions]}>
          {isUpdating ? (
            <ActivityIndicator size="small" color="#FF7F4D" />
          ) : (
            <TouchableOpacity
              style={styles.sdaActionButton}
              onPress={() => {
                const statusOptions = [
                  { label: 'Pending', value: 1 },
                  { label: 'Approved', value: 2 },
                  { label: 'Paid', value: 3 },
                  { label: 'Cancelled', value: 4 },
                ];
                Alert.alert(
                  'Change Status',
                  `Select new status for ${item.settlement_id}`,
                  [
                    ...statusOptions.map((opt) => ({
                      text: opt.label,
                      onPress: () => handleStatusChange(item, opt.value),
                    })),
                    { text: 'Cancel', style: 'cancel' },
                  ]
                );
              }}
            >
              <Icon name="ellipsis-vertical" size={20} color="#8E8EA0" />
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  // ---------- Main render ----------
  const selectedRestaurantName =
    selectedRestaurantId === ALL_RESTAURANTS_ID
      ? 'All Restaurants'
      : restaurants.find((r) => r.id === selectedRestaurantId)?.name || 'Select Restaurant';

  const pickerRestaurants = useMemo(() => {
    const allOption: Restaurant = { id: ALL_RESTAURANTS_ID, name: 'All Restaurants' };
    return [allOption, ...restaurants];
  }, [restaurants]);

  return (
    <SafeAreaView style={styles.sdaContainer}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      <View style={styles.sdaHeader}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.sdaBackButton}>
          <Icon name="arrow-back" size={24} color="#1A1A2E" />
        </TouchableOpacity>
        <Text style={styles.sdaHeaderTitle}>Settlement Dashboard</Text>
        <TouchableOpacity style={styles.sdaExportButton} onPress={handleExport}>
          {/* <Icon name="download-outline" size={24} color="#FF7F4D" /> */}
        </TouchableOpacity>
      </View>

      {!selectedRestaurantId && (
        <View style={styles.sdaBannerWarning}>
          <Text style={styles.sdaBannerWarningTitle}>No Restaurant Selected</Text>
          <Text style={styles.sdaBannerWarningText}>
            Please select a restaurant from the filter below.
          </Text>
        </View>
      )}
      {!!errorMessage && (
        <View style={styles.sdaBannerError}>
          <Text style={styles.sdaBannerErrorTitle}>Error</Text>
          <Text style={styles.sdaBannerErrorText}>{errorMessage}</Text>
        </View>
      )}

      <ScrollView
        style={styles.sdaVerticalScroll}
        contentContainerStyle={styles.sdaVerticalScrollContent}
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
        {/* Filter Section */}
        <View style={styles.sdaFilterSection}>
          {/* Restaurant Picker */}
          <View style={styles.sdaRestaurantRow}>
            <TouchableOpacity
              style={styles.sdaRestaurantPickerFull}
              onPress={() => setIsRestaurantPickerVisible(true)}
              activeOpacity={0.8}
            >
              <Icon name="restaurant-outline" size={20} color="#FF7F4D" />
              <Text style={styles.sdaRestaurantPickerFullText} numberOfLines={1}>
                {selectedRestaurantName}
              </Text>
              <Icon name="chevron-down" size={20} color="#8E8EA0" />
            </TouchableOpacity>
          </View>

          {/* Date Filter Chips */}
          <View style={styles.sdaFilterChipsRow}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.sdaChipsContainer}
            >
              {['thisWeek', 'lastWeek', 'thisMonth', 'lastMonth', 'custom'].map((key) => (
                <TouchableOpacity
                  key={key}
                  style={[styles.sdaWeekFilterChip, selectedFilter === key && styles.sdaWeekFilterChipActive]}
                  onPress={() => setSelectedFilter(key)}
                >
                  <Text
                    style={[
                      styles.sdaWeekFilterChipText,
                      selectedFilter === key && styles.sdaWeekFilterChipTextActive,
                    ]}
                  >
                    {key === 'thisWeek'
                      ? 'This Week'
                      : key === 'lastWeek'
                      ? 'Last Week'
                      : key === 'thisMonth'
                      ? 'This Month'
                      : key === 'lastMonth'
                      ? 'Last Month'
                      : 'Custom'}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Custom Date Range */}
          {selectedFilter === 'custom' && (
            <View style={styles.sdaCustomDateContainer}>
              <View style={styles.sdaCustomDateRow}>
                <TouchableOpacity
                  style={styles.sdaDatePickerButton}
                  onPress={() => setStartDatePickerVisible(true)}
                >
                  <Icon name="calendar-outline" size={16} color="#FF7F4D" />
                  <Text style={styles.sdaDatePickerText}>
                    Start: {customStartDate.toLocaleDateString('en-IN')}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.sdaDatePickerButton}
                  onPress={() => setEndDatePickerVisible(true)}
                >
                  <Icon name="calendar-outline" size={16} color="#FF7F4D" />
                  <Text style={styles.sdaDatePickerText}>
                    End: {customEndDate.toLocaleDateString('en-IN')}
                  </Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity
                style={styles.sdaApplyDateButton}
                onPress={() => {
                  setAppliedStartDate(customStartDate);
                  setAppliedEndDate(customEndDate);
                }}
              >
                <Text style={styles.sdaApplyDateText}>Apply</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Settlement Number Search */}
          <View style={styles.sdaSearchRow}>
            <Icon name="search-outline" size={18} color="#8E8EA0" />
            <TextInput
              style={styles.sdaSearchInput}
              placeholder="Search by Settlement Number"
              value={settlementNumberFilter}
              onChangeText={setSettlementNumberFilter}
              placeholderTextColor="#A0A0B0"
            />
          </View>
        </View>

        {/* Totals Summary Section */}
        {(transactionTotals || loadingTransactions) && (
          <View style={styles.sdaTotalsContainer}>
            {loadingTransactions ? (
              <View style={styles.sdaTotalsLoading}>
                <ActivityIndicator size="small" color="#FF7F4D" />
                <Text style={styles.sdaTotalsLoadingText}>Loading totals...</Text>
              </View>
            ) : transactionTotals ? (
              <View style={styles.sdaTotalsGrid}>
                <View style={styles.sdaTotalItem}>
                  <Text style={styles.sdaTotalLabel}>Total Orders</Text>
                  <Text style={styles.sdaTotalValue}>{transactionTotals.total_orders}</Text>
                </View>
                <View style={styles.sdaTotalItem}>
                  <Text style={styles.sdaTotalLabel}>Gross Sale</Text>
                  <Text style={styles.sdaTotalValue}>{formatCurrency(transactionTotals.gross_sale)}</Text>
                </View>
                <View style={styles.sdaTotalItem}>
                  <Text style={styles.sdaTotalLabel}>Delivery Fee</Text>
                  <Text style={styles.sdaTotalValue}>{formatCurrency(transactionTotals.total_delivery_fee)}</Text>
                </View>
                <View style={styles.sdaTotalItem}>
                  <Text style={styles.sdaTotalLabel}>Tax</Text>
                  <Text style={styles.sdaTotalValue}>{formatCurrency(transactionTotals.total_tax)}</Text>
                </View>
                <View style={styles.sdaTotalItem}>
                  <Text style={styles.sdaTotalLabel}>Commission</Text>
                  <Text style={styles.sdaTotalValue}>{formatCurrency(transactionTotals.eatoor_commission)}</Text>
                </View>
                <View style={styles.sdaTotalItem}>
                  <Text style={styles.sdaTotalLabel}>Net Pay</Text>
                  <Text style={[styles.sdaTotalValue, styles.sdaTotalNetPay]}>
                    {formatCurrency(transactionTotals.restaurant_net_pay)}
                  </Text>
                </View>
              </View>
            ) : null}
          </View>
        )}

        {/* Status Cards */}
        <View style={styles.sdaStatusCardsRow}>
          {renderStatusCard('Pending', statusCounts[1], 'pending', 'time-outline', '#f57c00')}
          {renderStatusCard('Approved', statusCounts[2], 'approved', 'checkmark-circle-outline', '#1976d2')}
          {renderStatusCard('Paid', statusCounts[3], 'paid', 'cash-outline', '#2e7d32')}
          {renderStatusCard('Cancelled', statusCounts[4], 'cancelled', 'close-circle-outline', '#c62828')}
        </View>

        {/* Settlements Table */}
        <View style={styles.sdaTableContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={true}>
            <View style={{ width: 1030 }}>
              <View style={styles.sdaTableHeader}>
                <Text style={[styles.sdaTableHeaderText, styles.sdaColSettlementId]}>Settlement ID</Text>
                <Text style={[styles.sdaTableHeaderText, styles.sdaColStartDate]}>Start Date</Text>
                <Text style={[styles.sdaTableHeaderText, styles.sdaColEndDate]}>End Date</Text>
                <Text style={[styles.sdaTableHeaderText, styles.sdaColPayoutDate]}>Payout Date</Text>
                <Text style={[styles.sdaTableHeaderText, styles.sdaColRestaurant]}>Restaurant</Text>
                <Text style={[styles.sdaTableHeaderText, styles.sdaColAmount]}>Amount</Text>
                <Text style={[styles.sdaTableHeaderText, styles.sdaColStatus]}>Status</Text>
                <Text style={[styles.sdaTableHeaderText, styles.sdaColInvoice]}>Invoice</Text>
                <Text style={[styles.sdaTableHeaderText, styles.sdaColActions]}>Action</Text>
              </View>

              {filteredItems.map((item, index) => (
                <React.Fragment key={`${item.settlement_id}-${index}`}>
                  {renderSettlementItem({ item })}
                </React.Fragment>
              ))}
              {filteredItems.length === 0 && !loadingTransactions && (
                <View style={styles.sdaEmptyRow}>
                  <Text style={styles.sdaEmptyText}>
                    {!selectedRestaurantId
                      ? 'Select a restaurant to view settlements.'
                      : 'No settlements found.'}
                  </Text>
                </View>
              )}
            </View>
          </ScrollView>
        </View>

        {loadingMore && (
          <View style={styles.sdaLoadingMoreContainer}>
            <ActivityIndicator size="small" color="#FF7F4D" />
            <Text style={styles.sdaLoadingMoreText}>Loading more...</Text>
          </View>
        )}
        {!hasMore && allDays.length > 0 && (
          <Text style={styles.sdaEndMessage}>No more data</Text>
        )}
        <View style={{ height: 20 }} />
      </ScrollView>

      {/* Restaurant Picker Modal */}
      <Modal
        visible={isRestaurantPickerVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsRestaurantPickerVisible(false)}
      >
        <View style={styles.sdaModalOverlay}>
          <View style={styles.sdaModalContent}>
            <View style={styles.sdaModalHeader}>
              <Text style={styles.sdaModalTitle}>Select Restaurant</Text>
              <TouchableOpacity onPress={() => setIsRestaurantPickerVisible(false)}>
                <Icon name="close" size={28} color="#333" />
              </TouchableOpacity>
            </View>
            <FlatList
              data={pickerRestaurants}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.sdaRestaurantOption,
                    selectedRestaurantId === item.id && styles.sdaRestaurantOptionSelected,
                  ]}
                  onPress={() => {
                    setSelectedRestaurantId(item.id);
                    setIsRestaurantPickerVisible(false);
                  }}
                >
                  <Text
                    style={[
                      styles.sdaRestaurantOptionText,
                      selectedRestaurantId === item.id && styles.sdaRestaurantOptionTextSelected,
                    ]}
                  >
                    {item.name}
                  </Text>
                  {selectedRestaurantId === item.id && (
                    <Icon name="checkmark" size={20} color="#FF7F4D" />
                  )}
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <Text style={styles.sdaEmptyText}>No live restaurants available.</Text>
              }
            />
          </View>
        </View>
      </Modal>

      {/* Details Modal */}
      <Modal
        visible={isDetailsModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setDetailsModalVisible(false)}
      >
        <View style={styles.sdaModalOverlay}>
          <View style={styles.sdaModalContent}>
            <View style={styles.sdaModalHeader}>
              <Text style={styles.sdaModalTitle}>Settlement Details</Text>
              <TouchableOpacity onPress={() => setDetailsModalVisible(false)}>
                <Icon name="close" size={28} color="#333" />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              {allDays.map((day) => (
                <View style={styles.sdaModalTransactionItem} key={day.settlement_id}>
                  <View style={styles.sdaModalTransactionLeft}>
                    <Text style={styles.sdaModalTransactionDate}>{day.settlement_id}</Text>
                    <Text style={styles.sdaModalTransactionOrderId}>Orders: {day.total_orders}</Text>
                    <View style={styles.sdaModalTransactionRow}>
                      <Text style={styles.sdaModalTransactionDetail}>
                        Gross: {formatCurrency(day.item_gross_sale)}
                      </Text>
                      <Text style={styles.sdaModalTransactionDetail}>
                        Net: {formatCurrency(day.restaurant_net_pay)}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.sdaModalTransactionRight}>
                    <Text style={styles.sdaModalTransactionAmount}>
                      {formatCurrency(day.restaurant_net_pay)}
                    </Text>
                    <Text style={styles.sdaModalTransactionType}>
                      Avg: {formatCurrency(day.average_order_value)}
                    </Text>
                  </View>
                </View>
              ))}
              {allDays.length === 0 && <Text style={styles.sdaEmptyText}>No data available.</Text>}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Date Pickers */}
      <DateTimePickerModal
        isVisible={isStartDatePickerVisible}
        mode="date"
        onConfirm={(date) => {
          setCustomStartDate(date);
          setStartDatePickerVisible(false);
        }}
        onCancel={() => setStartDatePickerVisible(false)}
        date={customStartDate}
      />
      <DateTimePickerModal
        isVisible={isEndDatePickerVisible}
        mode="date"
        onConfirm={(date) => {
          setCustomEndDate(date);
          setEndDatePickerVisible(false);
        }}
        onCancel={() => setEndDatePickerVisible(false)}
        date={customEndDate}
      />
    </SafeAreaView>
  );
};

// ---------- Styles (all prefixed with 'sda') ----------
const styles = StyleSheet.create({
  sdaContainer: {
    flex: 1,
    backgroundColor: '#F8F9FC',
  },
  sdaVerticalScroll: {
    flex: 1,
  },
  sdaVerticalScrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 30,
    paddingTop: 12,
  },
  sdaHeader: {
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
  sdaBackButton: { padding: 4 },
  sdaHeaderTitle: { fontSize: 20, fontWeight: '700', color: '#1A1A2E', letterSpacing: 0.3 },
  sdaExportButton: { padding: 4 },

  sdaBannerWarning: {
    padding: 12,
    backgroundColor: '#fff3e0',
    borderRadius: 12,
    marginBottom: 12,
    marginHorizontal: 16,
  },
  sdaBannerWarningTitle: { color: '#e65100', fontWeight: '700' },
  sdaBannerWarningText: { color: '#8E8EA0', marginTop: 4 },
  sdaBannerError: {
    padding: 12,
    backgroundColor: '#ffebee',
    borderRadius: 12,
    marginBottom: 12,
    marginHorizontal: 16,
  },
  sdaBannerErrorTitle: { color: '#b71c1c', fontWeight: '700' },
  sdaBannerErrorText: { color: '#8E8EA0', marginTop: 4 },

  sdaFilterSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#EEF0F4',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  sdaRestaurantRow: {
    marginBottom: 10,
  },
  sdaRestaurantPickerFull: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FC',
    borderRadius: 30,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#EEF0F4',
    justifyContent: 'space-between',
    width: '100%',
  },
  sdaRestaurantPickerFullText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    color: '#1A1A2E',
    marginHorizontal: 10,
  },
  sdaFilterChipsRow: {
    marginBottom: 8,
  },
  sdaChipsContainer: {
    paddingVertical: 4,
  },
  sdaWeekFilterChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    marginRight: 8,
    backgroundColor: '#F8F9FC',
    borderWidth: 1,
    borderColor: '#EEF0F4',
  },
  sdaWeekFilterChipActive: {
    backgroundColor: '#FF7F4D',
    borderColor: '#FF7F4D',
  },
  sdaWeekFilterChipText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#4A4A5A',
  },
  sdaWeekFilterChipTextActive: {
    color: '#FFFFFF',
  },

  sdaCustomDateContainer: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#EEF0F4',
    alignItems: 'center',
  },
  sdaCustomDateRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    width: '100%',
    marginBottom: 8,
  },
  sdaDatePickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FC',
    borderRadius: 30,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginHorizontal: 4,
    borderWidth: 1,
    borderColor: '#EEF0F4',
    flex: 1,
    maxWidth: '48%',
  },
  sdaDatePickerText: {
    fontSize: 13,
    color: '#1A1A2E',
    marginLeft: 4,
  },
  sdaApplyDateButton: {
    backgroundColor: '#FF7F4D',
    borderRadius: 30,
    paddingHorizontal: 24,
    paddingVertical: 6,
    alignSelf: 'center',
  },
  sdaApplyDateText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },

  sdaSearchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FC',
    borderRadius: 30,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#EEF0F4',
  },
  sdaSearchInput: {
    flex: 1,
    fontSize: 13,
    color: '#1A1A2E',
    paddingVertical: 4,
    paddingHorizontal: 6,
  },

  sdaTotalsContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#EEF0F4',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  sdaTotalsLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  sdaTotalsLoadingText: {
    marginLeft: 8,
    color: '#8E8EA0',
    fontSize: 14,
  },
  sdaTotalsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  sdaTotalItem: {
    width: '33.33%',
    alignItems: 'center',
    marginBottom: 12,
  },
  sdaTotalLabel: {
    fontSize: 12,
    color: '#8E8EA0',
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  sdaTotalValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1A2E',
    marginTop: 2,
  },
  sdaTotalNetPay: {
    color: '#FF7F4D',
  },

  sdaStatusCardsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  sdaStatusCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 4,
    alignItems: 'center',
    marginHorizontal: 3,
    borderWidth: 1,
    borderColor: '#EEF0F4',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
    minHeight: 80,
    justifyContent: 'center',
  },
  sdaStatusCardActive: {
    borderColor: '#FF7F4D',
    borderWidth: 2,
    backgroundColor: '#FFF8F5',
  },
  sdaStatusIconContainer: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 2,
  },
  sdaStatusCount: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1A2E',
    marginTop: 2,
  },
  sdaStatusLabel: {
    fontSize: 10,
    color: '#8E8EA0',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },

  sdaTableContainer: {
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
  sdaTableHeader: {
    flexDirection: 'row',
    backgroundColor: '#F8F9FC',
    paddingVertical: 14,
    paddingHorizontal: 10,
    borderBottomWidth: 2,
    borderBottomColor: '#FF7F4D',
  },
  sdaTableHeaderText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1A1A2E',
    textAlign: 'center',
  },
  sdaSettlementRow: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F4F8',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
  },
  sdaSettlementCell: {
    textAlign: 'center',
    fontSize: 10,
    color: '#1A1A2E',
  },
  sdaColSettlementId: { width: 120 },
  sdaColStartDate: { width: 100 },
  sdaColEndDate: { width: 100 },
  sdaColPayoutDate: { width: 100 },
  sdaColRestaurant: { width: 130 },
  sdaColAmount: { width: 100 },
  sdaColStatus: { width: 100 },
  sdaColInvoice: { width: 80, alignItems: 'center', justifyContent: 'center' }, // Fixed alignment
  sdaColActions: { width: 80, alignItems: 'center', justifyContent: 'center' },

  sdaStatusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    alignSelf: 'center',
  },
  sdaStatusBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  sdaActionButton: {
    padding: 4,
    alignSelf: 'center',
  },
  sdaInvoiceButton: {
    alignSelf: 'center',
    padding: 4,
  },

  sdaEmptyRow: {
    padding: 20,
    alignItems: 'center',
  },
  sdaEmptyText: {
    textAlign: 'center',
    padding: 20,
    color: '#A0A0B0',
    fontSize: 16,
  },
  sdaLoadingMoreContainer: {
    paddingVertical: 16,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  sdaLoadingMoreText: { marginLeft: 8, color: '#8E8EA0', fontSize: 14 },
  sdaEndMessage: { textAlign: 'center', paddingVertical: 16, color: '#8E8EA0', fontSize: 14 },

  sdaModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sdaModalContent: {
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
  sdaModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#EEF0F4',
    paddingBottom: 14,
    marginBottom: 14,
  },
  sdaModalTitle: { fontSize: 20, fontWeight: '700', color: '#1A1A2E' },
  sdaModalTransactionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F6FA',
  },
  sdaModalTransactionLeft: { flex: 1, marginRight: 8 },
  sdaModalTransactionDate: { fontSize: 14, fontWeight: '600', color: '#1A1A2E' },
  sdaModalTransactionOrderId: { fontSize: 12, color: '#8E8EA0', marginTop: 2 },
  sdaModalTransactionRow: { flexDirection: 'row', justifyContent: 'flex-start', marginTop: 2 },
  sdaModalTransactionDetail: { fontSize: 12, color: '#5A5A6E', marginRight: 12 },
  sdaModalTransactionRight: { alignItems: 'flex-end' },
  sdaModalTransactionAmount: { fontSize: 16, fontWeight: '700', color: '#1A1A2E', marginBottom: 4 },
  sdaModalTransactionType: { fontSize: 11, color: '#8E8EA0', marginTop: 2 },

  sdaRestaurantOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F4F8',
  },
  sdaRestaurantOptionSelected: {
    backgroundColor: '#FFF8F5',
  },
  sdaRestaurantOptionText: {
    fontSize: 16,
    color: '#1A1A2E',
  },
  sdaRestaurantOptionTextSelected: {
    fontWeight: '600',
    color: '#FF7F4D',
  },
});

export default SettlementDashboardScreen;