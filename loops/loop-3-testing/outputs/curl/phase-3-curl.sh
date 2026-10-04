#!/usr/bin/env bash
# Phase 3 curl tests (habits): prints "ID | expected | actual | PASS/FAIL | detail"
B=http://localhost:8080/api/habits
Y=$(date -d yesterday +%F); T=$(date +%F); TM=$(date -d tomorrow +%F)
# Monday of the current ISO week, and an earlier day this week other than today (if any)
MON=$(date -d "$T -$(( $(date +%u) - 1 )) days" +%F)
TAG="p3qa$RANDOM"
OUT=$(mktemp)
pass=0; fail=0
check() { # id expected actual detail-ok(0/1) detail
  local id=$1 exp=$2 act=$3 ok=$4 det=$5
  if [[ "$exp" == "$act" && "$ok" == 1 ]]; then r=PASS; pass=$((pass+1)); else r=FAIL; fail=$((fail+1)); fi
  echo "$id | $exp | $act | $r | $det"
}
req() { # method url [body] [accept] -> sets CODE, BODY, CT
  local m=$1 u=$2 b=$3 a=${4:-}
  local args=(-s -o "$OUT" -w '%{http_code} %{content_type}' -X "$m")
  [[ -n "$a" ]] && args+=(-H "Accept: $a")
  if [[ -n "$b" ]]; then
    CODE=$(curl "${args[@]}" -H 'Content-Type: application/json' --data "$b" "$u")
  else
    CODE=$(curl "${args[@]}" "$u")
  fi
  CT=${CODE#* }; CODE=${CODE%% *}; BODY=$(cat "$OUT")
}
j() { echo "$BODY" | jq -r "$1"; }
ok() { "$@" && echo 1 || echo 0; }
isproblem() { [[ "$CT" == application/problem+json* ]] && echo 1 || echo 0; }
hasfield() { echo "$BODY" | jq -e --arg f "$1" '.errors|map(.field)|index($f)!=null' >/dev/null 2>&1 && [[ "$CT" == application/problem+json* ]] && echo 1 || echo 0; }
is404() { [[ $(isproblem) == 1 && $(j .status) == 404 ]] && echo 1 || echo 0; }

# --- createHabit (AS1)
req POST $B "{\"name\":\"  $TAG water  \",\"description\":\"8 glasses\",\"frequency\":\"DAILY\"}"
D=$(j .id)
check BE-001 201 $CODE $(ok [ "$(j .name)" == "$TAG water" -a "$(j .frequency)" == DAILY -a "$(j .active)" == true -a "$(j .completedToday)" == false -a "$(j .doneForCurrentPeriod)" == false -a "$(j .currentStreak)" == 0 -a "$(j .completionRate)" == 0 -a "$(j .lastCompletedDate)" == null ]) "id=$D name='$(j .name)' active=$(j .active) streak=$(j .currentStreak) rate=$(j .completionRate)"
req POST $B "{\"name\":\"$TAG run\",\"frequency\":\"WEEKLY\"}"
W=$(j .id)
check BE-002 201 $CODE $(ok [ "$(j .frequency)" == WEEKLY -a "$(j .description)" == null ]) "id=$W weekly description=$(j .description)"
N150=$(printf 'a%.0s' $(seq 1 150)); N151=${N150}a
D2000=$(printf 'd%.0s' $(seq 1 2000)); D2001=${D2000}d
req POST $B "{\"name\":\"$N150\",\"description\":\"$D2000\",\"frequency\":\"DAILY\"}"
L=$(j .id)
check BE-003 201 $CODE $(ok [ "$(j '.name|length')" == 150 -a "$(j '.description|length')" == 2000 ]) "boundary 150/2000 accepted id=$L"

# --- validation (400 problem+json)
req POST $B '{"name":"","frequency":"DAILY"}';       check BE-004 400 $CODE $(hasfield name) "empty name: $(j '.errors|map(.message)|join("; ")')"
req POST $B '{"name":"   ","frequency":"DAILY"}';    check BE-005 400 $CODE $(hasfield name) "blank name"
req POST $B '{"frequency":"DAILY"}';                 check BE-006 400 $CODE $(hasfield name) "missing name"
req POST $B "{\"name\":\"$N151\",\"frequency\":\"DAILY\"}"; check BE-007 400 $CODE $(hasfield name) "151 chars: $(j '.errors[0].message')"
req POST $B "{\"name\":\"x\",\"description\":\"$D2001\",\"frequency\":\"DAILY\"}"; check BE-008 400 $CODE $(hasfield description) "2001 desc: $(j '.errors[0].message')"
req POST $B '{"name":"x"}';                          check BE-009 400 $CODE $(hasfield frequency) "missing frequency: $(j '.errors[0].message')"
req POST $B '{"name":"x","frequency":"MONTHLY"}';    check BE-010 400 $CODE $(hasfield frequency) "invalid frequency"
req POST $B '{bad';                                  check BE-011 400 $CODE $(isproblem) "malformed json"

# --- getHabit
req GET $B/$D; check BE-012 200 $CODE $(ok [ "$(j .id)" == "$D" ]) "get id=$(j .id)"
req GET $B/999999; check BE-013 404 $CODE $(ok [ "$(is404)" == 1 -a "$(j .detail)" == "Habit 999999 not found" ]) "detail=$(j .detail)"
req GET $B/abc; check BE-014 400 $CODE $(hasfield id) "bad id"

# --- listHabits
req GET $B; check BE-015 200 $CODE $(ok [ "$(j "[.[].id] | (index($L) < index($W)) and (index($W) < index($D))")" == true ]) "newest first: $(j '[.[].id]|join(",")')"
req GET "$B?active=bogus"; check BE-016 400 $CODE $(hasfield active) "active=bogus"

# --- updateHabit
req PUT $B/$D "{\"name\":\" $TAG water2 \",\"description\":null,\"frequency\":\"DAILY\"}"
check BE-017 200 $CODE $(ok [ "$(j .name)" == "$TAG water2" -a "$(j .description)" == null ]) "name='$(j .name)' desc=$(j .description)"
req PUT $B/$D '{"name":"","frequency":"DAILY"}';    check BE-018 400 $CODE $(hasfield name) "empty name"
req PUT $B/$D "{\"name\":\"$N151\",\"frequency\":\"DAILY\"}"; check BE-019 400 $CODE $(hasfield name) "151 name"
req PUT $B/$D '{"name":"x","frequency":"YEARLY"}';  check BE-020 400 $CODE $(hasfield frequency) "bad frequency"
req PUT $B/999999 '{"name":"x","frequency":"DAILY"}'; check BE-021 404 $CODE $(is404) "missing"

# --- completeHabit (AS2, AS3)
req POST $B/$D/completions
check BE-022 201 $CODE $(ok [ "$(j .completedToday)" == true -a "$(j .doneForCurrentPeriod)" == true -a "$(j .currentStreak)" == 1 -a "$(j .completionRate)" == 100 -a "$(j .lastCompletedDate)" == "$T" ]) "no body: today=$T completedToday=$(j .completedToday) streak=$(j .currentStreak) rate=$(j .completionRate)"
req POST $B/$D/completions
check BE-023 409 $CODE $(ok [ "$(isproblem)" == 1 -a "$(j .detail)" == "Habit is already completed on $T" ]) "duplicate: $(j .detail)"
req POST $B/$D/completions "{\"date\":\"$T\"}"; check BE-024 409 $CODE $(isproblem) "duplicate explicit date"
req POST $B/$D/completions '{}'; check BE-025 409 $CODE $(isproblem) "duplicate {} body (what the UI sends)"
req POST $B/$D/completions "{\"date\":\"$Y\"}"
check BE-026 201 $CODE $(ok [ "$(j .currentStreak)" == 2 -a "$(j .lastCompletedDate)" == "$T" ]) "yesterday: streak=$(j .currentStreak) rate=$(j .completionRate)"
req POST $B/$D/completions "{\"date\":\"$TM\"}"; check BE-027 400 $CODE $(hasfield date) "future: $(j '.errors[0].message')"
req POST $B/$D/completions '{"date":"2026-13-40"}'; check BE-028 400 $CODE $(isproblem) "invalid date fields=$(j '.errors|map(.field)|join(",")')"
req POST $B/999999/completions; check BE-029 404 $CODE $(is404) "unknown habit"
# 6 parallel completions on a fresh habit → exactly one 201
req POST $B "{\"name\":\"$TAG race\",\"frequency\":\"DAILY\"}"; R=$(j .id)
codes=$(for i in 1 2 3 4 5 6; do curl -s -o /dev/null -w '%{http_code}\n' -X POST $B/$R/completions & done; wait)
n201=$(echo "$codes" | grep -c 201); n409=$(echo "$codes" | grep -c 409)
cnt=$(curl -s $B/$R/completions | jq length)
check BE-030 "1x201/5x409/1row" "${n201}x201/${n409}x409/${cnt}row" 1 "parallel duplicate guard"

# --- listHabitCompletions
req GET $B/$D/completions
check BE-031 200 $CODE $(ok [ "$(j '[.[].completionDate]|join(",")')" == "$T,$Y" -a "$(j ".[0].habitId")" == "$D" ]) "newest first: $(j '[.[].completionDate]|join(",")')"
req GET $B/999999/completions; check BE-032 404 $CODE $(is404) "unknown habit"

# --- uncompleteHabit (AS4)
req DELETE $B/$D/completions/$T
check BE-033 200 $CODE $(ok [ "$(j .completedToday)" == false -a "$(j .currentStreak)" == 1 -a "$(j .lastCompletedDate)" == "$Y" ]) "undo today: completedToday=$(j .completedToday) streak=$(j .currentStreak) last=$(j .lastCompletedDate)"
req DELETE $B/$D/completions/$T; check BE-034 404 $CODE $(is404) "missing completion: $(j .detail)"
req DELETE $B/$D/completions/notadate; check BE-035 400 $CODE $(hasfield date) "bad date"
req DELETE $B/999999/completions/$T; check BE-036 404 $CODE $(is404) "unknown habit"
req DELETE $B/$D/completions/$Y "" "application/json, application/problem+json"; check BE-037 200 $CODE 1 "undo with generated-client Accept header"

# --- weekly (AS2, AS5): completion earlier this week (Monday) or today when today is Monday
if [[ "$MON" != "$T" ]]; then
  req POST $B/$W/completions "{\"date\":\"$MON\"}"
  check BE-038 201 $CODE $(ok [ "$(j .completedToday)" == false -a "$(j .doneForCurrentPeriod)" == true -a "$(j .currentStreak)" == 1 -a "$(j .completionRate)" == 100 ]) "weekly Monday $MON: completedToday=$(j .completedToday) doneForCurrentPeriod=$(j .doneForCurrentPeriod) streak=$(j .currentStreak) rate=$(j .completionRate)"
  req DELETE $B/$W/completions/$MON
  check BE-039 200 $CODE $(ok [ "$(j .doneForCurrentPeriod)" == false -a "$(j .currentStreak)" == 0 ]) "weekly undo: doneForCurrentPeriod=$(j .doneForCurrentPeriod)"
else
  check BE-038 201 201 1 "skipped detail: today is Monday"; check BE-039 200 200 1 "skipped detail: today is Monday"
fi

# --- deactivate / activate (AS6)
curl -s -o /dev/null -X POST $B/$D/completions
req POST $B/$D/deactivate
check BE-040 200 $CODE $(ok [ "$(j .active)" == false -a "$(j .completedToday)" == true ]) "active=$(j .active) stats kept completedToday=$(j .completedToday)"
req GET "$B?active=true";  check BE-041 200 $CODE $(ok [ "$(j "map(.id)|index($D)")" == null ]) "active=true excludes $D"
req GET "$B?active=false"; check BE-042 200 $CODE $(ok [ "$(j "map(.id)|index($D)")" != null -a "$(j 'all(.active==false)')" == true ]) "active=false includes $D"
req GET $B/$D/completions; check BE-043 200 $CODE $(ok [ "$(j length)" == 1 -a "$(j ".[0].completionDate")" == "$T" ]) "history kept: $(j length) completions"
req POST $B/$D/activate; check BE-044 200 $CODE $(ok [ "$(j .active)" == true ]) "reactivated"
req POST $B/999999/deactivate; check BE-045 404 $CODE $(is404) "deactivate unknown"
req POST $B/999999/activate;   check BE-046 404 $CODE $(is404) "activate unknown"
req POST $B/abc/activate;      check BE-047 400 $CODE $(hasfield id) "activate bad id"

# --- deleteHabit (AS6) with the generated client's Accept header
req DELETE $B/$D "" "application/problem+json"; check BE-048 204 $CODE 1 "delete (Accept problem+json)"
req GET $B/$D; check BE-049 404 $CODE $(is404) "deleted habit gone"
req GET $B/$D/completions; check BE-050 404 $CODE $(is404) "completions of deleted habit gone"
req DELETE $B/$D; check BE-051 404 $CODE $(is404) "delete again"
req DELETE $B/abc; check BE-052 400 $CODE $(hasfield id) "delete bad id"
for id in $W $L $R; do curl -s -o /dev/null -X DELETE $B/$id; done
req GET $B; check BE-053 200 $CODE $(ok [ "$(j "map(select(.name|startswith(\"$TAG\")))|length")" == 0 ]) "cleanup: no $TAG habits left"

echo "TOTAL pass=$pass fail=$fail"
rm -f "$OUT"
