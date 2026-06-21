import { api } from './client'

export interface OnlineOrder {
  Id: number
  OrderId: number | null
  CustomerName: string
  CustomerPhone: string
  DeliveryAddress: string
  Items: { name: string; quantity: number; unitPrice: number }[]
  TotalAmount: number
  Status: string
  OrderType: string
  Notes: string
  CreatedAt: string
}

export const onlineOrderApi = {
  list: (status?: string) => {
    const qs = status ? `?status=${status}` : ''
    return api.get<OnlineOrder[]>(`/online-orders${qs}`)
  },
  get: (id: number) => api.get<OnlineOrder>(`/online-orders/${id}`),
  updateStatus: (id: number, status: string) =>
    api.put<OnlineOrder>(`/online-orders/${id}/status`, { status }),
  update: (id: number, data: { notes?: string; deliveryAddress?: string }) =>
    api.put<OnlineOrder>(`/online-orders/${id}`, data),
  delete: (id: number) => api.delete(`/online-orders/${id}`),
}
