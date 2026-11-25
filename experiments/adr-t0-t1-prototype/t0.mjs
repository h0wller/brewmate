import { createHash } from 'node:crypto'

const textEncoder = new TextEncoder()

function assertJsonValue(value, path = '$') {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') {
    if (typeof value === 'string' && /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(value)) {
      throw new TypeError(`Lone surrogate at ${path}`)
    }
    return
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError(`Non-finite number at ${path}`)
    return
  }
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      if (!(i in value)) throw new TypeError(`Sparse array at ${path}[${i}]`)
      assertJsonValue(value[i], `${path}[${i}]`)
    }
    return
  }
  if (typeof value !== 'object' || Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) {
    throw new TypeError(`Non-JSON value at ${path}`)
  }
  for (const key of Object.keys(value)) {
    assertJsonValue(key, `${path} key`)
    assertJsonValue(value[key], `${path}.${key}`)
  }
}

// Prototype of RFC 8785: ECMAScript number/string rendering, UTF-16 property ordering.
export function canonicalJson(value) {
  assertJsonValue(value)
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`
}

export function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex')
}

export function normalizeInstant(value) {
  if (typeof value !== 'string') throw new TypeError('Instant must be an RFC 3339 string')
  const match = /^(\d{4})-(\d\d)-(\d\d)T(\d\d):(\d\d):(\d\d)(?:\.(\d{1,3}))?(Z|[+-]\d\d:\d\d)$/.exec(value)
  if (!match) throw new TypeError('Instant must have at most millisecond precision and an explicit offset')
  const [, y, mo, d, h, mi, s, fraction = '', zone] = match
  const year = Number(y), month = Number(mo), day = Number(d)
  if (month < 1 || month > 12 || day < 1 || day > 31 || Number(h) > 23 || Number(mi) > 59 || Number(s) > 59) throw new TypeError('Invalid instant')
  const milliseconds = Number(fraction.padEnd(3, '0'))
  const local = Date.UTC(year, month - 1, day, Number(h), Number(mi), Number(s), milliseconds)
  const check = new Date(local)
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) throw new TypeError('Invalid calendar date')
  let offset = 0
  if (zone !== 'Z') {
    const sign = zone[0] === '+' ? 1 : -1
    const oh = Number(zone.slice(1, 3)), om = Number(zone.slice(4, 6))
    if (oh > 23 || om > 59) throw new TypeError('Invalid UTC offset')
    offset = sign * (oh * 60 + om) * 60_000
  }
  return new Date(local - offset).toISOString()
}

export function snapshotHash({ schemaVersion, entityType, entityId, kind, snapshot }) {
  if (!['value', 'tombstone'].includes(kind)) throw new TypeError('Invalid snapshot kind')
  return sha256(textEncoder.encode(canonicalJson({
    canonicalizationVersion: 'brewmate-jcs-v1',
    schemaVersion,
    entityType,
    entityId,
    kind,
    snapshot,
  })))
}

export function conflictFingerprint({ entityType, entityId, baseSnapshotHash = null, variantHashes }) {
  const sorted = [...new Set(variantHashes)].sort()
  return sha256(textEncoder.encode(canonicalJson({ entityType, entityId, baseSnapshotHash, variantHashes: sorted })))
}

export function ingestConflict(records, { entityType, entityId, baseSnapshotHash = null, variants }) {
  const variantHashes = variants.map(variant => variant.hash)
  const fingerprint = conflictFingerprint({ entityType, entityId, baseSnapshotHash, variantHashes })
  const existing = records.find(record => record.fingerprint === fingerprint)
  if (existing) return { records, record: existing, created: false }
  const previous = records.filter(record => record.entityType === entityType && record.entityId === entityId).at(-1)
  const record = {
    fingerprint,
    entityType,
    entityId,
    baseSnapshotHash,
    state: 'unresolved',
    variants: structuredClone(variants),
    previousFingerprint: previous?.fingerprint ?? null,
    resolution: null,
  }
  return { records: [...records, record], record, created: true }
}

export function resolveConflict(records, fingerprint, selectedVariantHash, resolvedAt) {
  return records.map(record => {
    if (record.fingerprint !== fingerprint || record.state !== 'unresolved') return record
    if (!record.variants.some(variant => variant.hash === selectedVariantHash)) throw new TypeError('Unknown conflict variant')
    return {
      ...record,
      state: 'resolved',
      resolution: { selectedVariantHash, resultRevisionHash: selectedVariantHash, resolvedAt },
    }
  })
}

export function normalizeArchivePath(path) {
  if (typeof path !== 'string' || !path || path.includes('\0') || path.includes('\\')) throw new TypeError('Invalid archive path')
  if (path.startsWith('/') || /^[A-Za-z]:/.test(path) || path.startsWith('//')) throw new TypeError('Absolute archive path')
  const segments = path.split('/')
  if (segments.some(segment => !segment || segment === '.' || segment === '..')) throw new TypeError('Unsafe archive path segment')
  return segments.join('/')
}

export function validateArchiveEntries(entries) {
  const seen = new Set()
  for (const entry of entries) {
    if (entry.type === 'symlink' || entry.type === 'hardlink') throw new TypeError('Links are not allowed in archive')
    const normalized = normalizeArchivePath(entry.path)
    // Reject collisions on common case-insensitive filesystems and Unicode-normalizing filesystems.
    const collisionKey = normalized.normalize('NFC').toLocaleLowerCase('en-US')
    if (seen.has(collisionKey)) throw new TypeError('Duplicate normalized archive path')
    seen.add(collisionKey)
  }
  return entries.map(entry => normalizeArchivePath(entry.path)).sort((a, b) => Buffer.compare(Buffer.from(a), Buffer.from(b)))
}

export function bundleDigest(manifest, entries) {
  const paths = validateArchiveEntries(entries)
  const byPath = new Map(entries.map(entry => [normalizeArchivePath(entry.path), entry]))
  const manifestBytes = textEncoder.encode(canonicalJson(manifest))
  const chunks = [Buffer.from('brewmate-bundle-v1\0'), Buffer.from(String(manifestBytes.byteLength)), Buffer.from('\0'), Buffer.from(manifestBytes)]
  for (const path of paths) {
    const entry = byPath.get(path)
    const pathBytes = Buffer.from(path, 'utf8')
    const size = Buffer.byteLength(entry.bytes)
    chunks.push(Buffer.from(String(pathBytes.length)), Buffer.from(':'), pathBytes, Buffer.from(String(size)), Buffer.from(':'), Buffer.from(sha256(entry.bytes)), Buffer.from('\n'))
  }
  return sha256(Buffer.concat(chunks))
}

export function verifyBundle(manifest, entries, expectedDigest) {
  for (const entry of entries) {
    if (entry.type === 'file' && entry.declaredSize !== Buffer.byteLength(entry.bytes)) throw new TypeError('Entry size mismatch')
    if (entry.sha256 && entry.sha256 !== sha256(entry.bytes)) throw new TypeError('Entry hash mismatch')
  }
  return bundleDigest(manifest, entries) === expectedDigest
}
