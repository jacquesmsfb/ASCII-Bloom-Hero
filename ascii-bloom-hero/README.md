# ascii-bloom-hero

A full-viewport ASCII/canvas hero animation for React. Renders a field of
density characters (` .:-=+*#%@`) that breathes with ambient noise, waits for
a click/tap, then drops and settles every character with simple gravity
physics before revealing the page underneath.

Four phases, driven internally: `BLOOM -> IDLE -> DROP -> HANDOFF`.

## Usage

```tsx
"use client";

import AsciiBloomHero from "./AsciiBloomHero";

export default function Page() {
  return (
    <>
      <AsciiBloomHero
        onSettle={(particles) => {
          // optional: particles is the list of { x, y, ch, color } where
          // each character came to rest, if you want to render a "floor"
          // of them elsewhere on the page after handoff.
        }}
        onRelease={() => {
          // optional: fires ~700ms after settling, right as the hero
          // starts fading out of the layout.
        }}
      />
      {/* rest of your page */}
    </>
  );
}
```

Single file, zero dependencies beyond React 18+. Copy `AsciiBloomHero.tsx`
into any React or Next.js (App Router, client component) project.

## Notes

- Respects `prefers-reduced-motion` (skips the bloom-in) and adapts the
  interaction prompt for touch vs. pointer devices.
- The idle-state prompt uses a `blink` CSS animation on touch devices. Add
  this to your global stylesheet (harmless to omit — the label just won't
  blink):

  ```css
  @keyframes blink {
    0%, 100% { opacity: 1; }
    50% { opacity: 0; }
  }
  ```
- `fontFamily` prop lets you swap the monospace font; defaults to
  `'JetBrains Mono', ui-monospace, monospace`.

## License

MIT
