import type { GrindSize } from '../grinders/size'
import { coarsenessFromSetting, presetSettingByCoarseness, parseDialValue, getGrinderScale } from '../grinders/presets'
import type { GrindStats } from './analyze'
import { FLAG_TEXT } from './analyze'
import { coarsenessFromUm, midUm, TARGET_UM, umFromCoarseness } from './target'
import { predictUm, settingFor } from './curve'
import type { Flow } from './flow'
import type { Curve } from './curve'

export type Taste = 'sour' | 'bitter' | 'ok'
export type Verdict = 'ok' | 'finer' | 'coarser'

export interface Advice {
  verdict: Verdict            // что сделать с помолом
  offPct: number              // насколько D50 вне цели, % (0 если в диапазоне)
  expectedD50?: number        // какой D50 ожидался бы по таблице/кривой для этой настройки: только для сверки, на вердикт не влияет
  target: [number, number]
  aimUm: number               // куда целимся
  suggested?: number          // новая настройка (число на шкале)
  basis: 'curve' | 'preset' | 'none'
  reliable: boolean           // можно ли верить числу в suggested
  notes: string[]
}

export interface AdviseInput {
  stats: GrindStats
  size: GrindSize
  taste?: Taste
  flow?: Flow                 // заваривание шло дольше/быстрее плана (только для проливных методов)
  currentSetting?: number
  curve?: Curve | null
  grinderId?: string
  redClix?: boolean
  decimals?: number           // шаг шкалы: 0 — целые
}

/* Вкус сдвигает цель внутри диапазона: кислое — к мелкому краю, горькое — к крупному */
export function aimFor(size: GrindSize, taste: Taste = 'ok'): number {
  const [lo, hi] = TARGET_UM[size]
  const mid = midUm(size)
  if (taste === 'sour') return Math.sqrt(mid * lo)
  if (taste === 'bitter') return Math.sqrt(mid * hi)
  return mid
}

/* Ожидаемый D50 (мкм) исходя из заложенной в кофемолку настройки */
export function expectedUmForSetting(
  grinderId?: string,
  setting?: number,
  redClix?: boolean,
  curve?: Curve | null,
): number | undefined {
  if (setting === undefined || !Number.isFinite(setting)) return undefined
  if (curve) return predictUm(curve, setting)
  if (!grinderId) return undefined
  const c = coarsenessFromSetting(grinderId, setting, redClix)
  return c !== undefined ? umFromCoarseness(c) : undefined
}

const round = (v: number, decimals = 0) => { const k = 10 ** decimals; return Math.round(v * k) / k }

export function adviseGrind(inp: AdviseInput): Advice {
  const { stats, size } = inp
  const [lo, hi] = TARGET_UM[size]
  const notes: string[] = stats.flags.map(f => FLAG_TEXT[f])

  let taste: Taste = inp.taste ?? 'ok'
  if (taste === 'ok' && inp.flow) {
    taste = inp.flow === 'slow' ? 'bitter' : 'sour'
    notes.push(inp.flow === 'slow'
      ? 'Заваривание шло дольше плана — это тоже намекает, что помол мелковат.'
      : 'Заваривание прошло быстрее плана — это тоже намекает, что помол крупноват.')
  }
  const aimUm = aimFor(size, taste)

  /* Вердикт строится только по измеренному D50. Ожидание по таблице пресетов (она не подтверждена источниками)
     или по кривой служит лишь для сверки: сильное расхождение — повод проверить настройку и снимок, а не поправка к замеру. */
  const d50 = stats.d50
  const expectedD50 = expectedUmForSetting(inp.grinderId, inp.currentSetting, inp.redClix, inp.curve)
  if (expectedD50 !== undefined && (d50 < expectedD50 * 0.6 || d50 > expectedD50 * 1.7)) {
    notes.push(inp.curve
      ? 'Замер заметно отличается от твоей кривой для этой настройки: проверь, какая настройка стоит на самом деле, и качество снимка.'
      : `Замер заметно отличается от ориентира по шкале модели (≈ ${Math.round(expectedD50)} мкм при этой настройке; шкала не подтверждена): проверь, какая настройка стоит на самом деле. Верить стоит замеру.`)
  }

  let verdict: Verdict = 'ok'
  let offPct = 0
  if (d50 < lo) { verdict = 'coarser'; offPct = Math.round(((lo - d50) / lo) * 100) }
  else if (d50 > hi) { verdict = 'finer'; offPct = Math.round(((d50 - hi) / hi) * 100) }
  else if (taste === 'sour' && d50 > aimUm) { verdict = 'finer'; offPct = Math.round(((d50 - aimUm) / aimUm) * 100) }
  else if (taste === 'bitter' && d50 < aimUm) { verdict = 'coarser'; offPct = Math.round(((aimUm - d50) / aimUm) * 100) }

  /* вкус противоречит фото: не крутим помол вслепую */
  if ((verdict === 'finer' && taste === 'bitter') || (verdict === 'coarser' && taste === 'sour')) {
    notes.push('По фото помол надо двигать в одну сторону, а по вкусу — в другую. Скорее всего дело не в крупности: проверь температуру воды, время и равномерность помола.')
    verdict = 'ok'; offPct = 0
  }
  if (stats.span > 0.9) notes.push('Разброс размеров заметный: если вкус «и кисло, и горько», причина в нём, а не только в крупности.')

  let suggested: number | undefined
  let basis: Advice['basis'] = 'none'
  let reliable = false
  if (verdict !== 'ok') {
    if (inp.curve) {
      const s = settingFor(inp.curve, aimUm)
      suggested = round(s.setting, inp.decimals ?? 0); basis = 'curve'; reliable = s.reliable
      if (s.extrapolated) notes.push('Расчёт выходит за диапазон твоих замеров — после смены сфоткай ещё раз и проверь.')
      else if (!s.reliable) notes.push('Кривая кофемолки пока по 2 замерам или с разбросом: уточнится, когда добавишь ещё один.')
    } else if (inp.currentSetting !== undefined && inp.grinderId && getGrinderScale(inp.grinderId)) {
      const c0 = coarsenessFromSetting(inp.grinderId, inp.currentSetting, inp.redClix)
      if (c0 !== undefined) {
        // Разовый шаг ограничен ±0.85 уровня крупности: шкала пресетов ориентировочная, большой прыжок по ней не оправдан.
        const rawShift = coarsenessFromUm(aimUm) - coarsenessFromUm(d50)
        const safeShift = Math.max(-0.85, Math.min(0.85, rawShift))
        const next = presetSettingByCoarseness(inp.grinderId, c0 + safeShift, inp.redClix)
        const v = next ? parseDialValue(next, getGrinderScale(inp.grinderId)) : null
        if (v !== null) {
          const dec = inp.decimals ?? (getGrinderScale(inp.grinderId)?.decimals ?? 0)
          suggested = round(v, dec)
          basis = 'preset'
        }
      }
    }
    if (basis === 'none') notes.push('Сдвинь на 1–2 шага и сфоткай ещё раз: после двух-трёх замеров приложение выучит твою кофемолку и назовёт точную настройку.')
    if (basis === 'preset') notes.push('Число ориентировочное (рассчитано от текущей настройки твоей кофемолки): после смены сфоткай ещё раз.')
  }
  return { verdict, offPct, expectedD50, target: [lo, hi], aimUm, suggested, basis, reliable, notes }
}

export const VERDICT_TEXT: Record<Verdict, string> = {
  ok: 'Помол в самый раз',
  finer: 'Помол крупноват — сделай мельче',
  coarser: 'Помол мелковат — сделай крупнее',
}