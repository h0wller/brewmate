import type { GrindSize } from '../grinders/size'
import { coarsenessFromSetting, presetSettingByCoarseness, parseDialValue, getGrinderScale } from '../grinders/presets'
import type { GrindStats } from './analyze'
import { FLAG_TEXT } from './analyze'
import { coarsenessFromUm, midUm, TARGET_UM } from './target'
import { settingFor } from './curve'
import type { Flow } from './flow'
import type { Curve } from './curve'

export type Taste = 'sour' | 'bitter' | 'ok'
export type Verdict = 'ok' | 'finer' | 'coarser'

export interface Advice {
  verdict: Verdict            // что сделать с помолом
  offPct: number              // насколько D50 вне цели, % (0 если в диапазоне)
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

const round = (v: number, decimals = 0) => { const k = 10 ** decimals; return Math.round(v * k) / k }

export function adviseGrind(inp: AdviseInput): Advice {
  const { stats, size } = inp
  const [lo, hi] = TARGET_UM[size]
  const notes: string[] = stats.flags.map(f => FLAG_TEXT[f])
  /* Вкус главнее времени. Если вкус не указан или «нормально», подсказкой служит время заваривания:
     дольше плана — помол, вероятно, мелковат (как «горько»), быстрее — крупноват (как «кисло»). */
  let taste: Taste = inp.taste ?? 'ok'
  if (taste === 'ok' && inp.flow) {
    taste = inp.flow === 'slow' ? 'bitter' : 'sour'
    notes.push(inp.flow === 'slow'
      ? 'Заваривание шло дольше плана — это тоже намекает, что помол мелковат.'
      : 'Заваривание прошло быстрее плана — это тоже намекает, что помол крупноват.')
  }
  const aimUm = aimFor(size, taste)

  let verdict: Verdict = 'ok'
  let offPct = 0
  if (stats.d50 < lo) { verdict = 'coarser'; offPct = Math.round(((lo - stats.d50) / lo) * 100) }
  else if (stats.d50 > hi) { verdict = 'finer'; offPct = Math.round(((stats.d50 - hi) / hi) * 100) }
  else if (taste === 'sour' && stats.d50 > aimUm) { verdict = 'finer'; offPct = Math.round(((stats.d50 - aimUm) / aimUm) * 100) }
  else if (taste === 'bitter' && stats.d50 < aimUm) { verdict = 'coarser'; offPct = Math.round(((aimUm - stats.d50) / aimUm) * 100) }

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
      /* относительный шаг по таблице пресетов: сдвиг «в уровнях крупности» от текущей настройки */
      const c0 = coarsenessFromSetting(inp.grinderId, inp.currentSetting, inp.redClix)
      if (c0 !== undefined) {
        const shift = coarsenessFromUm(aimUm) - coarsenessFromUm(stats.d50)
        const next = presetSettingByCoarseness(inp.grinderId, c0 + shift, inp.redClix)
        const v = next ? parseDialValue(next, getGrinderScale(inp.grinderId)) : null
        if (v !== null) { suggested = round(v, inp.decimals ?? 0); basis = 'preset' }
      }
    }
    if (basis === 'none') notes.push('Сдвинь на 1–2 шага и сфоткай ещё раз: после двух-трёх замеров приложение выучит твою кофемолку и назовёт точную настройку.')
    if (basis === 'preset') notes.push('Число ориентировочное (по усреднённой шкале модели): после смены сфоткай ещё раз.')
  }
  return { verdict, offPct, target: [lo, hi], aimUm, suggested, basis, reliable, notes }
}

export const VERDICT_TEXT: Record<Verdict, string> = {
  ok: 'Помол в самый раз',
  finer: 'Помол крупноват — сделай мельче',
  coarser: 'Помол мелковат — сделай крупнее',
}
