# Running the engine from the Mac (plain-language runbook)

**Public URL of the engine: https://vks-macbook-pro.tailb85bea.ts.net**
The website (https://last-mile-iamvk.vercel.app) talks to this address. It is set in Vercel as `NEXT_PUBLIC_ENGINE_URL`.

## Keep the Mac ready (important)
- The Mac must stay **on, plugged in, with the lid open** while judges might visit. If it sleeps, shuts, or loses Wi-Fi, the site falls back to a sample (mock) run.
- Do not log out. The engine starts when you log in.

## After a reboot
Nothing to do: log in and wait about 30 seconds. Two background helpers start by themselves:
`com.lastmile.engine` (the engine, restarted if it crashes) and `com.lastmile.funnel` (the public HTTPS address).
Check it is working:
```bash
curl https://vks-macbook-pro.tailb85bea.ts.net/health
```
You should see `{"ok":true,...}`. Then open https://last-mile-iamvk.vercel.app/live and look for "LIVE · ENGINE".

## If it is not working
```bash
launchctl list | grep lastmile          # both lines should appear
tail -30 ~/Library/Logs/lastmile-engine.log
tailscale funnel status                 # should say "Funnel on"
bash scripts/mac-host-install.sh        # reinstalls both helpers
```
Or run it by hand in a terminal (stop with Ctrl+C): `bash scripts/mac-host.sh`, and `tailscale funnel --bg 8080`.

## Stop and remove it
```bash
bash scripts/mac-host-install.sh uninstall
```
This stops both helpers, deletes them, and turns the public address off.

## Notes
- Without a `.env` file containing `MONGODB_URI` and `TIGER_DATABASE_URL` the engine uses the in-memory sink (nothing is saved to Atlas or Tiger Data). Put them in a local `.env` (never committed) and run the install script again.
- The engine only allows the Vercel sites and http://localhost:3000 (`ENGINE_CORS_ORIGIN` in `scripts/mac-host.sh`).
- The Vultr runbook is separate and unchanged.
