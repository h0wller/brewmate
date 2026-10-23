/* Интерфейс драйвера BLE-весов. Новая модель весов = новый файл-драйвер
   и запись в реестре (drivers.ts); UI (ScaleChip) про протоколы ничего не знает. */

export interface ScaleReading {
  rawG: number     // вес в текущих единицах весов (до тары на сайте)
  stable: boolean
  unit: string     // 'г' | 'мл' | 'oz' | 'lb' | …
}

export interface ScaleDriver {
  id: string
  label: string
  /** подходит ли драйвер устройству с таким именем (если драйверов несколько) */
  match?: (deviceName: string) => boolean
  /** разбор данных GATT-характеристики; shortUuid — 4 hex-символа, напр. 'fff4' */
  parse: (shortUuid: string, bytes: Uint8Array) => ScaleReading | null
  /** команда, которую нужно отправить после подключения */
  handshake?: () => number[]
  /** аппаратная тара; нет поля — весы не поддерживают */
  tare?: () => number[]
  /** переключение единиц; нет поля — не поддерживается */
  setUnit?: (unit: 'g' | 'ml') => number[]
}
