import { useEffect, useMemo, useRef, useState } from 'react'
import type { PointerEvent } from 'react'
import type { BrewLog, GrinderProfile } from './types'
import { NumField } from './NumField'
import { findGrinder } from './grinders/catalog'
import { getGrinderScale, parseDialValue, presetSettingForSize } from './grinders/presets'
import { settingFor as profileSettingFor } from './grinders/profile'
import { tasteForGrind } from './brewlog/taste'
import { flowSignal } from './grind/flow'
import { GRIND_SIZES, SIZE_LABEL } from './grinders/size'
import type { GrindSize } from './grinders/size'
import { COINS, detectCoinCircle, segment, summarize } from './grind/analyze'
import type { Circle, GrindStats, Segmentation } from './grind/analyze'
import { adviseGrind, expectedUmForSetting, VERDICT_TEXT } from './grind/advise'
import type { Taste } from './grind/advise'
import { midUm } from './grind/target'
import { fitCurve } from './grind/curve'
import { curvePoints } from './grind/store'
import type { GrindCheck } from './grind/store'
import { uid } from './storage'
import { AIError, loadAIConfig } from './ai/client'
import { askGrindOpinion, ISSUE_TEXT, opinionAgrees } from './ai/grind'
import type { GrindOpinion } from './ai/grind'
import { imageDataToJpeg } from './ai/image'

const MAX_SIDE = 1600
type Step = 'setup' | 'mark' | 'result'

/* Достаёт числовую настройку кофемолки для выбранного уровня из профиля или заводского пресета */
function defaultSettingForSize(profile: GrinderProfile, size: GrindSize, logSetting?: string): number | null {
  const scale = getGrinderScale(profile.grinder?.id)
  if (logSetting) {
    const parsed = parseDialValue(logSetting, scale)
    if (parsed !== null) return parsed
  }
  const manual = profileSettingFor(profile, size)
  if (manual) {
    const parsed = parseDialValue(manual, scale)
    if (parsed !== null) return parsed
  }
  const preset = presetSettingForSize(profile.grinder?.id, size, profile.redClix)
  return preset ? parseDialValue(preset, scale) : null
}

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

export function GrindHelp({ profile, log, checks, onAddCheck, onDeleteCheck, onBack, onOpenGrinder }: {
  profile: GrinderProfile
  log?: BrewLog
  checks: GrindCheck[]
  onAddCheck: (c: GrindCheck) => void
  onDeleteCheck: (id: string) => void
  onBack: () => void
  onOpenGrinder: () => void
}) {
  const initialSize: GrindSize = log?.grind?.size ?? 'medium'
  const [step, setStep] = useState<Step>('setup')
  const [size, setSize] = useState<GrindSize>(initialSize)
  const [setting, setSetting] = useState<number | null>(() =>
    defaultSettingForSize(profile, initialSize, log?.grind?.setting),
  )
  const [taste, setTaste] = useState<Taste | undefined>(() => tasteForGrind(log?.taste))
  const flow = useMemo(() => (log ? flowSignal(log) : undefined), [log])
  const [coinId, setCoinId] = useState<string>('rub2')
  const [coinCircle, setCoinCircle] = useState<Circle | null>(null)
  const [dragMode, setDragMode] = useState<'move' | 'resize' | null>(null)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [stats, setStats] = useState<GrindStats | null>(null)
  const [seg, setSeg] = useState<Segmentation | null>(null)
  const [pxPerMm, setPxPerMm] = useState(0)
  const [saved, setSaved] = useState(false)
  const [opinion, setOpinion] = useState<GrindOpinion | null>(null)
  const [asking, setAsking] = useState(false)
  const [aiErr, setAiErr] = useState('')
  const canvas = useRef<HTMLCanvasElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const original = useRef<ImageData | null>(null)

  const grinderId = profile.grinder?.id
  const grinderScale = getGrinderScale(grinderId)
  const grinderName = profile.grinder
    ? (findGrinder(profile.grinder.id)?.label ?? profile.grinder.label ?? profile.grinder.id) : undefined

  const curve = useMemo(() => fitCurve(curvePoints(checks, grinderId)), [checks, grinderId])
  const mine = useMemo(() => checks.filter(c => (c.grinderId ?? '') === (grinderId ?? '')), [checks, grinderId])

  const pickSize = (nextSize: GrindSize) => {
    setSize(nextSize)
    const nextDefault = defaultSettingForSize(profile, nextSize)
    if (nextDefault !== null) setSetting(nextDefault)
  }

  const advice = useMemo(() => stats ? adviseGrind({
    stats, size, taste, flow, curve, grinderId, redClix: profile.redClix,
    currentSetting: setting ?? undefined,
    decimals: grinderScale?.decimals ?? (setting !== null && !Number.isInteger(setting) ? 1 : 0),
  }) : null, [stats, size, taste, flow, curve, grinderId, grinderScale, profile.redClix, setting])

  const repaint = () => {
    const cv = canvas.current
    if (cv && original.current) cv.getContext('2d')!.putImageData(original.current, 0, 0)
  }

  const draw = () => {
    const cv = canvas.current; if (!cv || !cv.width) return
    const ctx = cv.getContext('2d')!
    const lw = Math.max(2, cv.width / 350)

    if (step === 'mark' && coinCircle) {
      const { cx, cy, r } = coinCircle
      // Затемняем внешний фон вокруг кольца для контраста
      ctx.save()
      ctx.strokeStyle = '#ff9f0a'
      ctx.lineWidth = lw * 1.5
      ctx.beginPath()
      ctx.arc(cx, cy, r, 0, Math.PI * 2)
      ctx.stroke()

      // Центральное перекрестие
      ctx.lineWidth = lw * 0.8
      ctx.beginPath()
      ctx.moveTo(cx - lw * 5, cy); ctx.lineTo(cx + lw * 5, cy)
      ctx.moveTo(cx, cy - lw * 5); ctx.lineTo(cx, cy + lw * 5)
      ctx.stroke()

      // Ручка изменения радиуса справа на ободке
      ctx.fillStyle = '#ff9f0a'
      ctx.beginPath()
      ctx.arc(cx + r, cy, lw * 4.2, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
    } else if (step === 'result' && seg) {
      // Отброшенные комки/горки рисуем жёлтым пунктиром, чтобы пользователь видел, что куча не сломала расчёт
      ctx.save()
      ctx.lineWidth = Math.max(1.5, lw * 0.8)
      ctx.strokeStyle = 'rgba(255, 159, 10, 0.65)'
      ctx.setLineDash([4, 4])
      for (const c of seg.clumps) {
        ctx.beginPath()
        ctx.arc(c.cx, c.cy, Math.max(4, Math.sqrt(c.area / Math.PI)), 0, Math.PI * 2)
        ctx.stroke()
      }
      ctx.restore()

      // Учтённые отдельные крупинки — зелёным
      ctx.lineWidth = Math.max(1.2, lw * 0.6)
      ctx.strokeStyle = '#30d158'
      for (const p of seg.particles) {
        ctx.beginPath()
        ctx.arc(p.cx, p.cy, Math.max(1.5, Math.sqrt(p.area / Math.PI)), 0, Math.PI * 2)
        ctx.stroke()
      }
    }
  }

  useEffect(() => { if (step !== 'setup') { repaint(); draw() } }, [coinCircle, step, seg])

  const onFile = async (f?: File) => {
    if (!f) return
    setErr(''); setBusy(true)
    try {
      const cv = canvas.current!
      await loadToCanvas(f, cv)
      const img = cv.getContext('2d')!.getImageData(0, 0, cv.width, cv.height)
      original.current = img
      // Автоматически находим монету на фото
      setCoinCircle(detectCoinCircle(img))
      setStats(null); setSeg(null); setSaved(false); setOpinion(null); setAiErr('')
      setStep('mark')
    } catch {
      setErr('Не удалось открыть фото. Попробуй снять ещё раз.')
    }
    setBusy(false)
  }

  const canvasCoords = (e: PointerEvent<HTMLCanvasElement>) => {
    const cv = e.currentTarget, rect = cv.getBoundingClientRect()
    return {
      x: ((e.clientX - rect.left) / rect.width) * cv.width,
      y: ((e.clientY - rect.top) / rect.height) * cv.height,
    }
  }

  const onPointerDown = (e: PointerEvent<HTMLCanvasElement>) => {
    if (step !== 'mark' || !coinCircle) return
    e.currentTarget.setPointerCapture(e.pointerId)
    const p = canvasCoords(e)
    const dist = Math.hypot(p.x - coinCircle.cx, p.y - coinCircle.cy)
    // Если нажали близко к ободку — меняем радиус, иначе двигаем центр кольца туда, куда нажали
    if (Math.abs(dist - coinCircle.r) < Math.max(28, coinCircle.r * 0.28)) {
      setDragMode('resize')
    } else {
      setDragMode('move')
      setCoinCircle({ ...coinCircle, cx: p.x, cy: p.y })
    }
  }

  const onPointerMove = (e: PointerEvent<HTMLCanvasElement>) => {
    if (step !== 'mark' || !dragMode || !coinCircle) return
    const cv = e.currentTarget
    const p = canvasCoords(e)
    if (dragMode === 'move') {
      setCoinCircle({
        ...coinCircle,
        cx: Math.max(20, Math.min(cv.width - 20, p.x)),
        cy: Math.max(20, Math.min(cv.height - 20, p.y)),
      })
    } else {
      const newR = Math.max(20, Math.min(Math.min(cv.width, cv.height) * 0.45, Math.hypot(p.x - coinCircle.cx, p.y - coinCircle.cy)))
      setCoinCircle({ ...coinCircle, r: Math.round(newR) })
    }
  }

  const onPointerUp = () => setDragMode(null)

  const measure = () => {
    const cv = canvas.current, img = original.current
    if (!cv || !img || !coinCircle) return
    const coin = COINS.find(c => c.id === coinId)!
    const k = (coinCircle.r * 2) / coin.mm
    if (!(k > 0)) { setErr('Подгони кольцо под монету.'); return }
    setErr(''); setBusy(true)
    setTimeout(() => {
      // Ожидаемый размер в мкм от настройки кофемолки (или целевого уровня)
      const expectedUm = expectedUmForSetting(grinderId, setting ?? undefined, profile.redClix, curve) ?? midUm(size)
      // Максимальная площадь одной реальной крупинки кофе в пикселях (всё, что больше — слипшийся комок/куча)
      const maxSingleUm = Math.max(1150, Math.min(2200, expectedUm * 2.35))
      const maxRadiusPx = ((maxSingleUm / 1000) * k) / 2
      const maxAreaPx = Math.max(25, Math.round(Math.PI * maxRadiusPx * maxRadiusPx))
      const minRadiusPx = ((95 / 1000) * k) / 2
      const minAreaPx = Math.max(4, Math.round(Math.PI * minRadiusPx * minRadiusPx))

      const s = segment(img, {
        exclude: [coinCircle],
        minArea: minAreaPx,
        maxArea: maxAreaPx,
      })
      const st = summarize(s, k, { expectedUm })
      setBusy(false)
      if (!st) {
        setErr('Не нашёл отдельных крупинок. Рассыпь щепотку помола свободнее на белом листе.')
        return
      }
      setSeg(s); setStats(st); setPxPerMm(k); setStep('result')
    }, 30)
  }

  const save = () => {
    if (!stats || !advice || setting === null) return
    const now = Date.now()
    onAddCheck({
      id: uid(), at: now, createdAt: now, updatedAt: now, grinderId, setting, size, taste, logId: log?.id,
      d10: Math.round(stats.d10), d50: Math.round(advice.effectiveD50), d90: Math.round(stats.d90), n: stats.n,
    })
    setSaved(true)
  }

  const askAI = async () => {
    const img = original.current
    if (!img || !stats || !advice || asking) return
    setAsking(true); setAiErr('')
    try {
      const image = imageDataToJpeg(img)
      setOpinion(await askGrindOpinion(loadAIConfig(), image, {
        size, d10: Math.round(stats.d10), d50: Math.round(advice.effectiveD50), d90: Math.round(stats.d90), n: stats.n,
        ...(taste ? { taste } : {}),
      }))
    } catch (e) {
      setAiErr(e instanceof AIError ? e.message : 'Не удалось получить второе мнение. Попробуй ещё раз.')
    }
    setAsking(false)
  }

  const retake = () => { setStep('setup'); setStats(null); setSeg(null); setSaved(false); setCoinCircle(null); setErr(''); setOpinion(null); setAiErr('') }

  const maxRadius = canvas.current ? Math.round(Math.min(canvas.current.width, canvas.current.height) * 0.42) : 300

  return (
    <div>
      <button className="back" onClick={onBack}>← Назад</button>
      <h1>Помощь с помолом</h1>
      {log && <div className="small" style={{ marginTop: 0 }}>Для записи «{log.title}»: настройка и вкус взяты из неё, их можно поправить.</div>}

      {step === 'setup' && (
        <>
          <div className="small">
            Оценка отталкивается от твоей кофемолки и текущей настройки, а по фото проверяет реальные крупинки и отсекает слипшиеся комки.
          </div>

          <div className="card" onClick={onOpenGrinder}>
            <div className="grow">
              <div>🔧 {grinderName ?? 'Выбрать кофемолку'}</div>
              <div className="small" style={{ margin: '4px 0 0' }}>
                {grinderName ? `Шкала ${grinderName} используется как базовый ориентир` : 'Выбери кофемолку, чтобы привязать оценку к её шкале'}
              </div>
            </div>
            <span style={{ color: '#4b8ef1', fontSize: 14 }}>изменить →</span>
          </div>

          <div className="small">Для какого помола проверяем?</div>
          <div className="chips">
            {GRIND_SIZES.map(s => (
              <button key={s} className={'chip' + (size === s ? ' on' : '')} onClick={() => pickSize(s)}>{SIZE_LABEL[s]}</button>
            ))}
          </div>

          <div className="small">Какая настройка сейчас стоит на кофемолке?</div>
          <div className="row">
            <NumField value={setting} onValue={setSetting} decimal label="Настройка кофемолки" placeholder="напр. 5.5" />
            <span className="small" style={{ margin: 0 }}>
              {grinderScale?.unit ?? 'деление / клики'} (подставлено из {grinderName ?? 'рецепта'})
            </span>
          </div>

          <div className="small">Как на вкус прошлая заварка? (необязательно)</div>
          <div className="chips">
            {([['sour', 'Кисло'], ['bitter', 'Горько'], ['ok', 'Нормально']] as const).map(([t, l]) => (
              <button key={t} className={'chip' + (taste === t ? ' on' : '')} onClick={() => setTaste(taste === t ? undefined : t)}>{l}</button>
            ))}
          </div>

          <div className="card" style={{ marginTop: 16 }}>
            <b>Как снять для максимальной точности</b>
            <ol className="small" style={{ margin: '6px 0 0', paddingLeft: 18 }}>
              <li>Не насыпай горку: возьми одну щепотку и разровняй пальцем по белой бумаге, чтобы крупинки лежали раздельно.</li>
              <li>Рядом положи монету и сними строго сверху без резкой тени от телефона.</li>
            </ol>
          </div>

          <input ref={fileRef} type="file" accept="image/*" hidden
            onChange={e => { onFile(e.target.files?.[0]); e.target.value = '' }} />
          <button className="btn" style={{ marginTop: 12 }} disabled={busy} onClick={() => fileRef.current?.click()}>
            📷 Сфоткать помол
          </button>
          {err && <div className="small" style={{ color: '#ff6961' }}>{err}</div>}
          {mine.length > 0 && (
            <>
              <div className="small">
                Замеров по этой кофемолке: {mine.length}. {curve
                  ? 'Шкала кофемолки уже выучена — совет будет точным.'
                  : 'Нужны замеры на двух разных настройках, чтобы выучить шкалу.'}
              </div>
              <div className="card" style={{ display: 'block', cursor: 'default' }}>
                {[...mine].sort((a, b) => b.at - a.at).slice(0, 6).map(c => (
                  <div key={c.id} className="row" style={{ marginBottom: 4 }}>
                    <div className="grow">
                      <div>настройка {c.setting} · ≈ {c.d50} мкм</div>
                      <div className="meta">{new Date(c.at).toLocaleDateString('ru-RU')} · {SIZE_LABEL[c.size]}</div>
                    </div>
                    <button className="x" aria-label={`Удалить замер: настройка ${c.setting}`}
                      onClick={() => { if (window.confirm('Удалить этот замер?')) onDeleteCheck(c.id) }}>×</button>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}

      <canvas
        ref={canvas}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        style={{ width: '100%', borderRadius: 12, display: step === 'setup' ? 'none' : 'block', touchAction: 'none', marginTop: 8 }}
      />

      {step === 'mark' && coinCircle && (
        <>
          <div className="small">
            Перетащи оранжевое кольцо на монету и подгони его размер ползунком:
          </div>
          <div className="row" style={{ marginTop: 6 }}>
            <label>Размер кольца</label>
            <input
              type="range"
              min={20}
              max={maxRadius}
              value={Math.round(coinCircle.r)}
              onChange={e => setCoinCircle({ ...coinCircle, r: Number(e.target.value) })}
              style={{ flex: 1, padding: 0 }}
            />
          </div>
          <div className="chips">
            {COINS.map(c => (
              <button key={c.id} className={'chip' + (coinId === c.id ? ' on' : '')} onClick={() => setCoinId(c.id)}>{c.label}</button>
            ))}
          </div>
          {err && <div className="small" style={{ color: '#ff6961' }}>{err}</div>}
          <button className="btn" style={{ marginTop: 12 }} disabled={busy} onClick={measure}>
            {busy ? 'Считаю…' : 'Измерить помол'}
          </button>
          <button className="btn secondary" style={{ marginTop: 8 }} onClick={retake}>Переснять</button>
        </>
      )}

      {step === 'result' && stats && advice && (
        <>
          <div className="card" style={{ marginTop: 12, display: 'block', cursor: 'default' }}>
            <div style={{ fontSize: 18, fontWeight: 600 }}>
              {VERDICT_TEXT[advice.verdict]}{advice.offPct > 0 ? ` (на ~${advice.offPct}%)` : ''}
            </div>
            {advice.suggested !== undefined && (
              <div style={{ marginTop: 6, fontSize: 16 }}>
                Поставь ≈ <b>{advice.suggested} {grinderScale?.unit ?? ''}</b>
                {setting !== null && <span className="small"> (сейчас {setting})</span>}
              </div>
            )}
            <div className="small" style={{ margin: '8px 0 0' }}>
              Оценка помола ≈ <b>{Math.round(advice.effectiveD50)} мкм</b> (цель для «{SIZE_LABEL[size]}»: {advice.target[0]}–{advice.target[1]} мкм).
              {advice.expectedD50 !== undefined && (
                <> Ожидание для настройки {setting}: ≈ {Math.round(advice.expectedD50)} мкм.</>
              )}
              {' '}Отдельных крупинок учтено: {stats.n}
              {seg && seg.clumps.length > 0 ? ` (слипшихся комков отброшено: ${seg.clumps.length})` : ''}.
            </div>
          </div>
          {advice.notes.map((n, i) => <div key={i} className="small">• {n}</div>)}
          <div className="small">
            🟢 Зелёные кружки — отдельные крупинки кофе. 🟠 Жёлтый пунктир — слипшиеся комки/горка (исключены из расчёта).
          </div>
          <div className="card" style={{ display: 'block', cursor: 'default', marginTop: 12 }}>
            <b>Второе мнение ИИ</b> <span className="small" style={{ margin: 0 }}>необязательно</span>
            {!opinion && (
              <>
                <div className="small" style={{ margin: '6px 0' }}>
                  ИИ посмотрит снимок на мелкую пыль, комки и неравномерность.
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
                  <div className="small" style={{ margin: '6px 0 0' }}>ИИ и замер расходятся.</div>
                )}
              </div>
            )}
          </div>
          {/* Режим калибровки по лабораторным ситам (для разработчика / дома) */}
          <div className="card" style={{ display: 'block', background: '#1c1c22', border: '1px solid #2c2c36', marginTop: 10 }}>
            <div className="small" style={{ color: '#4b8ef1', margin: '0 0 6px' }}>🔬 Калибровка по ситам (дом):</div>
            <div className="small" style={{ margin: '0 0 8px' }}>Если это просеянная фракция, зафиксируй эталонный размер одной кнопкой:</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <button type="button" className="chip" style={{ fontSize: 12 }} onClick={() => {
                if (!stats || setting === null) return
                // 600–900 мкм -> истинный D50 = sqrt(600*900) = 735 мкм
                onAddCheck({
                  id: uid(), at: Date.now(), createdAt: Date.now(), updatedAt: Date.now(),
                  grinderId, setting, size, taste, logId: log?.id,
                  d10: Math.round(stats.d10), d50: 735, d90: Math.round(stats.d90), n: stats.n,
                })
                setSaved(true)
              }}>
                Ситы 600–900 (735 мкм)
              </button>
              <button type="button" className="chip" style={{ fontSize: 12 }} onClick={() => {
                if (!stats || setting === null) return
                // 900–1400 мкм -> истинный D50 = sqrt(900*1400) = 1122 мкм
                onAddCheck({
                  id: uid(), at: Date.now(), createdAt: Date.now(), updatedAt: Date.now(),
                  grinderId, setting, size, taste, logId: log?.id,
                  d10: Math.round(stats.d10), d50: 1122, d90: Math.round(stats.d90), n: stats.n,
                })
                setSaved(true)
              }}>
                Ситы 900–1400 (1122 мкм)
              </button>
            </div>
          </div>

          <button className="btn" style={{ marginTop: 8 }} disabled={setting === null || saved} onClick={save}>
            {saved ? 'Замер сохранён' : 'Сохранить замер'}
          </button>
          <button className="btn secondary" style={{ marginTop: 8 }} onClick={retake}>Переснять</button>
          <div className="small">Масштаб: {pxPerMm.toFixed(1)} пикс/мм.</div>
        </>
      )}
    </div>
  )
}
