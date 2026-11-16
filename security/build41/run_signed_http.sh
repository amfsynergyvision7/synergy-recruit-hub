#!/usr/bin/env bash
set -euo pipefail
if [[ -z "$PGPASSWORD" || -z "$B41_JWT_SECRET" ]]; then echo 'Synthetic credentials required' >&2; exit 1; fi
if [[ "$(printf %s "$B41_JWT_SECRET" | wc -c)" -lt 32 ]]; then echo 'Synthetic JWT secret too short' >&2; exit 1; fi
psql -X -v ON_ERROR_STOP=1 -h localhost -U postgres -d postgres -f security/build41/production-shaped-signed-http-bootstrap.sql
docker run -d --rm --name build41-postgrest --network host \
 -e PGRST_DB_URI="postgres://authenticator:b41_synthetic_postgrest_login_only@localhost:5432/postgres" \
 -e PGRST_DB_ANON_ROLE=anon \
 -e PGRST_DB_SCHEMAS=public \
 -e PGRST_JWT_SECRET="$B41_JWT_SECRET" \
 -e PGRST_SERVER_PORT=3000 \
 postgrest/postgrest:v12.2.3
ready=0
for i in $(seq 1 45); do
 if curl -s -o /dev/null http://127.0.0.1:3000/; then ready=1; break; fi
 sleep 1
done
if [[ "$ready" != 1 ]]; then docker logs build41-postgrest; exit 1; fi
node security/build41/signed-postgrest-http.test.mjs
docker stop build41-postgrest >/dev/null
