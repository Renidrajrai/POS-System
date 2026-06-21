import { api } from './client'

export interface DailySalesRow {
  hour: number
  orderCount: number
  revenue: number
}

export interface PeriodSales {
  totalRevenue: number
  totalOrders: number
  avgOrderValue: number
  byPaymentMethod: { method: string; count: number; total: number }[]
  byOrderType: { type: string; count: number; total: number }[]
}

export interface TopItem {
  name: string
  quantitySold: number
  revenue: number
}

export interface FoodCostItem {
  menuItemId: number
  itemName: string
  category: string
  sellPrice: number
  totalCost: number
  profitMargin: number
  ingredientCount: number
}

export interface PLSummary {
  totalRevenue: number
  totalOrders: number
  totalDiscounts: number
  estimatedFoodCost: number
  estimatedGrossProfit: number
  grossProfitMargin: number
}

export interface OrderStatusSummary {
  status: string
  count: number
}

export const reportApi = {
  dailySales: (date?: string) => {
    const qs = date ? `?date=${date}` : ''
    return api.get<DailySalesRow[]>(`/reports/sales/daily${qs}`)
  },
  periodSales: (start: string, end: string) =>
    api.get<PeriodSales>(`/reports/sales/period?start=${start}&end=${end}`),
  topItems: (start: string, end: string) =>
    api.get<TopItem[]>(`/reports/sales/top-items?start=${start}&end=${end}`),
  foodCost: () => api.get<FoodCostItem[]>('/reports/food-cost'),
  plSummary: (start: string, end: string) =>
    api.get<PLSummary>(`/reports/p-l?start=${start}&end=${end}`),
  orderStatusSummary: (date?: string) => {
    const qs = date ? `?date=${date}` : ''
    return api.get<OrderStatusSummary[]>(`/reports/order-status-summary${qs}`)
  },
}
