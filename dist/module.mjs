import { useNuxt, logger, defineNuxtModule, createResolver, resolvePath, addPlugin, addTemplate, addTypeTemplate, addComponent, addImports, addImportsSources } from '@nuxt/kit';
import { parseNodeModulePath } from 'mlly';
import path, { dirname, resolve } from 'node:path';
import MagicString from 'magic-string';
import os from 'node:os';
import { readFile } from 'node:fs/promises';
import pMemoize from 'p-memoize';
import semver from 'semver';

const version = "3.0.6";

const directivesRegExp = /(?<=[ (])_?resolveDirective\(\s*["']([^'"]*)["'][^)]*\)/g;
function transformDirectivesPlugin(context) {
  const { sourcemap } = useNuxt().options;
  return {
    name: "quasar:directive",
    enforce: "post",
    transform(code, id) {
      const [filename] = id.split("?", 2);
      if (!filename || !filename.endsWith(".vue"))
        return null;
      const s = new MagicString(code);
      const directives = [];
      let counter = 0;
      s.replace(directivesRegExp, (full, name) => {
        const directive = context.imports.directives.find((d) => d.kebabCase === name);
        if (directive) {
          const alias = `__q_directive_${counter++}`;
          directives.push({
            name: directive.name,
            alias
          });
          return alias;
        } else {
          return full;
        }
      });
      if (directives.length) {
        s.prepend(
          `${directives.map((d) => `import { ${d.name} as ${d.alias} } from "quasar"`).join("\n")}
`
        );
      }
      if (s.hasChanged()) {
        return {
          code: s.toString(),
          map: sourcemap[context.mode] ? s.generateMap({ source: id, includeContent: true }) : void 0
        };
      }
    }
  };
}

const isWindows = os.platform() === "win32";
function slash(p) {
  return p.replace(/\\/g, "/");
}
function normalizePath(id) {
  return path.posix.normalize(isWindows ? slash(id) : id);
}
const readFileMemoized = pMemoize(async (path2) => {
  return readFile(path2, "utf-8");
});
const readJSON = pMemoize(async (path2) => {
  return JSON.parse(await readFile(path2, "utf-8"));
});
const PASCAL_CASE = /[a-z][A-Z]|^[A-Z]/g;
function kebabCase(string) {
  return string.replaceAll(
    PASCAL_CASE,
    (match) => match.length === 1 ? match[0].toLowerCase() : `${match[0]}-${match[1].toLowerCase()}`
  );
}
function hasKeys(object) {
  return Object.keys(object || {}).length > 0;
}
function parseVueRequest(id) {
  const [filename = "", rawQuery] = id.split("?", 2);
  const query = Object.fromEntries(new URLSearchParams(rawQuery));
  if (query.vue != null) {
    query.vue = true;
  }
  return {
    filename,
    query
  };
}
function uniq(arr) {
  return [...new Set(arr)];
}

function transformScssPlugin({ options }) {
  const sassVariables = typeof options.sassVariables === "string" ? normalizePath(options.sassVariables) : options.sassVariables;
  const scssTransform = createScssTransform("scss", sassVariables);
  const sassTransform = createScssTransform("sass", sassVariables);
  return {
    name: "quasar:scss",
    enforce: "pre",
    transform(src, id) {
      const { filename, query } = parseVueRequest(id);
      let code;
      if (query.vue && query.type === "style") {
        const lang = Object.keys(query).find((k) => k.startsWith("lang."));
        if (lang?.endsWith(".scss")) {
          code = scssTransform(src);
        } else if (lang?.endsWith(".sass")) {
          code = sassTransform(src);
        }
      }
      if (!query.vue) {
        if (filename.endsWith(".scss")) {
          code = scssTransform(src);
        } else if (filename.endsWith(".sass")) {
          code = sassTransform(src);
        }
      }
      if (code) {
        return { code, map: null };
      }
    }
  };
}
function createScssTransform(fileExtension, sassVariables) {
  return (content) => {
    const hasQuasarVariables = content.includes("quasar/src/css/variables") || content.includes("quasar/dist/") || /@use\s+['"]quasar(?:[/'"]|$)/.test(content);
    const sassUseStatements = [];
    if (hasQuasarVariables) {
      return content;
    } else if (typeof sassVariables === "string") {
      sassUseStatements.push(`@use '${sassVariables}' as *`);
    } else {
      sassUseStatements.push("@use 'quasar/src/css/variables.sass' as *");
    }
    sassUseStatements.push("");
    const prefix = fileExtension === "sass" ? sassUseStatements.join("\n") : sassUseStatements.join(";\n");
    const useIndex = Math.max(content.lastIndexOf("@use "), content.lastIndexOf("@forward "));
    if (useIndex === -1) {
      return prefix + content;
    }
    const newLineIndex = content.indexOf("\n", useIndex);
    if (newLineIndex !== -1) {
      const index = newLineIndex + 1;
      return content.substring(0, index) + prefix + content.substring(index);
    }
    return `${content}
${prefix}`;
  };
}

const moduleName = "nuxt-quasar-ui";
const quasarFontsPath = "quasar/fonts";
const quasarAnimationsPath = "quasar/animations";
const quasarIconsPath = "quasar/icons";
const quasarCssPath = "quasar/css";
const quasarBrandPath = "quasar/brand";

const RESOLVED_ID$1 = "\0/__quasar/animations.css";
const RESOLVED_ID_WITH_QUERY_RE$1 = /([/\\])__quasar\1animations\.css(\?.*)?$/;
async function importAnimateList() {
  const specifiers = [
    "@quasar/extras/animate/animate-list.common",
    "@quasar/extras/animate/animate-list.mjs",
    "@quasar/extras/exports/animate/animate-list.js"
  ];
  let lastError;
  for (const specifier of specifiers) {
    try {
      const module = await import(specifier);
      const candidate = isAnimateListModule(module) ? module : module.default;
      if (candidate && isAnimateListModule(candidate)) {
        return candidate;
      }
      throw new Error(`Invalid animation list module shape from ${specifier}`);
    } catch (error) {
      if (isModuleNotFoundError(error)) {
        lastError = error;
        continue;
      }
      throw error;
    }
  }
  throw lastError ?? new Error("Unable to resolve animation list from @quasar/extras");
}
async function readAnimationCss(animation, resolveQuasarExtras) {
  const cssPaths = [
    resolveQuasarExtras(`animate/${animation}.css`),
    resolveQuasarExtras(`exports/animate/${animation}.css`)
  ];
  let lastError;
  for (const path of cssPaths) {
    try {
      return await readFile(path, "utf8");
    } catch (error) {
      if (isFileNotFoundError$1(error)) {
        lastError = error;
        continue;
      }
      throw error;
    }
  }
  throw lastError ?? new Error(`Unable to resolve css for animation "${animation}" from @quasar/extras`);
}
function isModuleNotFoundError(error) {
  return error instanceof Error && (error.code === "ERR_MODULE_NOT_FOUND" || error.message.includes("Cannot find module"));
}
function isAnimateListModule(module) {
  const value = module;
  return Array.isArray(value?.generalAnimations) && Array.isArray(value?.inAnimations) && Array.isArray(value?.outAnimations);
}
function isFileNotFoundError$1(error) {
  return error instanceof Error && error.code === "ENOENT";
}
function virtualAnimationsPlugin({ options, resolveQuasarExtras }) {
  return {
    name: "quasar:animations",
    resolveId(id) {
      if (id.match(RESOLVED_ID_WITH_QUERY_RE$1))
        return id;
      const [path] = id.split("?");
      if (path === quasarAnimationsPath)
        return RESOLVED_ID$1;
    },
    async load(id) {
      if (!RESOLVED_ID_WITH_QUERY_RE$1.test(id))
        return;
      let animations = options.extras?.animations || [];
      if (animations === "all") {
        const { generalAnimations, inAnimations, outAnimations } = await importAnimateList();
        animations = [...generalAnimations, ...inAnimations, ...outAnimations];
      } else {
        animations = uniq(animations);
      }
      const cssArray = await Promise.all(
        animations.map(
          (animation) => readAnimationCss(animation, resolveQuasarExtras)
        )
      );
      return cssArray.join("\n");
    }
  };
}

const RESOLVED_ID = "\0/__quasar/brand.css";
const RESOLVED_ID_WITH_QUERY_RE = /([/\\])__quasar\1brand\.css(\?.*)?$/;
function virtualBrandPlugin(context) {
  return {
    name: "quasar:brand",
    resolveId(id) {
      if (id.match(RESOLVED_ID_WITH_QUERY_RE))
        return id;
      const [path] = id.split("?");
      if (path === quasarBrandPath)
        return RESOLVED_ID;
    },
    load(id) {
      if (RESOLVED_ID_WITH_QUERY_RE.test(id))
        return [
          ":root {",
          ...Object.entries(context.options.config?.brand || {}).map(([name, color]) => `  --q-${name}: ${color};`),
          "}"
        ].join("\n");
    }
  };
}

const QUASAR_ENTRY = "quasar";
const QUASAR_VIRTUAL_ENTRY = "\0/__quasar/entry.mjs";
function virtualQuasarEntryPlugin(context) {
  const { resolveQuasar, quasarVersion } = context;
  const quasarGte216 = semver.gte(quasarVersion, "2.16.0");
  const clientEntry = quasarGte216 ? resolveQuasar("dist/quasar.client.js") : resolveQuasar("dist/quasar.esm.js");
  const serverEntry = quasarGte216 ? resolveQuasar("dist/quasar.server.prod.js") : resolveQuasar("src/index.ssr.js");
  return {
    name: "quasar:entry",
    enforce: "pre",
    config(config) {
      config.ssr ??= {};
      config.ssr.noExternal ??= [];
      if (config.ssr.noExternal !== true) {
        config.ssr.noExternal = toArray(config.ssr.noExternal);
        config.ssr.noExternal.push(/\/node_modules\/quasar\/src\//);
      }
    },
    resolveId(id, _importer, options) {
      const isSsrResolve = options?.ssr === true;
      if (context.mode === "server" && !isSsrResolve) {
        return;
      }
      if (context.mode === "client" && isSsrResolve) {
        return;
      }
      if (context.mode === "server" && isQuasarClientEntryId(id)) {
        return {
          id: serverEntry,
          moduleSideEffects: false
        };
      }
      if (id === QUASAR_ENTRY) {
        return {
          id: context.dev ? context.mode === "client" ? clientEntry : serverEntry : QUASAR_VIRTUAL_ENTRY,
          moduleSideEffects: false
        };
      }
    },
    async load(id) {
      if (!context.dev && id === QUASAR_VIRTUAL_ENTRY)
        return Object.entries(context.imports.raw).filter(([, path]) => !path.includes("/__tests__/")).map(([name, path]) => `export { default as ${name} } from "quasar/${path}"`).join("\n");
    }
  };
}
function toArray(value) {
  return Array.isArray(value) ? value : [value];
}
function isQuasarClientEntryId(id) {
  return id === "quasar/dist/quasar.client.js" || id === "quasar/dist/quasar.client.prod.js" || id.endsWith("/quasar/dist/quasar.client.js") || id.endsWith("/quasar/dist/quasar.client.prod.js");
}

function setupCss(css, options) {
  const brand = options.config?.brand || {};
  if (css.includes(quasarBrandPath)) {
    logger.warn('Re-ordering "quasar/brand" is deprecated. In a future version, brand variables will always be defined in body tag.');
  }
  if (!css.includes(quasarBrandPath) && Object.keys(brand).length) {
    css.unshift(quasarBrandPath);
  }
  const quasarCss = [
    typeof options.sassVariables === "string" ? "quasar/dist/quasar.sass" : "quasar/dist/quasar.css"
  ];
  if (options.cssAddon) {
    quasarCss.push("quasar/dist/quasar.addon.css");
  }
  const index = css.indexOf(quasarCssPath);
  if (index !== -1) {
    css.splice(index, 1, ...quasarCss);
  } else {
    css.unshift(...quasarCss);
  }
  const animations = options.extras?.animations || [];
  if (!css.includes(quasarAnimationsPath) && animations.length) {
    css.unshift(quasarAnimationsPath);
  }
  if (options.extras?.fontIcons) {
    const i = css.indexOf(quasarIconsPath);
    if (i !== -1) {
      css.splice(i, 1, ...uniq(options.extras.fontIcons).map(resolveFontIcon));
    } else {
      css.unshift(...uniq(options.extras.fontIcons).map(resolveFontIcon));
    }
  }
  if (options.extras?.font) {
    const i = css.indexOf(quasarFontsPath);
    if (i !== -1) {
      css.splice(i, 1, resolveFont(options.extras.font));
    } else {
      css.unshift(resolveFont(options.extras.font));
    }
  }
  return css;
}
function resolveFontIcon(icon) {
  return `@quasar/extras/${icon}/${icon}.css`;
}
function resolveFont(font) {
  return `@quasar/extras/${font}/${font}.css`;
}

function when(condition, content) {
  return condition ? typeof content === "function" ? content() : content : "";
}
function generateTemplateQuasarConfig(context) {
  const plugins = uniq(context.options.plugins || []);
  const { config, lang, iconSet, components } = context.options;
  const componentsWithDefaults = Object.entries(components?.defaults || {}).filter(([_, props]) => hasKeys(props)).map(([name]) => name);
  const ext = semver.gte(context.quasarVersion, "2.16.0") ? ".js" : ".mjs";
  return `${when(lang, () => `import lang from "quasar/lang/${lang}${ext}"`)}
${when(typeof iconSet === "string", () => `import iconSet from "quasar/icon-set/${iconSet}${ext}"`)}

export const pluginNames = ${JSON.stringify(plugins)}

export const componentsWithDefaults = ${JSON.stringify(componentsWithDefaults)}

export const appConfigKey = ${JSON.stringify(context.options.appConfigKey)}

export const quasarNuxtConfig = {
  ${when(lang, "lang,")}
  ${typeof iconSet === "string" ? "iconSet" : `iconSet: ${iconSet ? JSON.stringify(iconSet) : '"material-icons"'}`},
  components: ${JSON.stringify(components || {})},
  plugins: pluginNames,
  ${when(config, () => `config: ${JSON.stringify(config)}`)}
}`;
}

async function generateTemplateShims(context) {
  const componentNames = context.imports.components.map((c) => c.name);
  return `type KeysMatching<T, V> = {
  [K in keyof T]-?: T[K] extends V ? K : never
}[keyof T] & keyof T

type OptionalKeys<T extends object> = Exclude<{
  [K in keyof T]: T extends Record<K, T[K]> ? never : K
}[keyof T], undefined>

type OmitMatching<T extends object, V> = Omit<T, KeysMatching<T, V>>

type OmitFnProps<T extends object> = OmitMatching<T, ((...args: any[]) => any) | undefined>

type PickOptionalProps<T extends object> = Pick<T, OptionalKeys<T>>

declare module '${moduleName}' {
  interface QuasarComponentDefaults {
${componentNames.map(
    (name) => `    ${name}?: PickOptionalProps<OmitFnProps<import("quasar").${name}Props>>`
  ).join("\n")}
  }
}

declare module '@nuxt/schema' {
  interface AppConfigInput {
    [${JSON.stringify(context.options.appConfigKey)}]?: import("nuxt-quasar-ui").QuasarUIConfiguration
  }
  interface AppConfig {
    [${JSON.stringify(context.options.appConfigKey)}]?: import("nuxt-quasar-ui").QuasarUIConfiguration
  }
}

export {}
`;
}

const module$1 = defineNuxtModule({
  meta: {
    name: "quasar",
    version,
    configKey: "quasar",
    compatibility: {
      nuxt: ">=3.0.0"
    }
  },
  defaults: {
    lang: "en-US",
    iconSet: "material-icons",
    autoIncludeIconSet: true,
    cssAddon: false,
    sassVariables: false,
    appConfigKey: "nuxtQuasar",
    components: {
      defaults: {},
      autoImport: true
    },
    plugins: [],
    extras: {}
  },
  async setup(options, nuxt) {
    const { resolve: resolveLocal } = createResolver(import.meta.url);
    const { resolve: resolveQuasar } = createResolver(dirname(await resolvePath("quasar/package.json")));
    const { resolve: resolveQuasarExtras } = createResolver(dirname(await resolvePath("@quasar/extras/package.json")));
    const { version: quasarVersion } = await readJSON(resolveQuasar("package.json"));
    const importMap = await readJSON(resolveQuasar("dist/transforms/import-map.json"));
    const transformAssetUrls = await readJSON(resolveQuasar("dist/transforms/loader-asset-urls.json"));
    const imports = categorizeImports(importMap, resolveQuasar);
    const sassVersion = await getSassVersion();
    const baseContext = {
      ssr: nuxt.options.ssr,
      dev: nuxt.options.dev,
      imports,
      options,
      quasarVersion,
      sassVersion,
      resolveLocal,
      resolveQuasar,
      resolveQuasarExtras
    };
    if (options.autoIncludeIconSet && typeof options.iconSet === "string" && isFontIconSet(options.iconSet) && !options.extras?.fontIcons?.includes(options.iconSet)) {
      options.extras ??= {};
      options.extras.fontIcons ??= [];
      options.extras.fontIcons.push(options.iconSet);
    }
    setupCss(nuxt.options.css, options);
    addPlugin(resolveLocal("./runtime/plugin"));
    addTemplate({
      write: true,
      filename: "quasar.config.mjs",
      getContents: () => generateTemplateQuasarConfig(baseContext)
    });
    addTypeTemplate({
      filename: "quasar.shims.d.ts",
      getContents: () => generateTemplateShims(baseContext)
    });
    if (options.components?.autoImport !== false) {
      for (const component of imports.components) {
        addComponent({
          name: component.name,
          export: component.name,
          filePath: "quasar",
          // TOFIX: Nuxt v3.13.2 tries to resolve full component paths with following PR: https://github.com/nuxt/nuxt/pull/28843
          // Since this module has a custom way of resolving quasar, this breaks things.
          // Adding this property prevents nuxt from resolving components, but since this is an internal property, it might break again in future.
          // @ts-expect-error untyped internal property
          _scanned: true
        });
      }
    }
    if (nuxt.options.imports.autoImport !== false) {
      const ignoredComposables = ["useId", "useHydration"];
      for (const composable of imports.composables.filter((c) => !ignoredComposables.includes(c.name))) {
        addImports({
          name: composable.name,
          from: "quasar"
        });
      }
      if (options.plugins) {
        for (const plugin of uniq(options.plugins)) {
          const pluginPath = imports.plugins.find((p) => p.name === plugin)?.path;
          if (pluginPath) {
            addImports({
              name: plugin,
              from: "quasar"
            });
          }
        }
      }
      if (options.extras?.svgIcons) {
        for (const iconSet of uniq(options.extras.svgIcons)) {
          const icons = await getIconsFromIconset(iconSet, resolveQuasarExtras);
          addImportsSources({
            from: `@quasar/extras/${iconSet}`,
            imports: icons
          });
        }
      }
    }
    nuxt.hook("prepare:types", ({ references }) => {
      references.unshift({ types: "quasar" });
    });
    nuxt.hook("vite:extendConfig", (config, { isClient, isServer }) => {
      const ssr = nuxt.options.ssr;
      const context = {
        ...baseContext,
        mode: isServer ? "server" : "client"
      };
      config.optimizeDeps ??= {};
      config.optimizeDeps.exclude ??= [];
      config.optimizeDeps.exclude.push("quasar");
      config.vue ??= {};
      config.vue.template ??= {};
      if (config.vue.template.transformAssetUrls !== false) {
        config.vue.template.transformAssetUrls ??= {};
        config.vue.template.transformAssetUrls = {
          ...config.vue.template.transformAssetUrls,
          ...transformAssetUrls
        };
      }
      config.define = {
        ...config.define,
        __QUASAR_VERSION__: `'${quasarVersion}'`,
        __QUASAR_SSR__: ssr,
        __QUASAR_SSR_SERVER__: ssr && isServer,
        __QUASAR_SSR_CLIENT__: ssr && isClient,
        __QUASAR_SSR_PWA__: false
      };
      config.plugins ??= [];
      config.plugins.push(
        virtualAnimationsPlugin(context),
        virtualBrandPlugin(context),
        transformDirectivesPlugin(context),
        virtualQuasarEntryPlugin(context)
      );
      if (options.sassVariables) {
        config.plugins.push(transformScssPlugin(context));
      }
    });
    nuxt.hook("nitro:config", async (config) => {
      config.replace = {
        ...config.replace,
        __QUASAR_VERSION__: `'${quasarVersion}'`,
        __QUASAR_SSR__: nuxt.options.ssr,
        __QUASAR_SSR_SERVER__: true,
        __QUASAR_SSR_CLIENT__: false,
        __QUASAR_SSR_PWA__: false
      };
      config.externals ??= {};
      config.externals.inline ??= [];
      config.externals.inline.push("quasar");
    });
    nuxt.hook("devtools:customTabs", (tabs) => {
      tabs.push({
        name: "quasar",
        title: "Quasar",
        icon: "vscode-icons-file-type-light-quasar",
        view: {
          type: "iframe",
          src: "https://quasar.dev/vue-components"
        }
      });
    });
  }
});
function isFontIconSet(iconSet) {
  return !iconSet.startsWith("svg-");
}
function categorizeImports(importMap, quasarResolve) {
  const imports = {
    raw: importMap,
    components: [],
    composables: [],
    directives: [],
    plugins: []
  };
  for (const [name, path] of Object.entries(importMap)) {
    const importData = {
      name,
      path: quasarResolve(path)
    };
    if (path.includes("/components/") && !path.includes("/__tests__/")) {
      imports.components.push(importData);
    } else if (path.includes("/composables/")) {
      imports.composables.push(importData);
    } else if (path.includes("/directives/")) {
      imports.directives.push({
        ...importData,
        kebabCase: kebabCase(name)
      });
    } else if (path.includes("/plugins/")) {
      imports.plugins.push(importData);
    }
  }
  return imports;
}
const iconDeclarationPattern = /^export declare const ([a-zA-Z\d]+): string;?$/gm;
function isFileNotFoundError(error) {
  return error instanceof Error && error.code === "ENOENT";
}
async function getIconsFromIconset(iconSet, resolveQuasarExtras) {
  const iconSetPaths = [iconSet, `exports/${iconSet}`];
  for (const path of iconSetPaths) {
    try {
      const icons = await readJSON(resolveQuasarExtras(`${path}/icons.json`));
      return icons;
    } catch (error) {
      if (!isFileNotFoundError(error)) {
        throw error;
      }
    }
  }
  for (const path of iconSetPaths) {
    try {
      const dts = await readFileMemoized(resolveQuasarExtras(`${path}/index.d.ts`));
      const icons = [...dts.matchAll(iconDeclarationPattern)].map((arr) => arr[1]);
      return icons;
    } catch (error) {
      if (!isFileNotFoundError(error)) {
        throw error;
      }
    }
  }
  throw new Error(`Unable to resolve icon metadata for "${iconSet}" from @quasar/extras`);
}
async function getSassVersion() {
  try {
    const sassEntry = await resolvePath("sass");
    const modulePath = parseNodeModulePath(sassEntry);
    if (modulePath.dir) {
      const { version: version2 } = await readJSON(resolve(modulePath.dir, modulePath.name, "./package.json"));
      return version2;
    }
  } catch {
  }
  return null;
}

export { module$1 as default };
