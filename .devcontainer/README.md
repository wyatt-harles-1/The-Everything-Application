# Cloud dev with GitHub Codespaces

This folder lets you develop Kosmos entirely in the cloud — a Linux machine with
Node 24 and pnpm, where `pnpm dev` and `pnpm build` work out of the box. No local
install, and no OneDrive symlink problems.

## Start a Codespace

1. On GitHub, open the repo → **Code ▾ → Codespaces → Create codespace on main**.
2. First boot takes a couple of minutes: it builds the container and runs
   `pnpm install` automatically.
3. When it's ready, in the terminal run:

   ```bash
   pnpm dev
   ```

   Port **3000** auto-forwards and a preview opens. The app is live.

You can use the Codespace in your browser, or connect to it from VS Code / Cursor
(the GitHub Codespaces extension → "Connect to Codespace").

## Supabase keys (one-time)

The app needs your Supabase keys to load data. Add them once as **Codespaces
secrets** — they're injected as environment variables into every Codespace:

1. Go to **https://github.com/settings/codespaces** → **Secrets → New secret**
   (or repo **Settings → Secrets and variables → Codespaces**).
2. Add these (values from the Supabase dashboard → Settings → API — the same ones
   in `apps/kosmos/.env.example`):
   - `NEXT_PUBLIC_SUPABASE_URL` — Project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` — anon public key
   - `SUPABASE_SERVICE_ROLE_KEY` — service_role key (server-only)
   - `AI_SETTINGS_MASTER_KEY` — optional; needed for AI keys / integrations
     (generate: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`)
3. Give the secret access to this repository when prompted.
4. Rebuild or recreate the Codespace (or just restart `pnpm dev`) so it picks them up.

That's it — push changes from the Codespace as usual; Vercel still builds previews
and deploys `main` to production exactly as before.
