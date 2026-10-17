#!/usr/bin/env bash
# Soltex Global — smoke test of a running server (Phase N-0, docs/deploy-runbook-ru.md). Read-only:
# only GET and HEAD requests. Exit code = number of failed checks.
#
#   deploy/scripts/smoke.sh                     the production hosts
#   SITE=https://… ADMIN=https://… PREVIEW=https://… deploy/scripts/smoke.sh
#   SMOKE_SKIP_SITE=1 deploy/scripts/smoke.sh   before DNS of the public site points to the server
set -uo pipefail

SITE="${SITE:-https://soltexglobal.co}"
ADMIN="${ADMIN:-https://admin.soltexglobal.co}"
PREVIEW="${PREVIEW:-https://preview.soltexglobal.co}"
fail=0

check() { # name, expected status, url, [grep pattern on headers+body]
  local name="$1" want="$2" url="$3" pat="${4:-}" out code
  out="$(curl -sS -m 15 -D - -o - "$url" 2>&1)" || true
  code="$(printf '%s' "$out" | awk 'NR==1{print $2}')"
  if [ "$code" != "$want" ] || { [ -n "$pat" ] && ! printf '%s' "$out" | grep -qiE "$pat"; }; then
    printf 'FAIL  %-44s %s (want %s%s)\n' "$name" "${code:-no answer}" "$want" "${pat:+, /$pat/}"
    fail=$((fail + 1))
  else
    printf 'ok    %-44s %s\n' "$name" "$code"
  fi
}

# Local processes (loopback; the API is never public except through nginx).
check "API health (loopback)" 200 "http://127.0.0.1:3100/api/v1/health" '"status":"ok"'
check "preview server (loopback)" 200 "http://127.0.0.1:3102/robots.txt" 'Disallow: /'

check "admin: SPA" 200 "$ADMIN/" "content-security-policy: default-src 'self'; script-src 'self'"
check "admin: client route → SPA" 200 "$ADMIN/content/projects" '<div id="root">'
check "admin: API health" 200 "$ADMIN/api/v1/health" '"status":"ok"'
check "admin: no session → 401" 401 "$ADMIN/api/v1/auth/session"
check "admin: /internal closed" 404 "$ADMIN/internal/v1/redirect"
check "admin: not indexed" 200 "$ADMIN/robots.txt" 'Disallow: /'
check "preview: not indexed" 200 "$PREVIEW/robots.txt" 'Disallow: /'

if [ -z "${SMOKE_SKIP_SITE:-}" ]; then
  check "site: home" 200 "$SITE/" 'content-security-policy: default-src'
  check "site: Russian home" 200 "$SITE/ru" '<html lang="ru"'
  check "site: robots.txt" 200 "$SITE/robots.txt" 'Sitemap: '
  check "site: sitemap.xml" 200 "$SITE/sitemap.xml" '<urlset'
  check "site: unknown page → 404 page" 404 "$SITE/this-page-does-not-exist" '<html'
  check "site: old address /about → /company" 301 "$SITE/about" 'location: (https://soltexglobal.co)?/company'
  check "site: www → apex" 301 "${SITE/https:\/\//https://www.}/" 'location: https://soltexglobal.co/'
  check "site: http → https" 301 "${SITE/https:/http:}/" 'location: https://'
  check "site: API not public" 404 "$SITE/api/v1/health"
fi

echo
[ "$fail" -eq 0 ] && echo "smoke: all checks passed" || echo "smoke: $fail check(s) failed"
exit "$fail"
