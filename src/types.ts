export interface BrewStep { duration: number; pourTo: number; note?: string }

export interface Recipe {
  id: string; title: string; method: string;
  doseG: number; waterG: number; tempC: number; grind?: string;
  steps: BrewStep[]; favorite?: boolean; createdAt: number;
  updatedAt?: number; // время последней правки (для слияния при синхронизации)
}

export interface BeanProfile {
  id: string
  name: string
  origin?: string
  process?: string
  roastLevel?: 'light' | 'medium' | 'dark'
  agtron?: number
  photoColor?: string
  roastDate?: string
  notes?: string
  createdAt: number
  updatedAt?: number
}

/* ---------- Каппинг ---------- */
export interface Defect {
  id: string
  type: 'taint' | 'fault'
  intensity: number
  cups: number
}

export interface CuppingLot {
  id: string
  name: string
  quality: Record<string, number>
  cups: { sweetness: boolean[]; uniformity: boolean[]; clean: boolean[] }
  defects: Defect[]
  notes?: string
}

export interface CuppingSession {
  id: string
  title: string
  form: 'sca' | 'coe'
  createdAt: number
  updatedAt?: number
  lots: CuppingLot[]
}