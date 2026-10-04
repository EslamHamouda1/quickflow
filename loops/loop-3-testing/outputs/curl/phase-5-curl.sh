#!/usr/bin/env bash
# Phase 5 curl tests (plans): prints "ID | expected | actual | PASS/FAIL | detail"
H=http://localhost:8080/api
B=$H/plans
TAG="p5qa$RANDOM"
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
jt() { echo "$BODY" | jq -e "$1" >/dev/null 2>&1 && echo 1 || echo 0; }
isproblem() { [[ "$CT" == application/problem+json* ]] && echo 1 || echo 0; }
hasfield() { echo "$BODY" | jq -e --arg f "$1" 'any(.errors[]; .field|contains($f))' >/dev/null 2>&1 && [[ "$CT" == application/problem+json* ]] && echo 1 || echo 0; }
is404() { [[ $(isproblem) == 1 && $(j .status) == 404 ]] && echo 1 || echo 0; }
ts() { date -u -d "$1" +%Y-%m-%dT%H:%M:%SZ; }
T200=$(printf 'a%.0s' $(seq 1 200)); T201=${T200}a

# --- sources
req POST $H/tasks "{\"title\":\"$TAG task\"}"; T=$(j .id)
req POST $H/tasks "{\"title\":\"$TAG task2\"}"; T2=$(j .id)
req POST $H/tasks "{\"title\":\"$TAG archived\"}"; TA=$(j .id); curl -s -o /dev/null -X POST $H/tasks/$TA/archive
req POST $H/habits "{\"name\":\"$TAG habit\",\"frequency\":\"DAILY\"}"; HB=$(j .id)
req POST $H/habits "{\"name\":\"$TAG inactive\",\"frequency\":\"DAILY\"}"; HI=$(j .id); curl -s -o /dev/null -X POST $H/habits/$HI/deactivate
req POST $H/learning-cards "{\"title\":\"$TAG card\"}"; C=$(j .id)
ITEMS="[{\"sourceType\":\"TASK\",\"sourceId\":$T},{\"sourceType\":\"HABIT\",\"sourceId\":$HB},{\"sourceType\":\"LEARNING_RESOURCE\",\"sourceId\":$C}]"
plan() { # title start end priority items
  echo "{\"title\":\"$1\",\"estimatedDurationMinutes\":90,\"startDateTime\":\"$2\",\"endDateTime\":\"$3\",\"priorityOrder\":$4,\"items\":$5}"
}
PAST=$(ts '-10 min'); FUT=$(ts '+1 hour'); FUT2=$(ts '+2 hour'); OLD1=$(ts '-3 hour'); OLD2=$(ts '-2 hour')

# --- createPlan (AS1, AS5)
req POST $B "$(plan "  $TAG in progress  " $PAST $FUT 50 "$ITEMS")"; P=$(j .id)
check BE-001 201 $CODE $(jt ".title==\"$TAG in progress\" and .status==\"IN_PROGRESS\" and .restSeconds>3500 and .restSeconds<=3600 and .itemsTotal==3 and .itemsDone==0 and .progressPercent==0 and .startNotifiedAt==null and .estimatedDurationMinutes==90 and .priorityOrder==50 and ([.items[].sourceAvailable]|all) and ([.items[].done]|any|not) and .items[0].sourceTitle==\"$TAG task\" and .items[1].sourceTitle==\"$TAG habit\" and .items[2].sourceTitle==\"$TAG card\"") "id=$P status=$(j .status) rest=$(j .restSeconds) title='$(j .title)'"
req POST $B "$(plan "$TAG upcoming" $FUT $FUT2 49 "[{\"sourceType\":\"TASK\",\"sourceId\":$T2}]")"; PU=$(j .id)
check BE-002 201 $CODE $(jt '.status=="NOT_STARTED" and .restSeconds==null and .progressPercent==0') "id=$PU status=$(j .status) rest=$(j .restSeconds)"
req POST $B "$(plan "$TAG past" $OLD1 $OLD2 50 "[{\"sourceType\":\"TASK\",\"sourceId\":$T2}]")"; PP=$(j .id)
check BE-003 201 $CODE $(jt '.status=="COMPLETED" and .progressPercent==0 and .restSeconds==null') "id=$PP end passed with open items → $(j .status)"
req POST $B "$(plan "$T200" $PAST $FUT 50 "[{\"sourceType\":\"TASK\",\"sourceId\":$T2}]")"; PL=$(j .id)
check BE-004 201 $CODE $(jt '.title|length==200') "200-char title boundary id=$PL"

# --- listPlans / getPlan (AS7)
req GET $B; check BE-005 200 $CODE $(jt "[.[]|select(.id==$P or .id==$PU or .id==$PP or .id==$PL)|.id]==[$PU,$PP,$P,$PL]") "order prio asc, start asc: $(j "[.[]|select(.id==$P or .id==$PU or .id==$PP or .id==$PL)|.id]|join(\",\")") (P=$P PU=$PU PP=$PP PL=$PL)"
req GET "$B?status=IN_PROGRESS"; check BE-006 200 $CODE $(jt "(map(.status)|all(.==\"IN_PROGRESS\")) and any(.[];.id==$P) and (any(.[];.id==$PU)|not)") "filter IN_PROGRESS"
req GET "$B?status=NOT_STARTED"; check BE-007 200 $CODE $(jt "(map(.status)|all(.==\"NOT_STARTED\")) and any(.[];.id==$PU)") "filter NOT_STARTED"
req GET "$B?status=COMPLETED"; check BE-008 200 $CODE $(jt "(map(.status)|all(.==\"COMPLETED\")) and any(.[];.id==$PP)") "filter COMPLETED"
req GET "$B?status=BOGUS"; check BE-009 400 $CODE $(isproblem) "invalid status enum"
req GET $B/$P; check BE-010 200 $CODE $(jt ".id==$P and .status==\"IN_PROGRESS\"") "get"
req GET $B/999999; check BE-011 404 $CODE $(is404) "get unknown: $(j .detail)"
req GET $B/abc; check BE-012 400 $CODE $(isproblem) "get non-numeric id"

# --- create validation (AS2) — 400 problem+json with field
req POST $B "$(plan "" $PAST $FUT 1 "$ITEMS")"; check BE-013 400 $CODE $(hasfield title) "empty title: $(j '.errors[0].message')"
req POST $B "$(plan "   " $PAST $FUT 1 "$ITEMS")"; check BE-014 400 $CODE $(hasfield title) "blank title"
req POST $B "$(plan "$T201" $PAST $FUT 1 "$ITEMS")"; check BE-015 400 $CODE $(hasfield title) "201-char title"
req POST $B "$(plan x $PAST $FUT 1 "[]")"; check BE-016 400 $CODE $(hasfield items) "no items: $(j '.errors[0].message')"
req POST $B "$(plan x $PAST $PAST 1 "$ITEMS")"; check BE-017 400 $CODE $(hasfield endDateTime) "end == start: $(j '.errors[0].message')"
req POST $B "$(plan x $FUT $PAST 1 "$ITEMS")"; check BE-018 400 $CODE $(hasfield endDateTime) "end < start"
req POST $B "{\"title\":\"x\",\"estimatedDurationMinutes\":0,\"startDateTime\":\"$PAST\",\"endDateTime\":\"$FUT\",\"priorityOrder\":1,\"items\":$ITEMS}"; check BE-019 400 $CODE $(hasfield estimatedDurationMinutes) "duration 0"
req POST $B "$(plan x $PAST $FUT 0 "$ITEMS")"; check BE-020 400 $CODE $(hasfield priorityOrder) "priority 0"
req POST $B "{\"title\":\"x\",\"startDateTime\":\"$PAST\",\"endDateTime\":\"$FUT\",\"items\":$ITEMS}"; check BE-021 400 $CODE $(ok() { [[ $(hasfield estimatedDurationMinutes) == 1 && $(hasfield priorityOrder) == 1 ]] && echo 1 || echo 0; }; ok) "missing duration + priority"
req POST $B "{\"title\":\"x\",\"estimatedDurationMinutes\":5,\"priorityOrder\":1,\"items\":$ITEMS}"; check BE-022 400 $CODE $(ok() { [[ $(hasfield startDateTime) == 1 && $(hasfield endDateTime) == 1 ]] && echo 1 || echo 0; }; ok) "missing start + end"
req POST $B "$(plan x $PAST $FUT 1 "[{\"sourceId\":$T}]")"; check BE-023 400 $CODE $(hasfield sourceType) "item without sourceType"
req POST $B "$(plan x $PAST $FUT 1 "[{\"sourceType\":\"TASK\"}]")"; check BE-024 400 $CODE $(hasfield sourceId) "item without sourceId"
req POST $B "$(plan x $PAST $FUT 1 "[{\"sourceType\":\"BOOK\",\"sourceId\":1}]")"; check BE-025 400 $CODE $(isproblem) "invalid sourceType enum"
req POST $B "$(plan x $PAST $FUT 1 "[{\"sourceType\":\"TASK\",\"sourceId\":$TA}]")"; check BE-026 400 $CODE $(hasfield items) "archived task: $(j '.errors[0].message')"
req POST $B "$(plan x $PAST $FUT 1 "[{\"sourceType\":\"HABIT\",\"sourceId\":$HI}]")"; check BE-027 400 $CODE $(hasfield items) "inactive habit: $(j '.errors[0].message')"
req POST $B "$(plan x $PAST $FUT 1 "[{\"sourceType\":\"LEARNING_RESOURCE\",\"sourceId\":999999}]")"; check BE-028 400 $CODE $(hasfield items) "unknown card"
req POST $B "$(plan x $PAST $FUT 1 "[{\"sourceType\":\"TASK\",\"sourceId\":$T},{\"sourceType\":\"TASK\",\"sourceId\":$T}]")"; check BE-029 400 $CODE $(hasfield items) "duplicate source: $(j '.errors[0].message')"
req POST $B '{bad'; check BE-030 400 $CODE $(isproblem) "malformed json"

# --- setPlanItemDone (AS3, AS4)
req GET $B/$P; TI=$(j '.items[]|select(.sourceType=="TASK").id'); HII=$(j '.items[]|select(.sourceType=="HABIT").id'); LI=$(j '.items[]|select(.sourceType=="LEARNING_RESOURCE").id')
req PUT $B/$P/items/$TI '{"done":true}'; check BE-031 200 $CODE $(jt '.itemsDone==1 and .progressPercent==33 and .status=="IN_PROGRESS"') "task item done → $(j .progressPercent)%"
req GET $H/tasks/$T; check BE-032 200 $CODE $(jt '.status=="DONE" and .completedAt!=null') "task side effect → $(j .status)"
req PUT $B/$P/items/$HII '{"done":true}'; check BE-033 200 $CODE $(jt '.progressPercent==67') "habit item done → $(j .progressPercent)%"
req GET $H/habits/$HB/completions; check BE-034 200 $CODE $(jt 'length==1') "habit has today's completion ($(j length))"
req PUT $B/$P/items/$HII '{"done":false}'; req PUT $B/$P/items/$HII '{"done":true}'
req GET $H/habits/$HB/completions; check BE-035 200 $CODE $(jt 'length==1') "habit undo+redo: still 1 completion"
req PUT $B/$P/items/$LI '{"done":true}'; check BE-036 200 $CODE $(jt '.status=="COMPLETED" and .progressPercent==100 and .restSeconds==null') "all done → $(j .status) $(j .progressPercent)%"
req GET $H/learning-cards/$C; check BE-037 200 $CODE $(jt '.status=="NOT_STARTED" and (.milestones|length)==0') "learning card untouched"
req PUT $B/$P/items/$TI '{"done":false}'; check BE-038 200 $CODE $(jt '.status=="IN_PROGRESS" and .progressPercent==67 and .restSeconds>0') "undo task item → $(j .status)"
req GET $H/tasks/$T; check BE-039 200 $CODE $(jt '.status=="DONE"') "undo never reverts task"
req GET $H/habits/$HB/completions; req PUT $B/$P/items/$HII '{"done":false}'; req GET $H/habits/$HB/completions; check BE-040 200 $CODE $(jt 'length==1') "undo never reverts habit"
req PUT $B/$P/items/$TI '{}'; check BE-041 400 $CODE $(hasfield done) "missing done"
req PUT $B/$P/items/$TI '{"done":null}'; check BE-042 400 $CODE $(hasfield done) "done null"
req PUT $B/$P/items/999999 '{"done":true}'; check BE-043 404 $CODE $(is404) "unknown item"
req PUT $B/999999/items/$TI '{"done":true}'; check BE-044 404 $CODE $(is404) "unknown plan"
req PUT $B/$PU/items/$TI '{"done":true}'; check BE-045 404 $CODE $(is404) "item of another plan"
req PUT $B/$P/items/abc '{"done":true}'; check BE-046 400 $CODE $(isproblem) "non-numeric itemId"

# --- acknowledgePlanStart (AS6)
req POST $B/$P/start-notification; A1=$(j .startNotifiedAt); check BE-047 200 $CODE $(jt '.startNotifiedAt!=null') "ack → $A1"
sleep 1
req POST $B/$P/start-notification; check BE-048 200 $CODE $(jt ".startNotifiedAt==\"$A1\"") "idempotent: $(j .startNotifiedAt)"
req POST $B/999999/start-notification; check BE-049 404 $CODE $(is404) "ack unknown plan"
req POST $B/abc/start-notification; check BE-050 400 $CODE $(isproblem) "ack non-numeric id"

# --- removed source (AS9)
curl -s -o /dev/null -X DELETE $H/tasks/$T
req GET $B/$P; check BE-051 200 $CODE $(jt '(.items[]|select(.sourceType=="TASK")|.sourceAvailable==false and .sourceTitle!=null) and .itemsTotal==3') "deleted task kept as removed source"
req PUT $B/$P/items/$TI '{"done":true}'; check BE-052 200 $CODE $(jt '.progressPercent==67 and .itemsDone==2') "removed item still counts: $(j .itemsDone)/$(j .itemsTotal)"

# --- deletePlan (AS8)
req DELETE $B/$P "" "application/problem+json"; check BE-053 204 $CODE 1 "delete (Accept problem+json)"
req GET $B/$P; check BE-054 404 $CODE $(is404) "deleted plan gone"
req DELETE $B/$P; check BE-055 404 $CODE $(is404) "delete again"
req DELETE $B/abc; check BE-056 400 $CODE $(isproblem) "delete non-numeric id"
req GET $H/habits/$HB; check BE-057 200 $CODE $(jt ".id==$HB") "habit untouched after plan delete"
req GET $H/learning-cards/$C; check BE-058 200 $CODE $(jt ".id==$C") "card untouched after plan delete"

# --- cleanup
for id in $PU $PP $PL; do curl -s -o /dev/null -X DELETE $B/$id; done
for id in $T2 $TA; do curl -s -o /dev/null -X DELETE $H/tasks/$id; done
for id in $HB $HI; do curl -s -o /dev/null -X DELETE $H/habits/$id; done
curl -s -o /dev/null -X DELETE $H/learning-cards/$C
req GET $B; check BE-059 200 $CODE $(jt "map(select(.title|startswith(\"$TAG\")))|length==0") "cleanup: no $TAG plans left"

echo "TOTAL pass=$pass fail=$fail"
rm -f "$OUT"
