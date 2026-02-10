# React Client Setup (shadcn, Tailwind, TypeScript)

## Current structure

- **Components:** `src/components/ui/` (default location for shadcn-style UI components)
- **Styles:** Tailwind via `src/index.css` with `@tailwind` directives
- **Entry:** `src/main.tsx` → `App.tsx`

## Install dependencies

From the `client` folder:

```bash
cd client
npm install
```

This installs React, TypeScript, Vite, Tailwind CSS, and **framer-motion**.

## Run the dev server

```bash
npm run dev
```

App runs at http://localhost:5173. Click **Create** to see the pulsating loading animation.

## Why `src/components/ui`?

- **shadcn/ui** expects UI primitives to live in `components/ui` so they are easy to find and override.
- Using `src/components/ui` keeps the same idea while matching a typical Vite `src/` layout.
- If you add shadcn via CLI (see below), it will install into this folder.

## Adding shadcn (optional)

The project does not use shadcn yet. To add it:

1. From project root (or `client` if your app lives there), run:

   ```bash
   npx shadcn@latest init
   ```

2. Choose:
   - Style: Default or New York
   - Base color: any
   - CSS variables: Yes (recommended)
   - Tailwind config path: `tailwind.config.js`
   - Components path: **`src/components`** (so shadcn creates `src/components/ui`)

3. Add a component, e.g. Button:

   ```bash
   npx shadcn@latest add button
   ```

4. If the CLI asks for a different path (e.g. `components/ui`), use **`src/components`** so the result is `src/components/ui/button.tsx`.

## Build

```bash
npm run build
```

Output is in `dist/`. You can serve it with `npm run preview` or point your main app’s static server at `client/dist`.

## Loaders

- **PulsatingDots** – `src/components/ui/pulsating-loader.tsx` (used in Create button)
- **RippleWaveLoader** – `src/components/ui/ripple-wave-loader.tsx` (demo)

Both use **framer-motion** and Tailwind classes. No extra providers or context are required.
