# AI-компаньон BrewMate с контекстом

*   **Author:** h0wller
*   **Status:** Draft
*   **Date:** 2026-11-23

--------------------------------------------------------------------------------

## Overview

BrewMate — PWA для кофейных рецептов, таймера, профиля зерна, каппинга, BLE-весов и AI-рецептов по фото пачки. Приложение работает офлайн: данные в localStorage, синхронизация через Supabase по общему коду. AI сегодня умеет разбирать фото пачки (серверный прокси с лимитами или свой ключ) и чат-компаньон работает только при наличии своего ключа.

Цель: превратить существующий плавающий чат-компаньон в главную отличительную черту продукта — AI-компаньон с контекстом, которого нет у конкурентов (timerCoffee, CoffeeOS, Brewfolio, CoffeeMaster, Beansy). Компаньон подсказывает рецепт по зерну, даёт советы по экстракции из журнала, помогает калибровать кофемолку, объясняет термины. Приоритет — энтузиасты (начинающие бариста и любители); функционал для профессионалов обязателен: каппинг SCA/CoE, TDS/экстракция, калибровка кофемолки, настройка воды. Офлайн-работа обязательна, бюджета нет, сроки размыты, цель — монетизация и первый продукт профессионального бариста.

## The Problem

Конкуренты (timerCoffee, CoffeeOS, Brewfolio, CoffeeMaster, Beansy) не имеют компаньона с контекстом. Пользователь, особенно новичок, не понимает, что делать с рецептом, зерном, помолом. Существующий компаньон BrewMate работает только со своим ключом OpenAI-совместимой модели и не знает контекста экрана. Без ключа отвечает «Добавь свой ключ», что отпугивает новичков. Детерминированные рекомендации по зерну/помолу уже есть в `beans/engine.ts` и `grinders/`, но не связаны с компаньоном.

## Goals

*   Контекстный компаньон: знает текущий рецепт/зерно/запись журнала и отвечает с учётом этого.
*   Три сценария: рецепт по зерну, совет по экстракции из журнала, объяснение термина.
*   Детерминированный слой (глоссарий + движок рекомендаций) работает офлайн и без ключа.
*   Опциональный AI-слой (свой ключ) для развёрнутых ответов.
*   Уровень знаний влияет на глубину ответа.
*   Функционал профи (каппинг, TDS/экстракция, калибровка, вода) доступен и объясним.

## Non-Goals

*   RAG по каталогу кофемолок, память между сессиями, агенты с инструментами.
*   Перевод «клики одной кофемолки → другой» (сознательно нет).
*   Гарантированный расчёт TDS без рефрактометра.
*   Реклама в таймере, жёсткий paywall базовых функций.
*   Синхронизация истории чата.
*   Двуязычность ru/en (следующая итерация после стабилизации).
*   Серверная проверка Pro-статуса (до реальной монетизации достаточно локального флага).

## Open Questions

*   **Question 1**: Нужен ли серверный бесплатный чат (задача `chat` в `/api/vision`) — главный блокер для пользователей без ключа. Решение: да, вторым этапом после детерминированного слоя.
*   **Question 2**: Как считать лимиты компаньона — общий лимит на пользователя сначала, раздельный учёт позже при нагрузке.
*   **Question 3**: Формат ответа компаньона — текст vs структурированные карточки (влияет на UX и токены).
*   **Question 4**: Нужна ли проверка Pro-статуса на сервере до добавления безлимитного чата — отложено до реальной монетизации.

## Critical User Journeys (CUJs)

### CUJ 1: Новичок варит первую чашку

*   **Given**: Пользователь впервые открыл приложение, уровень знаний «новичок».
*   **When**: Создаёт рецепт, не понимает поле «доза».
*   **Then**: Нажимает «?» рядом с полем, читает пояснение из глоссария; компаньон предлагает рецепт по умолчанию.

### CUJ 2: Любитель получает совет по экстракции

*   **Given**: Пользователь завершил заваривание, запись в журнале.
*   **When**: Открывает компаньона, спрашивает «почему кисло?».
*   **Then**: Компаньон видит контекст записи (оценка, зерно) и даёт совет (увеличить температуру/помол мельче) из детерминированного слоя или AI.

### CUJ 3: Профессионал калибрует кофемолку

*   **Given**: Профессионал выбрал зерно и метод.
*   **When**: Открывает настройки кофемолки.
*   **Then**: Видит рекомендацию помола из каталога (≈ ориентир), может переопределить; компаньон объясняет ограничения (перевод кликов между кофемолками не поддерживается).

--------------------------------------------------------------------------------


## Risks & Mitigations

*   **Provider outage:** all AI calls go through Gemini/Groq/OpenRouter; if all are down, companion degrades to deterministic layer (glossary + recommendations) without error. Mitigation: cooldown per provider, fallback to next, user-facing message "AI временно недоступен".
*   **Prompt injection:** free-form `message`/`context` from the client are treated as data in a fixed system prompt; max lengths enforced; no tool execution. Mitigation: `ChatRequest` validation, allow-list of characters, tests for oversized/malformed input.
*   **Quota abuse:** IP-based limits (10/day user, 500/day global) with Upstash Redis for shared counters; in-memory fallback. Mitigation: origin check, content-length cap, separate counter namespace for chat vs. photo recognition.
*   **Offline fallback:** deterministic layer works without network; AI calls fail gracefully with cached last answer or "нет сети" message.
*   **Data privacy:** context includes recipe/bean/journal data only; never sync chat history; level stored locally and non-synced.
*   **False precision:** TDS/extraction are estimates without refractometer; UI labels them as estimates.

## Technical Plan (Architecture)

Архитектура: детерминированный слой (глоссарий + движок рекомендаций) работает офлайн без сети; опциональный AI-слой вызывает askChat со своим ключом или серверный /api/vision (задача chat). Контекст собирается в companion/context.ts из текущего маршрута и выбранного рецепта/зерна/записи. Сценарии — в companion/scenarios/*.ts. UI — тонкий компонент Companion.tsx.

Поток данных:
  Экран (маршрут) -> companion/context.ts (строка контекста)
    -> Companion.tsx (сообщение пользователя)
    -> scenarios/*.ts (детерминированный ответ, если есть данные)
    -> если нет данных и есть ключ/квота -> askChat (свой ключ) или /api/vision task=chat (сервер)
    -> ответ в чат

Компоненты:
- src/companion/context.ts — сборка контекста по маршруту (вынести из App.tsx). `buildContext(route, recipes, beans, logs): string`, где `route` — union-тип `Route` из `src/route.ts`; при отсутствии сущности возвращает пустую строку; формат: «Рецепт: …», «Зерно: …», «Запись: …».
- src/companion/scenarios/recipeFromBean.ts — рецепт по зерну (детерминированный, из beans/engine.ts).
- src/companion/scenarios/extractionAdvice.ts — совет по экстракции (детерминированный + опциональный LLM).
- src/companion/scenarios/termExplain.ts — объяснение термина (глоссарий, офлайн).
- src/companion/Companion.tsx — UI (плавающая кнопка + панель чата). Переключатель сценариев: три кнопки-чипа («Рецепт по зерну», «Совет по экстракции», «Объяснить термин»), состояние `scenario` в useState; при выборе сценария отправляется предзаполненный вопрос; доступно с клавиатуры (role=button, Enter/Space).
- src/ai/client.ts — askChat (уже есть), добавить askCompanion для серверного пути (переиспользовать parseProxyResponse).
- server/vision.ts — добавить task: 'chat' в validateRequest и handle, с лимитами и жёстким системным промптом. `ChatRequest = { task: 'chat'; message: string (1..500 символов, без управляющих); context?: string (<=500) }`. Валидация: длина, допустимые символы (без `\n` в message — заменять на пробел), отклонение при превышении. Тесты в vision.test.ts.
- src/companion/level.ts — ключ brewmate.skillLevel.v1 (уже есть, хранится напрямую в localStorage; src/storage.ts его не использует). brewmate.companionHistory — НЕ синхронизировать.

Миграции: localStorage-ключи с суффиксом .v1; при чтении — дефолты для новых полей. Синхронизация через Supabase хранит весь дамп в jsonb; новые поля появляются как undefined у старых клиентов — merge с дефолтами в src/sync/merge.ts.

Non-functional: офлайн — детерминированный слой работает без сети; AI-слой деградирует gracefully. Токены — жёсткий системный промпт, урезанный контекст (только текущий рецепт/зерно). Лимиты — общий на пользователя сначала.

--------------------------------------------------------------------------------


## Alternatives Considered

### Alternative A: Полноценный AI-чат с историей и RAG

*   **Pros**: Максимальная гибкость, персонализация, «умный» компаньон.
*   **Cons**: Бюджет 0, неподдерживаемо, риск галлюцинаций по рецептам, сложность.
*   **Reason for Rejection**: Rejected by author: детерминированный слой покрывает ~80% ценности; RAG/память/агенты отложены.

### Alternative B: Только детерминированные подсказки без LLM

*   **Pros**: Работает офлайн, бесплатно, просто.
*   **Cons**: Не даёт «совета по экстракции» по конкретному завариванию; не отличается от статичного FAQ; конкурентное преимущество теряется.
*   **Reason for Rejection**: Rejected by author: нужен опциональный AI-слой для развёрнутых ответов.

### Alternative C: Свой ключ обязателен для всех

*   **Pros**: Нет серверных затрат, простая архитектура.
*   **Cons**: Большинство пользователей не настроит ключ; компаньон бесполезен.
*   **Reason for Rejection**: Rejected by author: нужен серверный путь с лимитами (как для фото пачки).

### Alternative D: Синхронизация истории чата

*   **Pros**: Контекст между устройствами.
*   **Cons**: Большой объём, личные данные, не нужен для монетизации.
*   **Reason for Rejection**: Rejected by author: история чата остаётся локальной.

--------------------------------------------------------------------------------


## Detailed Implementation Plan

### Target Files to Create/Modify

#### 1. `src/companion/context.ts` (Create)

*   **Type / Scope**: TypeScript module
*   **Proposed Changes**: Вынести сборку контекста из App.tsx: функция buildContext(route, recipes, beans, logs) -> string. Возвращает «Рецепт: …», «Зерно: …», «Запись в журнале, оценка …» или ''.

#### 2. `src/companion/scenarios/recipeFromBean.ts` (Create)

*   **Type / Scope**: TypeScript module
*   **Proposed Changes**: Детерминированный сценарий: по BeanProfile + MethodKey + доза -> Recipe (через beans/engine.ts recommend + recipeFromBean). Без LLM.

#### 3. `src/companion/scenarios/extractionAdvice.ts` (Create)

*   **Type / Scope**: TypeScript module
*   **Proposed Changes**: Совет по экстракции: по BrewLog (оценка, зерно) -> текст рекомендации (увеличить температуру/помол мельче и т.п.) детерминированно; опционально LLM для развёрнутого совета.

#### 4. `src/companion/scenarios/termExplain.ts` (Create)

*   **Type / Scope**: TypeScript module
*   **Proposed Changes**: Объяснение термина из глоссария (findTerm). Офлайн.

#### 5. `src/companion/Companion.tsx` (Modify)

*   **Type / Scope**: React component
*   **Proposed Changes**: Принимать context prop; показывать «Я вижу: …»; для безключевого режима — детерминированные ответы + CTA. Добавить переключатель сценариев.

#### 6. `src/App.tsx` (Modify)

*   **Type / Scope**: React component
*   **Proposed Changes**: Использовать buildContext из companion/context.ts вместо инлайн-логики. Передавать context в Companion.

#### 7. `src/ai/client.ts` (Modify)

*   **Type / Scope**: TypeScript module
*   **Proposed Changes**: Добавить askCompanion(cfg, messages) для серверного пути (fetch /api/vision task=chat). При отсутствии ключа — null.

#### 8. `server/vision.ts` (Modify)

*   **Type / Scope**: Serverless function
*   **Proposed Changes**: Добавить task: 'chat' в validateRequest; принимать message (строка, до 500 символов) и context (строка, до 500 символов). Вызывать провайдера с жёстким системным промптом. Возвращать { result: { reply } }. Лимиты — общий на пользователя.

#### 9. `src/companion/glossary.ts` (Modify)

*   **Type / Scope**: TypeScript module
*   **Proposed Changes**: Расширить термины (настройка воды, помол, экстракция, TDS). Добавить поле level (beginner/pro) для глубины пояснения.

#### 10. `src/index.css` (Modify)

*   **Type / Scope**: CSS
*   **Proposed Changes**: Стили для индикации контекста в панели компаньона.

### Verification Plan

*   **Compilation/Build**: npm run build
*   **Unit Tests**: npm test (новые тесты для companion/context.ts, scenarios/*.ts)
*   **Static Analysis & Linting**: npm run lint
*   **Test Coverage Requirement**: покрытие детерминированного слоя (context, scenarios)
*   **E2E/Integration**: ручная проверка офлайн (detached network) — компаньон отвечает из глоссария/движка

--------------------------------------------------------------------------------

*Drafted with EGM*

### Legend of Code Types

*   `MethodKey`, `WaterKey`, `RoastLevel` — из `src/beans/engine.ts`.
*   `BeanProfile`, `Recipe`, `BrewLog`, `GrinderProfile` — из `src/types.ts`.
*   `Route` — из `src/route.ts`.

### Verification & Success Criteria

*   **Build**: `npm run build` проходит на Windows и Linux.
*   **Tests**: `npm test` зелёный; новые тесты для `context.ts` и `scenarios/*.ts`.
*   **Offline**: детерминированный слой отвечает без сети (глоссарий + рекомендации).
*   **Latency**: детерминированный ответ < 50 мс; AI-ответ < 10 с.
*   **Coverage**: 100% детерминированного слоя покрыто тестами.
*   **Fallback rate**: при отсутствии ключа/сети 100% запросов получают детерминированный ответ или понятное сообщение.
