import test from 'node:test'
import assert from 'node:assert/strict'
import { bundleDigest, canonicalJson, conflictFingerprint, ingestConflict, normalizeArchivePath, normalizeInstant, resolveConflict, sha256, snapshotHash, validateArchiveEntries, verifyBundle } from './t0.mjs'
import fixtures from './t0.golden.json' with { type: 'json' }

test('golden canonical bytes and SHA-256 fixtures', () => {
  for (const fixture of fixtures.canonical) {
    const bytes = canonicalJson(fixture.value)
    assert.equal(bytes, fixture.canonical)
    assert.equal(sha256(Buffer.from(bytes)), fixture.sha256)
  }
})

test('instant values normalize to UTC millisecond precision and invalid values reject', () => {
  assert.equal(normalizeInstant('2026-11-24T12:30:00.12+02:30'), '2026-11-24T10:00:00.120Z')
  assert.equal(normalizeInstant('2024-02-29T23:59:59.999Z'), '2024-02-29T23:59:59.999Z')
  for (const invalid of ['2023-02-29T00:00:00Z', '2024-01-01T00:00:00.1234Z', '2024-01-01T00:00:00', 'not-a-date']) {
    assert.throws(() => normalizeInstant(invalid))
  }
})

test('value and tombstone snapshots have stable distinct hashes', () => {
  const input = { schemaVersion: 1, entityType: 'bean', entityId: 'b1', snapshot: { name: 'Эфиопия' } }
  const value = snapshotHash({ ...input, kind: 'value' })
  const tombstone = snapshotHash({ ...input, kind: 'tombstone' })
  assert.equal(value, fixtures.snapshot.value)
  assert.equal(tombstone, fixtures.snapshot.tombstone)
  assert.notEqual(value, tombstone)
})

test('conflict fingerprint is order independent and deduplicates variants', () => {
  const a = conflictFingerprint({ entityType: 'bean', entityId: 'b1', variantHashes: ['b', 'a', 'a'] })
  assert.equal(a, conflictFingerprint({ entityType: 'bean', entityId: 'b1', variantHashes: ['a', 'b'] }))
})

test('resolved conflict redelivery stays resolved; new conflict links and resolves separately', () => {
  const firstVariants = [{ hash: 'v1', snapshot: { name: 'A' } }, { hash: 'v2', kind: 'tombstone', snapshot: null }]
  let records = []
  const first = ingestConflict(records, { entityType: 'bean', entityId: 'b1', baseSnapshotHash: 'base', variants: firstVariants })
  records = first.records
  records = resolveConflict(records, first.record.fingerprint, 'v1', '2026-11-24T12:00:00.000Z')
  const resolvedSnapshot = JSON.stringify(records[0].variants)
  const redelivery = ingestConflict(records, { entityType: 'bean', entityId: 'b1', baseSnapshotHash: 'base', variants: [...firstVariants].reverse() })
  assert.equal(redelivery.created, false)
  assert.equal(redelivery.record.state, 'resolved')
  assert.equal(JSON.stringify(redelivery.record.variants), resolvedSnapshot)

  const second = ingestConflict(records, { entityType: 'bean', entityId: 'b1', baseSnapshotHash: 'v1', variants: [{ hash: 'v3', snapshot: { name: 'B' } }, { hash: 'v4', snapshot: { name: 'C' } }] })
  assert.equal(second.created, true)
  assert.equal(second.record.previousFingerprint, first.record.fingerprint)
  records = second.records
  records = resolveConflict(records, second.record.fingerprint, 'v4', '2026-11-24T12:01:00.000Z')
  assert.deepEqual(records.map(record => record.state), ['resolved', 'resolved'])
  assert.equal(JSON.stringify(records[0].variants), resolvedSnapshot)
})

test('archive path policy rejects traversal, absolute paths, collisions and links', () => {
  for (const path of ['../escape', 'a/../escape', '/root/file', 'C:/file', '\\\\host\\share', 'a\\\\b', './x', 'a//b']) {
    assert.throws(() => normalizeArchivePath(path), path)
  }
  assert.throws(() => validateArchiveEntries([{ path: 'a/./b' }, { path: 'a/b' }]))
  assert.throws(() => validateArchiveEntries([{ path: 'a/b' }, { path: 'a/b' }]))
  assert.throws(() => validateArchiveEntries([{ path: 'a/b' }, { path: 'A/B' }]))
  assert.throws(() => validateArchiveEntries([{ path: 'media/é.png' }, { path: 'media/e\u0301.png' }]))
  assert.throws(() => validateArchiveEntries([{ path: 'link', type: 'symlink' }]))
  assert.throws(() => validateArchiveEntries([{ path: 'link', type: 'hardlink' }]))
  assert.deepEqual(validateArchiveEntries([{ path: 'z' }, { path: 'a' }]), ['a', 'z'])
})

test('bundle digest is path-order independent and rejects corrupted entries before apply', () => {
  const manifest = { format: 'brewmate-lab', schemaVersion: 1, records: 1 }
  const entries = [
    { path: 'data/records.json', type: 'file', bytes: Buffer.from('{"id":"x"}'), declaredSize: 10 },
    { path: 'media/a.bin', type: 'file', bytes: Buffer.from([1, 2, 3]), declaredSize: 3 },
  ]
  const digest = bundleDigest(manifest, entries)
  assert.equal(digest, fixtures.bundle)
  assert.equal(bundleDigest(manifest, [...entries].reverse()), digest)
  assert.equal(verifyBundle(manifest, entries, digest), true)
  assert.equal(verifyBundle(manifest, [{ ...entries[0], bytes: Buffer.from('{"id":"y"}') }, entries[1]], digest), false)
  assert.equal(verifyBundle({ ...manifest, records: 2 }, entries, digest), false)
  assert.throws(() => verifyBundle(manifest, [{ ...entries[0], declaredSize: 1 }, entries[1]], digest), /size mismatch/)
  assert.throws(() => verifyBundle(manifest, [{ ...entries[0], sha256: 'bad' }, entries[1]], digest), /hash mismatch/)
})
