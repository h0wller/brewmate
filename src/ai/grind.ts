import { AIError, askVision, parseProxyResponse } from './client'
import type { AIConfig } from './client'
import { GRIND_ISSUES, buildGrindPrompt } from './prompt'
import type { GrindFacts, GrindIssue } from './prompt'

export type OpinionVerdict = 'ok' | 'finer' | 'coarser' | 'unsure'

export interface GrindOpinion {
  verdict: OpinionVerdict
  comment: string
  issues: GrindIssue[]
}

export const ISSUE_TEXT: Record<GrindIssue, string> = {
  fines: 'много мелкой пыли',
  clumps: 'есть слипшиеся комки',
  uneven: 'помол неравномерный',
  bad_photo: 'снимок плохой для оценки',
}

const VERDICTS: OpinionVerdict[] = ['ok', 'finer', 'coarser', 'unsure']

/* Ответ модели → безопасная структура: лишнее отбрасываем, текст режем, неизвестное → «не уверен» */
export function parseGrindOpinion(raw: unknown): GrindOpinion {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const verdict = VERDICTS.includes(o.verdict as OpinionVerdict) ? (o.verdict as OpinionVerdict) : 'unsure'
  const comment = typeof o.comment === 'string' ? o.comment.replace(/\s+/g, ' ').trim().slice(0, 400) : ''
  const issues = Array.isArray(o.issues)
    ? GRIND_ISSUES.filter(i => (o.issues as unknown[]).includes(i))
    : []
  return { verdict, comment, issues }
}

/* Согласие с локальным измерением: расхождение показываем, но доверяем измерению */
export function opinionAgrees(opinion: GrindOpinion, local: 'ok' | 'finer' | 'coarser'): boolean | null {
  if (opinion.verdict === 'unsure') return null
  return opinion.verdict === local
}

/* Второе мнение: со своим ключом — напрямую, иначе через сервер BrewMate. Фото уходит только по нажатию кнопки. */
export async function askGrindOpinion(
  cfg: AIConfig | null, image: string, facts: GrindFacts,
): Promise<GrindOpinion> {
  if (cfg?.apiKey && cfg.baseUrl) return parseGrindOpinion(await askVision(cfg, image, buildGrindPrompt(facts)))
  let res: Response
  try {
    res = await fetch('/api/vision', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ task: 'grind', image, grind: facts }),
    })
  } catch {
    throw new AIError('network', 'Нет связи с сервером. Проверь интернет и попробуй ещё раз.')
  }
  let body: unknown = null
  try { body = await res.json() } catch { /* разберём по статусу */ }
  return parseGrindOpinion(parseProxyResponse(res.status, body))
}
