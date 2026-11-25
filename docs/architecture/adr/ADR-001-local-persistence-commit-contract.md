# ADR-001 — Local Persistence Commit Contract

**Статус:** Proposed
**Дата:** 25 ноября 2026
**Владелец решения:** владелец продукта BrewMate
**Ведущая специализация:** Architecture & Technical Lead, при участии Backend/Data и QA
**Связанные документы:** [Product Vision](../../product/vision.md), [Working Agreement](../../agents/working-agreement.md), [Coordination Protocol](../../agents/coordination-protocol.md)
**Связанные задачи:** Issue #36 (A1), Issue #41 (Backend/Data audit), Issue #42 (QA audit)
**Связанный эксперимент:** `experiments/adr-t0-t1-prototype` (публикуется отдельным PR, не подключён к runtime)
**Базовый commit анализа:** `ddba85b`; на `a69c34f` код, конфигурация и зависимости не изменялись (`git diff ddba85b..a69c34f` — только документация и шаблоны)

> Документ фиксирует **контракт и границы**, а не реализацию. В main нет ни `PersistenceStore`, ни IndexedDB-слоя домена. Всё, что ниже описано как интерфейс, — предложение, требующее отдельного implementation PR.

---

## 1. Status

Proposed. Не является действующим контрактом до утверждения владельцем продукта и merge этого ADR.

Решения, уже утверждённые владельцем:

- доменные данные хранятся в **IndexedDB**;
- scope включает **все доменные записи, import/restore и batch-import Vision Bench**;
- экспериментальный T1-прототип **предназначен к сохранению в Git как experiment** и не подключается к runtime (файлы пока не перенесены в этот checkout);
- вопрос Web Locks **сначала исследуется** (§19), затем принимается решение о fallback/refusal.

Не утверждены (остаются открытыми): контракт Supabase Sync, финальный UX разрешения конфликтов, срок жизни legacy-снапшота, политика PWA-обновлений.

---

## 2. Context

Текущее хранение (факты на `ddba85b`, код не менялся до `a69c34f`):

- `src/storage.ts:17` defines nine versioned localStorage keys, including grinder profile; domain-vs-settings classification is proposed in §7;
- state persistence and import writers are in `src/App.tsx`; this ADR avoids an exact effect count because it is an implementation detail that can drift;
- `safeWrite` (`src/storageError.ts:23-31`) возвращает `false` при ошибке, но вызывающие это игнорируют;
- импорт backup собирается в памяти и применяется через `onMerged` (`src/SyncSettings.tsx:46-70`);
- Vision Bench хранится в отдельной IndexedDB `brewmate-vision-bench` (`src/ai/visionBenchStore.ts:37-50`), импорт пишет записи циклом (`src/VisionBench.tsx:181-182`);
- Supabase sync делает `select` → merge → безусловный `upsert` без ревизии (`src/sync/sync.ts:21-33`);
- PWA собирается с `registerType: 'autoUpdate'` (`vite.config.ts:9`), слушателей `storage`/`BroadcastChannel` и flush на `pagehide` нет.

One user operation can change multiple keys, so cross-key atomicity is unavailable in localStorage; failed `safeWrite` results may be ignored by callers.

---

## 3. Problem statement

1. **Non-atomic multi-key writes.** Удаление, импорт, sync-merge и восстановление меняют 2–9 ключей без транзакции.
2. **False success.** UI сообщает об успехе до/независимо от результата записи.
3. **Lost update.** Две вкладки или два устройства перезаписывают чужие изменения без обнаружения.
4. **Нет durable recovery.** Прерванный импорт/restore не имеет журнала, staging и воспроизводимого восстановления.
5. **Нет сохранения конфликтующих версий.** merge выбирает победителя по `updatedAt`, проигравшая версия теряется.
6. **Разные субстраты не скоординированы.** Домен (`localStorage`) и Vision Bench (IndexedDB) не связаны общей границей.

---

## 4. Goals / Non-goals

**Goals**

- Единый API записи домена; ни один экран не пишет данные напрямую.
- Один обычный commit атомарно изменяет touched data + revision (и conflict record, если применимо) в одной IDB-транзакции; multi-step workflow не атомарен целиком.
- Ошибка commit никогда не приводит к «успешному» состоянию UI.
- Конкурентная запись обнаруживается; чужие изменения не теряются молча.
- Импорт не меняет активное состояние до успешной проверки. Multi-step restore может применять данные несколькими IDB-транзакциями; читатели должны видеть согласованный snapshot либо store обязан отказывать в чтении во время операции. Выбор механизма — открытый контрактный вопрос до реализации.
- Исходные данные сохраняются до завершения миграции; возможен откат.
- Backup v1 и CoffeeJSON остаются совместимыми.
- Секреты не попадают в экспериментальные данные и экспорт.
- Vision Bench остаётся вне облачного sync.
- Logout/отсутствие аккаунта не удаляет локальную лабораторию.

**Non-goals**

- Переписывание доменной логики, UI-потоков или стека.
- Изменение Supabase-схемы, RLS, sync payload.
- Изменение backup-формата и формата CoffeeJSON в этом ADR.
- CRDT/совместное редактирование, realtime, мультиустройство «в реальном времени».
- Серверная истина вместо локальной.
- Изменение per-record протокола Vision Bench (только batch-import).
- Аналитика, телеметрия, фоновые задания.

---

## 5. Accepted owner decisions

| Решение | Статус | Следствие для ADR |
|---|---|---|
| IndexedDB как субстрат домена | принято | §6–§10 проектируются на транзакциях IDB; `localStorage` остаётся только для настроек/секретов |
| Scope: все доменные записи + import/restore + batch-import Vision Bench | принято | §7 охватывает все коллекции; §13 описывает только batch |
| Прототип предназначен к публикации как experiment | принято | отдельный PR-B; runtime-импорт запрещён; файлы не находятся в текущем checkout |
| Web Locks: сначала исследование | принято | §19 фиксирует данные и решение отложено |

Остальные рекомендации предыдущего брифа в этом ADR помечены как открытые (§22), а не как решения.

---

## 6. Architecture overview

```
UI (экраны, App)
      │  читает snapshot, отправляет intent
      ▼
PersistenceStore  ──────────────►  IndexedDB
  • load()                          • domain stores (по коллекциям)
  • commit(mutations)               • meta (revision, schema)
  • runExclusive(op)                • journal / staging / conflicts
  • subscribe()                     • migration marker
      │
      ├──► SettingsStore (localStorage): skill level, AI config,
      │    sync config — настройки, не экспортируются
      │
      └──► VisionBenchStore (отдельная IDB): per-record запись + batch import
```

Границы:

- `src`-модули домена (`beans/*`, `grind/*`, `brewlog/*`, `cupping/*`) остаются чистыми функциями и не знают о хранилище.
- Сантайзеры и merge-логика переиспользуются; ADR не требует их дублирования.
- Если Sync будет включён в отдельный будущий scope, локальный merge должен применяться через `PersistenceStore.commit`; точная модель Sync не утверждена (§16, §22).
- Секреты (BYOK ключ, sync config) физически не входят в доменный store.

---

## 7. PersistenceStore contract

Контракт уровня типов; имена иллюстративны, финальные — в implementation PR.

```
interface PersistenceStore {
  load(): Promise<Snapshot>                       // { data, revision, schemaVersion }
  commit(intent: CommitIntent): Promise<CommitResult>
  runExclusive<T>(op: ExclusiveOp<T>): Promise<T>  // proposed multi-step coordination boundary
  subscribe(fn: (s: Snapshot) => void): () => void
  resolveConflict(conflictId, choice): Promise<CommitResult>
}

type CommitIntent = {
  expectedRevision: number
  mutations: Mutation[]
}

type Mutation =
  | { kind: 'put';    collection: Collection; value: Entity }
  | { kind: 'delete'; collection: Collection; id: string; deletedAt: number }
  | { kind: 'restore'; collection: Collection; id: string }

type CommitResult =
  | { ok: true; revision: number }
  | { ok: false; reason: 'conflict' | 'quota' | 'aborted' | 'unsupported' | 'invalid'; detail?: string }
```

Правила:

1. `commit` — **единственный** путь изменения домена. Прямые `localStorage`/IDB-записи домена запрещены.
2. `delete` всегда порождает tombstone в той же транзакции.
3. `expectedRevision` обязателен; отсутствие ревизии — ошибка типа, а не «0 по умолчанию».
4. `subscribe` уведомляет после успешного commit и после recovery; уведомление не означает атомарности с внешними хранилищами.
5. Настройки (skill level, AI/sync config) в домен не входят; для них допускается существующий `localStorage`, но их ошибки обязаны доходить до UI. GrinderProfile — пользовательские данные оборудования и входит в доменный commit/migration.
6. Доменные сущности не меняют форму: `Recipe`, `BrewLog`, `BeanProfile`, `CuppingSession`, `GrindCheck`, `DialInProfile`, `PhotoGrindProfile`, `Tombstones`.

---

## 8. Atomic commit semantics

1. Обычный commit открывает одну `readwrite`-транзакцию по затронутым доменным stores, `meta` и `conflicts` при необходимости. Multi-step apply транзакция дополнительно включает `journal`/`staging`; последовательность таких транзакций не атомарна как целое.
2. Первым шагом внутри транзакции читается `meta.revision` и сравнивается с `expectedRevision`.
3. Применяются все мутации, затем `revision+1`, затем (при необходимости) checkpoint.
4. `tx.abort` при любой ошибке; частично применённых мутаций **в пределах этой транзакции** быть не может. Многошаговый restore с отдельными транзакциями может быть виден частично до recovery. API чтения должен предоставлять стабильный base snapshot либо отказывать со статусом `recovery_pending`; выбор обязателен до реализации.
5. Успех = `tx.oncomplete`; только после него UI получает новое состояние.
6. Ошибка квоты/abort возвращается как `{ok:false}`; UI обязан показать unsaved-состояние, а не успех.
7. Один commit = одна пользовательская операция (одно действие пользователя), а не «всё приложение».

---

## 9. Revision / OCC model

- `meta.revision` — одна глобальная ревизия доменного snapshot в IndexedDB `meta` store; initial migration устанавливает начальное значение, обычный успешный commit увеличивает на 1.
- Ревизия проверяется и изменяется в одной IDB readwrite transaction с доменными stores; это локальная гарантия транзакции, не гарантия между localStorage или Supabase.
- Drift → входящая мутация не применяется. Предлагаемое правило: conflict record с base/local/incoming записывается транзакционно с повторной проверкой текущей ревизии; если текущая версия снова изменилась, bounded retry либо возврат conflict без заявления о durable сохранении. Требует согласования.
- Обнаружение конфликта не является ошибкой UI: это штатный исход конкурирующей записи.
- Для одиночных мутаций OCC достаточно; блокировки не требуются.
- Ревизия **не** добавляется в backup/payload/сущности: это внутреннее состояние устройства.
- `updatedAt` остаётся для merge с сервером и не заменяет ревизию.

---

## 10. Journal, staging and recovery

Применяется только к многошаговым операциям: import, restore, миграция.

```
staging : { target, baseRevision, targetHash }
journal : { phase: 'staged'|'applying'|'completed'|'conflict_pending'|'rolled-back',
            expectedRevision, targetHash, completed: Collection[] }
```

Порядок:

1. Проверка и подготовка `target` в памяти; ни одна активная запись до окончания validation.
2. Staging хранит полный целевой snapshot и base revision/hash. Его запись и journal `staged` — одна IDB-транзакция.
3. Каждая apply-транзакция атомарно меняет конкретный раздел, revision и journal checkpoint. Это не делает всю последовательность секций одной транзакцией; частичный результат возможен до recovery.
4. Читатели во время операции используют стабильный base snapshot либо получают `recovery_pending`; реализация обязана выбрать один вариант до начала кода.
5. Verify сравнивает полное целевое состояние и revision/checkpoint; только затем отдельная IDB-транзакция фиксирует `completed`.

Recovery при старте:

- нет журнала → обычная работа;
- `completed` → очистка staging, обычная работа;
- `staged`/`applying` → повторно проверить journal, staging, base/expected revision и актуальные записи; roll-forward разрешён только если проверенный checkpoint соответствует текущему состоянию;
- revision drift или несовпадение секции → сначала атомарно записать durable conflict с base/local/imported; rollback только для секций, которые всё ещё равны значению, записанному этой операцией. Иначе оставить текущее значение, сохранить конфликт и не перезаписывать его;
- повреждённый staging/journal → не делать слепой rollback; остановить доменные записи и сохранить доступные данные для восстановления. Recovery result должен быть наблюдаемым для UI;
- **никогда** не помечать `completed`, если verify не прошёл.

---

## 11. Conflict preservation and resolution

- Конфликт = сохранение **обеих** версий: локальная и входящая, плюс базовый снапшот.
- Запись конфликта: `{ id, entityType, entityId, base, local, imported, state, resolution, createdAt }`.
- Автоматическое разрешение — открытый вопрос; не выбирать версию автоматически до утверждения продуктовых правил для сущностей и tombstones.
- «Проигравшая» версия не удаляется до явного решения пользователя.
- Неблокирующий UX — **предварительная рекомендация**, не утверждённое решение. Требования контракта: разрешение всегда явное, обратимое и не блокирует текущее заваривание.
- `PhotoGrindProfile` не имеет стабильного `id` (ключ `grinderId+size`) — до изменения ключа конфликты по ним либо не создаются, либо создаются на уровне всей коллекции. Это открытый вопрос (§22).
- Скрытая потеря данных запрещена: если версия отброшена, это либо tombstone-правило, либо явный выбор пользователя.

---

## 12. Import/restore

1. Файл читается и валидируется целиком (app/version/размер/структура) **до** любых записей.
2. Строится `target`; активное состояние не меняется.
3. Пользователь видит preview: сколько записей, что будет слито, какие пропущены.
4. Применение идёт через `runExclusive` + journal/staging (§10).
5. Ошибка до начала apply → активное состояние прежнее. Ошибка после одной или нескольких apply-транзакций может оставить частичный результат до recovery (§10); UI не должен показывать import как завершённый, а читатели должны соблюдать §8 пункт 4.
6. Импорт сохраняет текущую merge-семантику, если пользовательский сценарий не говорит об обратном; явный replace/restore режим требует отдельного подтверждения и отдельного теста.
7. Backup v1 читается как есть; новые поля не обязательны; отсутствующие поля получают существующие дефолты.
8. CoffeeJSON-импорт использует тот же контракт commit (валидация остаётся в `src/coffeejson`).
9. Импорт Vision Bench — отдельный путь (§13).

---

## 13. Vision Bench batch import

- Хранилище остаётся отдельной IndexedDB `brewmate-vision-bench`; в доменный store не переезжает.
- Batch-import: одна транзакция по object store `samples`, все записи `put` за один проход; ошибка → abort, частичного импорта нет. Точный набор транзакционных stores/schema проверяется по версии базы перед реализацией.
- Обычная запись одной записи остаётся как сейчас (per-record транзакция).
- `benchmarkRuns` при импорте: явное правило (замена или объединение по `ranAt`+`providerId`+`model`+`photoId`) — открытый вопрос; текущий `put` сохраняет запись целиком под ключом id.
- Vision Bench **не** входит в облачный sync, backup v1 и доменный revision.
- Секреты провайдеров и ключи в bench-файлы не попадают.

---

## 14. Legacy migration and rollback

Инвариант: **сбой миграции не приводит к потере исходных данных.**

Фазы:

1. **Dual-read / preflight.** Пока IndexedDB не содержит завершённого migration marker, новый клиент читает legacy-ключи, валидирует и строит кандидат snapshot. Не пишет в legacy и не начинает обычные commits.
2. **Migration staging.** Поддерживаемая операция создаёт в IndexedDB staging и journal с исходной legacy inventory/hash и состоянием `applying`. Legacy остаётся неизменённым.
3. **First commit / completion.** Копирование домена, `meta.revision`, `meta.schemaVersion` и отметка завершения фиксируются как одна IndexedDB-транзакция; `completed` ставится только по событию transaction complete. При abort IndexedDB остаётся без завершённой миграции, legacy — источник для retry.
4. **Recovery.** При незавершённом journal новый клиент проверяет его версию/hash и либо повторяет безопасную миграцию из неизменённого legacy, либо отказывает в записи и сохраняет обе версии как конфликт. Нельзя считать отсутствующий journal эквивалентом пустых пользовательских данных.
5. **Старый клиент / dual-version.** Legacy сохраняется как snapshot, но новый клиент не может полагаться на него как на rollback-копию после начала обычных записей в IndexedDB. Старый клиент способен продолжить запись в legacy. До реализации обязателен fence: либо старый клиент надёжно блокируется от записи/переводится в read-only до переключения, либо новая версия при обнаруженной legacy-дельте останавливает изменения и предлагает явное восстановление/слияние. Неизвестная или необнаружимая legacy-дельта блокирует cutover; молча продолжать запрещено.
6. **Snapshot retention/removal.** Срок хранения и условие удаления остаются открытыми (§22); автоматическое удаление запрещено до отдельного решения владельца.

Откат:

- До первого успешного доменного commit после миграции можно заново прочитать неизменённый legacy и повторить/отменить миграцию.
- После доменных commits legacy snapshot может быть устаревшим; «переключить флаг назад» без сравнения и явного восстановления нельзя.
- Частичная миграция: `migration=applying` → recovery только по проверенным staging/journal/hash; иначе отказ и сохранение исходников, слепое дописывание запрещено.
- Ни один шаг не удаляет legacy-ключи автоматически.

---

## 15. PWA version compatibility

- Окончательная политика `autoUpdate` — открытое решение (§22); эта Proposed-модель не разрешает незаметно перезапускать/переключать клиент во время migration.
- Одновременная работа старого и нового клиента должна быть безопасно обработана, а не предполагаться безопасной.
- Предлагается version-gate: `meta.schemaVersion` + `meta.minClientVersion`; несовместимый клиент переходит в read-only и сообщает о необходимости обновить/перезагрузить приложение. Сам gate требует кооперации старых клиентов либо обнаружения их записи.
- Незавершённый журнал миграции при старте → recovery, затем явное сообщение «перезагрузите, чтобы завершить».
- Сервис-воркер не должен кешировать промежуточное состояние: данные живут только в IDB, не в Cache Storage.
- Acceptance: сценарий «вкладка A обновилась, вкладка B на старом коде» должен заканчиваться предсказуемо, без потери данных.

---

## 16. Supabase Sync boundary

- Sync — **предложение вынести в отдельный контракт**, не принятое решение владельца.
- Если sync останется вне реализации T1, будущий `syncAll` должен читать snapshot и применять локальный результат через commit. Это не защищает сервер от lost update.
- Локальный commit не зависит от сети и не должен падать при недоступном Supabase.
- Payload не меняется: ревизия устройства в него не добавляется.
- Серверная защита от lost update (CAS/RPC/колонка ревизии) требует отдельного ADR, аудита фактической схемы и RLS, миграции.
- До этого изменения sync нельзя описывать как «защищённый от потери данных».

---

## 17. Security and privacy

- Доменный store не содержит: API-ключей, sync `code`, anon key, токенов, cookies.
- Секреты остаются в существующих ключах настроек и **не** попадают в backup, CoffeeJSON, Vision Bench export и domain snapshot.
- Экспорт домена — только пользовательские данные.
- Логи не содержат заметок, фото, ключей, полных payload.
- Vision Bench фото не уходят в облачный sync.
- Отсутствие аккаунта/выход не удаляют локальную лабораторию; удаление данных — только явное действие пользователя.

---

## 18. Failure semantics

| Ситуация | Поведение контракта | Что видит пользователь |
|---|---|---|
| Quota exceeded | commit `{ok:false,'quota'}`; состояние не меняется | «не сохранено» + действие (повторить/экспорт) |
| Abort транзакции | `{ok:false,'aborted'}` | то же |
| Revision drift | commit не применён; durable conflict создан только если обе версии успешно записаны | конфликт явно обозначен; UX остаётся открытым |
| Прерывание между секциями restore | journal `applying`; recovery при следующем старте | после перезагрузки — завершено или конфликт |
| Повреждённый журнал/staging | остановить commit; не перезаписывать текущее состояние snapshot-ом вслепую; сохранить доступные версии для восстановления | явное сообщение о recovery/конфликте |
| Несовместимая версия | read-only | просьба обновить/перезагрузить |
| Нет Web Locks | поведение не утверждено; операция не должна начинать небезопасную multi-step запись | понятный отказ только после решения о fallback/refusal |
| Ошибка записи настроек | ошибка возвращается вызывающему | не «сохранено» |

Никакой путь не должен возвращать `void` при возможности ошибки.

---

## 19. Browser support and Web Locks findings

**Подтверждённые сведения из документации (не тестирование устройств):**

| Источник | Данные |
|---|---|
| MDN Web Locks API | Baseline «Widely available»; доступно только в secure context; работает в Workers; блокировки именованы и координируют совместимые контексты одного storage bucket; lifecycle описан API-спецификацией |
| MDN BCD (`api.LockManager`) | Desktop Chrome 69, Firefox 96, Safari 15.4; Chromium-family Edge mirror. Chrome Android и Safari iOS — BCD mirror от основного движка, не отдельное измерение установленной PWA |
| WebKit blog «New WebKit Features in Safari 15.4» (14.03.2022) | Web Locks API добавлен в Safari 15.4 / iOS 15.4 / iPadOS 15.4 |
| W3C Web Locks Editor’s Draft (12 Nov 2026), §§2.2, 2.6, 6.2 | lock manager связывается со storage bucket; при завершении документа/agent lock/request освобождается/прерывается; private session считается отдельным user agent. Это draft и не проверка конкретного браузера |

**Выводы:**

- MDN BCD указывает первые поддерживаемые версии Chrome 69, Firefox 96 и Safari 15.4. Это desktop browser data; Android/iOS mirror — не отдельное тестирование PWA. Минимальные версии не являются матрицей поддержки BrewMate.
- Secure context обязателен: production HTTPS и loopback localhost являются secure contexts; file:// не рассматривается как целевая среда приложения.
- Спецификация описывает отпускание блокировки при завершении документа/agent; это освобождает lock, но не гарантирует завершение/rollback бизнес-операции. Проверены только страницы в Chrome 152 по данным results.md; другие устройства не проверялись.
- W3C draft §6.2 указывает, что private session изолирована от обычного профиля; это не говорит, что приватная сессия обязательно имеет стабильное/долговечное IndexedDB-хранилище.
- Safari/iOS standalone PWA: официальные сведения подтверждают наличие API в Safari/iOS начиная с 15.4, но sharing lock manager между установленной PWA и Safari-вкладками того же origin, а также поведение при обновлении не подтверждены.

**Рекомендация (не решение):**

- Web Locks могут использоваться для сериализации import/restore/migration только после подтверждения целевой матрицы и lock-scope. Они не заменяют revision/OCC и не защищают от writers, не соблюдающих контракт.
- Обычные commit работают на OCC и не требуют блокировки.
- Поведение при отсутствии API пока не выбрано. Рекомендация для рассмотрения: отказ только от multi-step операции, если все обычные commits защищены OCC; иначе не запускать операцию и не обещать безопасность.
- Открытые проверки до реализации: реальные поддерживаемые версии desktop Chromium/Firefox/Safari, Chrome Android, Safari iOS и установленной PWA; same-origin tab/PWA lock sharing; close/crash; приватный режим; IDB доступность/срок хранения. На сегодня проверки реальных устройств не выполнялись.

---

## 20. Testing strategy

**Unit (Vitest, без браузера):**

- commit: успех, drift, quota, abort, tombstone в той же транзакции;
- journal state machine: staged → applying → completed / conflict_pending / rolled-back;
- recovery на каждом переходе;
- миграция: dual-read, частичная миграция, откат;
- конфликты: сохранение обеих версий, разрешение, идемпотентность.

**Integration (Vitest + фейковый store):**

- import/backup v1/CoffeeJSON round-trip;
- sync merge поверх commit;
- batch-import Vision Bench.

**Browser (реальный IndexedDB):**

- две вкладки: конкурентный commit, drift, отсутствие потери;
- закрытие вкладки на каждом checkpoint;
- quota/abort;
- recovery после перезапуска;
- миграция и rollback;
- старая/новая версия одновременно.

**Manual QA:**

- установленная PWA на iOS и Android;
- приватный режим;
- реальные объёмы журнала;
- отсутствие Web Locks (эмуляция/старый браузер).

Требование: тесты прототипа (`node --test`) не должны попадать в `vitest run` — см. §21.

---

## 21. Alternatives considered

| Вариант | Причина отказа |
|---|---|
| Оставить 9 `localStorage`-ключей + журнал | атомарность между ключами невозможна; требование §8 невыполнимо |
| Один `localStorage`-документ вместо 9 ключей | атомарность достижима, но лимит ~5 МБ и полная перезапись домена; квота — уже подтверждённая причина сбоев |
| IndexedDB без ревизии | не обнаруживает lost update |
| OCC без журнала | нет recovery после прерывания |
| Журнал без staging | невозможно отличить «не начали» от «начали и упали» |
| Самодельный lease/TTL вместо Web Locks | часы, paused tabs, ложные истечения; прототип подтвердил риск |
| CRDT/совместное редактирование | избыточно для local-first однопользовательского приложения |
| Сервер как источник истины | противоречит local-first и офлайну |
| Размещение прототипных тестов с суффиксом `.test.mjs` внутри репозитория | Vitest default include их обнаруживает; несовместимость с `node:test` требует отдельной проверки/изоляции до публикации; утверждение о падении CI без запуска — ожидаемый риск, не подтверждённый результат |

---

## 22. Risks and open decisions

**Открытые решения (не утверждены):**

1. Финальный UX разрешения конфликтов (неблокирующий — рекомендация, не решение).
2. Срок жизни legacy-снапшота и правило его удаления.
3. Механизм обнаружения записи старого клиента после миграции.
4. Политика PWA `autoUpdate`/prompt и требуемый version-gate.
5. Судьба конфликтов по `PhotoGrindProfile` без стабильного `id`.
6. Правило объединения `benchmarkRuns` при импорте Vision Bench.
7. Контракт Supabase Sync (отдельный ADR).
8. Поведение на платформах без Web Locks: отказ, безопасный fallback или ограничение поддерживаемой матрицы.
9. Видимость состояния во время multi-transaction restore: стабильный base snapshot либо read refusal/`recovery_pending`.
10. Механизм fence для старых клиентов: блокировка legacy writes или надёжное обнаружение каждой legacy-дельты.
11. Допустимый объём и схема транзакции первоначального копирования доменных коллекций.

**Риски:**

- iOS eviction, приватный режим и durable-хранение IDB не проверены на целевых устройствах.
- Двухверсионная работа PWA может приводить к записи в legacy после миграции.
- Производительность IDB на больших журналах (кривые весов) не измерялась.
- Перенос данных — операция с риском потери; обязателен план отката и ручная проверка на реальных данных.
- Публикация эксперимента может быть ошибочно воспринята как принятая реализация — нужен явный дисклеймер.
- В репозитории нет ADR-каталога и `docs/module-map.md`; ссылки на карту модулей в этом ADR не добавляются.

---

## 23. Migration phases

1. **Phase 0 — уточнение контракта.** Решить блокирующие пункты §22: visibility restore, conflict persistence, lock scope, legacy fence и rollback.
2. **Phase 1 — исправление ложного успеха.** Отдельный PR; ошибки локальной записи должны быть видны. Этап не делает multi-key writes атомарными и не заменяет IndexedDB.
3. **Phase 2 — IndexedDB migration.** Dual-read, staging/journal и first commit. До cutover старый клиент должен быть fenced от legacy-write либо новая версия обязана надёжно обнаруживать каждую такую запись. Если fence не доказан — cutover запрещён. Legacy не удалять.
4. **Phase 3 — PersistenceStore/OCC.** Перевести все доменные writers, revision checks, conflict capture и read visibility на утверждённый контракт; обычный commit — одна транзакция.
5. **Phase 4 — multi-step import/restore/recovery.** Web Locks policy только после платформенного исследования; без принятого поведения при отсутствии API операцию не начинать.
6. **Phase 5 — Vision Bench batch import** отдельной транзакцией в существующей базе; version-gate PWA — по отдельному решению.
7. **Phase 6 — удаление legacy snapshot** отдельным решением владельца после критериев стабильности.
8. **Phase 7 — Sync contract**, только если владелец утвердит этот отдельный scope.

Порядок: legacy fence и rollback утверждаются до cutover; multi-step операции выпускаются после OCC/read visibility и решения Web Locks.

---

## 24. Acceptance criteria

ADR считается принятым, когда:

1. Владелец принял §5; по каждому пункту §22 записано решение: принято, отложено или исключено.
2. Контракт (§7–10) однозначно задаёт revision scope, OCC, conflict persistence, staging/recovery и границы одной IDB-транзакции.
3. Migration plan запрещает cutover, пока legacy writer fence/delta detection не доказан; legacy данные не удаляются автоматически.
4. Для quota, abort, drift, повреждённого journal, crash на каждом checkpoint и отсутствия Web Locks указаны наблюдаемый результат и тест §20.
5. Sync и Vision Bench scope разделены: Sync остаётся open; Vision Bench batch-import входит в принятый scope, но DB transaction boundary описана.
6. Unit/integration/browser/manual тестовые уровни связаны с критериями §20; автоматическая проверка включает markdown links и согласованность ссылок на исходники.
7. Diff содержит только ADR и необходимые документационные метаданные; runtime/config/tests/dependencies не изменены.

Будущая реализация принимается только при выполнении:

- автоматический поиск по всем runtime writers показывает отсутствие обхода `PersistenceStore`;
- fault-injection tests доказывают all-or-nothing для каждой отдельной IDB-транзакции при quota/abort;
- two-context OCC test подтверждает, что stale revision не перезаписывает данные и conflict record durable только после успешной записи обеих версий;
- импорт с invalid input не открывает apply phase; crash каждого checkpoint завершается проверенным recovery или безопасным read/write refusal;
- backup v1 и CoffeeJSON имеют round-trip fixtures; export test проверяет отсутствие секретных полей по schema/allowlist;
- `npm run lint`, `npm test`, `npm run build` и все браузерные сценарии §20 имеют зафиксированные результаты; ручные проверки отдельно помечены.

---

## Ссылки на доказательства

- `src/storage.ts:10-49` — ключи и `save*`.
- `src/App.tsx:53-74,112-116` — writers и `onMerged`.
- `src/storageError.ts:23-31` — `safeWrite`.
- `src/sync/sync.ts:21-33` — read-modify-write без CAS.
- `src/sync/merge.ts:61-127` — merge/tombstones/payload.
- `src/backup.ts:9-16` — backup v1.
- `src/ai/visionBenchStore.ts:37-98,130-174` — отдельная IDB и импорт (сверено по актуальному файлу).
- `src/VisionBench.tsx:181-182` — цикл записи при импорте.
- `vite.config.ts:9` — `autoUpdate`.
- `node_modules/vitest` defaults — `**/*.{test,spec}.?(c|m)[jt]s?(x)`.
- `experiments/adr-t0-t1-prototype/results.md` — результаты эксперимента (не runtime).
