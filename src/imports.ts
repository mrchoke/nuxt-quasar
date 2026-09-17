import type { QuasarImportData, QuasarImports, ResolveFn } from './types'
import { kebabCase } from './utils'

/**
 * Quasar >= 2.26 ships test-only hydration fixtures inside `dist/transforms/import-map.json`
 * (for example `QBtn.hydration.fixtures`).
 *
 * Such keys are neither valid identifiers nor real public exports, so they cannot be used for
 * component registration, auto-imports, the virtual entry or the generated `quasar.shims.d.ts`.
 * Filtering here keeps every downstream consumer (types and runtime) consistent.
 */
const VALID_IDENTIFIER_RE = /^[A-Z_$][\w$]*$/i

export function categorizeImports(importMap: Record<string, string>, quasarResolve: ResolveFn): QuasarImports {
  const entries = Object.entries(importMap).filter(([name]) => VALID_IDENTIFIER_RE.test(name))

  const imports: QuasarImports = {
    raw: Object.fromEntries(entries),
    components: [],
    composables: [],
    directives: [],
    plugins: [],
  }

  for (const [name, path] of entries) {
    const importData: QuasarImportData = {
      name,
      path: quasarResolve(path),
    }
    if (path.includes('/components/') && !path.includes('/__tests__/')) {
      imports.components.push(importData)
    }
    else if (path.includes('/composables/')) {
      imports.composables.push(importData)
    }
    else if (path.includes('/directives/')) {
      imports.directives.push({
        ...importData,
        kebabCase: kebabCase(name),
      })
    }
    else if (path.includes('/plugins/')) {
      imports.plugins.push(importData)
    }
  }

  return imports
}
