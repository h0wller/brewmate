import { saveBeans, saveDeleted, saveLogs, saveRecipes, saveSessions } from '../storage'
import { saveChecks, savePhotoProfiles } from '../grind/store'
import { saveDialInProfiles } from '../beans/dialInProfile'
import { saveProfile } from '../grinders/profile'
import { runStorageWrites } from '../storageError'
import type { AppData } from './merge'
import type { GrinderProfile } from '../types'

/* Локальная запись синхронизированных или импортированных данных.
   Не атомарно: при сбое часть ключей уже записана, поэтому при непустом списке
   вызывающий не сообщает об успехе и не применяет данные в интерфейсе. */
export function applyLocalData(d: AppData, restored?: GrinderProfile): string[] {
  return runStorageWrites([
    { key: 'рецепты', write: () => saveRecipes(d.recipes) },
    { key: 'каппинги', write: () => saveSessions(d.sessions) },
    { key: 'зерно', write: () => saveBeans(d.beans) },
    { key: 'журнал', write: () => saveLogs(d.logs) },
    { key: 'замеры помола', write: () => saveChecks(d.grindChecks) },
    { key: 'метки удалений', write: () => saveDeleted(d.deleted) },
    { key: 'dial-in профили', write: () => saveDialInProfiles(d.dialInProfiles) },
    { key: 'фото-профили', write: () => savePhotoProfiles(d.photoProfiles) },
    ...(restored ? [{ key: 'профиль кофемолки', write: () => saveProfile(restored) }] : []),
  ])
}
