/* ФАЙЛ СГЕНЕРИРОВАН — не править руками.
   Источник: CoffeeJSON gear registry (https://github.com/coffeejson-org/coffeejson,
   registries/gear.json, коммит b7a4c4cdbf32150fbde2e109f2989eb4e61d5275), лицензия CC0 1.0 (общественное достояние).
   Обновить: node scripts/import-coffeejson-gear.mjs <gear.json> <commit> */

export interface CatalogGrinder {
  id: string          // slug реестра CoffeeJSON (kebab-case), по нему сопоставляются данные между приложениями
  label: string
  aliases?: string[]
  builtIn?: string    // кофемолка встроена в машину (категория оборудования в реестре)
}

export const CATALOG_SOURCE = { name: 'CoffeeJSON gear registry', license: 'CC0-1.0', commit: "b7a4c4cdbf32150fbde2e109f2989eb4e61d5275" }

export const CATALOG: CatalogGrinder[] = [
  {
    "id": "1zpresso-jx",
    "label": "1Zpresso JX"
  },
  {
    "id": "1zpresso-k-ultra",
    "label": "1Zpresso K-Ultra"
  },
  {
    "id": "1zpresso-zp6",
    "label": "1Zpresso ZP6"
  },
  {
    "id": "baratza-encore",
    "label": "Baratza Encore"
  },
  {
    "id": "baratza-encore-esp",
    "label": "Baratza Encore ESP"
  },
  {
    "id": "baratza-sette-270",
    "label": "Baratza Sette 270",
    "aliases": [
      "baratza-270"
    ]
  },
  {
    "id": "baratza-virtuoso-plus",
    "label": "Baratza Virtuoso+"
  },
  {
    "id": "breville-barista-express",
    "label": "Breville Barista Express",
    "aliases": [
      "sage-barista-express"
    ],
    "builtIn": "espresso-machine"
  },
  {
    "id": "breville-barista-pro",
    "label": "Breville Barista Pro",
    "builtIn": "espresso-machine"
  },
  {
    "id": "comandante-c40",
    "label": "Comandante C40"
  },
  {
    "id": "df54",
    "label": "DF54",
    "aliases": [
      "turin-df54"
    ]
  },
  {
    "id": "df64",
    "label": "DF64",
    "aliases": [
      "turin-df64",
      "miicoffee-df64"
    ]
  },
  {
    "id": "eureka-mignon-specialita",
    "label": "Eureka Mignon Specialità",
    "aliases": [
      "eureka-specialita"
    ]
  },
  {
    "id": "eureka-mignon-zero",
    "label": "Eureka Mignon Zero"
  },
  {
    "id": "fellow-espresso-series-1",
    "label": "Fellow Espresso Series 1",
    "builtIn": "espresso-machine"
  },
  {
    "id": "fellow-ode",
    "label": "Fellow Ode"
  },
  {
    "id": "fellow-opus",
    "label": "Fellow Opus"
  },
  {
    "id": "kinu-m47",
    "label": "Kinu M47"
  },
  {
    "id": "mahlkonig-e80",
    "label": "Mahlkönig E80"
  },
  {
    "id": "mahlkonig-ek43",
    "label": "Mahlkönig EK43"
  },
  {
    "id": "mazzer-philos",
    "label": "Mazzer Philos"
  },
  {
    "id": "mazzer-super-jolly",
    "label": "Mazzer Super Jolly"
  },
  {
    "id": "niche-duo",
    "label": "Niche Duo"
  },
  {
    "id": "niche-zero",
    "label": "Niche Zero"
  },
  {
    "id": "option-o-lagom-01",
    "label": "Option-O Lagom 01",
    "aliases": [
      "lagom-01"
    ]
  },
  {
    "id": "option-o-lagom-mini",
    "label": "Option-O Lagom Mini",
    "aliases": [
      "lagom-mini"
    ]
  },
  {
    "id": "option-o-lagom-p64",
    "label": "Option-O Lagom P64",
    "aliases": [
      "lagom-p64"
    ]
  },
  {
    "id": "timemore-c3",
    "label": "Timemore C3"
  },
  {
    "id": "timemore-chestnut-c2",
    "label": "Timemore Chestnut C2",
    "aliases": [
      "timemore-c2"
    ]
  },
  {
    "id": "timemore-sculptor-078",
    "label": "Timemore Sculptor 078",
    "aliases": [
      "timemore-078"
    ]
  },
  {
    "id": "timemore-sculptor-078s",
    "label": "Timemore Sculptor 078S",
    "aliases": [
      "timemore-078s"
    ]
  },
  {
    "id": "varia-vs3",
    "label": "Varia VS3"
  },
  {
    "id": "weber-eg-1",
    "label": "Weber EG-1"
  },
  {
    "id": "weber-hg-2",
    "label": "Weber HG-2"
  },
  {
    "id": "weber-key",
    "label": "Weber Key"
  },
  {
    "id": "xbloom-studio",
    "label": "xBloom Studio",
    "builtIn": "pour-over-machine"
  },
  {
    "id": "zerno-z1",
    "label": "Zerno Z1"
  }
]
