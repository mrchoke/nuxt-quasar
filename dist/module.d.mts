import * as _nuxt_schema from '@nuxt/schema';
import { QuasarFonts, QuasarAnimations } from '@quasar/extras';
import { QuasarUIConfiguration as QuasarUIConfiguration$1, QuasarIconSets, QuasarPlugins, QuasarLanguageCodes, QuasarIconSet } from 'quasar';

type ExtractFont<T extends string> = T extends `svg-${string}` ? never : T;
type ExtractSvg<T extends string> = T extends `svg-${infer F}` ? F : never;
type QuasarFontIconSet = ExtractFont<QuasarIconSets>;
type QuasarSvgIconSet = ExtractSvg<QuasarIconSets>;
type QuasarUIConfiguration = Omit<QuasarUIConfiguration$1, 'lang' | 'capacitor' | 'cordova'> & {
    addressbarColor?: string;
    brand?: {
        'dark-page'?: string;
    };
};

interface QuasarComponentDefaults {
}

interface ModuleOptions {
    /**
     * Would you like to use Quasar's SCSS/Sass variables?
     *   - `true`
     *      --> yes, all my vue files will be able to use $primary etc
     *   - `false`
     *      --> no, don't make the variables available in vue files
     *   - `'src/my-variables.sass'`
     *      --> yes, and I'd also like to customize those variables
     *
     * **Requires `sass`**
     *
     * **Note:** Variables will not be injected if any `.sass` file from `quasar` is imported manually.
     *
     * @default false
     */
    sassVariables?: string | boolean;
    /**
     * Quasar Plugins
     *
     * @see [Documentation](https://quasar.dev/quasar-plugins/)
     */
    plugins?: (keyof QuasarPlugins & string)[];
    config?: QuasarUIConfiguration;
    /**
     * Default Language pack used by Quasar
     *
     * @see [Documentation](https://quasar.dev/options/quasar-language-packs)
     */
    lang?: QuasarLanguageCodes;
    /**
     * Icon Set used by Quasar Components.
     * @default 'material-icons'
     */
    iconSet?: QuasarIconSets | QuasarIconSet;
    /**
     * If selected quasar `iconSet` is a font set, it will automatically be included in `extras.fontIcons`.
     * @default true
     */
    autoIncludeIconSet?: boolean;
    /**
     * App Config Key
     *
     * @default 'nuxtQuasar'
     */
    appConfigKey?: string;
    /**
     * When enabled, it provides breakpoint aware versions for all flex (and display) related CSS classes.
     *
     * @see [Documentation](https://quasar.dev/layout/grid/introduction-to-flexbox#flex-addons)
     */
    cssAddon?: boolean;
    /**
     * `@quasar/extras` options.
     *
     * @see [Documentation](https://github.com/quasarframework/quasar/blob/dev/extras/README.md)
     */
    extras?: {
        font?: QuasarFonts | null;
        /** Icons that are imported as webfont. */
        fontIcons?: QuasarFontIconSet[];
        /** Automaticly import selected svg icon sets provided by `@quasar/extras`. */
        svgIcons?: QuasarSvgIconSet[];
        /**
         * Animations provided by quasar.
         *
         * @see [Documentation](https://quasar.dev/options/animations)
         */
        animations?: QuasarAnimations[] | 'all';
    };
    /**
     * Component Settings
     */
    components?: {
        /**
         * Set defaults for quasar components
         */
        defaults?: QuasarComponentDefaults;
        /**
         * Auto-import quasar components
         * @default true
         */
        autoImport?: boolean;
    };
}
declare const _default: _nuxt_schema.NuxtModule<ModuleOptions, ModuleOptions, false>;

export { _default as default };
export type { ModuleOptions, QuasarComponentDefaults, QuasarUIConfiguration };
