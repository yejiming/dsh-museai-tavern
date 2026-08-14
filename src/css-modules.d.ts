/** CSS Modules type shim for the browser half. */
declare module '*.module.css' {
  const classes: Record<string, string>
  export default classes
}

/** Plain CSS side-effect imports (injected as style tags by the bundle). */
declare module '*.css' {}
