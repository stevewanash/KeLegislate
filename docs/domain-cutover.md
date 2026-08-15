# Hustleyetu Domain Cutover — `hustleyetu.aibuildathon.dev` → `143.198.177.184`

> Status: DNS mapping **confirmed** ("Mapped successfully").
> This document is the actionable checklist for cutting the platform over from the
> nip.io IP-based domain to the real subdomain, including SSL, webhook URLs, and
> stale references found during the kelegislate → hustleyetu rename.

---

## 0. What Does Not Change

| Item | Value | Notes |
|---|---|---|
| VPS public IP | `143.198.177.184` | The IP is unchanged — only the domain pointing to it is new. |
| Backend bind address | `127.0.0.1:8000` | Uvicorn stays behind Nginx on localhost. No systemd change. |
| Systemd service | `kelegislate.service` | Internal name only; renaming it is cosmetic and risks breakage. Leave it. |
| Code path on VPS | `/var/www/kelegislate` | Same. `git pull` continues to work (GitHub redirects old repo URLs). |
| Webhook secrets | `SUPABASE_SMS_WEBHOOK_SECRET`, `AT_DELIVERY_WEBHOOK_SECRET` | Secrets stay identical; only the URLs change. |

---

## 1. VPS / IP Changes (run over SSH: `ssh root@143.198.177.184`)

### 1.1 Update Nginx `server_name`

Edit `/etc/nginx/sites-available/kelegislate` — replace the current server block:

```nginx
server {
    server_name 143.198.177.184.nip.io;
    ...
}
```

with:

```nginx
server {
    server_name hustleyetu.aibuildathon.dev;
    ...
}
```

```bash
sudo nano /etc/nginx/sites-available/kelegislate
sudo nginx -t
sudo systemctl reload nginx
```

### 1.2 Provision SSL for the new domain (mandatory per buildathon rules)

Certbot is already installed. Ports `80` and `443` must be open in the VPS firewall
(DigitalOcean cloud firewall, if enabled) for the HTTP-01 challenge and HTTPS traffic.

```bash
sudo certbot --nginx -d hustleyetu.aibuildathon.dev
sudo certbot certificates          # verify a valid cert now exists
```

Certbot will add its own `server_name` redirect block; make sure the final config still
proxies to `http://127.0.0.1:8000`. Auto-renewal is handled by the certbot systemd timer.

### 1.3 Verify end-to-end from the VPS and externally

```bash
curl -i http://hustleyetu.aibuildathon.dev/health     # expect 301 -> https
curl -i https://hustleyetu.aibuildathon.dev/health    # expect {"status":"ok"}
curl -I https://hustleyetu.aibuildathon.dev           # check TLS cert chain
```

From your **local machine** (confirms DNS propagation + public reachability):

```powershell
Resolve-DnsName hustleyetu.aibuildathon.dev            # must return 143.198.177.184
Invoke-WebRequest https://hustleyetu.aibuildathon.dev/health
```

---

## 2. External Dashboard Changes (no code involved)

These URLs are **not hardcoded** in the codebase — they live in the respective dashboards
and are currently pointed at `https://143.198.177.184.nip.io/...`.

### 2.1 Supabase — Custom SMS Webhook (OTP delivery)

Supabase Dashboard → **Auth → Providers → Phone → SMS Provider → Custom SMS Webhook**:

| Field | Old | New |
|---|---|---|
| Webhook URL | `https://143.198.177.184.nip.io/api/webhooks/auth/send-sms` | `https://hustleyetu.aibuildathon.dev/api/webhooks/auth/send-sms` |
| HTTP Method | `POST` | `POST` (unchanged) |
| Header Name | `x-supabase-webhook-secret` | unchanged |
| Header Value | `<SUPABASE_SMS_WEBHOOK_SECRET>` | unchanged |

### 2.2 Africa's Talking — Delivery Reports

AT Dashboard → **SMS → (your shortcode/SMS app) → Delivery Reports URL**:

| Field | Old | New |
|---|---|---|
| Callback URL | `https://143.198.177.184.nip.io/api/webhooks/at-delivery` | `https://hustleyetu.aibuildathon.dev/api/webhooks/at-delivery` |

> Note: `backend/app/services/notifier.py` does not pass a per-request `callback`
> parameter, so this dashboard setting is the **only** source of delivery receipts.
> If left on the old nip.io URL, notification delivery status will stop updating.

### 2.3 Africa's Talking — Incoming SMS (keyword replies)

AT Dashboard → **SMS → Shortcode settings → Incoming SMS URL**:

| Field | Old | New |
|---|---|---|
| Callback URL | `https://143.198.177.184.nip.io/api/webhooks/incoming-sms` | `https://hustleyetu.aibuildathon.dev/api/webhooks/incoming-sms` |

Also confirm the shortcode **keyword** setting matches what citizens are told to text
(the code does not validate the keyword — see §4.2).

---

## 3. Code Changes (commit and redeploy)

### 3.1 Backend CORS — `backend/app/main.py`

CORS is driven by the **frontend origin**, not the API domain:

- Frontend stays on Vercel (`https://hustleyetu.vercel.app`): **no change required** — it is already in `origins`.
- Frontend will be served from the VPS at the new domain: add the origin:

```python
origins = [
    "https://hustleyetu.vercel.app",
    "https://hustleyetu.aibuildathon.dev",   # NEW: frontend served from VPS
    "http://localhost:3000",
]
```

### 3.2 Frontend API base URL — `frontend/.env.local` + Vercel env

Current value points at the developer's machine, so any deployed frontend cannot reach
the API. For production builds set:

```
NEXT_PUBLIC_API_BASE_URL=https://hustleyetu.aibuildathon.dev/api
```

- Update `frontend/.env.local` for local-to-VPS testing.
- Add the same variable in Vercel → Project → Settings → Environment Variables (Production).
- Rebuild/redeploy. `frontend/.next` contains the old `http://localhost:8000/api` value
  baked into compiled chunks — a plain redeploy without rebuild keeps the stale value.

### 3.3 SMS links — `backend/app/services/notifier.py` (lines ~150–152)

Both the Swahili and English alert templates currently link to
`https://hustleyetu.co.ke/bills/{bill_id}` — a domain the project does not own.
Replace with the real domain:

```python
msg = f"Taarifa ya Hustleyetu: Mswada mpya '{bill_title}' unaweza kuathiri biashara yako. Pata maelezo na ushiriki wa umma kwa https://hustleyetu.aibuildathon.dev/bills/{bill_id}"
...
msg = f"Hustleyetu Alert: New bill '{bill_title}' may impact your business. View details and public participation info at https://hustleyetu.aibuildathon.dev/bills/{bill_id}"
```

### 3.4 Optional — docstring cleanup — `backend/app/api/webhooks.py` (line ~121)

```python
Receives citizen messages sent to keyword (e.g., 'kamilimu kelegislate ...').
```
→
```python
Receives citizen messages sent to keyword (e.g., 'kamilimu hustleyetu ...').
```

Cosmetic only — no functional impact.

---

## 4. Rename (kelegislate → hustleyetu) Conflict Review

The rename introduces **no functional conflicts**: no Python module, import, or env var
references the old name. Remaining leftovers and their impact:

| Location | Leftover | Impact / Action |
|---|---|---|
| `backend/app/api/webhooks.py:121` | Docstring `'kamilimu kelegislate ...'` | None — comment only (§3.4). |
| `README.md:56-57` | `github.com/stevewanash/KeLegislate.git`, `cd KeLegislate` | Stale. GitHub redirects old repo URLs, but update if the repo was renamed. |
| `docs/architectural_design.md:1257`, `docs/implementation_plan.md:797` | `kelegislate.vercel.app` in CORS snippets | Docs only — actual code already uses `hustleyetu.vercel.app`. |
| VPS: `kelegislate.service`, `/var/www/kelegislate`, nginx site filename | Old name | Zero impact. Do **not** rename — systemd/nginx symlinks depend on them. |
| `frontend/package.json` / `package-lock.json` | Already `hustleyetu-frontend` | Consistent — no conflict. |
| Africa's Talking shortcode keyword (`kamilimu`) | Hackathon keyword | Code never validates the keyword, so no code conflict; align the AT dashboard keyword with whatever citizens are told to text. |

---

## 5. Post-Cutover Verification Checklist

- [ ] `Resolve-DnsName hustleyetu.aibuildathon.dev` → `143.198.177.184`
- [ ] `https://hustleyetu.aibuildathon.dev/health` → `{"status":"ok"}` with valid TLS cert
- [ ] Old nip.io URLs still resolve (fallback alias in `server_name`)
- [ ] Supabase OTP test: request OTP on a registered test number → SMS arrives → verify works
- [ ] Supabase Dashboard SMS webhook URL shows the new domain
- [ ] AT delivery reports flow: send a real SMS → `notifications.delivered_at` updates in DB
- [ ] SMS alert template contains `hustleyetu.aibuildathon.dev` links (not `hustleyetu.co.ke`)
- [ ] Deployed frontend loads data (browser Network tab shows calls to the new domain, no CORS errors)
- [ ] Commit + push all code changes; on the VPS: `cd /var/www/kelegislate && git pull && sudo systemctl restart kelegislate`

---

## 6. Rollback

If the new domain misbehaves, the nip.io alias kept in `server_name` means the old URLs
keep working. To fully roll back: remove the new domain from Nginx `server_name`,
`sudo systemctl reload nginx`, and revert the three dashboard URLs to
`https://143.198.177.184.nip.io/...`.
