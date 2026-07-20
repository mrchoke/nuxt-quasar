declare module '@quasar/extras/animate/animate-list.mjs' {
  import type { QuasarGeneralAnimations, QuasarInAnimations, QuasarOutAnimations } from 'quasar'

  export const generalAnimations: QuasarGeneralAnimations[]
  export const inAnimations: QuasarInAnimations[]
  export const outAnimations: QuasarOutAnimations[]
}

declare module '@quasar/extras/animate/animate-list.common' {
  import type { QuasarGeneralAnimations, QuasarInAnimations, QuasarOutAnimations } from 'quasar'

  export const generalAnimations: QuasarGeneralAnimations[]
  export const inAnimations: QuasarInAnimations[]
  export const outAnimations: QuasarOutAnimations[]
}

declare module '#build/quasar.config.mjs' {
  import type { QuasarIconSet, QuasarLanguage, QuasarUIConfiguration } from 'quasar'

  export const componentsWithDefaults: string[]
  export const pluginNames: string[]

  export const quasarNuxtConfig: {
    lang?: QuasarLanguage
    iconSet: QuasarIconSet
    config?: QuasarUIConfiguration
    components: { defaults?: Record<string, Record<string, unknown>> }
    plugins: string[]
  }

  export const appConfigKey: string
}

declare module 'quasar/src/composables/use-quasar.js' {
  import type { QVueGlobals } from 'quasar'

  const useQuasar: () => QVueGlobals
  export = useQuasar
}

declare module 'quasar/src/vue-plugin.js' {
  import type { Plugin } from 'vue'

  const Quasar: Plugin
  export = Quasar
}
