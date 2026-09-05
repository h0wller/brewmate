export interface BrewStep {
  duration: number
  pourTo: number
  note?: string
}

export interface Recipe {
  id: string
  title: string
  method: string
  doseG: number
  waterG: number
  tempC: number
  grind?: string
  steps: BrewStep[]
  favorite?: boolean
  createdAt: number
}

export interface BeanProfile {
  id: string
  name?: string
  origin?: string
  process?: string
  roastLevel?: 'light' | 'medium' | 'dark'
  agtron?: number
  roastDate?: string
  notes?: string
}