export const btSupported = () => typeof (navigator as any).bluetooth !== 'undefined'

type DataHandler = (charUuid: string, bytes: Uint8Array) => void
type InfoHandler = (line: string) => void

export interface ScaleHandle {
  name: string
  tare: () => void
  disconnect: () => void
  writeChar?: any
}

export async function connectScale(
  onData: DataHandler,
  onInfo: InfoHandler,
): Promise<ScaleHandle> {
  const nav = navigator as any
  if (!nav.bluetooth) {
    throw new Error('Web Bluetooth недоступен на этом устройстве (iOS). Нужен Android/Chrome.')
  }
  const device = await nav.bluetooth.requestDevice({
    acceptAllDevices: true,
    optionalServices: [0xfff0, 0xffe0, 0xffe5, 0x180f, 0x180a],
  })
  onInfo(`device: ${device.name || '(без имени)'}`)

  const server = await device.gatt!.connect()
  const services = await server.getPrimaryServices()
  let writeChar: any = null
  for (const s of services) {
    onInfo(`service ${s.uuid}`)
    let chars: any[] = []
    try { chars = await s.getCharacteristics() } catch { continue }
    for (const c of chars) {
      const p = c.properties
      const flags = [p.read && 'read', p.write && 'write', p.notify && 'notify', p.indicate && 'indicate']
        .filter(Boolean).join('+')
      onInfo(`  char ${c.uuid} [${flags}]`)
      if (p.write || p.writeWithoutResponse) writeChar = c
      if (p.notify || p.indicate) {
        try {
          await c.startNotifications()
          onInfo(`  ✔ подписан: ${c.uuid}`)
          c.addEventListener('characteristicvaluechanged', (e: any) => {
            const v = e.target.value as DataView
            onData(c.uuid, new Uint8Array(v.buffer, v.byteOffset, v.byteLength))
          })
        } catch { onInfo(`  ✖ notify не удался: ${c.uuid}`) }
      }
    }
  }
  return {
    name: device.name || 'scale',
    tare: () => {}, // теперь таром рулит ScaleChip через offset,
    disconnect: () => { try { device.gatt?.disconnect() } catch {} },
    writeChar,
  }
}

export const hex = (b: Uint8Array) =>
  Array.from(b).map(x => x.toString(16).padStart(2, '0')).join(' ')