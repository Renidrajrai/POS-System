import { api } from './client'

export interface Order {
  Id: number
  OrderNumber: string
  TableNumber: number
  ItemCount: number
  Amount: number
  Status: string
  OrderType: string
  CreatedAt: string
  CustomerId?: number
  CustomerName: string
  DiscountPercent: number
  DiscountAmount: number
  TaxAmount: number
  PaymentMethod: string
  IsPaid: boolean
  items?: OrderItem[]
}

export interface OrderItem {
  Id: number
  OrderId: number
  Name: string
  Notes: string
  Quantity: number
  UnitPrice: number
}

export interface OrderRefund {
  Id: number
  OrderId: number
  Amount: number
  Reason: string
  Status: string
  CreatedAt: string
}

export interface InventoryItem {
  Id: number
  Name: string
  CurrentStock: number
  MaxStock: number
  Unit: string
}

export interface Customer {
  Id: number
  Name: string
  Phone: string
  Email: string
  Points: number
  CreatedAt: string
}

export const orderApi = {
  list: (status?: string, orderType?: string) => {
    const params = new URLSearchParams()
    if (status) params.set('status', status)
    if (orderType) params.set('orderType', orderType)
    const qs = params.toString()
    return api.get<Order[]>(`/orders${qs ? `?${qs}` : ''}`)
  },

  get: (id: number) => api.get<Order>(`/orders/${id}`),

  create: (data: Partial<Order> & { items?: Partial<OrderItem>[] }) =>
    api.post<Order>('/orders', data),

  update: (id: number, data: Partial<Order>) =>
    api.put<Order>(`/orders/${id}`, data),

  delete: (id: number) => api.delete(`/orders/${id}`),

  inventory: {
    list: () => api.get<InventoryItem[]>('/orders/inventory/all'),
    create: (data: Partial<InventoryItem>) => api.post<InventoryItem>('/orders/inventory', data),
    update: (id: number, data: Partial<InventoryItem>) =>
      api.put<InventoryItem>(`/orders/inventory/${id}`, data),
  },
  refunds: {
    create: (orderId: number, data: { Amount: number; Reason: string }) =>
      api.post<OrderRefund>(`/orders/${orderId}/refund`, data),
    list: (orderId: number) => api.get<OrderRefund[]>(`/orders/${orderId}/refunds`),
  },
  voidOrder: (orderId: number, reason: string) =>
    api.put(`/orders/${orderId}/void`, { reason }),
}

export const customerApi = {
  search: (q: string) => api.get<Customer[]>(`/customers/search?q=${q}`),
  get: (id: number) => api.get<Customer>(`/customers/${id}`),
  create: (data: Partial<Customer>) => api.post<Customer>('/customers', data),
  update: (id: number, data: Partial<Customer>) =>
    api.put<Customer>(`/customers/${id}`, data),
}
