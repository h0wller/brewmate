# Factory Grinder Presets, Water Tuning & Precision Clicks (CoffeeOS / Brewmark Flow)

Comprehensive enhancement to coffee brewing recommendations: adds factory preset scales for 37 popular grinders, fractional click interpolation based on bean attributes and brew method, water chemistry profiling (soft, balanced SCA, hard), AI package scan water awareness, and factory presets auto-fill with Comandante Red Clix support.

### User Review & Critical Decisions

> [!IMPORTANT]
> The following user preferences were confirmed during clarification:
> - **Fill with factory defaults button**: Overwrites all 7 grind levels with factory preset values, allowing users to quickly baseline their calibration and tweak individual steps.
> - **Comandante Red Clix accessory**: Dedicated toggle for `comandante-c40` that doubles click values across both dynamic calculation and preset autofill.

---

## 1. Overview & Core Concept

- **What It Does**: Bridges the gap between abstract grind sizes (`medium_fine`, `coarse`) and real physical grinder settings (clicks, numbers, divisions). When viewing a coffee bean or scanning a bag, the app immediately recommends exact clicks for the user's specific grinder, factoring in roast degree, processing method, resting time, brewing device, and water hardness.
- **Target Audience / Persona**: Filter coffee enthusiasts, baristas, and home brewers using precision hand or electric grinders (Comandante, Timemore, 1Zpresso, Fellow, Baratza, DF64, Niche, Kingrinder, etc.).
- **Key Value**: Eliminates manual guesswork and conversion tables. One photo or bean card provides exact clicks, brewing ratio, temperature, and bloom timing.

---

## 2. User Experience & Visual Design

### Key User Flows

```
┌─────────────────┐       ┌─────────────────┐       ┌──────────────────┐
│  Bean Screen    │ ───>  │  Grinder Setup  │ ───>  │  Brewing Timer   │
│  (BeanView.tsx) │       │ (GrinderSettings│       │  & Recipe Log    │
└────────┬────────┘       └─────────────────┘       └──────────────────┘
         │
         ├── 1. Photo of bean / bag (AI vision with water context)
         ├── 2. Grinder model & instant click calculation
         ├── 3. Brew method selector (V60, French, Aeropress, etc.)
         └── 4. Water profile toggle (💧 Soft, ⚖️ SCA Balanced, 🪨 Hard)
```

1. **Quick Grinder & Water Setup on Bean Screen**:
   - The user selects or views their active grinder in a compact card.
   - Water chips (`💧 Мягкая`, `⚖️ Баланс (SCA)`, `🪨 Жёсткая`) allow 1-tap switching.
   - The recommendation hero displays exact calculated clicks (e.g. `22 кл. · Comandante C40`), water temperature, and ratio.
2. **AI Package Recipe Integration**:
   - Taking a photo of a coffee bag passes the chosen water profile into the vision prompt, tailoring recipe extraction and bloom parameters.
   - Generated recipes receive exact clicks calculated from the recognized bean parameters.
3. **Grinder Calibration Screen (`GrinderSettings.tsx`)**:
   - Shows a "Заполнить заводскими настройками" action when a supported grinder is chosen.
   - For Comandante C40, presents a "Red Clix" toggle (2x clicks).
   - Allows users to freely adjust any individual level.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Continuous Interpolation vs. Discrete Sizes**
  - *Chosen Approach*: `presetSettingByCoarseness(grinderId, coarseness, redClix)` continuously interpolates between the 7 discrete scale points using fractional coarseness ($0..6$).
  - *Why*: Allows subtle bean nudges (e.g. $+0.3$ for light roast, $-0.2$ for soft water) to shift clicks by $1\text{–}2$ clicks on grinders like Comandante C40 or 1Zpresso, providing true micro-adjustments.
  - *Alternatives Considered*: Snapping to the nearest discrete level would ignore fine-grained bean adjustments.

- **Decision 2: Backward Compatibility with Existing Tests**
  - *Chosen Approach*: `water` parameter in `recommend()` defaults to `'balanced'`. `settingFor(profile, size)` remains unchanged for manual overrides, while `smartSettingFor(profile, size, coarseness)` handles the preset fallback and interpolation.
  - *Why*: All existing tests in `src/grinders/grind.test.ts` and `src/beans/engine.test.ts` pass without regressions.

---

## 4. Technical Architecture & Component Mapping

```
┌──────────────────────────────────────────────────────────┐
│                      src/types.ts                        │
│  GrinderProfile { grinder, calibration, redClix? }       │
└────────────────────────────┬─────────────────────────────┘
                             │
     ┌───────────────────────┴───────────────────────┐
     ▼                                               ▼
┌───────────────────────────┐         ┌───────────────────────────┐
│  src/grinders/presets.ts  │         │   src/beans/engine.ts     │
│  - 37 GRINDER_PRESETS     │         │  - WaterKey & WATER_PROFILES
│  - presetSettingByCoarseness        │  - recommend(bean, m, water)
│  - Red Clix 2x support    │         │  - Anaerobic & water nudges
└─────────────┬─────────────┘         └─────────────┬─────────────┘
              │                                     │
              ▼                                     ▼
┌───────────────────────────┐         ┌───────────────────────────┐
│  src/grinders/profile.ts  │         │    src/ai/client.ts       │
│  - smartSettingFor()      │         │  - buildPackagePrompt()   │
│  - grindFor()             │         │    with waterLabel hint   │
└─────────────┬─────────────┘         └─────────────┬─────────────┘
              │                                     │
              └───────────────┬─────────────────────┘
                              ▼
        ┌───────────────────────────────────────────┐
        │             src/BeanView.tsx              │
        │  Interactive multi-step flow & click rec  │
        │                                           │
        │         src/GrinderSettings.tsx           │
        │  "Заполнить заводскими" + Red Clix toggle │
        └───────────────────────────────────────────┘
```

### Planned File Changes

1. **`src/types.ts`**:
   - Add optional `redClix?: boolean` to `GrinderProfile`.
2. **`src/grinders/presets.ts`** *(New)*:
   - Define `GRINDER_PRESETS` for 37 models from `catalog.generated.ts`.
   - Provide `presetSettingByCoarseness` and `presetSettingForSize` with `redClix` scaling.
3. **`src/grinders/profile.ts`**:
   - Implement `smartSettingFor(profile, size, coarseness)` and update `grindFor`.
   - Preserve existing `settingFor` contract.
4. **`src/beans/engine.ts`**:
   - Add `WaterKey` ('balanced', 'soft', 'hard') and `WATER_PROFILES`.
   - Update `recommend` to adjust coarseness, temperature, and ratio based on water and anaerobic fermentation.
5. **`src/ai/client.ts`**:
   - Accept optional `waterLabel` in `buildPackagePrompt`.
6. **`src/BeanView.tsx`**:
   - Add water profile selector chips, grinder status card, real-time click calculation, and AI prompt water integration.
7. **`src/GrinderSettings.tsx`**:
   - Add "Заполнить заводскими настройками" button.
   - Add "Red Clix" toggle for Comandante C40.
8. **Tests & Validation**:
   - Run `npm test` and `npm run lint` to guarantee complete test passage.
