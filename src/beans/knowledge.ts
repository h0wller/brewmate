/**
 * Source-backed brew guidance.
 *
 * Numeric grinder settings are intentionally NOT inferred from these profiles:
 * grinder dial numbers are device-specific and the legacy preset table is explicitly
 * unverified. This file stores only method-level guidance with provenance.
 */
export interface BrewKnowledgeSource {
  title: string
  url: string
  publisher: string
}
export interface BrewMethodKnowledge {
  targetGrind: 'medium' | 'medium_coarse'
  grindDescription: string
  ratioMin: number
  ratioMax: number
  targetTempMinC: number
  targetTempMaxC: number
  bloomSeconds?: number
  notes: string[]
  sources: BrewKnowledgeSource[]
}

export const BREW_KNOWLEDGE: Record<'moccamaster', BrewMethodKnowledge> = {
  moccamaster: {
    targetGrind: 'medium_coarse',
    grindDescription: 'средний–средне-крупный, визуально как крупный песок / морская соль',
    ratioMin: 16.7,
    ratioMax: 18.2,
    targetTempMinC: 92,
    targetTempMaxC: 96,
    bloomSeconds: 35,
    notes: [
      'Начинай с диапазона среднего–средне-крупного помола; слишком мелкий может замедлить проток и вызвать переполнение корзины.',
      'Ориентир дозировки 55–60 г кофе на литр воды; подстрой под вкус и размер партии.',
      'Не переводить общую крупность в клики/деления кофемолки без проверенной калибровки именно этой модели.',
      'Предсмачивание — опциональный эксперимент бариста, а не обязательная часть штатного цикла машины.',
    ],
    sources: [
      {
        title: 'Can grind size make my coffee taste bitter or weak?',
        publisher: 'Moccamaster USA Support',
        url: 'https://support.moccamaster.com/hc/en-us/articles/1500009385562-Can-grind-size-make-my-coffee-taste-bitter-or-weak',
      },
      {
        title: 'How to Make a Perfect Cup of Coffee with a Moccamaster',
        publisher: 'Moccamaster USA',
        url: 'https://us.moccamaster.com/blogs/blog/how-to-make-a-perfect-cup-of-coffee-with-a-moccamaster',
      },
      {
        title: 'Minimum Certification Requirements for Coffee Brewers',
        publisher: 'Specialty Coffee Association',
        url: 'https://sca.coffee/s/2017-SCA-CHB-Program-Requirements-ba6g.pdf',
      },
    ],
  },
}

export function moccamasterWaterGuidance(doseG: number): { minWaterG: number; maxWaterG: number } {
  return {
    minWaterG: Math.round(doseG * BREW_KNOWLEDGE.moccamaster.ratioMin),
    maxWaterG: Math.round(doseG * BREW_KNOWLEDGE.moccamaster.ratioMax),
  }
}

/** General principles: constraints are explicit and traceable, not free-form model guesses. */
export const BREWING_PRINCIPLES = [
  {
    id: 'grind-device-specific',
    rule: 'A grinder dial number is not a universal grind-size unit. Use measured/user-calibrated settings or the manufacturer range for that exact grinder.',
    sources: [
      {
        title: 'Can grind size make my coffee taste bitter or weak?',
        publisher: 'Moccamaster USA Support',
        url: 'https://support.moccamaster.com/hc/en-us/articles/1500009385562-Can-grind-size-make-my-coffee-taste-bitter-or-weak',
      },
    ],
  },
  {
    id: 'taste-and-extraction',
    rule: 'Do not infer a uniquely correct recipe from roast/process labels alone. Treat the recipe as a starting point and adjust against taste, brew time/flow, and where available TDS/extraction.',
    sources: [
      {
        title: 'How Hot is Hot Enough? Brew Temperature, Sensory Profile, and Consumer Acceptance of Brewed Coffee',
        publisher: 'Specialty Coffee Association',
        url: 'https://sca.coffee/sca-news/25/issue-15/how-hot-is-hot-enough-brew-temperature-sensory-profile-and-consumer-acceptance-of-brewed-coffee-5dj5b',
      },
      {
        title: 'ACM 2.08 - Recap and Glossary',
        publisher: 'Barista Hustle',
        url: 'https://www.baristahustle.com/lesson/acm-2-08-recap-and-glossary/',
      },
    ],
  },
] as const
