import { createHash } from 'node:crypto'

const stores = ['domain', 'bench', 'media', 'relations']
const clone = value => structuredClone(value)
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex')

export function inventory(state) {
  return Object.fromEntries(stores.map(name => [name, hash(state[name])]))
}

export function createLab(initial) {
  return {
    state: clone(initial),
    journal: null,
    staging: null,
    safety: null,
    appVersion: 1,
    lock: false,
  }
}

function failAt(actual, requested) {
  if (actual === requested) throw new Error(`injected:${actual}`)
}

export function restore(lab, target, { failAt: failure, journalQuota = false, concurrentEdit = false, appVersion = lab.appVersion } = {}) {
  if (lab.lock) throw new Error('restore already active')
  lab.lock = true
  try {
    if (!lab.staging) lab.staging = clone(target)
    if (journalQuota) throw new Error('QuotaExceededError:journal')
    lab.safety = clone(lab.state)
    lab.journal = { version: appVersion, state: 'applying', targetHash: hash(lab.staging), completed: [] }
    failAt('journal-created', failure)
    if (concurrentEdit) throw new Error('concurrent modification detected before apply')
    for (const store of stores) {
      lab.state[store] = clone(lab.staging[store])
      failAt(`${store}-written`, failure)
      if (failure === `${store}-checkpoint`) throw new Error(`injected:${store}-checkpoint`)
      lab.journal.completed.push(store)
    }
    failAt('verification', failure)
    if (hash(lab.state) !== lab.journal.targetHash) throw new Error('target integrity mismatch')
    lab.journal.state = 'completed'
    return 'completed'
  } catch (error) {
    return `interrupted:${error.message}`
  } finally {
    lab.lock = false
  }
}

export function recover(lab, { journalCorrupt = false, journalMissing = false, appVersion = lab.appVersion, stagingCorrupt = false } = {}) {
  if (!lab.safety) return 'no-operation'
  if (journalMissing || journalCorrupt || !lab.journal) {
    lab.state = clone(lab.safety)
    lab.journal = { state: 'rolled-back', reason: journalMissing ? 'missing' : 'corrupt' }
    return 'rolled-back'
  }
  if (lab.journal.version !== appVersion) {
    lab.state = clone(lab.safety)
    lab.journal.state = 'rolled-back'
    lab.journal.reason = 'unsupported-session-version'
    return 'rolled-back'
  }
  if (stagingCorrupt || hash(lab.staging) !== lab.journal.targetHash) {
    lab.state = clone(lab.safety)
    lab.journal.state = 'rolled-back'
    lab.journal.reason = 'invalid-staging'
    return 'rolled-back'
  }
  for (const store of stores) lab.state[store] = clone(lab.staging[store])
  if (hash(lab.state) !== lab.journal.targetHash) throw new Error('recovery verification failed')
  lab.journal.state = 'completed'
  return 'rolled-forward'
}
