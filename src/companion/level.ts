/* Уровень знаний пользователя — влияет на плотность интерфейса и подсказки. */
import { reportStorageError } from '../storageError'
export type SkillLevel = 'beginner' | 'enthusiast' | 'pro'

const KEY = 'brewmate.skillLevel.v1'

export const loadSkillLevel = (): SkillLevel => {
  try {
    const v = localStorage.getItem(KEY)
    if (v === 'beginner' || v === 'enthusiast' || v === 'pro') return v
  } catch { /* ignore */ }
  return 'enthusiast'
}

export const saveSkillLevel = (l: SkillLevel): boolean => {
  try {
    localStorage.setItem(KEY, l)
    return true
  } catch (e) {
    reportStorageError(KEY, e)
    return false
  }
}

export const LEVEL_LABEL: Record<SkillLevel, string> = {
  beginner: 'Новичок',
  enthusiast: 'Любитель',
  pro: 'Профессионал',
}

/* Новичкам показываем меньше полей и больше подсказок. */
export const showAdvanced = (l: SkillLevel) => l !== 'beginner'
export const showHints = (l: SkillLevel) => l !== 'pro'