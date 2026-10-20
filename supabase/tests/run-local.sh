#!/usr/bin/env bash
# Applies every migration to a throwaway local Postgres and runs the access tests.
# Requires Postgres server binaries (initdb, pg_ctl, psql). Safe to run repeatedly.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
PGBIN="${PGBIN:-$(dirname "$(ls /usr/lib/postgresql/*/bin/initdb 2>/dev/null | sort -V | tail -1)")}"
WORK="$(mktemp -d)"
PORT="${PGPORT_TEST:-54329}"
RUN=""
if [ "$(id -u)" = "0" ]; then chown "$(id -u postgres)" "$WORK"; RUN="su postgres -c"; fi
run() { if [ -n "$RUN" ]; then $RUN "$1"; else bash -c "$1"; fi; }
cleanup() { run "$PGBIN/pg_ctl -D $WORK/data stop -m immediate >/dev/null 2>&1" || true; rm -rf "$WORK"; }
trap cleanup EXIT
chmod 755 "$ROOT" "$ROOT/supabase" 2>/dev/null || true
run "$PGBIN/initdb -D $WORK/data -A trust -U postgres >/dev/null"
run "$PGBIN/pg_ctl -D $WORK/data -o '-p $PORT -k $WORK -c listen_addresses=' -l $WORK/log -w start >/dev/null"
PSQL="psql -X -q -h $WORK -p $PORT -U postgres -v ON_ERROR_STOP=1"
$PSQL -d postgres -c "create database mentoring_test" >/dev/null
$PSQL -d mentoring_test -f "$ROOT/supabase/tests/00_local_shim.sql" >/dev/null
for f in "$ROOT"/supabase/migrations/*.sql; do $PSQL -d mentoring_test -f "$f" >/dev/null; done
OUT="$($PSQL -d mentoring_test -o /dev/null -f "$ROOT/supabase/tests/access.sql" 2>&1 || true)"
echo "$OUT" | sed -n 's/.*NOTICE:  //p;/FAIL\|ERROR/p'
echo "$OUT" | grep -q "ALL ACCESS TESTS PASSED" || { echo "ACCESS TESTS FAILED"; exit 1; }
echo "ALL ACCESS TESTS PASSED"
