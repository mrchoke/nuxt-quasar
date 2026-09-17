import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { categorizeImports } from '../src/imports'
import { generateTemplateShims } from '../src/template/shims'
import type { ModuleContext } from '../src/types'

const IDENTIFIER_RE = /^[A-Z_$][\w$]*$/i

/** Minimal subset of Quasar's import map shape, including >= 2.26 hydration fixtures. */
const fixtureImportMap: Record<string, string> = {
  'QAjaxBar': 'src/components/ajax-bar/QAjaxBar.js',
  'QAjaxBar.hydration.fixtures': 'src/components/ajax-bar/QAjaxBar.hydration.fixtures.js',
  'QBtn': 'src/components/btn/QBtn.js',
  'QBtn.hydration.fixtures': 'src/components/btn/QBtn.hydration.fixtures.js',
  'QBtnTester': 'src/components/btn/__tests__/QBtn.test.js',
  'ClosePopup': 'src/directives/close-popup/ClosePopup.js',
  'ClosePopup.hydration.fixtures': 'src/directives/close-popup/ClosePopup.hydration.fixtures.js',
  'Dark': 'src/plugins/dark/Dark.js',
  'Dark.auto.hydration.fixtures': 'src/plugins/dark/Dark.auto.hydration.fixtures.js',
  'useQuasar': 'src/composables/use-quasar/use-quasar.js',
}

function mockContext(imports: ModuleContext['imports']): Omit<ModuleContext, 'mode'> {
  return {
    ssr: true,
    dev: true,
    imports,
    options: { appConfigKey: 'nuxtQuasar' },
    quasarVersion: '2.32.3',
    sassVersion: null,
    resolveLocal: path => path,
    resolveQuasar: path => path,
    resolveQuasarExtras: path => path,
  }
}

describe('categorizeImports', () => {
  const imports = categorizeImports(fixtureImportMap, path => path)

  it('drops non-identifier keys (Quasar >= 2.26 hydration fixtures)', () => {
    expect(Object.keys(imports.raw)).not.toContain('QBtn.hydration.fixtures')

    const names = [
      ...imports.components,
      ...imports.composables,
      ...imports.directives,
      ...imports.plugins,
    ].map(entry => entry.name)

    expect(names.length).toBeGreaterThan(0)
    for (const name of names) {
      expect(name).toMatch(IDENTIFIER_RE)
    }
  })

  it('keeps real components, directives, plugins and composables', () => {
    expect(imports.components.map(c => c.name)).toEqual(['QAjaxBar', 'QBtn'])
    expect(imports.composables.map(c => c.name)).toEqual(['useQuasar'])
    expect(imports.directives.map(d => d.kebabCase)).toEqual(['close-popup'])
    expect(imports.plugins.map(p => p.name)).toEqual(['Dark'])
  })

  it('classifies only real imports from the installed quasar import map', () => {
    return readFile(
      new URL('../node_modules/quasar/dist/transforms/import-map.json', import.meta.url),
      'utf-8',
    ).then((contents) => {
      const realImports = categorizeImports(JSON.parse(contents) as Record<string, string>, path => path)

      const names = [
        ...realImports.components,
        ...realImports.composables,
        ...realImports.directives,
        ...realImports.plugins,
      ].map(entry => entry.name)

      expect(names.length).toBeGreaterThan(0)
      for (const name of names) {
        expect(name).toMatch(IDENTIFIER_RE)
      }
    })
  })

  it('emits only valid quasar.shims.d.ts members', async () => {
    const shims = await generateTemplateShims(mockContext(imports))

    const memberNames = [...shims.matchAll(/^ {4}(\S+?)\?: PickOptionalProps/gm)].map(match => match[1]!)

    expect(memberNames).toEqual(['QAjaxBar', 'QBtn'])
    expect(shims).not.toContain('hydration')
    for (const name of memberNames) {
      expect(name).toMatch(IDENTIFIER_RE)
    }
  })
})
