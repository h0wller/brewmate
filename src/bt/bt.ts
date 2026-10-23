export const btSupported = () => typeof (navigator as any).bluetooth !== 'undefined'

type DataHandler = (charUuid: string, bytes: Uint8Array) => void
type InfoHandler = (line: string) => void
type ConnectHandler = (deviceName: string) => void

export interface ScaleHandle {
  name: string
  write: (bytes: Uint8Array) => Promise<void>
  disconnect: () => void
}

export async function connectScale(
  onData: DataHandler,
  onInfo: InfoHandler,
  onConnect: ConnectHandler,
): Promise<ScaleHandle> {
  const nav = navigator as any
  if (!nav.bluetooth) {
    throw new Error('Web Bluetooth недоступен (iOS). Нужен Android/Chrome.')
  }
  const device = await nav.bluetooth.requestDevice({
    acceptAllDevices: true,
    optionalServices: [0xfff0, 0xffe0, 0xffe5, 0x180f, 0x180a],
  })
  onInfo(`device: ${device.name || '(без имени)'}`)

  let writeChar: any = null
  let manual = false

  const setup = async () => {
    await device.gatt!.connect()
    const services = await device.gatt!.getPrimaryServices()
    writeChar = null
    for (const s of services) {
      let chars: any[] = []
      try { chars = await s.getCharacteristics() } catch { continue }
      for (const c of chars) {
        const p = c.properties
        if (p.write || p.writeWithoutResponse) writeChar = c
        if (p.notify || p.indicate) {
          try {
            await c.startNotifications()
            c.addEventListener('characteristicvaluechanged', (e: any) => {
              const v = e.target.value as DataView
              onData(c.uuid, new Uint8Array(v.buffer, v.byteOffset, v.byteLength))
            })
          } catch { /* ок */ }
        }
      }
    }
  }

  /* весы тарируются перезагрузкой и рвут связь — возвращаемся сами */
  device.addEventListener('gattserverdisconnected', () => {
    if (manual) return
    onInfo('⚠️ весы перезагрузились — переподключаюсь…')
    setTimeout(async () => {
      try {
        await setup()
        onInfo('✔ переподключено')
        onConnect(device.name || '')
      } catch { onInfo('✖ переподключение не удалось') }
    }, 2000)
  })

  await setup()
  onConnect(device.name || '')

  return {
    name: device.name || 'scale',
    write: async (bytes: Uint8Array) => {
      if (!writeChar) throw new Error('нет write-характеристики')
      try { await writeChar.writeValueWithResponse(bytes) }
      catch { await writeChar.writeValueWithoutResponse(bytes) }
    },
    disconnect: () => { manual = true; try { device.gatt?.disconnect() } catch {} },
  }
}

export const hex = (b: Uint8Array) =>
  Array.from(b).map(x => x.toString(16).padStart(2, '0')).join(' ')