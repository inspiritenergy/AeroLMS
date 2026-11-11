#!/bin/bash
# AeroLMS - inicializace databáze předváděcí instance.
#
# Běží jako jednorázový kontejner (služba db-init v docker-compose.demo.yaml) před
# startem aplikace. Kroky:
#   1. počká na SQL Server
#   2. založí simulaci tabulek Heliosu (deployment/demo/sql/00_helios_simulation.sql)
#   3. spustí PRODUKČNÍ skripty deployment/sql/02-10 beze změny
#   4. naplní předváděcí data, jen když je databáze bez zaměstnanců
#   5. založí přihlášení aplikace AeroLMS s nejmenšími potřebnými právy
#
# Všechny kroky jsou bezpečně opakovatelné: nové nasazení data nepřepíše.
# DEMO_RESET=true databázi smaže a založí znovu (návrat předváděcích dat do výchozího stavu).
#
# Proměnné prostředí:
#   MSSQL_HOST (výchozí mssql), MSSQL_SA_PASSWORD, APP_DB_PASSWORD,
#   DEMO_ADMIN_PASSWORD, DEMO_TRAINER_PASSWORD, DEMO_WORKER_PASSWORD, DEMO_RESET

set -euo pipefail

HOST="${MSSQL_HOST:-mssql}"
DB="Helios003"
PROD_SQL_DIR="/opt/aerolms/sql"
DEMO_SQL_DIR="/opt/aerolms/demo/sql"

log() { echo "[db-init] $*"; }
fail() { echo "[db-init] CHYBA: $*" >&2; exit 1; }

SQLCMD=""
for candidate in /opt/mssql-tools18/bin/sqlcmd /opt/mssql-tools/bin/sqlcmd; do
  if [ -x "$candidate" ]; then SQLCMD="$candidate"; break; fi
done
[ -n "$SQLCMD" ] || fail "sqlcmd v obrazu nenalezen"

for name in MSSQL_SA_PASSWORD APP_DB_PASSWORD DEMO_ADMIN_PASSWORD DEMO_TRAINER_PASSWORD DEMO_WORKER_PASSWORD; do
  [ -n "${!name:-}" ] || fail "proměnná $name není nastavena"
done

# Heslo přihlášení aplikace se dosazuje do SQL a do připojovacího řetězce jako text.
# Povolená abeceda vylučuje znaky, které by změnily jejich význam. Generuje ho Coolify.
[[ "$APP_DB_PASSWORD" =~ ^[A-Za-z0-9_.-]{8,64}$ ]] || fail "APP_DB_PASSWORD smí obsahovat jen písmena, číslice a znaky _ . - (8 až 64 znaků)"

# Hesla předváděcích účtů volí provozovatel a smí obsahovat libovolné znaky. Do SQL
# se proto předávají zakódovaná šestnáctkově (UTF-16LE): v textu SQL jsou z nich jen
# znaky 0-9 a a-f. Výsledek se vrací v proměnné HEX.
hex_utf16() {
  local name="$1" value="${!1}" units
  [[ "$value" =~ [[:cntrl:]] ]] && fail "$name obsahuje řídicí znak (konec řádku, tabulátor)"
  HEX="$(printf '%s' "$value" | iconv -f UTF-8 -t UTF-16LE | od -An -v -tx1 | tr -d ' \n')" \
    || fail "$name není platný text v UTF-8"
  [[ "$HEX" =~ ^([0-9a-f]{4})+$ ]] || fail "$name se nepodařilo zakódovat"
  units=$(( ${#HEX} / 4 ))
  [ "$units" -ge 8 ] && [ "$units" -le 64 ] || fail "$name musí mít 8 až 64 znaků"
}
hex_utf16 DEMO_ADMIN_PASSWORD;   DEMO_ADMIN_PASSWORD_HEX="$HEX"
hex_utf16 DEMO_TRAINER_PASSWORD; DEMO_TRAINER_PASSWORD_HEX="$HEX"
hex_utf16 DEMO_WORKER_PASSWORD;  DEMO_WORKER_PASSWORD_HEX="$HEX"
unset HEX

export SQLCMDPASSWORD="$MSSQL_SA_PASSWORD"

# -b: chyba SQL ukončí sqlcmd nenulovým kódem; -C: certifikát serveru je v kontejneru
# podepsaný sám sebou; -f 65001: skripty jsou v UTF-8; -I: QUOTED_IDENTIFIER ON
# (filtrované indexy a zápis do tabulek s nimi ho vyžadují).
run_sql() { "$SQLCMD" -S "$HOST" -U sa -C -b -I -f 65001 "$@"; }
scalar() { run_sql -h -1 -W -d "$1" -Q "SET NOCOUNT ON; $2" | tr -d '[:space:]'; }

log "čekám na SQL Server ($HOST)"
ready=0
for attempt in $(seq 1 60); do
  if run_sql -l 5 -Q "SELECT 1" >/dev/null 2>&1; then ready=1; break; fi
  sleep 3
done
[ "$ready" = "1" ] || fail "SQL Server neodpověděl do 180 s"
log "SQL Server odpovídá: $(scalar master "SELECT CAST(SERVERPROPERTY('ProductVersion') AS VARCHAR(32)) + '/' + CAST(SERVERPROPERTY('Edition') AS VARCHAR(64))")"

if [ "${DEMO_RESET:-false}" = "true" ]; then
  exists="$(scalar master "SELECT COUNT(*) FROM sys.databases WHERE name = N'$DB'")"
  if [ "$exists" = "1" ]; then
    marked="$(scalar "$DB" "SELECT COUNT(*) FROM sys.extended_properties WHERE class = 0 AND name = N'AeroLMS.HeliosSimulation'")"
    [ "$marked" = "1" ] || fail "DEMO_RESET: databáze $DB není označena jako simulace, mazat ji nebudu"
    log "DEMO_RESET=true: mažu databázi $DB"
    run_sql -Q "ALTER DATABASE [$DB] SET SINGLE_USER WITH ROLLBACK IMMEDIATE; DROP DATABASE [$DB];"
  fi
fi

log "simulace tabulek Heliosu"
run_sql -i "$DEMO_SQL_DIR/00_helios_simulation.sql"

for script in "$PROD_SQL_DIR"/0[2-9]_*.sql "$PROD_SQL_DIR"/1[0-9]_*.sql; do
  [ -f "$script" ] || continue
  log "produkční skript $(basename "$script")"
  # -x: produkční skripty proměnné sqlcmd nepoužívají, substituce se u nich vypíná
  run_sql -d "$DB" -x -i "$script" >/tmp/db-init-last.log 2>&1 || { cat /tmp/db-init-last.log >&2; fail "skript $(basename "$script") selhal"; }
done

employees="$(scalar "$DB" "SELECT COUNT(*) FROM dbo.TabCisZam")"
if [ "$employees" = "0" ]; then
  log "plním předváděcí data"
  run_sql -d "$DB" -i "$DEMO_SQL_DIR/90_demo_seed.sql" \
    -v DEMO_ADMIN_PASSWORD_HEX="$DEMO_ADMIN_PASSWORD_HEX" \
       DEMO_TRAINER_PASSWORD_HEX="$DEMO_TRAINER_PASSWORD_HEX" \
       DEMO_WORKER_PASSWORD_HEX="$DEMO_WORKER_PASSWORD_HEX"
else
  log "databáze už obsahuje $employees zaměstnanců, předváděcí data nechávám beze změny"
fi

log "přihlášení aplikace AeroLMS"
run_sql -d master -v APP_DB_PASSWORD="$APP_DB_PASSWORD" -i "$DEMO_SQL_DIR/95_app_login.sql"

log "hotovo: zaměstnanců v pohledu InspiritCisZam: $(scalar "$DB" "SELECT COUNT(*) FROM dbo.InspiritCisZam"), školení: $(scalar "$DB" "SELECT COUNT(*) FROM dbo.InspiritTraining WHERE deletedAt IS NULL")"
