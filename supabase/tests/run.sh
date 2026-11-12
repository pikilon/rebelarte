#!/usr/bin/env bash
# Pruebas de base de datos de Rebelarte: levanta un Postgres 16 temporal, carga los
# stubs de Supabase, aplica migraciones y seed, y ejecuta tests/*.test.sql.
# Sale con código != 0 si algo falla. Uso: npm run test:db
set -uo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"      # supabase/tests
SUPA="$(dirname "$HERE")"                                   # supabase
PGBIN="${PGBIN:-/usr/lib/postgresql/16/bin}"
[ -x "$PGBIN/initdb" ] || PGBIN="$(dirname "$(command -v initdb 2>/dev/null || echo /usr/lib/postgresql/16/bin/initdb)")"

TMP="$(mktemp -d)"
chmod 755 "$TMP"
# initdb no se puede ejecutar como root: si lo somos, usar el usuario postgres
as_pg() { if [ "$(id -u)" = 0 ]; then runuser -u postgres -- "$@"; else "$@"; fi; }
[ "$(id -u)" = 0 ] && chown postgres "$TMP"

PORT="$(python3 - <<'PY'
import socket
s = socket.socket(); s.bind(("127.0.0.1", 0)); print(s.getsockname()[1]); s.close()
PY
)"

cleanup() {
  as_pg "$PGBIN/pg_ctl" -D "$TMP/data" -m immediate stop >/dev/null 2>&1 || true
  rm -rf "$TMP"
}
trap cleanup EXIT

as_pg "$PGBIN/initdb" -D "$TMP/data" -U postgres --auth=trust -E UTF8 --locale=C --no-sync >"$TMP/initdb.log" 2>&1 \
  || { cat "$TMP/initdb.log"; echo "initdb falló"; exit 2; }
as_pg "$PGBIN/pg_ctl" -D "$TMP/data" -l "$TMP/pg.log" -w \
  -o "-p $PORT -c listen_addresses=127.0.0.1 -c unix_socket_directories=$TMP -c fsync=off -c synchronous_commit=off -c full_page_writes=off" \
  start >/dev/null || { cat "$TMP/pg.log"; echo "pg_ctl start falló"; exit 2; }

DB=rebelarte_test
PSQL=("$PGBIN/psql" -h 127.0.0.1 -p "$PORT" -U postgres -X -q -v ON_ERROR_STOP=1)
"$PGBIN/psql" -h 127.0.0.1 -p "$PORT" -U postgres -X -q -c "create database $DB" || exit 2

export PGOPTIONS='-c client_min_messages=notice'
run_sql() {  # run_sql <fichero>  (muestra solo avisos y errores, sin el prefijo de psql)
  "${PSQL[@]}" -d "$DB" -o /dev/null -f "$1" 2>&1 | sed -E 's/^psql:[^ ]+ (NOTICE|ERROR|WARNING):  /\1: /; s/^NOTICE: //'
  return "${PIPESTATUS[0]}"
}

echo "== stubs de Supabase"
sed "s/current_database_placeholder/$DB/" "$HERE/stubs.sql" > "$TMP/stubs.sql"
run_sql "$TMP/stubs.sql" || { echo "stubs falló"; exit 1; }

echo "== migraciones"
for f in "$SUPA"/migrations/*.sql; do
  echo "   $(basename "$f")"
  run_sql "$f" || { echo "migración fallida: $f"; exit 1; }
done

echo "== seed"
run_sql "$SUPA/seed.sql" || { echo "seed falló"; exit 1; }
run_sql "$SUPA/seed.sql" || { echo "seed no es idempotente"; exit 1; }   # idempotencia
run_sql "$HERE/helpers.sql" || { echo "helpers falló"; exit 1; }

echo "== seed-demo (en una transacción que se revierte)"
{ echo "begin;"; cat "$SUPA/seed-demo.sql"; echo "rollback;"; } > "$TMP/demo.sql"
run_sql "$TMP/demo.sql" || { echo "seed-demo falló"; exit 1; }

fail=0
total=0
shopt -s nullglob
for f in "$HERE"/*.test.sql; do
  total=$((total + 1))
  echo "== $(basename "$f")"
  # cada fichero va dentro de una transacción que se revierte al final
  { echo "begin;"; cat "$f"; echo; echo "rollback;"; } > "$TMP/case.sql"
  if ! out="$(run_sql "$TMP/case.sql")"; then
    echo "$out"
    echo "!! FALLO en $(basename "$f")"
    fail=$((fail + 1))
  else
    echo "$out" | grep -c '^ok ' | sed 's/^/   aserciones ok: /'
    [ -n "${VERBOSE:-}" ] && echo "$out"
  fi
done

echo
if [ "$fail" -ne 0 ]; then
  echo "PRUEBAS DE BD: $fail de $total ficheros fallaron"
  exit 1
fi
echo "PRUEBAS DE BD: $total ficheros, todo correcto"
