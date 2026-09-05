import type { CuppingSession, Recipe } from './types'

const RKEY = 'brewmate.recipes.v1'
const CKEY = 'brewmate.cupping.v1'

export const loadRecipes = (): Recipe[] => {
  try { return JSON.parse(localStorage.getItem(RKEY) ?? '[]') } catch { return [] }
}
export const saveRecipes = (r: Recipe[]) => localStorage.setItem(RKEY, JSON.stringify(r))

export const loadSessions = (): CuppingSession[] => {
  try { return JSON.parse(localStorage.getItem(CKEY) ?? '[]') } catch { return [] }
}
export const saveSessions = (s: CuppingSession[]) => localStorage.setItem(CKEY, JSON.stringify(s))

export const uid = () => Math.random().toString(36).slice(2, 10)