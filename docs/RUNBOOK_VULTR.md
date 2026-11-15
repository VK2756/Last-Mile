# Vultr engine runbook

This deploys the simulation engine on an Ubuntu 24.04 Vultr Cloud Compute VM. Run one block at a time. The engine uses synthetic households and helpers. Keep the database credentials in the ignored `engine/.env` on the VM; put `GEMINI_API_KEY` in Vercel for the web triage API.

## 1. Create the VM

In the Vultr dashboard choose **Deploy → Cloud Compute → Regular Performance → Ubuntu 24.04**, select a nearby location, add your SSH public key, enable **Limited User Login**, and deploy. Vultr creates the sudo-capable `linuxuser` account with this option ([Vultr provisioning guide](https://docs.vultr.com/products/compute/instances/cloud-compute/provisioning)). Copy the public IPv4 address. Allow inbound TCP 22, 80 and 443 in any Vultr firewall group you attach. Replace `<VM_PUBLIC_IP>` below with that IPv4 address.

On your own computer:

```bash
ssh linuxuser@<VM_PUBLIC_IP>
```

The remaining blocks run inside that SSH session.

## 2. Clone and set up HTTPS

```bash
sudo apt-get update
sudo apt-get install -y git
sudo install -d -o "$(id -un)" -g "$(id -gn)" /opt/lastmile
git clone https://github.com/VK2756/Last-Mile.git /opt/lastmile
export API_HOST="$(curl -4fsS https://api.ipify.org).sslip.io"
printf 'Engine hostname: %s\n' "$API_HOST"
sudo --preserve-env=API_HOST bash /opt/lastmile/deploy/vultr/setup.sh
sudo chown -R lastmile:lastmile /opt/lastmile
```

`setup.sh` installs Node 22, pnpm, Caddy, the `lastmile-engine` systemd unit, and UFW rules for 22/80/443. Caddy requests a public TLS certificate for the `sslip.io` hostname. If the hostname prints a different IP than the VM's public IPv4, set it explicitly with `export API_HOST=<VM_PUBLIC_IP>.sslip.io` and rerun `sudo --preserve-env=API_HOST bash /opt/lastmile/deploy/vultr/setup.sh`.

## 3. Put credentials in the ignored engine env file

```bash
cd /opt/lastmile
git check-ignore -v engine/.env
sudo install -o lastmile -g lastmile -m 0600 /dev/null engine/.env
sudoedit engine/.env
```

Paste these **variable names** into the editor and enter the values there. Do not paste values into chat, a terminal command, Git, or a screenshot. `ENGINE_CORS_ORIGIN=*` works for the demo; after the Vercel URL is known, replace it with its exact origin such as `https://last-mile.vercel.app` (or a comma-separated list including all demo origins).

```dotenv
DATA_SINK=real
MONGODB_URI='<your Atlas URI>'
MONGODB_DB=lastmile
TIGER_DATABASE_URL='<your Tiger connection URL>'
ENGINE_CORS_ORIGIN=*
```

The engine selects `@lastmile/data` only with `DATA_SINK=real`. Both database URLs are needed for its buffered real sink; if either is absent it uses the memory sink. The service reads `engine/.env` through systemd. Set `GEMINI_API_KEY` in the Vercel project environment for `/api/triage`, then redeploy the web app. The key is not needed by the engine.

For a foreground engine run from the repository root, use `pnpm deploy:engine`. It invokes the same `pnpm --filter @lastmile/engine start` command as the systemd unit. The engine's `start` script uses `tsx` to transpile TypeScript as it starts; there is no separate emitted build artifact. The normal VM deployment below runs `pnpm verify` before restarting that unit.

Check file permissions without showing its contents:

```bash
stat -c '%a %U %G %n' /opt/lastmile/engine/.env
```

Expected: `600 lastmile lastmile`.

## 4. Migrate, seed, deploy

```bash
cd /opt/lastmile
sudo -u lastmile pnpm install --frozen-lockfile
sudo -u lastmile bash -c 'set -a; source engine/.env; set +a; pnpm --filter @lastmile/data migrate; pnpm --filter @lastmile/data seed'
sudo -u lastmile env API_HOST="$API_HOST" bash /opt/lastmile/deploy/vultr/deploy.sh
```

Keep the database values in single quotes because connection URLs commonly contain shell special characters. If a real value itself contains a single quote, use a shell-safe quoted form instead. The deploy script pulls `main`, installs dependencies, runs `pnpm verify`, restarts the service, and checks local and public health.

## 5. Check the result

```bash
sudo systemctl status lastmile-engine --no-pager
curl --fail --silent --show-error http://127.0.0.1:8080/health
curl --fail --silent --show-error "https://$API_HOST/health"
```

Set Vercel `NEXT_PUBLIC_ENGINE_URL=https://<VM_PUBLIC_IP>.sslip.io` and redeploy Vercel, because public environment variables are baked into its build. Confirm `ENGINE_CORS_ORIGIN` contains the deployed Vercel origin or `*`. Visit `/live` on Vercel and verify both maps update. `docs/VERCEL.md` has the Vercel steps.

For later deployments, reconnect by SSH, then run:

```bash
cd /opt/lastmile
export API_HOST="$(curl -4fsS https://api.ipify.org).sslip.io"
sudo -u lastmile env API_HOST="$API_HOST" bash deploy/vultr/deploy.sh
```

When a custom domain is ready, point the `api` A record at the VM IPv4, set `API_HOST=api.<domain>`, rerun `setup.sh`, and update Vercel's `NEXT_PUBLIC_ENGINE_URL` to `https://api.<domain>` followed by a fresh Vercel deployment.
