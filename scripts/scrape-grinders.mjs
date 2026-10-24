#!/usr/bin/env node
/* Парсер базы кофемолок и шкал помола с BrewMark (https://brewmark.io/grinders)
   и DiFluid CoffeeOS (https://digitizefluid.com/pages/grinder-converter-tool).
   Запуск: node scripts/scrape-grinders.mjs */

import { writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36'

async function fetchHtml(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA } })
  if (!res.ok) throw new Error(`${res.status} ${url}`)
  return res.text()
}

/* 1. Собираем все slug кофемолок со страницы каталога BrewMark */
async function getBrewMarkSlugs() {
  const html = await fetchHtml('https://brewmark.io/grinders')
  const re = /href="\/grinders\/([a-z0-9-]+)"/g
  const ignore = new Set(['finder', 'compare', 'best', 'charts'])
  const slugs = new Set()
  let m
  while ((m = re.exec(html)) !== null) {
    if (!ignore.has(m[1])) slugs.add(m[1])
  }
  return [...slugs].sort()
}

/* 2. Парсим карточку конкретной кофемолки на BrewMark */
function parseBrewMarkGrinder(slug, html) {
  const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')

  // Название
  const titleMatch = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)
  const label = (titleMatch ? titleMatch[1].replace(/<[^>]+>/g, '').replace(/grind settings/i, '').trim() : slug)

  // "On the X, start pour over at A, espresso at B and French press at C."
  const summaryMatch = text.match(/start pour over at\s+([0-9.+A-Za-z\s-]+?),\s*espresso at\s+([0-9.+A-Za-z\s-]+?)\s+and French press at\s+([0-9.+A-Za-z\s-]+?)\./i)

  // Dial range, Scale, Burrs
  const dialMatch = text.match(/Dial range\s*([^B]+?)(?=Scale|Burrs|Filter|$)/i)
  const burrsMatch = text.match(/Burrs\s*(Conical|Flat)/i)
  const filterRefMatch = text.match(/Filter reference\s*([0-9.]+)/i)

  const parseNum = (s) => {
    if (!s) return null
    // Поддержка формата "1+3 turns" -> 1.3 или чисел "145 clicks" -> 145
    const turns = s.match(/(\d+)\s*\+\s*([\d.]+)/)
    if (turns) return Number(turns[1]) * 10 + Number(turns[2])
    const num = s.match(/[\d.]+/)
    return num ? Number(num[0]) : null
  }

  const pourOver = parseNum(summaryMatch?.[1])
  const espresso = parseNum(summaryMatch?.[2])
  const frenchPress = parseNum(summaryMatch?.[3])

  if (pourOver === null || espresso === null || frenchPress === null) return null

  const unit = /click/i.test(summaryMatch?.[1] ?? '') || /click/i.test(dialMatch?.[1] ?? '')
    ? 'кл.'
    : /rotation|turn/i.test(dialMatch?.[1] ?? '')
      ? 'об.'
      : 'дел.'

  // Строим 7 опорных точек: [extra_fine, fine, medium_fine, medium, medium_coarse, coarse, extra_coarse]
  const ef = Math.max(1, +(espresso * 0.65).toFixed(1))
  const f = espresso
  const mf = pourOver
  const m = +((pourOver + frenchPress) * 0.46).toFixed(1)
  const mc = +((pourOver + frenchPress) * 0.56).toFixed(1)
  const c = frenchPress
  const ec = +(frenchPress * 1.15).toFixed(1)

  const decimals = [f, mf, c].some(n => !Number.isInteger(n)) ? 1 : 0

  return {
    id: slug,
    label,
    burrs: burrsMatch ? burrsMatch[1].toLowerCase() : undefined,
    dialRange: dialMatch ? dialMatch[1].trim().slice(0, 40) : undefined,
    filterRef: filterRefMatch ? Number(filterRefMatch[1]) : undefined,
    unit,
    points: [ef, f, mf, m, mc, c, ec].map(x => decimals ? +x.toFixed(1) : Math.round(x)),
    decimals: decimals || undefined,
  }
}

async function main() {
  console.log('🔍 Загружаю список кофемолок с brewmark.io/grinders...')
  const slugs = await getBrewMarkSlugs()
  console.log(`Найдено моделей: ${slugs.length}`)

  const out = []
  for (const slug of slugs) {
    try {
      const html = await fetchHtml(`https://brewmark.io/grinders/${slug}`)
      const data = parseBrewMarkGrinder(slug, html)
      if (data) {
        out.push(data)
        console.log(`  ✔ ${data.label}: [${data.points.join(', ')}] ${data.unit}`)
      }
      await new Promise(r => setTimeout(r, 150)) // бережём сервер
    } catch (e) {
      console.warn(`  ✖ пропуск ${slug}: ${e.message}`)
    }
  }

  const dest = resolve(dirname(fileURLToPath(import.meta.url)), '../src/grinders/brewmark.generated.json')
  writeFileSync(dest, JSON.stringify(out, null, 2))
  console.log(`✅ Сохранено ${out.length} кофемолок в ${dest}`)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch(err => {
    console.error(err)
    process.exit(1)
  })
}
