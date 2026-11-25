# Prototype run record

Run environment: Node.js `v22.23.4`, Windows; browser harness in Chrome `152.0.7977.167` (Windows UA). No dependencies installed.

## Test result

Command:

```powershell
node --test experiments/adr-t0-t1-prototype/*.test-node.mjs
```

Result: **12/12 tests passed** in three runs; whole-suite durations were **117.559 ms**, **120.301 ms**, and **117.376 ms**. These are test-runner durations, not operation benchmarks.

## Scenario matrix

| Area/scenario | Result | Evidence / limitation |
|---|---|---|
| JCS-shaped canonical bytes and hashes | PASS in prototype | Golden fixture assertions pass. Most expected values were produced during this prototype; independent RFC/reference implementation comparison is still required. |
| UTC instant normalization, millisecond precision, invalid date rejection | PASS in prototype | Offset-to-UTC, leap day, excess precision and malformed date fixtures pass. Does not migrate existing BrewMate date fields. |
| Value/tombstone snapshot hashes | PASS in prototype | Distinct fixed hashes pass. |
| Conflict sequence: unresolved → resolved → old redelivery → new conflict → resolution | PASS in prototype | Old fingerprint remains resolved; new fingerprint links to the prior record; original snapshots compare unchanged. In-memory model only. |
| Traversal/absolute paths/backslashes/dot segments | PASS in path helper | Rejected before an extraction layer exists. |
| Duplicate, case-fold and Unicode-normalization path collisions | PASS in path helper | Rejected by prototype collision key. Not exercised against a selected archive/container implementation. |
| Symlink/hardlink entries | PASS in path helper | Rejected when entry metadata reports a link. No actual archive parser/container yet. |
| Manifest/bundle digest, input order, content/manifest tampering | PASS in helper tests | Digest stable for reversed entries; changed bytes or manifest produce a non-matching digest; mismatched size/hash rejects. Fixtures are not yet cross-checked by a second implementation. |
| Interrupted domain/Bench/media/relations apply and checkpoint injection | PASS in state simulator | Recovery ends at modeled pre- or post-inventory; no browser persistence. |
| Simulated quota flag before safety snapshot/journal creation | PASS in state simulator | No active state mutation before failure. This does **not** simulate quota during journal/checkpoint writes; real IndexedDB quota remains untested. |
| Missing/corrupt journal, corrupt staging, unsupported app version | PASS in state simulator | Boolean fault flags select rollback path; no persisted/corrupt journal bytes or real restart. |
| Two restore attempts while lock held | PASS in state simulator | A manually set in-process lock rejects the second attempt; does not prove cross-tab locking. |
| Concurrent user edits during restore | FAIL in browser probe | Separate two-tab run reproduced a lost update; sequence and hashes are recorded below. |
| Checkpoint write failure after data write | PARTIAL | Modeled by throwing between store write and checkpoint; journal durability and real quota behavior are not modeled. |
| Staging exists but journal absent after partial apply | PASS in browser probe | After domain checkpoint, journal was deleted while staging remained; a fresh tab rolled back to the pre-inventory. Staging remained present after rollback. |
| Journal and staging in same IndexedDB database | PASS in browser harness | Separate object stores share the same database; staged operation and checkpoints survived tab closure. Does not prove filesystem/browser-process durability. |
| Close/reopen tab in same browser profile | PASS in Chrome 152 | The harness auto-recovers before showing status. Full browser-process restart and service-worker/app upgrade remain untested. |
| Safety snapshot persistence/integrity | PASS in tested rollback paths | Stored in IndexedDB; missing/corrupt journal cases restored the recorded pre-inventory. Snapshot corruption and real quota failure during snapshot write remain untested. |

## Measurements

- Whole Node test-suite durations: 117.559 ms, 120.301 ms, and 117.376 ms across three runs.
- Per-operation wall time: **not measured**.
- Peak memory: **not measured**.
- Archive/staging bytes: **not measured**; no large-media archive or container was selected.
- State inventories: Node simulator asserts in-memory hashes; browser runs recorded exact pre/post hashes in the scenario matrix below.
- Browser support: **only the attached Chrome 152 runtime was exercised**; this does not establish support for other Chromium versions, Firefox, Safari, or installed-PWA lifecycle.

## Browser-backed T1 IndexedDB crash/restart run

The isolated harness uses a dedicated IndexedDB database, separate stores for `domain`, `bench`, `media`, `relations`, `journal`, `staging` and `safety`, and a local-only static server. It does not load BrewMate runtime code or user records. On a new page context the harness checks for an unfinished journal and recovers before displaying its status. Each row compares per-store SHA-256 inventories with exact pre-operation and post-operation inventories.

| Scenario | Result | Observed outcome |
|---|---|---|
| 1. Close tab after staging, before apply; open new tab | PASS | Durable staged journal and snapshot were read; roll-forward ended at exact post-inventory with `completed`. |
| 2. Abort domain IndexedDB transaction after queuing a write | PASS, transaction test only | Transaction raised `AbortError`; exact pre-inventory and empty checkpoint remained. After tab close/reopen, recovery reached exact post-inventory. This is not a true process crash inside an active transaction. |
| 3. Close tab after domain checkpoint, before Bench | PASS | Before close: only domain target hash and `completed:["domain"]`; after reopen: checkpoint survived and recovery reached exact post-inventory. |
| 4. Close tab after media checkpoint, before relations | PASS | Before close: checkpoints were domain, Bench and media; after reopen: recovery reached exact post-inventory. |
| 5. Close tab after all writes, before `completed` | PASS | All four target hashes and checkpoints persisted while phase was still applying; reopen recovered/finalized with `completed`. |
| 6a. Delete journal after partial apply, then reopen | PASS | Before deletion: phase `applying`, checkpoint `["domain"]`, staging present. After deletion: journal absent, staging still present. Fresh tab restored exact pre-inventory, phase `rolled-back`; staging remained present after recovery. |
| 6b. Replace journal with corrupt marker after partial apply, then reopen | PASS | Safety snapshot restored exact pre-inventory and phase became `rolled-back`. |
| 7a. Inject quota-shaped error before staging writes | PASS, synthetic only | Rejected with `QuotaExceededError`; active stores remained pre-state and no journal/staging record was committed. |
| 7b. Inject quota-shaped error before apply transaction writes | PASS, synthetic only | Rejected with `QuotaExceededError`; active stores and checkpoints remained pre-state. Reopen then recovered to post-state. |
| 8. Close tab and open a new tab in the same Chrome profile | PASS | IndexedDB state and journal/checkpoint survived the tab context. A full browser-process exit/relaunch was not performed. |
| 9. Reopen with incompatible harness `appVersion=2` | PASS, version-gate simulation | Version-1 partial operation rolled back to exact pre-inventory; no `completed` marker. No actual service-worker/app upgrade was exercised. |
| 10. Invoke recovery twice after interruption/completion | PASS | Both calls ended at `completed`; inventory remained exactly post-operation. |

Observed inventory hashes:

| Store | Before | After |
|---|---|---|
| domain | `0a3646722e2e37759adc3e4becfe26f43ddcf1cb8e13c7368bdb60c7c1ca48a2` | `ebfd24a40edeb8ba54de461146691479090f0c224d979e1a2894c31ee30f6ccf` |
| Bench | `f22d836bb366146239a6e746a65758244863b7b179f025ba3ac9688a27a68245` | `986e3110f292e89fee049ddb5a40dd039d0dac8d4c55fdf241528160d9635e2c` |
| media | `4209e68992d0ba135cf42829f51174749962b0ae07d08ed394633e890b7698a8` | `d6d98136189248ba9b5bc353b00667d6fb318587ba9e4aa0b2deb1bf12db0474` |
| relations | `45786443e4821b82785ddf8e29f82d31a48c5f3f99a225783a67eebe8b06a7f1` | `d744609cd5b0c953f091a180b2930606dd819b5d1a6c4987e6e0ea7db2d2e4d2` |

### Reproducible cross-tab lost-update probe — FAIL

1. Open two harness tabs on the same origin before starting restore.
2. In tab A, seed pre-state and create staging/safety/journal.
3. In tab B, write `domain = {"recipes":["concurrent-user-edit"]}` to the same IndexedDB store.
4. Tab A observes that edit (`domain` hash `38b0f42a01431e2e2043a1a1bdc8bea947f413d04a754a6e28ba791ad560ce3e`) and runs `applyAll()`.
5. Final domain becomes `{"recipes":["after"]}` with target hash `ebfd24a40edeb8ba9b5bc353b00667d6fb318587ba9e4aa0b2deb1bf12db0474`; the concurrent edit does not survive.

The harness has no cross-tab lock or stale-state check. This confirms that the prototype protocol is not safe to use concurrently as-is.

Quota was not exhausted: `navigator.storage.estimate()` reported roughly 13.39–14.19 GB available in this browser profile; test data was tiny. Quota outcomes above use explicit injected `QuotaExceededError` before writes and are not evidence of behavior under real disk pressure. The browser estimate is not a guarantee of future quota.

## Browser measurement limits

- This validates a new tab/page context in the same browser profile, **not** complete browser-process restart or OS crash recovery.
- Browser close/reopen occurs between committed IndexedDB transactions. Real abrupt termination during an in-flight transaction was not reliably forced; an explicit `AbortError` transaction test was used instead.
- The scenario data are small synthetic objects; no large Blob/media workload was run. Peak memory and per-operation durations were not measured.
- `navigator.storage.estimate()` was available, but true quota exhaustion and browser eviction were not induced.
- App-version incompatibility is simulated by a version query parameter; actual PWA/service-worker upgrade behavior remains untested.
- Safety snapshot corruption/missing-snapshot behavior was not injected. Cross-tab concurrent editing was tested once and failed (lost edit); multi-writer recovery remains unresolved.

## Decision

This result supports continuing the isolated prototype, not approving T0/T1. T0 helpers still need independent conformance fixtures/oracle. The initial browser-backed T1 protocol failed its concurrent-edit probe; a follow-up candidate protocol and its limitations are recorded below. No recovery guarantee should be claimed yet.

## Follow-up: concurrent restore protection

### Current architecture evidence

- `src/storage.ts` reads/writes core app records as separate `localStorage` keys; `src/App.tsx` persists React state through separate effects. Those writes do not currently update a shared revision or join a cross-tab lock.
- `src/SyncSettings.tsx` imports by merging with current state and later saving through those app paths; this is not an atomic multi-key restore.
- `src/ai/visionBenchStore.ts` stores Vision Bench data in its own IndexedDB database. The T1 harness's `bench` store is a synthetic restore section and does not prove inclusion/coordination of that existing database.
- `t0.mjs` models `ConflictRecord`; it is not integrated with BrewMate runtime persistence or a user-facing conflict resolver.

### Architecture comparison

| Option | Data preservation | Crash / stale owner | Atomicity | Fit to current architecture | Assessment |
|---|---|---|---|---|---|
| Exclusive cross-tab Web Lock | Prevents concurrent operations only when every writer cooperates; does not alone detect old or bypassing app writes. | Browser releases a Web Lock when its owner context dies; no TTL or stale-owner revival. | Serializes lock users, but cannot make multiple localStorage keys atomic. | Small for restore entry points; incomplete while ordinary App writes do not acquire it. | Useful as a secondary guard, insufficient alone. |
| Revision check / OCC | Detects changes if every write increments the same revision and restore checks it inside the write transaction. | No owner lease to expire; after restart the persisted revision can be compared with the journal. | Strong only within a single IndexedDB transaction covering data, revision and checkpoint. | Requires moving/coordinating current independent localStorage writes; currently incompatible as a drop-in guarantee. | Best primary candidate for an IndexedDB-backed protocol; not yet usable against current runtime writers. |
| Detect, abort, rollback | Safe only if rollback never overwrites a value changed by another writer. Naively restoring the whole pre-snapshot loses edits. | Recovery needs a durable journal and must re-check current values before any rollback write. | Per-section atomic transaction possible in the harness; cross-key localStorage rollback is not atomic. | Requires persistent snapshot/journal and instrumented writers. | Candidate implementation now rolls back only sections still equal to its target. |
| Preserve both sides as a T0 conflict | Keeps local and imported snapshots for explicit resolution; no silent winner. | Durable conflict record survives restart only if committed with the recovery transaction. | Can be atomic with IndexedDB writes; does not by itself serialize or recover restore. | T0 model exists only as a prototype; format/UI/runtime integration absent. | Used as the candidate abort outcome, but not asserted to conform to T0 conflict identity/redelivery rules. |
| IndexedDB TTL lease with fencing token | Can reject an expired owner if every write checks its monotonically increasing token in the same transaction. | TTL alone is vulnerable to clock/paused-tab problems; fencing blocks an old token after takeover. | Token check and write can be one transaction. | New coordination state and mandatory participation by all writers; no advantage over browser-managed Web Locks for same-origin tabs unless leases must cross contexts not covered by Web Locks. | Tested as a comparison only; not selected. |

### Selected hypothesis — not an implementation decision

For the isolated prototype, test **OCC as the safety check, Web Locks as restore serialization, and conflict-preserving abort on detected drift**:

1. Snapshot base revision and state, then stage target.
2. Each participating writer updates its record and global revision in one IndexedDB transaction.
3. Each restore section checks expected revision and writes that section, increments revision and advances the journal checkpoint in the same transaction.
4. On drift, stop forward apply. In one transaction, preserve the concurrent value; revert only already-applied sections that still exactly equal the restore target; persist local/import snapshots as an unresolved conflict and mark the journal `conflict_pending`. Never write `completed`.
5. On reopen, acquire the Web Lock and recover only if revision matches the journal; otherwise use the same conflict-preserving path. A lock owner dying releases the lock; the next context performs recovery.
6. A second restore queues behind the Web Lock; after the first commits, an old staged plan fails its revision fence and becomes a conflict without replacing the completed journal.

The hypothesis does **not** protect against writers that bypass the revision protocol. Existing BrewMate `localStorage` writes do bypass it today. So this proves a protocol within the test IndexedDB boundary, not safety of BrewMate restore.

### Real-browser tests of the candidate

Environment: Chrome `152.0.7977.167` on Windows, same-origin tabs, isolated per-run IndexedDB databases. Assertions compared SHA-256 inventory for all four synthetic data stores (`domain`, `bench`, `media`, `relations`). Each run used small synthetic objects.

| Store | Before hash | Imported target hash |
|---|---|---|
| domain | `0a3646722e2e37759adc3e4becfe26f43ddcf1cb8e13c7368bdb60c7c1ca48a2` | `b71ef7c7bc4b7c6bf0d463e60deaa4e0ace44b9ccd2516d22d560c78f5ac85c9` |
| bench | `f22d836bb366146239a6e746a65758244863b7b179f025ba3ac9688a27a68245` | `108c78c93fcf062ce806d890692af4cfdaed2ccbe1747e0ea933cb247e40473c` |
| media | `4209e68992d0ba135cf42829f51174749962b0ae07d08ed394633e890b7698a8` | `6d42ab0be8358a9a0e2f5c31c9c82b487df26ee3be5d18d40bd467adc60d5f05` |
| relations | `45786443e4821b82785ddf8e29f82d31a48c5f3f99a225783a67eebe8b06a7f1` | `860f5d0ed5c4ce46bcb85744c7f90b33cf25605d12a5404e928f2b12d29b11d1` |

| Required test | Result | Observed state / evidence |
|---|---|---|
| Concurrent edit before restore starts | PASS, refused before staging | Second tab changed domain; stage detected revision `0→1`, stored unresolved local/import conflict, left edit hash `8130b154afda0a870bb8aa7d31a48eca3aff7efc80ef7af53b03214f76570f87`, and did not write the target. No `completed` journal. |
| Edit after staging, before apply | PASS, aborted | `applyAll()` returned `conflict_pending`; domain remained `{"recipes":["post-stage-edit"]}` (hash `3afef8f5…4b0df722`), other seeded stores retained their before hashes; conflict contains local and import variants. |
| Edit during apply to an already-applied section | PASS, aborted safely | Domain had reached target hash `b71ef7c7…f5ac85c9`; second tab replaced it with `{"recipes":["during-edit"]}` (hash `1ddce7b3…9ae980da`). Next section detected revision drift; final domain retained edit, remaining sections remained at before hashes, journal `conflict_pending`, `concurrentChangeDetected:true`, and conflict retained local/import snapshots. |
| Second-tab edit between two restore sections | PASS, aborted safely | After domain checkpoint, second tab changed Bench. Restore rejected the Bench apply; the domain (which still equalled target) was reverted to its before hash, while concurrent Bench remained at hash `a1655469…49c02d98`. Conflict record retained local/import snapshots. No `completed`. |
| Edit transaction races an apply transaction | PASS, fail-safe ordering | `Promise.all` of real IndexedDB edit and apply serialized at the database. The edit survived; the next section detected revision drift and recorded conflict. No silent overwrite. This is a race test, not an injected mid-transaction process crash. |
| Close tab owning restore Web Lock | PASS | Held lock observed through `navigator.locks.query()` while stage paused. Closing owner released it; a fresh tab acquired it during boot and completed recovery at all four target hashes. |
| Expired/lost lease and stale owner | PASS, fencing comparison only | Logical-clock test acquired token 1, advanced expiry, then acquired token 2. Token-1 write rejected with `InvalidStateError`, domain stayed at before hash; token-2 write succeeded and incremented revision. A follow-up deleted the lease row before reacquiring: the independent generation still produced token 2 and rejected token 1. Controlled clock only; not real elapsed-time expiry or throttling. |
| Two simultaneous restore operations | PASS, serialized/refused stale plan | Second Web Lock request stayed queued while first held lock. First reached target and `completed`; second then detected its old base revision and produced a conflict. Final data remained exact target hashes and completed journal stayed `completed`. |
| Reopen after unfinished restore | PASS | Tab closed after domain checkpoint. New tab auto-recovered and completed at exact four target hashes. |
| Reopen unfinished restore after another tab edited | PASS, aborted safely | After partial domain apply, second tab edited Bench. On reopen, revision drift caused rollback of still-target domain to before hash; changed Bench hash `ad047064…1d0aedcf` and its value remained; conflict preserved local mixed snapshot and import. Journal stayed `conflict_pending`. |

The persistent `results.md` records key full concurrency hashes below:

| Value | SHA-256 |
|---|---|
| Concurrent domain edit during apply `{"recipes":["during-edit"]}` | `1ddce7b3bb1151412e8edfd9a592a755942ae020b2f360e462cf602e9ae980da` |
| Target domain `{"recipes":["imported"]}` | `b71ef7c7bc4b7c6bf0d463e60deaa4e0ace44b9ccd2516d22d560c78f5ac85c9` |
| Concurrent Bench edit `{"samples":["between-sections-edit"]}` | `a1655469531840d03a045a1e5717b41275d4cc1b33764c3e6e375dae49c02d98` |
| Concurrent Bench edit before reopen `{"samples":["edit-before-reopen"]}` | `ad0470649742cb92ae3a1a855798a7d85ed2e5dafa83cd464e22230d1d0aedcf` |
| Concurrent domain edit before restore `{"recipes":["pre-start-edit"]}` | `8130b154afda0a870bb8aa7d31a48eca3aff7efc80ef7af53b03214f76570f87` |
| Concurrent domain edit after staging `{"recipes":["post-stage-edit"]}` | `3afef8f59dd2c59c85997998b36ddc879d70c8cdfdf2b79e1665523f4b0df722` |

**Interpretation:** candidate runs passed the listed synthetic IndexedDB cases; this does not prove zero data loss for current BrewMate users. Required coverage still missing includes real App/localStorage writers during restore, migration of all relevant stores, lock-unavailable browsers, tab/process/OS crash inside an active transaction, actual quota/eviction, persisted conflict redelivery/resolution, actual T0 `ConflictRecord` compatibility, and a UI that requires explicit user resolution. A no-lock fallback is not allowed by this hypothesis: the safe result must be refusal.

### Independent QA review

Read-only reviews identified and drove three hardening changes:

1. Raw restore mutators were removed from `window.lab`; restore operations now enter through Web Lock. Browser pauses are test hooks inside that locked flow.
2. Lease generation is stored separately from the lease row. Chrome test deleted the lease row after token 1, reacquired token 2 and verified the old token was rejected.
3. A later review found the test-only `reset` method could clear data and reset revision outside the lock. Both `reset` and the page-exposed database deletion method were removed. A fresh per-run database is now seeded exactly once by `boot()` under Web Lock; an unmarked non-empty database is refused. A new Chrome test paused restore after staging, confirmed `reset`/`clearDatabase` are absent from the public harness API, resumed restore and verified exact target hashes with `completed`.
4. The next review found the exported `stores` array could be mutated to skip checks and writes. The internal array is now frozen and only a copy is exposed. Chrome tests set the public copy's length to zero before restore, and separately while restore was paused after the domain checkpoint; both operations still applied and verified all four data stores, with the journal listing all four completed sections and exact target hashes.
5. A further review found that a queued restore held a mutable caller-owned plan. Plans now have private per-page tickets: `plan()` stores a detached canonical copy, and `startLockedRestore()` resolves/clones that copy synchronously before queueing on Web Locks. The caller can mutate its returned plan but cannot change the queued revision or target. Chrome test: queue restore 2 behind paused restore 1, mutate plan 2's `baseRevision` from `0` to `4` and target domain to `["forged"]`, then release restore 1. Restore 2 rejected the original stale revision as `conflict_pending`; final inventory remained exact restore-1 target hashes, journal remained `completed`, and one conflict was recorded.

The reviews did not independently rerun all browser scenarios or verify every hash; affected staging/apply/lease/owner-close/reset/store-list/queued-plan paths were rerun in Chrome. Node tests and diff checks were rerun. An independent read-only review after the plan-ticket hardening is pending. Regardless, T1 remains **PROPOSAL** because current runtime writers bypass this boundary and restore/conflict resolution is not integrated.

### Follow-up status

The candidate is an isolated research harness only. It changes no BrewMate runtime, schema, dependencies, production data, Issues, PRs or infrastructure. Independent QA is required before interpreting the candidate as accepted. T1 remains **PROPOSAL**.
