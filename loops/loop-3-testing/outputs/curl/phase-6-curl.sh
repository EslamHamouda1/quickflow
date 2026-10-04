#!/usr/bin/env bash
# Phase 6 curl tests (settings): prints "ID | expected | actual | PASS/FAIL | detail"
B=http://localhost:8080/api/settings
OUT=$(mktemp)
pass=0; fail=0
check() { local id=$1 exp=$2 act=$3 ok=$4 det=$5
  if [[ "$exp" == "$act" && "$ok" == 1 ]]; then r=PASS; pass=$((pass+1)); else r=FAIL; fail=$((fail+1)); fi
  echo "$id | $exp | $act | $r | $det"; }
req() { local m=$1 u=$2 b=$3
  local args=(-s -o "$OUT" -w '%{http_code} %{content_type}' -X "$m")
  if [[ -n "$b" ]]; then CODE=$(curl "${args[@]}" -H 'Content-Type: application/json' --data "$b" "$u"); else CODE=$(curl "${args[@]}" "$u"); fi
  CT=${CODE#* }; CODE=${CODE%% *}; BODY=$(cat "$OUT"); }
j() { echo "$BODY" | jq -r "$1"; }
jt() { echo "$BODY" | jq -e "$1" >/dev/null 2>&1 && echo 1 || echo 0; }
isproblem() { [[ "$CT" == application/problem+json* ]] && echo 1 || echo 0; }
hasfield() { echo "$BODY" | jq -e --arg f "$1" 'any(.errors[]; .field==$f)' >/dev/null 2>&1 && [[ "$CT" == application/problem+json* ]] && echo 1 || echo 0; }
body() { echo "{\"displayName\":$1,\"inAppNotifications\":$2,\"browserNotifications\":$3,\"defaultView\":$4}"; }
N80=$(printf 'a%.0s' $(seq 1 80)); N81=${N80}a

req GET $B; ORIG=$BODY
check BE-001 200 $CODE $(jt 'has("displayName") and has("inAppNotifications") and has("browserNotifications") and has("defaultView") and (.inAppNotifications|type)=="boolean"') "getSettings all 4 fields: $(j -c .)"
req PUT $B "$(body '"Sara"' false true '"TASKS"')"
check BE-002 200 $CODE $(jt '.displayName=="Sara" and .inAppNotifications==false and .browserNotifications==true and .defaultView=="TASKS"') "updateSettings all fields"
req GET $B
check BE-003 200 $CODE $(jt '.displayName=="Sara" and .inAppNotifications==false and .browserNotifications==true and .defaultView=="TASKS"') "persisted on GET"
req PUT $B "$(body '"  Omar  "' true false '"PLANS"')"
check BE-004 200 $CODE $(jt '.displayName=="Omar" and .defaultView=="PLANS"') "name trimmed"
for v in DASHBOARD TASKS HABITS LEARNING PLANS; do
  req PUT $B "$(body '"V"' true false "\"$v\"")"
  check BE-005-$v 200 $CODE $(jt ".defaultView==\"$v\"") "defaultView $v accepted"
done
req PUT $B "$(body "\"$N80\"" true false '"HABITS"')"
check BE-006 200 $CODE $(jt '(.displayName|length)==80') "80-char name ok"
req PUT $B "$(body '"   "' true false '"TASKS"')";   check BE-007 400 $CODE $(hasfield displayName) "blank name problem+json errors[displayName]"
req PUT $B "$(body '""' true false '"TASKS"')";      check BE-008 400 $CODE $(hasfield displayName) "empty name"
req PUT $B "$(body "\"$N81\"" true false '"TASKS"')"; check BE-009 400 $CODE $(hasfield displayName) "81-char name"
req PUT $B '{"inAppNotifications":true,"browserNotifications":false,"defaultView":"TASKS"}'; check BE-010 400 $CODE $(hasfield displayName) "missing displayName"
req PUT $B '{"displayName":"x","browserNotifications":false,"defaultView":"TASKS"}'; check BE-011 400 $CODE $(hasfield inAppNotifications) "missing inAppNotifications"
req PUT $B '{"displayName":"x","inAppNotifications":true,"defaultView":"TASKS"}'; check BE-012 400 $CODE $(hasfield browserNotifications) "missing browserNotifications"
req PUT $B '{"displayName":"x","inAppNotifications":true,"browserNotifications":false}'; check BE-013 400 $CODE $(hasfield defaultView) "missing defaultView"
req PUT $B "$(body '"x"' true false '"CALENDAR"')"; check BE-014 400 $CODE $(( $(isproblem) && $(jt '.status==400') )) "invalid enum problem+json"
req PUT $B "$(body '"x"' '"yes"' false '"TASKS"')"; check BE-015 400 $CODE $(isproblem) "non-boolean inAppNotifications"
req PUT $B '{'; check BE-016 400 $CODE $(isproblem) "malformed JSON"
req PUT $B '{}'; check BE-017 400 $CODE $(jt '[.errors[].field]|contains(["displayName","inAppNotifications","browserNotifications","defaultView"])') "empty body: all 4 field errors"
req GET $B; check BE-018 200 $CODE $(jt '(.displayName|length)==80 and .defaultView=="HABITS"') "unchanged after 400s"
req DELETE $B; check BE-019 405 $CODE 1 "unsupported method"
req POST $B "$(body '"x"' true false '"TASKS"')"; check BE-020 405 $CODE 1 "POST not allowed"
CODE=$(curl -s -o /dev/null -w '%{http_code}' -X PUT -H 'Content-Type: text/plain' --data 'x' $B); check BE-021 415 $CODE 1 "wrong content type"
# restore defaults
req PUT $B "$(body '"Friend"' true false '"DASHBOARD"')"; check BE-022 200 $CODE $(jt '.displayName=="Friend" and .defaultView=="DASHBOARD"') "restore defaults"
echo "TOTAL=$((pass+fail)) PASS=$pass FAIL=$fail"
