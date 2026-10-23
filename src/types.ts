export interface BrewStep { duration: number; pourTo: number; note?: string }

export interface Recipe {
  id: string; title: string; method: string;
  doseG: number; waterG: number; tempC: number; grind?: string;
  steps: BrewStep[]; favorite?: boolean; createdAt: number;
  updatedAt?: number; // время последней правки (для слияния при синхронизации)
}

/* Точка кривой пролива: t — секунды от старта таймера, g — вес нетто, г */
export interface WeightSample { t: number; g: number }

/* Запись в журнале завариваний. Рецепт и зерно скопированы «снимком»: рецепт
   можно потом изменить или удалить, а запись о том, что было сварено, остаётся. */
export interface BrewLog {
  id: string
  recipeId?: string
  title: string
  method: string
  doseG: number
  waterG: number
  tempC: number
  grind?: string
  steps: BrewStep[]       // план из рецепта (для сравнения «план / факт»)
  beanId?: string
  beanName?: string
  startedAt: number
  durationS: number
  finalG?: number         // фактический вес в конце (с весов)
  curve?: WeightSample[]  // кривая веса по времени (только если были весы)
  rating?: number         // 1–5
  notes?: string
  createdAt: number
  updatedAt?: number
}

/* Что таймер передаёт приложению при «Записать в журнал»; остальное (id, даты) добавляет App */
export type LogDraft = Pick<BrewLog,
  'recipeId' | 'title' | 'method' | 'doseG' | 'waterG' | 'tempC' | 'grind' | 'steps' |
  'durationS' | 'finalG' | 'curve'>

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