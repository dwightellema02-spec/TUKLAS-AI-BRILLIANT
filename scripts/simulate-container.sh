#!/bin/sh
# Rehearses what the Dockerfile does, from a CLEAN copy of the repository (only files git would ship: no node_modules, dist, .env, storage...):
#   npm ci -> prisma generate -> build -> scripts/start-production.sh (check settings, migrate, seed, first admin, serve) -> health/ready -> SIGTERM.
# It cannot replace `docker build` (the base image and apt-get are not exercised), but it catches what a clean checkout is missing.
#   SIM_DATABASE_URL=postgresql://user@host:5432/emptydb sh scripts/simulate-container.sh
set -eu
: "${SIM_DATABASE_URL:?set SIM_DATABASE_URL to an EMPTY PostgreSQL database}"
SRC="$(pwd)"
DIR="$(mktemp -d)"
trap 'kill "$SERVER_PID" 2>/dev/null || true; rm -rf "$DIR"' EXIT
SERVER_PID=""
git -C "$SRC" ls-files --cached --others --exclude-standard | tar -C "$SRC" -cf - -T - | tar -C "$DIR" -xf -
cd "$DIR"
echo "== clean copy: $(find . -type f | wc -l) files; npm ci"
npm ci --legacy-peer-deps > npm-ci.log 2>&1 || { tail -20 npm-ci.log; exit 1; }
echo "== prisma generate + build"
npx prisma generate > build.log 2>&1 && npm run build >> build.log 2>&1 || { tail -20 build.log; exit 1; }
[ -f dist/index.html ] || { echo "build produced no dist/index.html"; exit 1; }
PORT="${SIM_PORT:-6990}"
export NODE_ENV=production DATABASE_URL="$SIM_DATABASE_URL" PORT AI_PROVIDER=local TRUST_PROXY=true APP_URL=https://school.example.edu \
  AUTH_SECRET="$(node -e 'console.log(require("crypto").randomBytes(24).toString("hex"))')" \
  ADMIN_EMAIL=sim.admin@example.edu ADMIN_NAME="Sim Admin" ADMIN_PASSWORD="Sim-pass-12345" DOCUMENT_STORAGE_DIR="$DIR/storage/documents"
echo "== start-production.sh"
sh scripts/start-production.sh > server.log 2>&1 &
SERVER_PID=$!
i=0; until curl -fsS "http://127.0.0.1:$PORT/api/ready" > /dev/null 2>&1; do i=$((i+1)); [ $i -gt 120 ] && { echo "NOT READY after 120 s"; tail -30 server.log; exit 1; }; sleep 1; done
echo "== ready after ${i}s"
curl -fsS "http://127.0.0.1:$PORT/api/health"; echo
curl -fsS "http://127.0.0.1:$PORT/" | grep -q "<div id=\"root\"" && echo "web app served" || { echo "web app NOT served"; exit 1; }
CODE=$(curl -s -o /dev/null -w '%{http_code}' -X POST "http://127.0.0.1:$PORT/api/auth/login" -H 'Content-Type: application/json' -H 'X-Forwarded-Proto: https' -d '{"email":"sim.admin@example.edu","password":"Sim-pass-12345"}')
[ "$CODE" = "200" ] && echo "first administrator signs in" || { echo "admin sign-in returned $CODE"; exit 1; }
kill -TERM "$SERVER_PID"; wait "$SERVER_PID" 2>/dev/null && echo "clean shutdown (exit 0)" || { echo "unclean shutdown"; tail -5 server.log; exit 1; }
SERVER_PID=""
echo "SIMULATION OK"
