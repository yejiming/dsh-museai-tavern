/**
 * Global MuseAI stylesheet (a trimmed subset of MuseAI's App.css) plus the
 * idempotent injection helper. The plugin ships plain CSS as an embedded
 * string — the browser bundle inlines it and a plugin-owned <style> tag is
 * installed once per page load.
 * @module @yejiming/dsh-museai-tavern/client/styles
 */
/** Plain CSS text injected once by {@link injectMuseaiStyles}. */
export declare const MUSAI_CSS: string;
/** Install the MuseAI stylesheet once; idempotent across view remounts. */
export declare function injectMuseaiStyles(): void;
