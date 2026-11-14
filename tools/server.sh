#!/bin/bash
# Developer tool: applies server/schema.sql to the Supabase project of the rating.
# Uses the Supabase CLI login token in ~/.config/supabase/access-token.
#   tools/server.sh            apply the schema
#   tools/server.sh "select 1" run one query and print the result
set -euo pipefail
cd "$(dirname "$0")/.."
REF=qofvpeteuvwhfnwhmdhq
TOKEN=$(cat ~/.config/supabase/access-token)
sql=${1:-$(cat server/schema.sql)}
body=$(python3 -c 'import json,sys; print(json.dumps({"query": sys.argv[1]}))' "$sql")
curl -sS -m 60 -X POST "https://api.supabase.com/v1/projects/$REF/database/query" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" --data "$body"
echo
