
import API from './httpClient';

// Sample API response structure for reference

export interface ApiBannerItem {
  id: string;
  name: string;
  icon: string;
  document_type: 1 | 2;
  thumbnail?: string;
}

export interface ApiCategoryItem {
  id: number;
  name: string;
  icon: string;
  icon_type?: string;
  item_count?: number;
  image?: string;
  color?: string;
  bg_color?: string;
  is_active?: boolean;
  sort_order?: number;
}

export interface ApiGroceryItem {
  item_id: string;
  item_name: string;
  item_image: string;
  category_id: number;
  category_name: string;
  price: string;
  discount_price?: string;
  unit: string;
  in_stock: boolean;
  is_favourite: boolean;
  brand?: string;
  weight?: string;
  rating?: number;
  reviews?: number;
  origin?: string;
  expiry?: string;
  nutrition?: string;
  description?: string;
  mrp?: string;
  discount_percentage?: number;
  tags?: string[];
  is_organic?: boolean;
  is_new?: boolean;
  is_bestseller?: boolean;
}

export interface ApiHomeData {
  CategoryList: ApiCategoryItem[];
  final_banner_image: ApiBannerItem;
  FeaturedItemsList?: ApiGroceryItem[];
  banner_images?: ApiBannerItem[];
  trending_items?: ApiGroceryItem[];
  new_arrivals?: ApiGroceryItem[];
  offers?: any[];
}

export interface ApiResponse {
  success: boolean;
  data: ApiHomeData;
  message?: string;
  errors?: any;
}

/**
 * Fetch Eatmart home data
 * @param latitude - Optional latitude for location-based results
 * @param longitude - Optional longitude for location-based results
 * @returns Promise with API response
 */
export const getEatmartHomeData = (latitude?: number, longitude?: number) => {
  let url = '/eatoor/home/list/';
  
  // Add query parameters if coordinates are provided
  if (latitude && longitude) {
    url += `?lat=${latitude}&lng=${longitude}`;
  }
  
  return API.get<ApiResponse>(url);
};