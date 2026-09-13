# Grow2Guide

Static site for [grow2guide.com](https://grow2guide.com), hosted free on **GitHub Pages**.

## Repo

- Site root: `index.html`, `styles.css`
- Custom domain: `CNAME` → `www.grow2guide.com`

## Enable GitHub Pages

1. Open **Settings → Pages**
2. **Source**: Deploy from a branch
3. Branch: `main` / `/ (root)`
4. Save
5. Under **Custom domain**, confirm `www.grow2guide.com`
6. After DNS propagates, turn on **Enforce HTTPS**

## DNS (after domain transfer)

Point the domain at GitHub Pages:

### Apex `grow2guide.com` — A records

| Type | Name | Value |
|------|------|-------|
| A | `@` | `185.199.108.153` |
| A | `@` | `185.199.109.153` |
| A | `@` | `185.199.110.153` |
| A | `@` | `185.199.111.153` |

### `www` — CNAME

| Type | Name | Value |
|------|------|-------|
| CNAME | `www` | `kompweb.github.io` |

Also add (optional, GitHub may ask):

| Type | Name | Value |
|------|------|-------|
| AAAA | `@` | `2606:50c0:8000::153` |
| AAAA | `@` | `2606:50c0:8001::153` |
| AAAA | `@` | `2606:50c0:8002::153` |
| AAAA | `@` | `2606:50c0:8003::153` |

Remove old Wix DNS records so they don’t conflict.

## Edit content

Edit `index.html` / `styles.css` and push to `main`. Pages rebuilds automatically.

Placeholder email is `hello@grow2guide.com` — change it when the real inbox is ready.
