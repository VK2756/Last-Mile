# Vultr engine deployment

Use an Ubuntu 24.04 VM. The human runs these commands over SSH. Replace the placeholders first. Point `API_HOST` DNS to the VM, or use `<VM_PUBLIC_IP>.sslip.io` until the domain exists.

```bash
ssh ubuntu@<VM_PUBLIC_IP>
sudo apt-get update && sudo apt-get install -y git
export API_HOST=<VM_PUBLIC_IP>.sslip.io
sudo install -d -o ubuntu -g ubuntu /opt/lastmile
git clone https://github.com/VK2756/Last-Mile.git /opt/lastmile
sudo --preserve-env=API_HOST bash /opt/lastmile/deploy/vultr/setup.sh
sudo chown -R lastmile:lastmile /opt/lastmile
sudo install -o root -g lastmile -m 0640 /dev/null /etc/lastmile/engine.env
sudoedit /etc/lastmile/engine.env
sudo -u lastmile env API_HOST="$API_HOST" bash /opt/lastmile/deploy/vultr/deploy.sh
```

Put `ENGINE_CORS_ORIGIN=https://<VERCEL_HOST>` in `engine.env`. Add `MONGODB_URI`, `MONGODB_DB`, and `TIGER_DATABASE_URL` only when available, and `DATA_SINK=real` after the engine integrates the package. Never paste secret values into chat or commit them. For future deploys, run `sudo -u lastmile env API_HOST="$API_HOST" bash /opt/lastmile/deploy/vultr/deploy.sh`.

After domain registration, set the `api` A record to the VM IP, change `API_HOST` to `api.<DOMAIN>`, rerun `setup.sh`, and set Vercel `NEXT_PUBLIC_ENGINE_URL=https://api.<DOMAIN>`.
