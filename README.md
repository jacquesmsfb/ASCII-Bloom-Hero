# ASCII-Bloom-Hero

A full-viewport ASCII/canvas hero animation for React. Renders a field of density characters that breathes with ambient noise, waits for a click/tap, then drops and settles every character with simple gravity physics before revealing the page underneath.

## ✨ Features

- **Four-Phase Animation**: `BLOOM → IDLE → DROP → HANDOFF`
- **Accessibility-First**: Respects `prefers-reduced-motion` and adapts for touch vs. pointer devices
- **Zero Dependencies**: Single file, TypeScript, React 18+ only
- **Customizable**: Optional callbacks for `onSettle` and `onRelease` events
- **Monospace Font Flexibility**: Configurable font family (defaults to JetBrains Mono)

## 🚀 Quick Start

### Installation

Copy `AsciiBloomHero.tsx` directly into your React or Next.js project:

```bash
cp ascii-bloom-hero/AsciiBloomHero.tsx your-project/components/
```

### Usage

```tsx
"use client";

import AsciiBloomHero from "./AsciiBloomHero";

export default function Page() {
  return (
    <>
      <AsciiBloomHero
        onSettle={(particles) => {
          // Optional: particles is { x, y, ch, color }[]
          // Use this to render settled characters as a "floor" elsewhere
        }}
        onRelease={() => {
          // Optional: fires ~700ms after settling,
          // right as the hero starts fading out
        }}
      />
      {/* rest of your page */}
    </>
  );
}
```

## 📋 What's Inside

- **`AsciiBloomHero.tsx`** — The main component (single file, all you need)
- **`LICENSE`** — MIT license
- **`README.md`** — Full documentation and usage guide

## 🎨 Animation Phases

1. **BLOOM** — Characters fade in with ambient noise, breathing effect
2. **IDLE** — Waiting for user interaction (click/tap), shows interaction prompt
3. **DROP** — Gravity physics kicks in, characters fall and settle
4. **HANDOFF** — Hero fades out, page content revealed

## ♿ Accessibility

- Skips bloom-in animation for users with `prefers-reduced-motion` enabled
- Auto-detects touch vs. pointer devices and adapts the interaction prompt
- Semantic HTML and keyboard-friendly event handling

## 🎯 CSS Setup (Optional)

For the blinking prompt on touch devices, add to your global stylesheet:

```css
@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}
```

(Harmless to omit — the label just won't blink.)

## 📝 TypeScript

Fully typed component with optional props:

- `onSettle?: (particles: Particle[]) => void` — Called when all characters settle
- `onRelease?: () => void` — Called when hero fades out
- `fontFamily?: string` — Custom monospace font (default: `'JetBrains Mono', ui-monospace, monospace`)

## 📄 License

MIT — See [LICENSE](./ascii-bloom-hero/LICENSE) for details.

---

Made with ❤️ by [@jacquesmsfb](https://github.com/jacquesmsfb)
