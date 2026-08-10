import { CATPPUCCIN_FLAVOURS, DEFAULT_FLAVOUR, paletteToCssVariables } from '@sfaizh/shared';

/**
 * Emits every Catppuccin flavour as a block of CSS custom properties, keyed on
 * `data-flavour`. Generating them from the shared palette rather than writing
 * them into the stylesheet keeps one source of truth, and means switching
 * flavour is a single attribute write with no re-render and no flash.
 */
export function ThemeStyles() {
  const blocks = [
    `:root, [data-flavour='${DEFAULT_FLAVOUR}'] {\n${paletteToCssVariables(DEFAULT_FLAVOUR)}\n}`,
    ...CATPPUCCIN_FLAVOURS.filter((flavour) => flavour !== DEFAULT_FLAVOUR).map(
      (flavour) => `[data-flavour='${flavour}'] {\n${paletteToCssVariables(flavour)}\n}`
    ),
  ];

  return <style id="catppuccin-palette" dangerouslySetInnerHTML={{ __html: blocks.join('\n\n') }} />;
}

/**
 * Applies the stored flavour before first paint. Without this the page renders
 * once in Mocha and then snaps to the saved flavour, which is exactly the
 * flash-of-wrong-theme that makes a site feel cheap.
 */
export function FlavourBootstrap() {
  const script = `
    try {
      var stored = window.localStorage.getItem('sfaizh:flavour:v1');
      var allowed = ${JSON.stringify(CATPPUCCIN_FLAVOURS)};
      document.documentElement.dataset.flavour =
        allowed.indexOf(stored) >= 0 ? stored : '${DEFAULT_FLAVOUR}';
    } catch (error) {
      document.documentElement.dataset.flavour = '${DEFAULT_FLAVOUR}';
    }
  `;
  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}
