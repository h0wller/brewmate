import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Recipe, WeightSample } from './types'
import { downsample, flowRateAt, recordSample } from './brewlog/curve'

export const fmt = (s: number) =>
  `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`

let audio: AudioContext | null = null
export function beep(times = 1) {
  const AC = window.AudioContext || (window as any).webkitAudioContext
  if (!AC) return
  audio ??= new AC()
  if (audio.state === 'suspended') audio.resume()
  for (let i = 0; i < times; i++) {
    const t = audio.currentTime + i * 0.3
    const o = audio.createOscillator()
    const g = audio.createGain()
    o.type = 'sine'; o.frequency.value = 880
    o.connect(g); g.connect(audio.destination)
    g.gain.setValueAtTime(0.001, t)
    g.gain.exponentialRampToValueAtTime(0.4, t + 0.02)
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.25)
    o.start(t); o.stop(t + 0.3)
  }
}

export function useBrewTimer(recipe: Recipe) {
  const [status, setStatus] = useState<'idle' | 'run' | 'pause' | 'done'>('idle')
  const [elapsed, setElapsed] = useState(0)
  const [liveG, setLiveGState] = useState<number | null>(null)
  const [flow, setFlow] = useState<number | null>(null) // скорость вливания, г/с
  /* актуальный вес для таймера: интервал читает его из ref, а не из замыкания */
  const liveRef = useRef<number | null>(null)
  const samples = useRef<WeightSample[]>([])
  const setLiveG = useCallback((g: number | null) => {
    liveRef.current = g
    setLiveGState(g)
  }, [])
  const base = useRef(0)
  const startAt = useRef(0)
  const wake = useRef<any>(null)
  const prevStep = useRef(-1)

  const total = recipe.steps.reduce((s, x) => s + x.duration, 0)

  const bounds = useMemo(
    () => recipe.steps.reduce<number[]>((acc, st) => [...acc, (acc.at(-1) ?? 0) + st.duration], []),
    [recipe],
  )

  const idx = bounds.findIndex(b => elapsed < b)
  const stepIndex = idx === -1 ? bounds.length - 1 : idx

  useEffect(() => {
    if (status !== 'run') return
    const id = setInterval(() => {
      const e = base.current + (Date.now() - startAt.current) / 1000
      if (liveRef.current !== null) {
        recordSample(samples.current, Math.min(e, total), liveRef.current)
        setFlow(flowRateAt(samples.current, Math.min(e, total)))
      } else {
        setFlow(null)
      }
      if (e >= total) {
        setElapsed(total)
        setStatus('done')
        beep(3)
        wake.current?.release?.()
      } else {
        setElapsed(e)
      }
    }, 200)
    return () => clearInterval(id)
  }, [status, total])

  useEffect(() => {
    if (stepIndex !== prevStep.current) {
      if (prevStep.current >= 0 && status === 'run') beep(2)
      prevStep.current = stepIndex
    }
  }, [stepIndex, status])

  const start = async () => {
    base.current = 0
    samples.current = []
    setElapsed(0)
    prevStep.current = -1
    startAt.current = Date.now()
    setStatus('run')
    beep(1)
    try {
      wake.current = await (navigator as any).wakeLock?.request('screen')
    } catch {}
  }

  const pause = () => {
    base.current = elapsed
    setStatus('pause')
  }

  const resume = () => {
    startAt.current = Date.now()
    setStatus('run')
  }

  const reset = () => {
    base.current = 0
    samples.current = []
    setElapsed(0)
    setStatus('idle')
    wake.current?.release?.()
  }

  return {
    status, elapsed, total, stepIndex,
    liveG, setLiveG, flow,
    /* кривая веса за текущий пролив (пусто, если весов не было) */
    getCurve: () => downsample(samples.current),
    start, pause, resume, reset,
  }
}