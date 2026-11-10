/// <reference types="vite/client" />

/**
 * Declare the `?inline` import type so TypeScript understands
 * `import styles from './some.css?inline'` returns a string.
 *
 * Vite processes the CSS file at build time and embeds the resulting
 * string in the JavaScript bundle – no separate network request is made.
 */
declare module "*.css?inline" {
  const content: string;
  export default content;
}
