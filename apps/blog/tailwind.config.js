/**
 * Catppuccin is exposed through CSS custom properties rather than baked hex
 * values, so switching flavour at runtime (`theme latte`) only has to swap the
 * variables on `:root` — no class churn, no re-render.
 *
 * @type {import('tailwindcss').Config}
 */
const ctp = (name) => `var(--ctp-${name})`;

module.exports = {
  content: [
    './{src,pages,components,app}/**/*.{ts,tsx,js,jsx,html}',
    '!./{src,pages,components,app}/**/*.{stories,spec}.{ts,tsx,js,jsx,html}',
  ],
  theme: {
    extend: {
      colors: {
        rosewater: ctp('rosewater'),
        flamingo: ctp('flamingo'),
        pink: ctp('pink'),
        mauve: ctp('mauve'),
        red: ctp('red'),
        maroon: ctp('maroon'),
        peach: ctp('peach'),
        yellow: ctp('yellow'),
        green: ctp('green'),
        teal: ctp('teal'),
        sky: ctp('sky'),
        sapphire: ctp('sapphire'),
        blue: ctp('blue'),
        lavender: ctp('lavender'),
        text: ctp('text'),
        subtext1: ctp('subtext1'),
        subtext0: ctp('subtext0'),
        overlay2: ctp('overlay2'),
        overlay1: ctp('overlay1'),
        overlay0: ctp('overlay0'),
        surface2: ctp('surface2'),
        surface1: ctp('surface1'),
        surface0: ctp('surface0'),
        base: ctp('base'),
        mantle: ctp('mantle'),
        crust: ctp('crust'),
      },
      fontFamily: {
        mono: ['var(--font-mono)'],
        prose: ['var(--font-prose)'],
      },
      maxWidth: {
        prose: '75ch',
      },
      keyframes: {
        blink: { '0%, 49%': { opacity: '1' }, '50%, 100%': { opacity: '0' } },
        flapDown: {
          '0%': { transform: 'rotateX(0deg)' },
          '100%': { transform: 'rotateX(-90deg)' },
        },
        scanline: {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100%)' },
        },
        fadeUp: {
          '0%': { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        blink: 'blink 1.05s steps(1) infinite',
        scanline: 'scanline 7s linear infinite',
        fadeUp: 'fadeUp 120ms ease-out both',
      },
    },
  },
  plugins: [],
};
