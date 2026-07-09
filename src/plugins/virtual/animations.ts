import { readFile } from 'node:fs/promises'
import type { QuasarGeneralAnimations, QuasarInAnimations, QuasarOutAnimations } from 'quasar'
import type { Plugin as VitePlugin } from 'vite'
import { quasarAnimationsPath } from '../../constants'
import type { ModuleContext } from '../../types'
import { uniq } from '../../utils'

// Add css suffix so loaded string can be interpreted as a css file
const RESOLVED_ID = '\0/__quasar/animations.css'
const RESOLVED_ID_WITH_QUERY_RE = /([/\\])__quasar\1animations\.css(\?.*)?$/

interface AnimateListModule {
  generalAnimations: QuasarGeneralAnimations[]
  inAnimations: QuasarInAnimations[]
  outAnimations: QuasarOutAnimations[]
}

type ErrorWithCode = Error & { code?: string }

async function importAnimateList (): Promise<AnimateListModule> {
  const specifiers = [
    '@quasar/extras/animate/animate-list.common',
    '@quasar/extras/animate/animate-list.mjs',
  ]

  let lastError: unknown
  for (const specifier of specifiers) {
    try {
      return await import(specifier) as AnimateListModule
    }
    catch (error) {
      if (isModuleNotFoundError(error)) {
        lastError = error
        continue
      }
      throw error
    }
  }

  throw lastError ?? new Error('Unable to resolve animation list from @quasar/extras')
}

async function readAnimationCss (animation: string, resolveQuasarExtras: ModuleContext['resolveQuasarExtras']): Promise<string> {
  const cssPaths = [
    resolveQuasarExtras(`animate/${animation}.css`),
    resolveQuasarExtras(`exports/animate/${animation}.css`),
  ]

  let lastError: unknown
  for (const path of cssPaths) {
    try {
      return await readFile(path, 'utf8')
    }
    catch (error) {
      if (isFileNotFoundError(error)) {
        lastError = error
        continue
      }
      throw error
    }
  }

  throw lastError ?? new Error(`Unable to resolve css for animation "${animation}" from @quasar/extras`)
}

function isModuleNotFoundError (error: unknown): error is ErrorWithCode {
  return error instanceof Error
    && ((error as ErrorWithCode).code === 'ERR_MODULE_NOT_FOUND' || error.message.includes('Cannot find module'))
}

function isFileNotFoundError (error: unknown): error is ErrorWithCode {
  return error instanceof Error && (error as ErrorWithCode).code === 'ENOENT'
}

export function virtualAnimationsPlugin ({ options, resolveQuasarExtras }: ModuleContext): VitePlugin {
  return {
    name: 'quasar:animations',

    resolveId (id) {
      if (id.match(RESOLVED_ID_WITH_QUERY_RE))
        return id

      const [path] = id.split('?')
      if (path === quasarAnimationsPath)
        return RESOLVED_ID
    },

    async load (id) {
      if (!RESOLVED_ID_WITH_QUERY_RE.test(id))
        return

      let animations = options.extras?.animations || []
      if (animations === 'all') {
        const { generalAnimations, inAnimations, outAnimations } = await importAnimateList()
        animations = [...generalAnimations, ...inAnimations, ...outAnimations]
      }
      else {
        animations = uniq(animations)
      }

      const cssArray = await Promise.all(
        animations.map(animation =>
          readAnimationCss(animation, resolveQuasarExtras),
        ),
      )
      return cssArray.join('\n')
    },
  }
}
