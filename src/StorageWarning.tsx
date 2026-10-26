import { useEffect, useState } from 'react'
import type { GrinderProfile } from './types'
import type { AppData } from './sync/merge'
import { backupFileName, makeBackup } from './backup'
import { downloadText } from './download'
import { subscribeStorageError } from './storageError'

/* Если браузер не даёт записать данные на устройство, пользователь должен узнать об этом сразу,
   а не потерять записи после перезагрузки. Плашка предлагает скачать копию и закрывается. */
export function StorageWarning({ backup, profile }: { backup: () => AppData; profile: GrinderProfile }) {
  const [failed, setFailed] = useState(false)
  const [hidden, setHidden] = useState(false)

  useEffect(() => subscribeStorageError(() => setFailed(true)), [])

  if (!failed || hidden) return null
  const save = () => {
    const b = makeBackup(backup(), profile)
    downloadText(backupFileName(b.exportedAt), JSON.stringify(b, null, 2))
  }
  return (
    <div className="storageWarn" role="alert">
      <div>
        Не удалось сохранить данные на этом устройстве: возможно, память браузера заполнена или запись запрещена.
        Последние изменения могут пропасть после перезагрузки.
      </div>
      <div className="storageWarnBtns">
        <button className="btn" onClick={save}>Скачать копию данных</button>
        <button className="btn secondary" onClick={() => setHidden(true)}>Закрыть</button>
      </div>
    </div>
  )
}
