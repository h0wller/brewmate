import type { GrindSize } from './size'
import { GRIND_SIZES } from './size'
import { findGrinder } from './catalog'

/* ВНИМАНИЕ: числа в GRINDER_PRESETS — ориентиры, а не измерения. Источник не указан и не проверен
   (таблица попала в проект из генерации ИИ). Нельзя показывать их как «точные клики»: в интерфейсе они
   подаются как «≈ ориентир», а калибровка пользователя всегда главнее (см. smartSettingFor).
   Добавлять сюда модель можно только с источником в комментарии; тест presets.test.ts проверяет
   внутреннюю согласованность (монотонность, диапазон шкалы). */
export interface GrinderScale {
  unit: string // 'кл.' | 'дел.' | 'ст.' | 'об.' | 'мкм'
  /** Значения на шкале кофемолки для 7 уровней:
      [extra_fine (турка/ристретто), fine (эспрессо), medium_fine (V60/аэропресс),
       medium (капельная/плоское дно), medium_coarse (каппинг/кемекс),
       coarse (френч-пресс), extra_coarse (колд-брю)] */
  points: [number, number, number, number, number, number, number]
  decimals?: number
  burrs?: 'conical' | 'flat'
  dialRange?: string
  /** Параметры лимба в стиле CoffeeOS: [кликовНаОборот, цифрНаЛимбе]
      Позволяет рядом с общим числом кликов писать "1-4-5" (оборот-цифра-клик) */
  coffeeOsDial?: [number, number]
}

export const GRINDER_PRESETS: Record<string, GrinderScale> = {
  // ================= 1Zpresso =================
  '1zpresso-j':           { unit: 'кл.', points: [25, 38, 65, 78, 88, 100, 115], burrs: 'conical', dialRange: '0–120 кл.', coffeeOsDial: [30, 10] },
  '1zpresso-j-max':       { unit: 'кл.', points: [75, 115, 210, 245, 275, 310, 350], burrs: 'conical', dialRange: '0–450 кл. (8.8 мкм/кл)', coffeeOsDial: [90, 9] },
  '1zpresso-j-ultra':     { unit: 'кл.', points: [80, 120, 220, 255, 290, 325, 370], burrs: 'conical', dialRange: '0–500 кл. (8 мкм/кл)', coffeeOsDial: [100, 10] },
  '1zpresso-jx':          { unit: 'кл.', points: [28, 42, 72, 84, 95, 108, 122], burrs: 'conical', dialRange: '0–150 кл.', coffeeOsDial: [30, 10] },
  '1zpresso-jx-pro':      { unit: 'кл.', points: [40, 59, 145, 158, 172, 186, 200], burrs: 'conical', dialRange: '0–200 кл. (12.5 мкм/кл)', coffeeOsDial: [40, 10] },
  '1zpresso-k-max':       { unit: 'кл.', points: [25, 38, 68, 78, 88, 100, 115], burrs: 'conical', dialRange: '0–90 кл. (22 мкм/кл)', coffeeOsDial: [90, 9] },
  '1zpresso-k-ultra':     { unit: 'кл.', points: [28, 42, 72, 82, 92, 105, 120], burrs: 'conical', dialRange: '0–100 кл. (20 мкм/кл)', coffeeOsDial: [100, 10] },
  '1zpresso-q2':          { unit: 'кл.', points: [18, 28, 46, 52, 56, 60, 68], burrs: 'conical', dialRange: '0–90 кл.', coffeeOsDial: [30, 10] },
  '1zpresso-x-pro':       { unit: 'кл.', points: [35, 55, 125, 145, 160, 180, 205], burrs: 'conical', dialRange: '0–240 кл. (12.5 мкм/кл)', coffeeOsDial: [60, 6] },
  '1zpresso-x-ultra':     { unit: 'кл.', points: [35, 55, 125, 145, 160, 180, 205], burrs: 'conical', dialRange: '0–240 кл. (12.5 мкм/кл)', coffeeOsDial: [60, 6] },
  '1zpresso-zp6':         { unit: 'кл.', points: [20, 30, 47, 55, 63, 71, 82], burrs: 'conical', dialRange: '0–90 кл. (22 мкм/кл)', coffeeOsDial: [90, 9] },

  // ================= Baratza =================
  'baratza-encore':           { unit: 'дел.', points: [4, 8, 15, 19, 24, 29, 35], burrs: 'conical', dialRange: '1–40' },
  'baratza-encore-esp':       { unit: 'дел.', points: [6, 15, 25, 28, 31, 35, 39], burrs: 'conical', dialRange: '1–40 (1–20 ESP)' },
  'baratza-forte-bg':         { unit: 'дел.', points: [20, 45, 140, 165, 195, 230, 255], burrs: 'flat', dialRange: '1A–10Z (260 шагов)' },
  'baratza-sette-270':        { unit: 'ст.', points: [3, 8, 15, 19, 23, 27, 30], burrs: 'conical', dialRange: '1–31 (A–I микро)' },
  'baratza-sette-30':         { unit: 'ст.', points: [4, 9, 16, 20, 24, 28, 30], burrs: 'conical', dialRange: '1–31' },
  'baratza-vario-plus':       { unit: 'дел.', points: [18, 38, 115.5, 132, 148, 162.7, 185], decimals: 1, burrs: 'flat', dialRange: '1A–10W (220 шагов)' },
  'baratza-virtuoso-plus':    { unit: 'дел.', points: [4, 8, 15, 19, 24, 29, 36], burrs: 'conical', dialRange: '1–40' },

  // ================= Breville / Sage =================
  'breville-barista-express':         { unit: 'дел.', points: [2, 5, 11, 13, 14, 15, 16], burrs: 'conical', dialRange: '1–16' },
  'breville-barista-express-impress': { unit: 'дел.', points: [3, 8, 16, 19, 21, 23, 25], burrs: 'conical', dialRange: '1–25' },
  'breville-barista-pro':             { unit: 'дел.', points: [4, 9, 18, 22, 25, 28, 30], burrs: 'conical', dialRange: '1–30' },
  'breville-dose-control-pro':        { unit: 'дел.', points: [5, 14, 34.7, 41, 46, 52, 58], decimals: 1, burrs: 'conical', dialRange: '1–60' },
  'breville-smart-grinder-pro':       { unit: 'дел.', points: [4, 12, 36, 44, 50, 55, 60], burrs: 'conical', dialRange: '1–60' },

  // ================= Ceado / Cuisinart / DeLonghi =================
  'ceado-e37s':            { unit: 'дел.', points: [0.5, 1.4, 4.2, 5.0, 5.8, 6.8, 7.8], decimals: 1, burrs: 'flat', dialRange: '0–9' },
  'ceado-e5p':             { unit: 'дел.', points: [0.6, 1.5, 4.5, 5.3, 6.2, 7.2, 8.2], decimals: 1, burrs: 'flat', dialRange: '0–9' },
  'cuisinart-dbm-8':       { unit: 'дел.', points: [1, 3, 9, 11, 13, 16, 18], burrs: 'flat', dialRange: '1–18' },
  'delonghi-kg79':         { unit: 'дел.', points: [1, 2, 7, 9, 11, 14, 16], burrs: 'flat', dialRange: '1–16' },
  'delonghi-dedica-kg521': { unit: 'дел.', points: [1, 3, 9, 11, 13, 16, 18], burrs: 'conical', dialRange: '1–18' },

  // ================= Comandante =================
  'comandante-c40': { unit: 'кл.', points: [7, 12, 24, 27, 30, 33, 38], burrs: 'conical', dialRange: '0–50 кл. (30 мкм/кл)' },
  'comandante-c60': { unit: 'кл.', points: [9, 15, 28, 32, 36, 41, 46], burrs: 'conical', dialRange: '0–60 кл. (21 мкм/кл)' },
  'comandante-x25': { unit: 'кл.', points: [7, 12, 24, 27, 30, 33, 38], burrs: 'conical', dialRange: '0–50 кл. (30 мкм/кл)' },

  // ================= DF / Turin =================
  'df54':       { unit: 'дел.', points: [6, 14, 48, 56, 65, 75, 85], burrs: 'flat', dialRange: '0–90' },
  'df64':       { unit: 'дел.', points: [6, 14, 48, 58, 68, 78, 88], burrs: 'flat', dialRange: '0–90' },
  'df64-gen-2': { unit: 'дел.', points: [6, 14, 48, 58, 68, 78, 88], burrs: 'flat', dialRange: '0–90' },
  'df64v':      { unit: 'дел.', points: [5, 13, 45, 55, 64, 74, 84], burrs: 'flat', dialRange: '0–90' },
  'df83':       { unit: 'дел.', points: [6, 15, 50, 60, 70, 80, 88], burrs: 'flat', dialRange: '0–90' },

  // ================= Eureka =================
  'eureka-atom-75':            { unit: 'об.', points: [0.3, 0.8, 2.2, 2.7, 3.2, 3.8, 4.4], decimals: 1, burrs: 'flat', dialRange: '0–5 об.' },
  'eureka-drogheria': { unit: 'дел.', points: [1.5, 2.3, 3.8, 4.8, 5.6, 6.5, 7.5], decimals: 1, burrs: 'flat', dialRange: '1–8 (85 мм)' },
  'eureka-mignon-crono':       { unit: 'об.', points: [0.4, 0.9, 2.4, 2.9, 3.4, 4.0, 4.6], decimals: 1, burrs: 'flat', dialRange: '0–5 об.' },
  'eureka-mignon-libra':       { unit: 'об.', points: [0.3, 0.8, 2.3, 2.8, 3.3, 3.9, 4.5], decimals: 1, burrs: 'flat', dialRange: '0–5 об.' },
  'eureka-mignon-silenzio':    { unit: 'об.', points: [0.3, 0.8, 2.3, 2.8, 3.3, 3.9, 4.5], decimals: 1, burrs: 'flat', dialRange: '0–5 об.' },
  'eureka-mignon-single-dose': { unit: 'об.', points: [0.3, 0.8, 2.2, 2.7, 3.2, 3.8, 4.4], decimals: 1, burrs: 'flat', dialRange: '0–5 об.' },
  'eureka-mignon-specialita':  { unit: 'об.', points: [0.3, 0.8, 2.3, 2.8, 3.3, 3.9, 4.5], decimals: 1, burrs: 'flat', dialRange: '0–5 об.' },
  'eureka-mignon-zero':        { unit: 'об.', points: [0.3, 0.8, 2.3, 2.8, 3.3, 3.9, 4.5], decimals: 1, burrs: 'flat', dialRange: '0–5 об.' },
  'eureka-oro-mignon-xl':      { unit: 'об.', points: [0.3, 0.8, 2.2, 2.7, 3.2, 3.8, 4.4], decimals: 1, burrs: 'flat', dialRange: '0–5 об.' },

  // ================= Fellow =================
  'fellow-espresso-series-1': { unit: 'дел.', points: [2, 6, 18, 22, 26, 30, 34], burrs: 'conical', dialRange: '1–36' },
  'fellow-ode':               { unit: 'дел.', points: [1.0, 1.3, 2.3, 3.5, 4.8, 6.2, 8.5], decimals: 1, burrs: 'flat', dialRange: '1–11 (Gen 1)' },
  'fellow-ode-gen-2':         { unit: 'дел.', points: [1.0, 2.0, 4.8, 6.0, 7.2, 9.0, 10.5], decimals: 1, burrs: 'flat', dialRange: '1–11 (Gen 2)' },
  'fellow-ode-ssp':           { unit: 'дел.', points: [1.2, 2.5, 5.2, 6.3, 7.5, 9.2, 10.8], decimals: 1, burrs: 'flat', dialRange: '1–11 (SSP MP)' },
  'fellow-opus':              { unit: 'дел.', points: [1.2, 2.2, 5.0, 6.2, 7.5, 9.0, 10.5], decimals: 1, burrs: 'conical', dialRange: '1–11' },

  // ================= Fiorenzato / Femobook =================
  'fiorenzato-allground': { unit: 'кл.', points: [4, 10, 28, 34, 40, 48, 55], burrs: 'flat', dialRange: 'Espresso → Filter → Moka' },
  'femobook-a68':         { unit: 'кл.', points: [35, 60, 135, 155, 175, 200, 230], burrs: 'conical', dialRange: '0–300 кл. (8 мкм/кл)', coffeeOsDial: [60, 6] },

  // ================= Hario / Porlex / JavaPresse =================
  'hario-mini-mill-plus': { unit: 'кл.', points: [3, 5, 9, 11, 13, 15, 18], burrs: 'conical', dialRange: '1–20 кл.' },
  'hario-skerton-pro':    { unit: 'кл.', points: [2, 4, 7, 9, 11, 13, 16], burrs: 'conical', dialRange: '1–18 кл.' },
  'javapresse-manual':    { unit: 'кл.', points: [2, 4, 8, 10, 12, 15, 18], burrs: 'conical', dialRange: '1–18 кл.' },
  'porlex-mini-ii':       { unit: 'кл.', points: [2, 4, 8, 10, 11, 13, 15], burrs: 'conical', dialRange: '1–16 кл.' },

  // ================= Kafatek =================
  'kafatek-monolith-conical':  { unit: 'дел.', points: [2, 5, 14, 17, 20, 24, 28], burrs: 'conical', dialRange: 'Stepless' },
  'kafatek-monolith-flat-max': { unit: 'дел.', points: [2, 5, 15, 18, 21, 25, 29], burrs: 'flat', dialRange: 'Stepless' },

  // ================= KINGrinder =================
  'kingrinder-k0': { unit: 'кл.', points: [22, 35, 65, 78, 90, 105, 120], burrs: 'conical', dialRange: '0–140 кл.', coffeeOsDial: [40, 10] },
  'kingrinder-k2': { unit: 'кл.', points: [28, 42, 80, 95, 110, 125, 145], burrs: 'conical', dialRange: '0–160 кл. (18 мкм/кл)', coffeeOsDial: [40, 10] },
  'kingrinder-k4': { unit: 'кл.', points: [35, 55, 95, 110, 125, 140, 160], burrs: 'conical', dialRange: '0–240 кл. (16 мкм/кл)', coffeeOsDial: [60, 6] },
  'kingrinder-k6': { unit: 'кл.', points: [30, 45, 90, 105, 120, 135, 155], burrs: 'conical', dialRange: '0–240 кл. (16 мкм/кл)', coffeeOsDial: [60, 6] },
  'kingrinder-p0': { unit: 'кл.', points: [15, 22, 38, 45, 52, 60, 70], burrs: 'conical', dialRange: '0–90 кл.', coffeeOsDial: [30, 6] },

  // ================= Kinu =================
  'kinu-m47': { unit: 'об.', points: [0.8, 1.3, 2.7, 3.2, 3.6, 4.2, 4.8], decimals: 1, burrs: 'conical', dialRange: '0–5.0 об. (50 дел./об.)' },

  // ================= Option-O Lagom =================
  'option-o-lagom-01':   { unit: 'дел.', points: [1.0, 2.0, 5.2, 6.2, 7.2, 8.4, 9.4], decimals: 1, burrs: 'flat', dialRange: '0–10' },
  'option-o-lagom-casa': { unit: 'дел.', points: [2.0, 4.2, 9.5, 11.0, 12.5, 14.5, 16.5], decimals: 1, burrs: 'conical', dialRange: '0–18' },
  'option-o-lagom-mini': { unit: 'кл.', points: [6, 11, 22, 26, 30, 35, 40], burrs: 'conical', dialRange: '0–50' },
  'option-o-lagom-p64':  { unit: 'дел.', points: [0.8, 1.6, 4.8, 5.8, 6.8, 8.0, 9.0], decimals: 1, burrs: 'flat', dialRange: '0–10' },
  'option-o-lagom-p100': { unit: 'дел.', points: [0.8, 1.7, 5.0, 6.0, 7.0, 8.2, 9.2], decimals: 1, burrs: 'flat', dialRange: '0–10' },

  // ================= Mahlkönig =================
  'mahlkonig-e80':       { unit: 'дел.', points: [1.0, 2.2, 5.5, 7.0, 8.5, 10.0, 12.0], decimals: 1, burrs: 'flat', dialRange: '0–12' },
  'mahlkonig-ek43':      { unit: 'дел.', points: [1.8, 3.7, 8.8, 9.8, 11.5, 14.1, 15.5], decimals: 1, burrs: 'flat', dialRange: '0–16' },
  'mahlkonig-guatemala': { unit: 'дел.', points: [1.0, 2.0, 4.5, 5.5, 6.8, 8.2, 9.5], decimals: 1, burrs: 'flat', dialRange: '1–10' },
  'mahlkonig-x54':       { unit: 'дел.', points: [2, 5, 16, 20, 24, 30, 34], burrs: 'flat', dialRange: '1–35' },

  // ================= Mazzer =================
  'mazzer-mini':        { unit: 'дел.', points: [1.0, 2.0, 4.8, 5.8, 6.8, 8.0, 9.0], decimals: 1, burrs: 'flat', dialRange: '0–10' },
  'mazzer-philos':      { unit: 'дел.', points: [12, 22, 55, 68, 80, 95, 110], burrs: 'flat', dialRange: '0–120' },
  'mazzer-super-jolly': { unit: 'дел.', points: [1.0, 2.0, 4.8, 5.8, 6.8, 8.0, 9.0], decimals: 1, burrs: 'flat', dialRange: '0–10' },
  'mazzer-zm':          { unit: 'мкм', points: [180, 280, 580, 700, 820, 950, 1100], burrs: 'flat', dialRange: '0–1200 мкм' },

  // ================= OXO / Rancilio / Wilfa =================
  'oxo-brew-conical': { unit: 'дел.', points: [1.5, 3.0, 6.7, 8.5, 10.5, 12.5, 14.5], decimals: 1, burrs: 'conical', dialRange: '1–15' },
  'rancilio-rocky':   { unit: 'дел.', points: [3, 8, 24, 28, 33, 38, 45], burrs: 'flat', dialRange: '0–55' },
  'wilfa-svart':      { unit: 'дел.', points: [2, 6, 16, 20, 24, 29, 33], burrs: 'conical', dialRange: 'Moka → Filter → Steep' },
  'wilfa-uniform':    { unit: 'дел.', points: [3, 8, 19.2, 24, 28, 34, 39], decimals: 1, burrs: 'flat', dialRange: '1–41' },

  // ================= Timemore =================
  'timemore-chestnut-c2':  { unit: 'кл.', points: [8, 11, 16, 20, 23, 26, 30], burrs: 'conical', dialRange: '0–36 кл.', coffeeOsDial: [12, 12] },
  'timemore-c3':           { unit: 'кл.', points: [7, 9, 15, 18, 21, 24, 28], burrs: 'conical', dialRange: '0–36 кл.', coffeeOsDial: [12, 12] },
  'timemore-c3-esp':       { unit: 'кл.', points: [14, 21, 46, 54, 62, 72, 82], burrs: 'conical', dialRange: '0–90 кл. (23 мкм/кл, 30 кл./об.)', coffeeOsDial: [30, 10] },
  'timemore-chestnut-s3':  { unit: 'дел.', points: [1.2, 2.2, 5.2, 6.2, 7.2, 8.2, 9.0], decimals: 1, burrs: 'conical', dialRange: '0.0–9.0 (90 кл.)' },
  'timemore-sculptor-064': { unit: 'дел.', points: [1.0, 2.2, 5.5, 7.0, 8.5, 10.5, 12.5], decimals: 1, burrs: 'flat', dialRange: '0–16' },
  'timemore-sculptor-078': { unit: 'дел.', points: [1.0, 2.0, 3.9, 6.0, 8.0, 11.0, 14.0], decimals: 1, burrs: 'flat', dialRange: '0–18' },
  'timemore-sculptor-078s':{ unit: 'дел.', points: [1.0, 2.5, 8.0, 10.0, 12.0, 14.0, 16.5], decimals: 1, burrs: 'flat', dialRange: '0–18' },

  // ================= Varia / Weber / xBloom / Zerno =================
  'varia-vs3':     { unit: 'дел.', points: [1.8, 3.2, 7.2, 8.5, 10.0, 11.8, 13.5], decimals: 1, burrs: 'conical', dialRange: '0–18 (10 мкм/0.1)' },
  'varia-vs6':     { unit: 'дел.', points: [1.5, 2.8, 6.5, 7.8, 9.2, 11.0, 12.5], decimals: 1, burrs: 'flat', dialRange: '0–16' },
  'weber-eg-1':    { unit: 'дел.', points: [1.5, 2.5, 5.5, 6.5, 7.5, 8.5, 9.5], decimals: 1, burrs: 'flat', dialRange: '0–10 (5 мкм/шаг)' },
  'weber-hg-2':    { unit: 'об.', points: [0.5, 0.9, 1.8, 2.2, 2.6, 3.0, 3.5], decimals: 1, burrs: 'conical', dialRange: '0–4 об.' },
  'weber-key':     { unit: 'об.', points: [0.5, 0.9, 1.8, 2.2, 2.6, 3.0, 3.5], decimals: 1, burrs: 'conical', dialRange: '0–4 об.' },
  'xbloom-studio': { unit: 'дел.', points: [15, 25, 52, 62, 70, 76, 80], burrs: 'conical', dialRange: '1–80' },
  'zerno-z1':      { unit: 'мкм', points: [200, 320, 600, 720, 840, 960, 1100], burrs: 'flat', dialRange: '0–1200 мкм' },
}

/* Разрешает псевдоним кофемолки (например, 'timemore-c2' -> 'timemore-chestnut-c2') */
export function getGrinderScale(grinderId: string | undefined): GrinderScale | undefined {
  if (!grinderId) return undefined
  if (GRINDER_PRESETS[grinderId]) return GRINDER_PRESETS[grinderId]
  const canonical = findGrinder(grinderId)?.id
  return canonical ? GRINDER_PRESETS[canonical] : undefined
}

/* Нотация CoffeeOS: переводит общее число кликов в (Оборот-Цифра-Клик),
   чтобы на 1Zpresso / KINGrinder / Timemore C3 ESP было видно позицию на лимбе */
export function formatCoffeeOS(totalClicks: number, dial: [number, number]): string {
  const [clicksPerRot, numbersOnDial] = dial
  const clicksPerNum = clicksPerRot / numbersOnDial
  const rot = Math.floor(totalClicks / clicksPerRot)
  const rem = totalClicks % clicksPerRot
  if (Number.isInteger(clicksPerNum) && clicksPerNum > 1) {
    const num = Math.floor(rem / clicksPerNum)
    const sub = Math.round(rem % clicksPerNum)
    return `${rot}-${num}-${sub}`
  }
  return `${rot}-${Math.round(rem)}`
}

/* Форматирует числовое значение на шкале кофемолки (value уже учитывает Red Clix) */
function fmtVal(v: number, scale: GrinderScale, redClix?: boolean): string {
  const d = scale.decimals ?? 0
  const n = d === 0 ? Math.round(v) : Number(v.toFixed(d))
  const base = `${n} ${scale.unit}`
  if (scale.coffeeOsDial && d === 0 && !redClix) {
    return `${base} (${formatCoffeeOS(n, scale.coffeeOsDial)})`
  }
  return base
}

/* Интерполяция по дробному coarseness (0..6): число на шкале кофемолки */
function presetValue(
  grinderId: string | undefined,
  coarseness: number,
  redClix?: boolean,
): { value: number; scale: GrinderScale; red: boolean } | undefined {
  const scale = getGrinderScale(grinderId)
  if (!scale) return undefined
  const c = Math.max(0, Math.min(GRIND_SIZES.length - 1, coarseness))
  const i = Math.floor(c)
  const frac = c - i
  const p0 = scale.points[i]
  const p1 = scale.points[Math.min(GRIND_SIZES.length - 1, i + 1)]
  const red = Boolean(redClix) && isComandanteC40(grinderId)
  return { value: (p0 + (p1 - p0) * frac) * (red ? 2 : 1), scale, red }
}

const isComandanteC40 = (id: string | undefined): boolean =>
  id === 'comandante-c40' || findGrinder(id)?.id === 'comandante-c40'

/* Интерполяция по дробному coarseness (0..6), строка для показа */
export function presetSettingByCoarseness(
  grinderId: string | undefined,
  coarseness: number,
  redClix?: boolean,
): string | undefined {
  const r = presetValue(grinderId, coarseness, redClix)
  return r && fmtVal(r.value, r.scale, r.red)
}

export function presetSettingForSize(
  grinderId: string | undefined,
  size: GrindSize,
  redClix?: boolean,
): string | undefined {
  const idx = GRIND_SIZES.indexOf(size)
  return idx >= 0 ? presetSettingByCoarseness(grinderId, idx, redClix) : undefined
}

export function allPresetSettings(
  grinderId: string | undefined,
  redClix?: boolean,
): Partial<Record<GrindSize, string>> {
  const out: Partial<Record<GrindSize, string>> = {}
  for (const s of GRIND_SIZES) {
    const v = presetSettingForSize(grinderId, s, redClix)
    if (v) out[s] = v
  }
  return out
}

/* Извлекает число из строки помола (например: "24", "24 кл.", "4.8 дел.", "1-4-5") */
export function parseDialValue(settingInput: string | number, scale?: GrinderScale): number | null {
  if (typeof settingInput === 'number') {
    return isNaN(settingInput) ? null : settingInput
  }
  const trimmed = settingInput.replace(/^[≈~]\s*/, '').trim()
  if (!trimmed) return null

  // CoffeeOS формат «Оборот-Цифра-Клик» (1-4-5, 1.4.5) или «Оборот-Клик» (1-6).
  // Одиночная точка («1.5», «22.5») — это десятичная дробь, а не оборот.цифра.
  const rnc = scale?.coffeeOsDial
    ? trimmed.match(/^(\d+)[-–—:.](\d+)[-–—:.](\d+)(?!\d)/) ?? trimmed.match(/^(\d+)[-–—:](\d+)(?!\d)/)
    : null
  if (rnc && scale?.coffeeOsDial) {
    const [clicksPerRot, numbersOnDial] = scale.coffeeOsDial
    const clicksPerNum = clicksPerRot / numbersOnDial
    const rot = Number(rnc[1])
    const num = Number(rnc[2])
    const sub = rnc[3] !== undefined ? Number(rnc[3]) : 0
    return rot * clicksPerRot + num * clicksPerNum + sub
  }

  // Обычное число "24 кл.", "4.8"
  const m = trimmed.match(/[-+]?[0-9]*\.?[0-9]+/)
  if (!m) return null
  const parsed = parseFloat(m[0])
  return isNaN(parsed) ? null : parsed
}

/* Преобразует значение шкалы исходной кофемолки в непрерывную крупность coarseness (0..6) */
export function coarsenessFromSetting(
  grinderId: string | undefined,
  settingInput: string | number,
  redClix?: boolean,
): number | undefined {
  const scale = getGrinderScale(grinderId)
  if (!scale) return undefined

  const num = parseDialValue(settingInput, scale)
  if (num === null) return undefined

  const mult = (isComandanteC40(grinderId) && redClix) ? 2 : 1
  const effectivePoints = scale.points.map(p => p * mult)

  if (num <= effectivePoints[0]) {
    const span = effectivePoints[1] - effectivePoints[0]
    return span > 0 ? Math.max(0, (num - effectivePoints[0]) / span) : 0
  }
  const lastIdx = effectivePoints.length - 1
  if (num >= effectivePoints[lastIdx]) {
    return lastIdx
  }

  for (let i = 0; i < lastIdx; i++) {
    const p0 = effectivePoints[i]
    const p1 = effectivePoints[i + 1]
    if (num >= p0 && num <= p1) {
      const frac = p1 > p0 ? (num - p0) / (p1 - p0) : 0
      return i + frac
    }
  }
  return 0
}

/* Мгновенный конвертер помола между двумя кофемолками (как на brewmark.io/grinders) */
export function convertGrindSetting(
  fromGrinderId: string | undefined,
  settingInput: string | number,
  toGrinderId: string | undefined,
  fromRedClix?: boolean,
  toRedClix?: boolean,
): { targetSetting: string; targetValue: number; coarseness: number; size: GrindSize } | undefined {
  const coarseness = coarsenessFromSetting(fromGrinderId, settingInput, fromRedClix)
  if (coarseness === undefined) return undefined
  const target = presetValue(toGrinderId, coarseness, toRedClix)
  if (!target) return undefined
  const targetSetting = fmtVal(target.value, target.scale, target.red)
  const dd = target.scale.decimals ?? 0
  const targetValue = dd === 0 ? Math.round(target.value) : Number(target.value.toFixed(dd))
  const sizeIdx = Math.max(0, Math.min(GRIND_SIZES.length - 1, Math.round(coarseness)))
  return {
    targetSetting,
    targetValue,
    coarseness,
    size: GRIND_SIZES[sizeIdx],
  }
}
