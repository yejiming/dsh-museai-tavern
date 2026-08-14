/**
 * Browser shim for `node:url` (the subset inlined dependencies touch at
 * module scope). URL construction is delegated to the global URL/URLSearchParams.
 * @module @yejiming/dsh-museai-tavern/client/shims/node-url
 */
export declare function fileURLToPath(url: string | URL): string;
export declare function pathToFileURL(path: string): URL;
export declare function parse(input: string): URL;
declare const _default: {
    fileURLToPath: typeof fileURLToPath;
    pathToFileURL: typeof pathToFileURL;
    parse: typeof parse;
};
export default _default;
