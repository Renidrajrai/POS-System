import { api } from './client'

export interface Supplier {
  Id: number
  Name: string
  ContactPerson: string
  Phone: string
  Email: string
  Address: string
  Status: string
  CreatedAt: string
}

export interface PurchaseOrderItem {
  Id: number
  PurchaseOrderId: number
  ItemName: string
  Quantity: number
  Unit: string
  UnitPrice: number
  TotalPrice: number
}

export interface PurchaseOrder {
  Id: number
  SupplierId: number
  OrderNumber: string
  Status: string
  OrderDate: string
  ExpectedDate: string
  TotalAmount: number
  Notes: string
  CreatedAt: string
  SupplierName?: string
  items?: PurchaseOrderItem[]
}

export interface GoodsReceipt {
  Id: number
  PurchaseOrderId: number
  ReceiptDate: string
  Status: string
  Notes: string
  CreatedAt: string
}

export const procurementApi = {
  suppliers: {
    list: () => api.get<Supplier[]>('/suppliers'),
    create: (data: Partial<Supplier>) => api.post<Supplier>('/suppliers', data),
    update: (id: number, data: Partial<Supplier>) => api.put<Supplier>(`/suppliers/${id}`, data),
    delete: (id: number) => api.delete(`/suppliers/${id}`),
  },
  purchaseOrders: {
    list: () => api.get<PurchaseOrder[]>('/purchase-orders'),
    get: (id: number) => api.get<PurchaseOrder>(`/purchase-orders/${id}`),
    create: (data: Partial<PurchaseOrder> & { items?: Partial<PurchaseOrderItem>[] }) =>
      api.post<PurchaseOrder>('/purchase-orders', data),
    update: (id: number, data: Partial<PurchaseOrder> & { items?: Partial<PurchaseOrderItem>[] }) =>
      api.put<PurchaseOrder>(`/purchase-orders/${id}`, data),
    updateStatus: (id: number, status: string) =>
      api.put<PurchaseOrder>(`/purchase-orders/${id}/status`, { status }),
    delete: (id: number) => api.delete(`/purchase-orders/${id}`),
    receive: (id: number, data: { items: { purchaseOrderItemId: number; receivedQuantity: number; acceptedQuantity: number }[]; notes?: string }) =>
      api.post<GoodsReceipt>(`/purchase-orders/${id}/receive`, data),
  },
}
