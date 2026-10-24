#!/usr/bin/env node
/* Импорт каталога кофемолок из реестра CoffeeJSON (CC0-1.0).
   Источник: https://github.com/coffeejson-org/coffeejson → registries/gear.json

   Использование:
     node scripts/import-coffeejson-gear.mjs <путь/к/gear.json> [<commit источника>]

   Пишет src/grinders/catalog.generated.ts. Файл не править руками —
   запускать скрипт заново при обновлении реестра. */
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const [src, commit = 'unknown'] = process.argv.slice(2)
if (!src) {
  console.error('Укажи путь к registries/gear.json')
  process.exit(1)
}

const registry = JSON.parse(readFileSync(src, 'utf8'))
if (!Array.isArray(registry.gear)) throw new Error('в файле нет массива gear')

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const grinders = registry.gear
  .filter(g => Array.isArray(g.roles) && g.roles.includes('grinder'))
  .map(g => {
    if (!SLUG.test(g.id)) throw new Error(`некорректный id: ${g.id}`)
    if (typeof g.label !== 'string' || !g.label) throw new Error(`нет label у ${g.id}`)
    const out = { id: g.id, label: g.label }
    if (Array.isArray(g.aliases) && g.aliases.length) out.aliases = g.aliases.filter(a => typeof a === 'string')
    /* в реестре встроенные кофемолки помечены категорией оборудования (эспрессо-машина и т.п.) */
    if (typeof g.category === 'string') out.builtIn = g.category
    return out
  })
  .sort((a, b) => a.label.localeCompare(b.label, 'en'))

const ids = new Set(grinders.map(g => g.id))
if (ids.size !== grinders.length) throw new Error('в реестре повторяются id кофемолок')

const body = `/* ФАЙЛ СГЕНЕРИРОВАН — не править руками.
   Источник: CoffeeJSON gear registry (https://github.com/coffeejson-org/coffeejson,
   registries/gear.json, коммит ${commit}), лицензия CC0 1.0 (общественное достояние).
   Обновить: node scripts/import-coffeejson-gear.mjs <gear.json> <commit> */

export interface CatalogGrinder {
  id: string          // slug реестра CoffeeJSON (kebab-case), по нему сопоставляются данные между приложениями
  label: string
  aliases?: string[]
  builtIn?: string    // кофемолка встроена в машину (категория оборудования в реестре)
}

export const CATALOG_SOURCE = { name: 'CoffeeJSON gear registry', license: 'CC0-1.0', commit: ${JSON.stringify(commit)} }

export const CATALOG: CatalogGrinder[] = ${JSON.stringify(grinders, null, 2)}
`

const out = resolve(dirname(fileURLToPath(import.meta.url)), '../src/grinders/catalog.generated.ts')
writeFileSync(out, body)
console.log(`записано ${grinders.length} кофемолок → ${out}`)
