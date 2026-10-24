import type { ScaleDriver } from './driver'
import { fdCmd, parseFutula, unitCmd } from './futula'

/* FUTULA / LFSmart Scale (протокол — по реверсу родного приложения, см. futula.ts) */
export const futulaDriver: ScaleDriver = {
  id: 'futula',
  label: 'FUTULA / LFSmart',
  parse: (shortUuid, bytes) => (shortUuid === 'fff4' ? parseFutula(bytes) : null),
  handshake: () => [0x06, 0x0f, 0x00, 0x00],
  tare: () => fdCmd(0x32),
  setUnit: unit => unitCmd(unit === 'ml' ? 0x07 : 0x04),
}

/* Реестр. Первый драйвер — запасной, если ни один не опознал устройство по имени. */
export const DRIVERS: ScaleDriver[] = [futulaDriver]

export const pickDriver = (deviceName: string): ScaleDriver =>
  DRIVERS.find(d => d.match?.(deviceName)) ?? DRIVERS[0]
