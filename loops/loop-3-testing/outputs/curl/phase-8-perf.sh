#!/usr/bin/env bash
# Phase 8 performance tests (T106). Usage: phase-8-perf.sh [seed|run|cleanup|all]
# seed: 1,000 tasks titled "PERF8T <i> ..." ; run: timings ; cleanup: delete seeded tasks.
B=${B:-http://localhost:8080}
LIMIT=0.5
PASS=0; FAIL=0
J='Content-Type: application/json'
TMP=$(mktemp -d)

res() { # id label expected_status actual_status time
  local ok=FAIL
  if [ "$3" = "$4" ] && awk -v t="$5" -v l="$LIMIT" 'BEGIN{exit !(t<l)}'; then ok=PASS; PASS=$((PASS+1)); else FAIL=$((FAIL+1)); fi
  printf '%-8s %-70s exp %-3s got %-3s %7.1f ms %s\n' "$1" "$2" "$3" "$4" "$(awk -v t="$5" 'BEGIN{print t*1000}')" "$ok"
}
# t <id> <label> <expected> <method> <path> [body]   -> response body in $TMP/r.json
t() {
  local id=$1 label=$2 exp=$3 m=$4 p=$5 body=$6 out
  if [ -n "$body" ]; then out=$(curl -s -o "$TMP/r.json" -w '%{http_code} %{time_total}' -X "$m" -H "$J" --data "$body" "$B$p")
  else out=$(curl -s -o "$TMP/r.json" -w '%{http_code} %{time_total}' -X "$m" "$B$p"); fi
  res "$id" "$m $p" "$exp" "${out% *}" "${out#* }"
}
# tw: worst of 3 runs for idempotent GETs
tw() {
  local id=$1 p=$2 worst=0 code out
  for i in 1 2 3; do
    out=$(curl -s -o "$TMP/r.json" -w '%{http_code} %{time_total}' "$B$p"); code=${out% *}
    worst=$(awk -v a="$worst" -v b="${out#* }" 'BEGIN{print (b>a)?b:a}')
  done
  res "$id" "GET $p (worst of 3, $(jq length "$TMP/r.json") rows)" 200 "$code" "$worst"
}

seed() {
  local st=(TODO IN_PROGRESS DONE) pr=(LOW MEDIUM HIGH) start=$(date +%s)
  for i in $(seq 1 1000); do
    d=$(date -d "$(( (i % 90) - 30 )) days" +%F)
    curl -s -o /dev/null -X POST -H "$J" "$B/api/tasks" \
      --data "{\"title\":\"PERF8T $i $( [ $((i%2)) = 0 ] && echo alpha || echo beta)\",\"description\":\"perf seed\",\"status\":\"${st[$((i%3))]}\",\"priority\":\"${pr[$((i%3))]}\",\"dueDate\":\"$d\"}"
  done
  echo "seeded 1000 tasks in $(( $(date +%s) - start )) s; total tasks: $(curl -s "$B/api/tasks" | jq length)"
}

cleanup() {
  for id in $(curl -s "$B/api/tasks?q=PERF8T" | jq '.[].id') $(curl -s "$B/api/tasks?q=PERF8T&archived=true" | jq '.[].id'); do
    curl -s -o /dev/null -X DELETE "$B/api/tasks/$id"
  done
  echo "cleanup done; total tasks: $(curl -s "$B/api/tasks" | jq length)"
}

run() {
  echo "== list / search / filter with $(curl -s "$B/api/tasks" | jq length) active tasks =="
  tw P-01 "/api/tasks"
  tw P-02 "/api/tasks?q=alpha"
  tw P-03 "/api/tasks?q=PERF8T%20555"
  tw P-04 "/api/tasks?status=TODO"
  tw P-05 "/api/tasks?priority=HIGH"
  tw P-06 "/api/tasks?dueFrom=$(date +%F)&dueTo=$(date -d '+30 days' +%F)"
  tw P-07 "/api/tasks?overdue=true"
  tw P-08 "/api/tasks?archived=true"
  tw P-09 "/api/tasks?sort=DUE_DATE&direction=ASC"
  tw P-10 "/api/tasks?q=perf8t&status=IN_PROGRESS&priority=MEDIUM&dueFrom=$(date -d '-30 days' +%F)&dueTo=$(date -d '+60 days' +%F)&sort=CREATED_AT&direction=DESC"
  tw P-11 "/api/dashboard"

  echo "== tasks CRUD =="
  t P-12 "create task" 201 POST /api/tasks '{"title":"PERF8T crud","priority":"HIGH"}'; tid=$(jq .id "$TMP/r.json")
  t P-13 "update task" 200 PUT /api/tasks/$tid '{"title":"PERF8T crud edited","priority":"LOW","status":"IN_PROGRESS"}'
  t P-14 "complete task" 200 POST /api/tasks/$tid/complete
  t P-15 "delete task" 204 DELETE /api/tasks/$tid

  echo "== habits CRUD + completion =="
  t P-16 "create habit" 201 POST /api/habits '{"name":"PERF8H habit","frequency":"DAILY"}'; hid=$(jq .id "$TMP/r.json")
  t P-17 "update habit" 200 PUT /api/habits/$hid '{"name":"PERF8H habit edited","frequency":"WEEKLY"}'
  t P-18 "complete habit" 201 POST /api/habits/$hid/completions "{\"date\":\"$(date +%F)\"}"
  t P-19 "uncomplete habit" 200 DELETE /api/habits/$hid/completions/$(date +%F)
  t P-20 "delete habit" 204 DELETE /api/habits/$hid

  echo "== learning cards CRUD + milestone =="
  t P-21 "create card" 201 POST /api/learning-cards '{"title":"PERF8L card"}'; lid=$(jq .id "$TMP/r.json")
  t P-22 "update card" 200 PUT /api/learning-cards/$lid '{"title":"PERF8L card edited","status":"IN_PROGRESS"}'
  t P-23 "add milestone" 201 POST /api/learning-cards/$lid/milestones '{"title":"PERF8L m1"}'; mid=$(jq '.milestones[0].id // .id' "$TMP/r.json")
  t P-24 "toggle milestone" 200 PUT /api/learning-cards/$lid/milestones/$mid '{"title":"PERF8L m1","done":true}'
  t P-25 "delete milestone" 200 DELETE /api/learning-cards/$lid/milestones/$mid
  t P-26 "delete card" 204 DELETE /api/learning-cards/$lid

  echo "== plans create + item toggle + delete =="
  t P-27 "create task for plan" 201 POST /api/tasks '{"title":"PERF8P item"}'; ptid=$(jq .id "$TMP/r.json")
  s=$(date -u -d '+1 hour' +%FT%TZ); e=$(date -u -d '+2 hours' +%FT%TZ)
  t P-28 "create plan" 201 POST /api/plans "{\"title\":\"PERF8P plan\",\"estimatedDurationMinutes\":30,\"startDateTime\":\"$s\",\"endDateTime\":\"$e\",\"priorityOrder\":1,\"items\":[{\"sourceType\":\"TASK\",\"sourceId\":$ptid}]}"
  pid=$(jq .id "$TMP/r.json"); iid=$(jq '.items[0].id' "$TMP/r.json")
  t P-29 "toggle plan item done" 200 PUT /api/plans/$pid/items/$iid '{"done":true}'
  t P-30 "toggle plan item undone" 200 PUT /api/plans/$pid/items/$iid '{"done":false}'
  t P-31 "delete plan" 204 DELETE /api/plans/$pid
  curl -s -o /dev/null -X DELETE "$B/api/tasks/$ptid"

  echo "== settings =="
  orig=$(curl -s "$B/api/settings")
  t P-32 "get settings" 200 GET /api/settings
  t P-33 "update settings" 200 PUT /api/settings "$(echo "$orig" | jq -c '.displayName="PERF8 Name"')"
  t P-34 "restore settings" 200 PUT /api/settings "$orig"

  echo "TOTAL: $PASS pass, $FAIL fail"
}

case "${1:-all}" in
  seed) seed;; run) run;; cleanup) cleanup;;
  all) seed; run;;
esac
rm -rf "$TMP"
