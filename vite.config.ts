import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

/** Where `npm run dev` sends /api calls.
 *
 *  The functions in api/ only run on Vercel, so the dev server had no catalog
 *  at all: every request 404'd and the page sat on its error state. Pointing
 *  them at the deployed site means local work sees real data. Override with
 *  API_ORIGIN to aim at a preview deployment instead. */
const API_ORIGIN = process.env.API_ORIGIN || 'https://laprevia-lime.vercel.app'

/** Where `vercel dev --listen 3010` serves the functions in api/.
 *
 *  The deployed site only knows the API as it was at the last deploy, so a
 *  change to api/ cannot be tried against it. `npm run dev -- --mode local-api`
 *  points the proxy here instead. It is a mode rather than one more
 *  environment variable because a mode is spelled the same in every shell. */
const LOCAL_API_ORIGIN = 'http://localhost:3010'

// https://vite.dev/config/
export default defineConfig(({ command, mode }) => {
  // A build here is always a production build, so it says so instead of asking
  // the environment. Two separate things read NODE_ENV and both got it wrong
  // when the shell happened to carry `development`:
  //
  //  - React picks its development or production build from
  //    `process.env.NODE_ENV` inside the bundle. The development one is nearly
  //    twice the size (430 KB against 223 KB) and slower to render.
  //  - @vitejs/plugin-react picks the JSX runtime from Vite's `isProduction`,
  //    which is derived from NODE_ENV before any `define` applies. That one
  //    kept pulling in `jsx-dev-runtime`, which tracks a source location for
  //    every element rendered.
  //
  // Setting the variable itself covers both; a `define` alone only covered the
  // first. Vercel already builds with NODE_ENV=production, so this changes
  // nothing there — it makes a local `npm run build` produce the same bundle
  // the shop actually serves, which is what makes it worth measuring.
  if (command === 'build') process.env.NODE_ENV = 'production'

  return {
    plugins: [react(), tailwindcss()],
    server: {
      proxy: {
        '/api': {
          target: mode === 'local-api' ? LOCAL_API_ORIGIN : API_ORIGIN,
          changeOrigin: true,
          secure: true,
        },
      },
    },
  }
})
