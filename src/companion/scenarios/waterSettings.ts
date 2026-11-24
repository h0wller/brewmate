/* Детерминированный сценарий: настройка воды. */
export type WaterProfile = 'soft' | 'balanced' | 'hard'

export function waterAdvice(profile: WaterProfile): string {
  switch (profile) {
    case 'soft':
      return 'Мягкая вода подчёркивает кислотность. Чуть тоньше помол и плотнее пропорция для сладости. Температура +1°C.'
    case 'hard':
      return 'Жёсткая вода гасит кислотность и усиливает горечь. Вода прохладнее (-2°C), помол чуть крупнее.'
    default:
      return 'Сбалансированная вода — универсальный вариант. Начинайте с неё, корректируйте по вкусу.'
  }
}