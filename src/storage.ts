import type { Recipe } from './types'

const KEY = 'brewmate.recipes.v1'

export const loadRecipes = (): Recipe[] => {
  try { return JSON.parse(localStorage.getItem(KEY) ?? '[]') }
  catch { return [] }
}

export const saveRecipes = (r: Recipe[]) =>
  localStorage.setItem(KEY, JSON.stringify(r))

export const uid = () =>
  Math.random().toString(36).slice(2, 10)