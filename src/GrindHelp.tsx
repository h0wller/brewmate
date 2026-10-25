import { useEffect, useMemo, useRef, useState } from 'react'
import type { PointerEvent } from 'react'
import type { GrinderProfile } from './types'
import { NumField } from './NumField'
import { findGrinder } from './grinders/catalog'
import { GRIND_SIZES, SIZE_LABEL } from './grinders/size'
import type { GrindSize } from './grinders/size'
import { COINS, scaleFromPoints, segment, summarize } from './grind/analyze'
import type { GrindStats, Segmentation } from './grind/analyze'
import { adviseGrind, VERDICT_TEXT } from './grind/advise'
import type { Taste } from './grind/advise'
import { fitCurve } from './grind/curve'
import { curvePoints, loadChecks, saveChecks } from './grind/store'
import { uid } from './storage'
import { AIError, loadAIConfig } from './ai/client'
import { askGrindOpinion, ISSUE_TEXT, opinionAgrees } from './ai/grind'
import type { GrindOpinion } from './ai/grind'
import { imageDataToJpeg } from './ai/image'

const MAX_SIDE = 1600
type Pt = { x: number; y: number }
type Step = 'setup' | 'mark' | 'result'

/* Фото → холст рабочего размера (с учётом поворота камеры). Дальше оно нигде не хранится и никуда не уходит. */
async function loadToCanvas(file: File, canvas: HTMLCanvasElement): Promise<void> {
  let src: CanvasImageSource & { width: number; height: number }
  let revoke = ''
  try {
    src = await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    const url = URL.createObjectURL(file); revoke = url
    src = await new Promise<HTMLImageElement>((ok, fail) => {
      const im = new Image(); im.onload = () => ok(im); im.onerror = () => fail(new Error('image')); im.src = url
    })
  }
  const k = Math.min(1, MAX_SIDE / Math.max(src.width, src.height))
  canvas.width = Math.round(src.width * k); canvas.height = Math.round(src.height * k)
  canvas.getContext('2d', { willReadFrequently: true })!.drawImage(src, 0, 0, canvas.width, canvas.height)
  if (revoke) URL.revokeObjectURL(revoke)
}

export function GrindHelp({ profile, onBack, onOpenGrinder }: {
  profile: GrinderProfile
  onBack: () => void
  onOpenGrinder: () => void
}) {
  const [step, setStep] = useState<Step>('setup')
  const [setting, setSetting] = useState<number | null>(null)
  const [size, setSize] = useState<GrindSize>('medium')
  const [taste, setTaste] = useState<Taste | undefined>()
  const [coinId, setCoinId] = useState<string>(COINS[0].id)
  const [pts, setPts] = useState<Pt[]>([])
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [stats, setStats] = useState<GrindStats | null>(null)
  const [seg, setSeg] = useState<Segmentation | null>(null)
  const [pxPerMm, setPxPerMm] = useState(0)
  const [saved, setSaved] = useState(false)
  const [opinion, setOpinion] = useState<GrindOpinion | null>(null)
  const [asking, setAsking] = useState(false)
  const [aiErr, setAiErr] = useState('')
  const [checks, setChecks] = useState(loadChecks)
  const canvas = useRef<HTMLCanvasElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const grinderId = profile.grinder?.id
  const grinderName = profile.grinder
    ? (findGrinder(profile.grinder.id)?.label ?? profile.grinder.label ?? profile.grinder.id) : undefined

  const curve = useMemo(() => fitCurve(curvePoints(checks, grinderId)), [checks, grinderId])
  const mine = useMemo(() => checks.filter(c => (c.grinderId ?? '') === (grinderId ?? '')), [checks, grinderId])

  const advice = useMemo(() => stats ? adviseGrind({
    stats, size, taste, curve, grinderId, redClix: profile.redClix,
    currentSetting: setting ?? undefined,
    decimals: setting !== null && !Number.isInteger(setting) ? 1 : 0,
  }) : null, [stats, size, taste, curve, grinderId, profile.redClix, setting])

  /* рисуем: фото + отметки монеты (шаг 2) или найденные частицы (шаг 3) */
  const draw = () => {
    const cv = canvas.current; if (!cv || !cv.width) return
    const ctx = cv.getContext('2d')!
    if (step === 'mark') {
      ctx.lineWidth = Math.max(2, cv.width / 400)
      ctx.strokeStyle = '#ff9f0a'; ctx.fillStyle = '#ff9f0a'
      for (const p of pts) { ctx.beginPath(); ctx.arc(p.x, p.y, ctx.lineWidth * 3, 0, 7); ctx.fill() }
      if (pts.length === 2) {
        ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y); ctx.lineTo(pts[1].x, pts[1].y); ctx.stroke()
        const r = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) / 2
        ctx.beginPath(); ctx.arc((pts[0].x + pts[1].x) / 2, (pts[0].y + pts[1].y) / 2, r, 0, 7); ctx.stroke()
      }
    } else if (step === 'result' && seg) {
      ctx.lineWidth = 1; ctx.strokeStyle = '#30d158'
      for (const p of seg.particles) {
        ctx.beginPath(); ctx.arc(p.cx, p.cy, Math.max(1.5, Math.sqrt(p.area / Math.PI)), 0, 7); ctx.stroke()
      }
    }
  }
  const reload = async (file: File) => {
    setErr(''); setBusy(true)
    try {
      await loadToCanvas(file, canvas.current!)
      canvas.current!.dataset.src = '1'
      setPts([]); setStats(null); setSeg(null); setSaved(false); setOpinion(null); setAiErr(''); setStep('mark')
    } catch { setErr('Не удалось открыть фото. Попробуй снять ещё раз.') }
    setBusy(false)
  }

  /* перерисовать чистое фото (после отметок/результата) придётся из исходника — поэтому храним копию */
  const original = useRef<ImageData | null>(null)
  const onFile = async (f?: File) => {
    if (!f) return
    await reload(f)
    const cv = canvas.current!
    original.current = cv.getContext('2d')!.getImageData(0, 0, cv.width, cv.height)
  }
  const repaint = () => {
    const cv = canvas.current
    if (cv && original.current) cv.getContext('2d')!.putImageData(original.current, 0, 0)
  }
  useEffect(() => { if (step !== 'setup') { repaint(); draw() } }, [pts, step, seg])

  const tap = (e: PointerEvent<HTMLCanvasElement>) => {
    if (step !== 'mark') return
    const cv = e.currentTarget, r = cv.getBoundingClientRect()
    const p = { x: ((e.clientX - r.left) / r.width) * cv.width, y: ((e.clientY - r.top) / r.height) * cv.height }
    setPts(prev => (prev.length >= 2 ? [p] : [...prev, p]))
  }

  const measure = () => {
    const cv = canvas.current, img = original.current
    if (!cv || !img || pts.length < 2) return
    const coin = COINS.find(c => c.id === coinId)!
    const k = scaleFromPoints(pts[0], pts[1], coin.mm)
    if (!k) { setErr('Отметь два края монеты.'); return }
    setErr(''); setBusy(true)
    /* даём экрану перерисоваться, пока считаем */
    setTimeout(() => {
      const circle = {
        cx: (pts[0].x + pts[1].x) / 2, cy: (pts[0].y + pts[1].y) / 2,
        r: (Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) / 2) * 1.12,
      }
      const s = segment(img, { exclude: [circle] })
      const st = summarize(s, k)
      setBusy(false)
      if (!st) { setErr('Не нашёл частиц. Нужен тёмный помол на белой бумаге, при ровном свете.'); return }
      setSeg(s); setStats(st); setPxPerMm(k); setStep('result')
    }, 30)
  }

  const save = () => {
    if (!stats || setting === null) return
    const next = [...checks, {
      id: uid(), at: Date.now(), grinderId, setting, size, taste,
      d10: Math.round(stats.d10), d50: Math.round(stats.d50), d90: Math.round(stats.d90), n: stats.n,
    }]
    saveChecks(next); setChecks(next); setSaved(true)
  }

  const askAI = async () => {
    const img = original.current
    if (!img || !stats || asking) return
    setAsking(true); setAiErr('')
    try {
      const image = imageDataToJpeg(img)
      setOpinion(await askGrindOpinion(loadAIConfig(), image, {
        size, d10: Math.round(stats.d10), d50: Math.round(stats.d50), d90: Math.round(stats.d90), n: stats.n,
        ...(taste ? { taste } : {}),
      }))
    } catch (e) {
      setAiErr(e instanceof AIError ? e.message : 'Не удалось получить второе мнение. Попробуй ещё раз.')
    }
    setAsking(false)
  }

  const retake = () => { setStep('setup'); setStats(null); setSeg(null); setSaved(false); setPts([]); setErr(''); setOpinion(null); setAiErr('') }

  return (
    <div>
      <button className="back" onClick={onBack}>← Назад</button>
      <h1>Помощь с помолом</h1>

      {step === 'setup' && (
        <>
          <div className="small">
            Сфоткай помол — приложение измерит частицы на телефоне и скажет, крупнее или мельче. Фото никуда не отправляется и не сохраняется.
          </div>

          <div className="card" onClick={onOpenGrinder}>
            <div>🔧 {grinderName ?? 'Выбрать кофемолку'}</div>
            <div className="small" style={{ margin: '4px 0 0' }}>
              {grinderName ? 'Замеры привязываются к ней' : 'Без кофемолки приложение не выучит твою шкалу'}
            </div>
          </div>

          <div className="small">На какой настройке сейчас помол?</div>
          <div className="row">
            <NumField value={setting} onValue={setSetting} decimal label="Настройка кофемолки" placeholder="напр. 24" />
            <span className="small" style={{ margin: 0 }}>число на шкале кофемолки</span>
          </div>

          <div className="small">Для чего этот помол?</div>
          <div className="chips">
            {GRIND_SIZES.map(s => (
              <button key={s} className={'chip' + (size === s ? ' on' : '')} onClick={() => setSize(s)}>{SIZE_LABEL[s]}</button>
            ))}
          </div>

          <div className="small">Как на вкус прошлая заварка? (необязательно)</div>
          <div className="chips">
            {([['sour', 'Кисло'], ['bitter', 'Горько'], ['ok', 'Нормально']] as const).map(([t, l]) => (
              <button key={t} className={'chip' + (taste === t ? ' on' : '')} onClick={() => setTaste(taste === t ? undefined : t)}>{l}</button>
            ))}
          </div>

          <div className="card" style={{ marginTop: 16 }}>
            <b>Как снять</b>
            <ol className="small" style={{ margin: '6px 0 0', paddingLeft: 18 }}>
              <li>Тонкий слой помола на белой бумаге, частицы не слипаются (слегка постучи по листу).</li>
              <li>Рядом положи монету и снимай сверху, ровный свет без бликов и теней.</li>
              <li>Ближе — лучше: должны быть видны отдельные крупинки.</li>
            </ol>
          </div>

          <input ref={fileRef} type="file" accept="image/*" hidden
            onChange={e => { onFile(e.target.files?.[0]); e.target.value = '' }} />
          <button className="btn" style={{ marginTop: 12 }} disabled={busy} onClick={() => fileRef.current?.click()}>
            📷 Сфоткать помол
          </button>
          {err && <div className="small" style={{ color: '#ff6961' }}>{err}</div>}
          {mine.length > 0 && (
            <div className="small">
              Замеров по этой кофемолке: {mine.length}. {curve
                ? 'Шкала кофемолки уже выучена — совет будет точным.'
                : 'Нужны замеры на двух разных настройках, чтобы выучить шкалу.'}
            </div>
          )}
        </>
      )}

      <canvas ref={canvas} onPointerDown={tap}
        style={{ width: '100%', borderRadius: 12, display: step === 'setup' ? 'none' : 'block', touchAction: 'manipulation', marginTop: 8 }} />

      {step === 'mark' && (
        <>
          <div className="small">Нажми на два противоположных края монеты — так приложение узнает масштаб.</div>
          <div className="chips">
            {COINS.map(c => (
              <button key={c.id} className={'chip' + (coinId === c.id ? ' on' : '')} onClick={() => setCoinId(c.id)}>{c.label}</button>
            ))}
          </div>
          {err && <div className="small" style={{ color: '#ff6961' }}>{err}</div>}
          <button className="btn" style={{ marginTop: 12 }} disabled={pts.length < 2 || busy} onClick={measure}>
            {busy ? 'Считаю…' : 'Измерить'}
          </button>
          <button className="btn secondary" style={{ marginTop: 8 }} onClick={retake}>Переснять</button>
        </>
      )}

      {step === 'result' && stats && advice && (
        <>
          <div className="card" style={{ marginTop: 12 }}>
            <div style={{ fontSize: 18, fontWeight: 600 }}>
              {VERDICT_TEXT[advice.verdict]}{advice.offPct > 0 ? ` (на ~${advice.offPct}%)` : ''}
            </div>
            {advice.suggested !== undefined && (
              <div style={{ marginTop: 6 }}>
                Поставь ≈ <b>{advice.suggested}</b>
                <span className="small"> {advice.basis === 'curve' ? (advice.reliable ? 'по твоей шкале' : 'по твоей шкале, предварительно') : 'по усреднённой шкале модели'}</span>
              </div>
            )}
            <div className="small" style={{ margin: '8px 0 0' }}>
              Типичный размер частиц ≈ {Math.round(stats.d50)} мкм (цель для «{SIZE_LABEL[size]}»: {advice.target[0]}–{advice.target[1]}).
              Разброс: {stats.span < 0.6 ? 'небольшой' : stats.span < 0.9 ? 'средний' : 'большой'}. Посчитано частиц: {stats.n}.
            </div>
          </div>
          {advice.notes.map((n, i) => <div key={i} className="small">• {n}</div>)}
          <div className="small">Зелёные кружки — найденные частицы. Если они лежат мимо крупинок, переснимай при другом освещении.</div>
          {setting === null && <div className="small">Укажи текущую настройку, чтобы сохранить замер и выучить шкалу кофемолки.</div>}
          <div className="card" style={{ display: 'block', cursor: 'default', marginTop: 12 }}>
            <b>Второе мнение ИИ</b> <span className="small" style={{ margin: 0 }}>необязательно</span>
            {!opinion && (
              <>
                <div className="small" style={{ margin: '6px 0' }}>
                  ИИ посмотрит снимок на мелкую пыль, комки и неравномерность. Размеры он не измеряет — берёт твои цифры.
                  {loadAIConfig()?.apiKey ? 'Фото уйдёт напрямую выбранному AI-сервису (твой ключ) и нигде не сохраняется.' : 'Фото уйдёт на сервер BrewMate и AI-провайдеру и нигде не сохраняется; бесплатных запросов в день немного.'}
                </div>
                <button className="btn secondary" disabled={asking} onClick={askAI}>{asking ? 'Смотрю…' : 'Спросить ИИ'}</button>
              </>
            )}
            {aiErr && <div className="small" style={{ color: '#ff6961' }}>{aiErr}</div>}
            {opinion && (
              <div style={{ marginTop: 6 }}>
                {opinion.comment && <div>{opinion.comment}</div>}
                {opinion.issues.length > 0 && (
                  <div className="small" style={{ margin: '6px 0 0' }}>Заметил: {opinion.issues.map(i => ISSUE_TEXT[i]).join(', ')}.</div>
                )}
                {opinion.verdict === 'unsure' && <div className="small" style={{ margin: '6px 0 0' }}>По этому снимку ИИ судить не берётся.</div>}
                {opinionAgrees(opinion, advice.verdict) === false && (
                  <div className="small" style={{ margin: '6px 0 0' }}>ИИ и замер расходятся. Замеру можно верить больше: он считает частицы, а ИИ только смотрит.</div>
                )}
              </div>
            )}
          </div>

          <button className="btn" style={{ marginTop: 8 }} disabled={setting === null || saved} onClick={save}>
            {saved ? 'Замер сохранён' : 'Сохранить замер'}
          </button>
          <button className="btn secondary" style={{ marginTop: 8 }} onClick={retake}>Переснять после правки</button>
          <div className="small">Масштаб: {pxPerMm.toFixed(1)} пикс/мм.</div>
        </>
      )}
    </div>
  )
}
