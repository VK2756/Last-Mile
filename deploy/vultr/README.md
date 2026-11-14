# Vultr engine deployment

Follow [the step-by-step Vultr runbook](../../docs/RUNBOOK_VULTR.md). It contains the VM creation steps, exact SSH commands, ignored `engine/.env` setup, Caddy HTTPS hostname, and health checks.

`setup.sh` is idempotent and configures Node 22, pnpm, Caddy, UFW, and the `lastmile-engine` systemd unit. `deploy.sh` pulls `main`, installs dependencies, runs verification, restarts the engine, and checks local and public `/health`.
