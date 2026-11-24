#!/usr/bin/env bash
# Put the site on Cloudflare: a Worker with the static build as assets and D1
# behind /api and /seasons. Run it after `wrangler login`.
#
#   PLAN_PASSPHRASE=... PLAN_SECRET=... scripts/deploy.sh
#
# Both secrets are generated if you leave them out, and printed once at the end.
set -euo pipefail
cd "$(dirname "$0")/.."

NODE="${NODE:-$HOME/.nvm/versions/node/v24.20.0/bin/node}"
[ -x "$NODE" ] || NODE="$(command -v node)"
WRANGLER=("$NODE" node_modules/wrangler/wrangler-dist/cli.js)
DB=seasons
PLACEHOLDER=REPLACE_AFTER_wrangler_d1_create

# tr | head dies of SIGPIPE under pipefail, so the secrets come from openssl.
PLAN_PASSPHRASE="${PLAN_PASSPHRASE:-$(openssl rand -hex 12)}"
PLAN_SECRET="${PLAN_SECRET:-$(openssl rand -hex 24)}"

echo "== whoami"
if ! "${WRANGLER[@]}" whoami >/dev/null 2>&1; then
	echo "not logged in. run this first, in a terminal:" >&2
	echo "  $NODE node_modules/wrangler/wrangler-dist/cli.js login" >&2
	exit 1
fi
"${WRANGLER[@]}" whoami | tail -3

echo "== d1 create $DB (skipped if it exists)"
"${WRANGLER[@]}" d1 create "$DB" 2>&1 | tee /tmp/d1-create.log || true
ID="$(grep -oE '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}' /tmp/d1-create.log | head -1 || true)"
if [ -n "$ID" ]; then
	echo "   database_id $ID"
	"$NODE" -e '
		const fs = require("node:fs");
		const path = "wrangler.jsonc";
		const text = fs.readFileSync(path, "utf8");
		const next = text.replace(/"database_id":\s*"[^"]*"/, `"database_id": "${process.argv[1]}"`);
		fs.writeFileSync(path, next);
	' "$ID"
else
	ID="$(grep -oE '"database_id":\s*"[^"]+"' wrangler.jsonc | grep -oE '[^"]+"$' | tr -d '"' || true)"
	echo "   reusing database_id from wrangler.jsonc: ${ID:-none}"
fi
if [ -z "$ID" ] || [ "$ID" = "$PLACEHOLDER" ]; then
	echo "no database id: create the database by hand and put its id in wrangler.jsonc" >&2
	exit 1
fi

echo "== migrations"
"${WRANGLER[@]}" d1 migrations apply "$DB" --remote

echo "== secrets"
printf '%s' "$PLAN_PASSPHRASE" | "${WRANGLER[@]}" secret put PLAN_PASSPHRASE
printf '%s' "$PLAN_SECRET" | "${WRANGLER[@]}" secret put PLAN_SECRET

echo "== build and deploy"
npm run build
"${WRANGLER[@]}" deploy 2>&1 | tee /tmp/deploy.log

URL="$(grep -oE 'https://[a-z0-9.-]+\.workers\.dev' /tmp/deploy.log | head -1 || true)"
echo
echo "worker: ${URL:-see the output above}"
echo
echo "put these in .env so npm run pull and npm run push talk to it:"
echo "  PLAN_URL=$URL"
echo "  PLAN_PASSPHRASE=$PLAN_PASSPHRASE"
echo
echo "then send the plan up once: npm run push"
