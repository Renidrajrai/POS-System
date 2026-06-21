import { api } from './client'

export interface MenuItem {
  Id: number
  Name: string
  Description: string
  Category: string
  Price: number
  Sku: string
  ImagePath: string
  IsAvailable: boolean
  CreatedAt: string
}

export interface MenuCategory {
  Id: number
  Name: string
  Icon: string
  DisplayOrder: number
}

export interface MenuModifier {
  Id: number
  MenuItemId: number
  Name: string
  Type: 'select' | 'multi'
  IsRequired: boolean
  DisplayOrder: number
  options?: MenuModifierOption[]
}

export interface MenuModifierOption {
  Id: number
  ModifierId: number
  Name: string
  PriceAdjustment: number
  DisplayOrder: number
}

export const menuApi = {
  list: (category?: string) => {
    const qs = category ? `?category=${category}` : ''
    return api.get<MenuItem[]>(`/menu${qs}`)
  },

  get: (id: number) => api.get<MenuItem>(`/menu/${id}`),

  create: (data: Partial<MenuItem>) => api.post<MenuItem>('/menu', data),

  update: (id: number, data: Partial<MenuItem>) =>
    api.put<MenuItem>(`/menu/${id}`, data),

  delete: (id: number) => api.delete(`/menu/${id}`),

  toggle: (id: number) => api.put(`/menu/${id}/toggle`),

  categories: {
    list: () => api.get<MenuCategory[]>('/menu/categories/all'),
    create: (data: Partial<MenuCategory>) => api.post<MenuCategory>('/menu/categories', data),
    delete: (id: number) => api.delete(`/menu/categories/${id}`),
  },
  modifiers: {
    list: (menuItemId: number) => api.get<MenuModifier[]>(`/menu/${menuItemId}/modifiers`),
    create: (menuItemId: number, data: Partial<MenuModifier>) =>
      api.post<MenuModifier>(`/menu/${menuItemId}/modifiers`, data),
    update: (id: number, data: Partial<MenuModifier>) =>
      api.put<MenuModifier>(`/menu/modifiers/${id}`, data),
    delete: (id: number) => api.delete(`/menu/modifiers/${id}`),
    options: {
      create: (modifierId: number, data: Partial<MenuModifierOption>) =>
        api.post<MenuModifierOption>(`/menu/modifiers/${modifierId}/options`, data),
      update: (id: number, data: Partial<MenuModifierOption>) =>
        api.put<MenuModifierOption>(`/menu/modifier-options/${id}`, data),
      delete: (id: number) => api.delete(`/menu/modifier-options/${id}`),
    },
  },
}
