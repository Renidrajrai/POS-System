import { api } from './client'

export interface RecipeIngredient {
  Id: number
  MenuItemId: number
  IngredientName: string
  Quantity: number
  Unit: string
  CostPerUnit: number
  DisplayOrder: number
}

export interface FoodCostResult {
  totalCost: number
  sellPrice: number
  profitMargin: number
}

export const recipeApi = {
  list: (menuItemId: number) => api.get<RecipeIngredient[]>(`/menu/${menuItemId}/recipes`),
  create: (menuItemId: number, data: Partial<RecipeIngredient>) => api.post<RecipeIngredient>(`/menu/${menuItemId}/recipes`, data),
  update: (id: number, data: Partial<RecipeIngredient>) => api.put<RecipeIngredient>(`/menu/ingredients/${id}`, data),
  delete: (id: number) => api.delete(`/menu/ingredients/${id}`),
  foodCost: (menuItemId: number) => api.get<FoodCostResult>(`/menu/${menuItemId}/food-cost`),
}
