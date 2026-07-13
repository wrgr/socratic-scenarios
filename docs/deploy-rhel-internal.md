# Deploying on an internal RHEL box

Notes from a production deploy on an internal corporate RHEL 8 box (no outbound HTTPS without corp-CA trust, no Docker daemon, firewalld + SELinux enforcing). These are the specific gotchas — for the happy-path `scripts/deploy.sh` flow, see the [main README](../README.md#deploying).

## Target architecture

- Host nginx serves the static bundle from `/var/www/teachme/`
- Builds happen on the box (or on a dev Mac, then rsync)
- No Docker, no backend service, no secrets on the box
- Users supply their own Gemini key via the gear icon (stored in their browser's localStorage)

## One-time setup checklist

1. **Node 20** — RHEL AppStream defaults to an old major via module streams. To get Node 20:
   ```bash
   sudo dnf module reset -y nodejs
   sudo dnf install -y https://rpm.nodesource.com/pub_20.x/nodistro/repo/nodesource-release-nodistro-1.noarch.rpm
   sudo dnf install -y nodejs
   node --version   # must print v20.x
   ```
   If a legacy `nodejs` package still wins after that (AppStream module pinning is sticky), use nvm as a user-local escape hatch:
   ```bash
   curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
   source ~/.bashrc
   nvm install 20 && nvm use 20
   ```

2. **Corporate CA trust** — if the org does TLS interception (`unable to get local issuer certificate` in npm logs), the proper fix is dropping the corp root CA into `/etc/pki/ca-trust/source/anchors/` and `sudo update-ca-trust`, then `export NODE_EXTRA_CA_CERTS=/etc/pki/tls/certs/ca-bundle.crt` in `~/.bashrc`. Short-term escape hatch for the install step only:
   ```bash
   export NODE_TLS_REJECT_UNAUTHORIZED=0
   ```
   and/or
   ```bash
   npm install --ignore-scripts    # skips native-module prebuilds that fetch from GitHub
   ```
   `--ignore-scripts` is safe here because the build (`tsc`, `vite`) is pure JS — only the DB tooling (`better-sqlite3`) has a native postinstall, and the web app doesn't need it at runtime.

3. **nginx, SELinux, firewalld**:
   ```bash
   sudo dnf install -y nginx policycoreutils-python-utils
   sudo mkdir -p /var/www/teachme
   sudo chown -R "$USER":"$USER" /var/www/teachme

   # SELinux: tag the doc root so nginx is allowed to read it.
   # Skip this and you'll get 403s with "Permission denied" in the nginx error log
   # despite file perms looking fine.
   sudo semanage fcontext -a -t httpd_sys_content_t "/var/www/teachme(/.*)?"
   sudo restorecon -Rv /var/www/teachme

   # firewalld (not ufw on RHEL)
   sudo firewall-cmd --permanent --add-service=http
   sudo firewall-cmd --reload
   ```

4. **Replace the stock `/etc/nginx/nginx.conf`** — the default ships with its own `server { listen 80 default_server; ... }` block serving the nginx welcome page. That collides with `conf.d/teachme.conf` (both claim `default_server` on `0.0.0.0:80`) and nginx refuses to start. Overwrite with a minimal parent config that just includes `conf.d/*.conf`:
   ```bash
   sudo tee /etc/nginx/nginx.conf > /dev/null <<'EOF'
   user nginx;
   worker_processes auto;
   error_log /var/log/nginx/error.log;
   pid /run/nginx.pid;

   events { worker_connections 1024; }

   http {
     include       /etc/nginx/mime.types;
     default_type  application/octet-stream;
     log_format  main  '$remote_addr - $remote_user [$time_local] "$request" '
                       '$status $body_bytes_sent "$http_referer" '
                       '"$http_user_agent" "$http_x_forwarded_for"';
     access_log  /var/log/nginx/access.log  main;
     sendfile        on;
     keepalive_timeout  65;
     include /etc/nginx/conf.d/*.conf;
   }
   EOF
   ```

5. **Site config at `/etc/nginx/conf.d/teachme.conf`** — see the main README for the full block (SPA fallback, gzip, immutable caching on `/assets/`).

6. **Start nginx**:
   ```bash
   sudo nginx -t && sudo systemctl enable --now nginx
   curl -I http://localhost/    # expect HTTP/1.1 200
   ```

## Deploys after initial setup

```bash
cd ~/teachme
./scripts/deploy.sh
```

The script calls `npm install` under the hood. If corp TLS is still an issue and you haven't trusted the corp CA system-wide, edit the script to use `npm install --ignore-scripts` with `NODE_TLS_REJECT_UNAUTHORIZED=0` prepended (see the commented block inside `deploy.sh`).

## Diagnosing "Connection refused"

In order:

1. `sudo systemctl status nginx` — is it actually running? Most common cause of "Connection refused" is nginx not started or failed to start.
2. `sudo ss -tlnp | grep ':80'` — if blank, nothing is listening. If bound to `127.0.0.1:80` only, a config is forcing localhost-only.
3. `sudo firewall-cmd --list-all | grep services` — must include `http`.
4. `curl -I http://localhost/` from the box — if this works but external IP fails, it's firewall/binding, not nginx.
5. `sudo journalctl -u nginx --no-pager | tail -30` — if nginx failed to start, the reason is here.

## What won't work without further plumbing

- **DB setup scripts** (`npm run db:setup`, `db:ingest-kb`, etc.) — these need `better-sqlite3` to compile, which fetches a prebuild from GitHub during `npm install`. Either trust the corp CA properly, or run these on a dev Mac and commit the exported JSON to `public/` for the client to consume.
- **BYOK with shared keys** — the gear-icon flow is per-browser. If you want every user on the LAN to share one key (and trust them with it), you'd need a small backend proxy — not implemented.
- **HTTPS / TLS** — current config is plain HTTP on port 80. For internal-only with no auth that's usually fine; add Caddy in front for automatic certs if you want them.
