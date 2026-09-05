export const btSupported = () => typeof (navigator as any).bluetooth !== 'undefined'

type Handler = (charUuid: string, bytes: Uint8Array) => void

export async function connectScale(onData: Handler): Promise<{ name: string; disconnect: () => void }> {
  const nav = navigator as any
  if (!nav.bluetooth) {
    throw new Error('Web Bluetooth недоступен: на iOS Safari не поддерживается. Тест нужен на Android/Chrome.')
  }
  const device = await nav.bluetooth.requestDevice({
    acceptAllDevices: true,
    optionalServices: ['fff0', 'ffe0', 'ffe5', '180f', '180a'],
  })
  const server = await device.gatt!.connect()
  const services = await server.getPrimaryServices()
  for (const s of services) {
    let chars: any[] = []
    try { chars = await s.getCharacteristics() } catch { continue }
    for (const c of chars) {
      if (c.properties.notify || c.properties.indicate) {
        try {
          await c.startNotifications()
          c.addEventListener('characteristicvaluechanged', (e: any) => {
            const v = e.target.value as DataView
            onData(c.uuid, new Uint8Array(v.buffer, v.byteOffset, v.byteLength))
          })
        } catch { /* некоторые характеристики не дают notify — ок */ }
      }
    }
  }
  return {
    name: device.name || 'scale',
    disconnect: () => { try { device.gatt?.disconnect() } catch {} },
  }
}

export const hex = (b: Uint8Array) =>
  Array.from(b).map(x => x.toString(16).padStart(2, '0')).join(' ')