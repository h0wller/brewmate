export interface BrewStep { duration: number; pourTo: number; note?: string }

export interface Recipe {
  id: string; title: string; method: string;
  doseG: number; waterG: number; tempC: number; grind?: string;
  steps: BrewStep[]; favorite?: boolean; createdAt: number;
}

export interface BeanProfile {
  id: string; name?: string; origin?: string; process?: string;
  roastLevel?: 'light' | 'medium' | 'dark'; agtron?: number;
  roastDate?: string; notes?: string;
}

/* ---------- Каппинг ---------- */
export interface Defect {
  id: string
  type: 'taint' | 'fault'
  intensity: number // 1–3
  cups: number      // 1–5
}

export interface CuppingLot {
  id: string
  name: string
  quality: Record<string, number> // ключи атрибутов SCA/CoE, см. sca.ts
  cups: { sweetness: boolean[]; uniformity: boolean[]; clean: boolean[] }
  defects: Defect[]
  notes?: string
}

export interface CuppingSession {
  id: string
  title: string
  form: 'sca' | 'coe'
  createdAt: number
  lots: CuppingLot[]
}