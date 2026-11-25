import test from 'node:test'
import assert from 'node:assert/strict'
import { createLab, inventory, recover, restore } from './t1.mjs'

const before = { domain: { recipe: 'old' }, bench: { sample: 'old' }, media: { photo: 'old' }, relations: { link: 'old' } }
const after = { domain: { recipe: 'new' }, bench: { sample: 'new' }, media: { photo: 'new' }, relations: { link: 'new' } }
const pre = inventory(before), post = inventory(after)

test('recoveries after each store write/checkpoint failure are wholly pre or post', () => {
  for (const failure of ['journal-created', 'domain-written', 'domain-checkpoint', 'bench-written', 'bench-checkpoint', 'media-written', 'media-checkpoint', 'relations-written', 'relations-checkpoint', 'verification']) {
    const lab = createLab(before)
    restore(lab, after, { failAt: failure })
    const recovered = recover(lab)
    assert.ok(['rolled-back', 'rolled-forward'].includes(recovered), failure)
    const final = inventory(lab.state)
    assert.ok(JSON.stringify(final) === JSON.stringify(pre) || JSON.stringify(final) === JSON.stringify(post), failure)
    assert.equal(lab.journal.state === 'completed', JSON.stringify(final) === JSON.stringify(post), `completion marker mismatch at ${failure}`)
  }
})

test('safe roll-forward after a valid interrupted write and detects missing/corrupt journal', () => {
  for (const options of [{}, { journalMissing: true }, { journalCorrupt: true }]) {
    const lab = createLab(before)
    restore(lab, after, { failAt: 'bench-written' })
    assert.notEqual(recover(lab, options), 'completed')
    const final = inventory(lab.state)
    assert.ok(JSON.stringify(final) === JSON.stringify(pre) || JSON.stringify(final) === JSON.stringify(post))
  }
})

test('quota before safety snapshot and concurrent edit do not mutate active state', () => {
  for (const options of [{ journalQuota: true }, { concurrentEdit: true }]) {
    const lab = createLab(before)
    restore(lab, after, options)
    assert.deepEqual(inventory(lab.state), pre)
    assert.notEqual(lab.journal?.state, 'completed')
  }
})

test('app upgrade and corrupt staging roll back to safety snapshot', () => {
  for (const recoveryOptions of [{ appVersion: 2 }, { stagingCorrupt: true }]) {
    const lab = createLab(before)
    restore(lab, after, { failAt: 'bench-written' })
    assert.equal(recover(lab, recoveryOptions), 'rolled-back')
    assert.deepEqual(inventory(lab.state), pre)
    assert.notEqual(lab.journal.state, 'completed')
  }
})

test('second concurrent restore is rejected while lock is held', () => {
  const lab = createLab(before)
  lab.lock = true
  assert.throws(() => restore(lab, after), /already active/)
  lab.lock = false
})
