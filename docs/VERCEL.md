# Deploying the web app to Vercel

The web app (`web/`, package `@lastmile/web`) is a Next.js app inside a pnpm monorepo. It imports workspace packages (`@lastmile/contracts`, `@lastmile/ai`) as TypeScript source, so Vercel must be able to see the whole repo, not just `web/`.

## One-time setup (about 5 minutes)

1. Go to <https://vercel.com/new> and sign in with the GitHub account that has access to `VK2756/Last-Mile`.
2. **Import Git Repository** → pick `VK2756/Last-Mile` → **Import**. If it is not listed, click **Adjust GitHub App Permissions** and grant the Vercel app access to the repo.
3. On the **Configure Project** screen:
   - **Project Name**: `last-mile` (or anything).
   - **Framework Preset**: Next.js (auto-detected once the root directory is set).
   - **Root Directory**: click **Edit** → choose `web` → **Continue**.
   - **Build and Output Settings**: leave the defaults. Vercel detects pnpm from the root `package.json` (`packageManager: pnpm@9.15.0`) and `pnpm-lock.yaml`, installs the whole workspace, and runs `next build` in `web/`.
4. Open **Environment Variables** and add:

   | Name | Value | Environments |
   |---|---|---|
   | `NEXT_PUBLIC_ENGINE_URL` | `https://<engine-domain>` (the Vultr engine behind Caddy; no trailing slash) | Production, Preview |
   | `NEXT_PUBLIC_SITE_URL` | `https://<your-domain>` (the public site, no trailing slash; optional) | Production |
   | `GEMINI_API_KEY` | (Lane C's key, only needed for `/api/triage`; without it `/call` uses the deterministic fallback) | Production, Preview |

5. Click **Deploy**. The first build takes about 1-2 minutes.
6. After the first deploy: **Project → Settings → General → Root Directory** and check that **"Include files outside of the Root Directory in the Build Step"** is **Enabled** (it is on by default for monorepos; the build fails with `Cannot find module '@lastmile/contracts'` if it is off).
7. **Settings → Git**: Production Branch = `main`. Every PR then gets a Preview URL automatically.

## `NEXT_PUBLIC_SITE_URL` (custom domain)

Set it to the domain judges will type (for example the GoDaddy Registry domain). When set, these all use it instead of the `*.vercel.app` host:
- the **Copy demo link** button and the pitch-mode **QR code** on `/live`
- Open Graph / canonical URLs (root layout `metadataBase`, and Lane E's story pages via `components/story/meta.ts`)
- `/sitemap.xml` and `/robots.txt`

When unset, the link and QR use the page's own `window.location.origin`, and server metadata falls back to Vercel's production URL. Like every `NEXT_PUBLIC_*` variable it is baked in at build time: redeploy after changing it.

## `NEXT_PUBLIC_ENGINE_URL` is baked in at build time

Next.js inlines every `NEXT_PUBLIC_*` variable into the browser JavaScript **when the app is built**. Changing it in the Vercel dashboard does nothing to deployments that already exist.

After changing it: **Deployments** → the latest Production deployment → **⋯** → **Redeploy** (untick "Use existing Build Cache"). Or push any commit to `main`.

If it is unset, `/live` falls back to the in-browser mock and shows an "Engine not configured" banner, so the site never goes blank.

## The engine must allow the Vercel origin (CORS)

The browser calls the engine directly (`POST /scenarios`, SSE stream, `POST /scenarios/:id/control`, `GET /presets`). On the Vultr VM, set the engine's `ENGINE_CORS_ORIGIN` to a comma-separated list that includes the Vercel URLs, for example:

```
ENGINE_CORS_ORIGIN=https://last-mile.vercel.app,https://<custom-domain>
```

(`*` also works for the weekend.) Preview deployments have their own `*.vercel.app` URLs; add the ones you demo from, or use `*`.

The engine must be served over **HTTPS** (Caddy on the VM). An `http://` engine URL is blocked as mixed content on the `https://` Vercel site.

## Custom domain (GoDaddy Registry prize)

**Project → Settings → Domains → Add** → enter the domain → follow the DNS instructions Vercel shows (an `A` record for the apex domain, a `CNAME` for `www`). Then add the domain to `ENGINE_CORS_ORIGIN` on the engine.

## Checking a deployment

1. `https://<site>/live`: the header shows `LIVE · ENGINE` (not `MOCK`), the clock advances, both maps fill, and the browser console shows no errors.
2. `https://<site>/live?mock=1`: works with no engine at all (the last-resort demo fallback).
3. If `/live` shows **"Live engine offline"**, open `https://<engine-domain>/health` in a new tab. A failed health check means the engine is down. If health works, the cause is CORS or a stale build (redeploy after fixing `NEXT_PUBLIC_ENGINE_URL`).
