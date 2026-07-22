import QuasarModule from '../../../src/module'

export default defineNuxtConfig({
  modules: [
    QuasarModule,
  ],
  // @ts-ignore Local module option augmentation resolves at prepare/build time.
  quasar: {
    components: {
      defaults: {
        QBtn: {
          color: 'primary',
          label: 'Default',
        },
      },
    },
  },
})
