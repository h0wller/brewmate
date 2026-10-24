/* Каталог кофемолок: реестр CoffeeJSON (CC0-1.0) + модели из BrewMark и DiFluid CoffeeOS. */

export interface CatalogGrinder {
  id: string          // slug (kebab-case)
  label: string
  aliases?: string[]
  builtIn?: string
}

export const CATALOG_SOURCE = {
  name: 'CoffeeJSON gear registry + BrewMark + CoffeeOS',
  license: 'CC0-1.0',
  commit: 'b7a4c4cdbf32150fbde2e109f2989eb4e61d5275',
}

export const CATALOG: CatalogGrinder[] = [
  // --- 1Zpresso ---
  { id: '1zpresso-j', label: '1Zpresso J' },
  { id: '1zpresso-j-max', label: '1Zpresso J-Max' },
  { id: '1zpresso-j-ultra', label: '1Zpresso J-Ultra' },
  { id: '1zpresso-jx', label: '1Zpresso JX' },
  { id: '1zpresso-jx-pro', label: '1Zpresso JX-Pro' },
  { id: '1zpresso-k-max', label: '1Zpresso K-Max', aliases: ['1zpresso-k-plus'] },
  { id: '1zpresso-k-ultra', label: '1Zpresso K-Ultra' },
  { id: '1zpresso-q2', label: '1Zpresso Q2', aliases: ['1zpresso-q-air'] },
  { id: '1zpresso-x-pro', label: '1Zpresso X-Pro' },
  { id: '1zpresso-x-ultra', label: '1Zpresso X-Ultra' },
  { id: '1zpresso-zp6', label: '1Zpresso ZP6', aliases: ['1zpresso-zp6-special'] },

  // --- Baratza ---
  { id: 'baratza-encore', label: 'Baratza Encore' },
  { id: 'baratza-encore-esp', label: 'Baratza Encore ESP' },
  { id: 'baratza-forte-bg', label: 'Baratza Forté BG', aliases: ['baratza-forte-ap'] },
  { id: 'baratza-sette-270', label: 'Baratza Sette 270', aliases: ['baratza-270', 'baratza-sette-270wi'] },
  { id: 'baratza-sette-30', label: 'Baratza Sette 30' },
  { id: 'baratza-vario-plus', label: 'Baratza Vario+', aliases: ['baratza-vario'] },
  { id: 'baratza-virtuoso-plus', label: 'Baratza Virtuoso+' },

  // --- Breville / Sage ---
  { id: 'breville-barista-express', label: 'Breville Barista Express', aliases: ['sage-barista-express'], builtIn: 'espresso-machine' },
  { id: 'breville-barista-express-impress', label: 'Breville Barista Express Impress', builtIn: 'espresso-machine' },
  { id: 'breville-barista-pro', label: 'Breville Barista Pro', aliases: ['breville-barista-touch-impress'], builtIn: 'espresso-machine' },
  { id: 'breville-dose-control-pro', label: 'Breville Dose Control Pro' },
  { id: 'breville-smart-grinder-pro', label: 'Breville Smart Grinder Pro', aliases: ['sage-smart-grinder-pro'] },

  // --- Ceado / Cuisinart / DeLonghi ---
  { id: 'ceado-e37s', label: 'Ceado E37S' },
  { id: 'ceado-e5p', label: 'Ceado E5P' },
  { id: 'cuisinart-dbm-8', label: 'Cuisinart DBM-8 Supreme' },
  { id: 'delonghi-kg79', label: 'DeLonghi KG79 / KG89' },
  { id: 'delonghi-dedica-kg521', label: 'DeLonghi Dedica KG521.M' },

  // --- Comandante ---
  { id: 'comandante-c40', label: 'Comandante C40', aliases: ['comandante-c40-mk4', 'comandante-c40-mk3'] },
  { id: 'comandante-c60', label: 'Comandante C60 Baracuda' },
  { id: 'comandante-x25', label: 'Comandante X25 Trailmaster' },

  // --- DF / Turin / MiiCoffee ---
  { id: 'df54', label: 'DF54', aliases: ['turin-df54'] },
  { id: 'df64', label: 'DF64', aliases: ['turin-df64', 'miicoffee-df64', 'df64-v2'] },
  { id: 'df64-gen-2', label: 'DF64 Gen 2', aliases: ['turin-df64-gen-2'] },
  { id: 'df64v', label: 'DF64V' },
  { id: 'df83', label: 'DF83 V2', aliases: ['turin-df83-v2', 'df83v'] },

  // --- Eureka ---
  { id: 'eureka-atom-75', label: 'Eureka Atom 75' },
  { id: 'eureka-drogheria', label: 'Eureka Drogheria MCD4' },
  { id: 'eureka-mignon-crono', label: 'Eureka Mignon Crono / Filtro' },
  { id: 'eureka-mignon-libra', label: 'Eureka Mignon Libra' },
  { id: 'eureka-mignon-silenzio', label: 'Eureka Mignon Silenzio' },
  { id: 'eureka-mignon-single-dose', label: 'Eureka Mignon Single Dose', aliases: ['eureka-oro-single-dose'] },
  { id: 'eureka-mignon-specialita', label: 'Eureka Mignon Specialità', aliases: ['eureka-specialita'] },
  { id: 'eureka-mignon-zero', label: 'Eureka Mignon Zero' },
  { id: 'eureka-oro-mignon-xl', label: 'Eureka Oro Mignon XL' },

  // --- Fellow ---
  { id: 'fellow-espresso-series-1', label: 'Fellow Espresso Series 1', builtIn: 'espresso-machine' },
  { id: 'fellow-ode', label: 'Fellow Ode', aliases: ['fellow-ode-gen-1'] },
  { id: 'fellow-ode-gen-2', label: 'Fellow Ode Gen 2' },
  { id: 'fellow-ode-ssp', label: 'Fellow Ode (SSP MP Burrs)' },
  { id: 'fellow-opus', label: 'Fellow Opus' },

  // --- Fiorenzato / Femobook ---
  { id: 'fiorenzato-allground', label: 'Fiorenzato AllGround' },
  { id: 'femobook-a68', label: 'Femobook A68' },

  // --- Hario / Porlex / JavaPresse ---
  { id: 'hario-mini-mill-plus', label: 'Hario Mini Mill Slim+' },
  { id: 'hario-skerton-pro', label: 'Hario Skerton Pro' },
  { id: 'javapresse-manual', label: 'JavaPresse Manual Burr Grinder' },
  { id: 'porlex-mini-ii', label: 'Porlex Mini II / Tall II' },

  // --- Kafatek ---
  { id: 'kafatek-monolith-conical', label: 'Kafatek Monolith Conical' },
  { id: 'kafatek-monolith-flat-max', label: 'Kafatek Monolith Flat Max' },

  // --- KINGrinder ---
  { id: 'kingrinder-k0', label: 'KINGrinder K0' },
  { id: 'kingrinder-k2', label: 'KINGrinder K2' },
  { id: 'kingrinder-k4', label: 'KINGrinder K4' },
  { id: 'kingrinder-k6', label: 'KINGrinder K6' },
  { id: 'kingrinder-p0', label: 'KINGrinder P0 / P2' },

  // --- Kinu ---
  { id: 'kinu-m47', label: 'Kinu M47', aliases: ['kinu-m47-classic', 'kinu-m47-phoenix', 'kinu-m47-simplicity'] },

  // --- Lagom / Option-O ---
  { id: 'option-o-lagom-01', label: 'Option-O Lagom 01', aliases: ['lagom-01'] },
  { id: 'option-o-lagom-casa', label: 'Option-O Lagom Casa' },
  { id: 'option-o-lagom-mini', label: 'Option-O Lagom Mini', aliases: ['lagom-mini'] },
  { id: 'option-o-lagom-p64', label: 'Option-O Lagom P64', aliases: ['lagom-p64'] },
  { id: 'option-o-lagom-p100', label: 'Option-O Lagom P100', aliases: ['lagom-p100'] },

  // --- Mahlkönig ---
  { id: 'mahlkonig-e65s', label: 'Mahlkönig E65S / GBW' },
  { id: 'mahlkonig-e80', label: 'Mahlkönig E80' },
  { id: 'mahlkonig-ek43', label: 'Mahlkönig EK43', aliases: ['mahlkonig-ek43-s'] },
  { id: 'mahlkonig-guatemala', label: 'Mahlkönig Guatemala' },
  { id: 'mahlkonig-x54', label: 'Mahlkönig X54' },

  // --- Mazzer ---
  { id: 'mazzer-mini', label: 'Mazzer Mini' },
  { id: 'mazzer-philos', label: 'Mazzer Philos' },
  { id: 'mazzer-super-jolly', label: 'Mazzer Super Jolly' },
  { id: 'mazzer-zm', label: 'Mazzer ZM' },

  // --- Niche ---
  { id: 'niche-duo', label: 'Niche Duo' },
  { id: 'niche-zero', label: 'Niche Zero' },

  // --- OXO / Rancilio / Wilfa ---
  { id: 'oxo-brew-conical', label: 'OXO Brew Conical Burr' },
  { id: 'rancilio-rocky', label: 'Rancilio Rocky' },
  { id: 'wilfa-svart', label: 'Wilfa Svart Aroma' },
  { id: 'wilfa-uniform', label: 'Wilfa Uniform' },

  // --- Timemore ---
  { id: 'timemore-chestnut-c2', label: 'Timemore Chestnut C2', aliases: ['timemore-c2', 'timemore-c2-max'] },
  { id: 'timemore-c3', label: 'Timemore C3', aliases: ['timemore-c3s', 'timemore-c3-pro'] },
  { id: 'timemore-c3-esp', label: 'Timemore Chestnut C3 ESP / ESP Pro' },
  { id: 'timemore-chestnut-s3', label: 'Timemore Chestnut S3' },
  { id: 'timemore-chestnut-x', label: 'Timemore Chestnut X' },
  { id: 'timemore-sculptor-064', label: 'Timemore Sculptor 064 / 064S' },
  { id: 'timemore-sculptor-078', label: 'Timemore Sculptor 078', aliases: ['timemore-078'] },
  { id: 'timemore-sculptor-078s', label: 'Timemore Sculptor 078S', aliases: ['timemore-078s'] },

  // --- Varia / Weber / xBloom / Zerno ---
  { id: 'varia-vs3', label: 'Varia VS3', aliases: ['varia-vs3-gen-2'] },
  { id: 'varia-vs6', label: 'Varia VS6' },
  { id: 'weber-eg-1', label: 'Weber EG-1' },
  { id: 'weber-hg-2', label: 'Weber HG-2' },
  { id: 'weber-key', label: 'Weber Key' },
  { id: 'xbloom-studio', label: 'xBloom Studio', builtIn: 'pour-over-machine' },
  { id: 'zerno-z1', label: 'Zerno Z1' },
]
