#!/usr/bin/env bash
# Phase 8: validation (400 problem) and not-found (404) checks, run with 1,010 tasks stored.
B=${B:-http://localhost:8080}
R=$(mktemp)
PASS=0; FAIL=0
c() { # expected id args...
  local exp=$1 id=$2; shift 2
  out=$(curl -s -o "$R" -w '%{http_code} %{content_type} %{time_total}' "$@")
  code=${out%% *}
  if [ "$code" = "$exp" ] && grep -q problem <<<"$out" && [ "$(jq .status "$R")" = "$exp" ]; then ok=PASS; PASS=$((PASS+1)); else ok=FAIL; FAIL=$((FAIL+1)); fi
  echo "$id ${*: -1} exp $exp got $out $(jq -c '{title,errors:[.errors[]?.field]}' "$R") $ok"
}
J='Content-Type: application/json'
c 400 V-01 -X POST -H "$J" --data '{"title":""}' $B/api/tasks
c 400 V-02 -X POST -H "$J" --data '{"name":"x"}' $B/api/habits
c 400 V-03 -X POST -H "$J" --data '{"title":""}' $B/api/learning-cards
c 400 V-04 -X POST -H "$J" --data '{"title":"p","items":[]}' $B/api/plans
c 400 V-05 -X PUT -H "$J" --data '{"displayName":""}' $B/api/settings
c 400 V-06 "$B/api/tasks?sort=bogus"
c 404 N-01 $B/api/tasks/999999
c 404 N-02 $B/api/habits/999999
c 404 N-03 $B/api/learning-cards/999999
c 404 N-04 $B/api/plans/999999
echo "TOTAL: $PASS pass, $FAIL fail"
rm -f "$R"
