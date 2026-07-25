import { defineNuxtPlugin } from "#app";
import { appConfigKey, componentsWithDefaults, pluginNames, quasarNuxtConfig } from "#build/quasar.config.mjs";
import { computed, reactive, useAppConfig, useHead, watch } from "#imports";
import { defuFn } from "defu";
function getUpdatedDefaults(cfg, prevCfg) {
  const prevKeys = Object.keys(prevCfg);
  return {
    ...Object.fromEntries(prevKeys.map((k) => [k, void 0])),
    ...cfg
  };
}
function getPrimaryColor() {
  return getComputedStyle(document.body).getPropertyValue("--q-primary").trim();
}
function omit(object, keys) {
  return Object.keys(object).reduce((output, key) => {
    if (!keys.includes(key)) {
      output[key] = object[key];
    }
    return output;
  }, {});
}
export default defineNuxtPlugin({
  name: "quasar",
  async setup(nuxt) {
    const quasarModule = import.meta.server ? await import("quasar/dist/quasar.server.prod.js") : await import("quasar");
    const { Quasar } = quasarModule;
    const quasarRuntimeExports = quasarModule;
    const resolvedPlugins = Object.fromEntries(
      pluginNames.map((name) => [name, quasarRuntimeExports[name]]).filter(([, plugin]) => plugin !== void 0)
    );
    const resolvedComponentsWithDefaults = Object.fromEntries(
      componentsWithDefaults.map((name) => [name, quasarRuntimeExports[name]]).filter(([, component]) => component !== void 0)
    );
    const notifyPlugin = resolvedPlugins.Notify;
    const quasarAppConfig = useAppConfig()[appConfigKey];
    const { lang, iconSet, components } = quasarNuxtConfig;
    let ssrContext;
    let quasarProxy;
    let config = defuFn(quasarAppConfig, omit(quasarNuxtConfig.config || {}, ["brand"]));
    if (import.meta.server) {
      const BRAND_RE = /--q-[\w-]+:.+?;/g;
      const meta = reactive({
        bodyClasses: "",
        htmlAttrs: "",
        endingHeadTags: ""
      });
      const htmlAttrsRecord = computed(
        () => Object.fromEntries(
          meta.htmlAttrs.split(" ").map((attr) => attr.split("="))
        )
      );
      const bodyStyles = computed(() => {
        return [...meta.endingHeadTags.matchAll(BRAND_RE)].map((match) => match[0]).join("");
      });
      useHead(
        computed(() => ({
          bodyAttrs: {
            class: meta.bodyClasses,
            style: bodyStyles.value
          },
          htmlAttrs: htmlAttrsRecord.value
        }))
      );
      ssrContext = {
        req: nuxt.ssrContext.event.node.req,
        res: nuxt.ssrContext.event.node.res
      };
      quasarProxy = {
        install({ ssrContext: ssrContext2 }) {
          meta.bodyClasses = ssrContext2._meta.bodyClasses;
          meta.htmlAttrs = ssrContext2._meta.htmlAttrs;
          meta.endingHeadTags = ssrContext2._meta.endingHeadTags;
          ssrContext2._meta = new Proxy({}, {
            get(target, key) {
              return meta[key] ?? target[key];
            },
            set(target, key, value) {
              if (typeof meta[key] === "string") {
                meta[key] = value;
              } else {
                target[key] = value;
              }
              return true;
            }
          });
        }
      };
    } else {
      quasarProxy = {
        install({ onSSRHydrated }) {
          nuxt.hook("app:suspense:resolve", () => {
            onSSRHydrated.forEach((fn) => fn());
          });
        }
      };
    }
    nuxt.vueApp.use(Quasar, {
      lang,
      iconSet,
      plugins: {
        quasarProxy,
        ...resolvedPlugins
      },
      config
    }, ssrContext);
    const quasar = nuxt.vueApp.config.globalProperties.$q;
    if (!quasar) {
      return {
        provide: {
          q: void 0
        }
      };
    }
    const asDefault = (value) => value && typeof value === "object" ? () => value : value;
    for (const [name, propDefaults] of Object.entries(components.defaults || {})) {
      const component = resolvedComponentsWithDefaults[name];
      if (!component) {
        continue;
      }
      for (const [propName, defaultValue] of Object.entries(propDefaults)) {
        const propConfig = component.props[propName];
        if (Array.isArray(propConfig) || typeof propConfig === "function") {
          component.props[propName] = {
            type: propConfig,
            default: asDefault(defaultValue)
          };
        } else if (typeof propConfig === "object") {
          const propObject = propConfig;
          if (propObject) {
            propObject.default = asDefault(defaultValue);
          } else {
            component.props[propName] = {
              default: asDefault(defaultValue)
            };
          }
        } else {
          throw new TypeError(`Unexpected prop definition type used at ${name}.props.${propName}, please open an issue.`);
        }
      }
    }
    if (import.meta.dev && import.meta.client) {
      watch(
        () => quasarAppConfig,
        (newAppConfig) => {
          const prevConfig = config;
          config = defuFn(newAppConfig, quasarNuxtConfig.config);
          quasar.addressbarColor?.set(config.addressbarColor || getPrimaryColor());
          const modifiedBrand = getUpdatedDefaults(
            config.brand || {},
            prevConfig.brand || {}
          );
          for (const [name, color] of Object.entries(modifiedBrand)) {
            if (!color) {
              document.body.style.removeProperty(`--q-${name}`);
            } else {
              document.body.style.setProperty(`--q-${name}`, color);
            }
          }
          if (prevConfig.dark !== config.dark) {
            quasar.dark.set(config.dark || false);
          }
          quasar.loading?.setDefaults(getUpdatedDefaults(
            config.loading || {},
            prevConfig.loading || {}
          ));
          quasar.loadingBar?.setDefaults(getUpdatedDefaults(
            config.loadingBar || {},
            prevConfig.loadingBar || {}
          ));
          notifyPlugin?.setDefaults?.(getUpdatedDefaults(
            config.loadingBar || {},
            prevConfig.loadingBar || {}
          ));
        },
        { deep: true }
      );
    }
    return {
      provide: {
        q: quasar
      }
    };
  }
});
