#!/usr/bin/env bash
# Phase 7 curl tests (dashboard): prints "ID | expected | actual | PASS/FAIL | detail"
# Every dashboard number is compared with counts computed (jq) from /api/tasks, /api/habits,
# /api/plans and /api/learning-cards, before and after seeding / changing data.
H=http://localhost:8080
D=$H/api/dashboard
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

# Expected dashboard computed from the list endpoints (same shape as the dashboard numbers).
expected() {
  local today=$1
  local tasks habits plans cards since
  tasks=$(curl -s "$H/api/tasks")              # default: non-archived
  habits=$(curl -s "$H/api/habits?active=true")
  plans=$(curl -s "$H/api/plans")
  cards=$(curl -s "$H/api/learning-cards")
  since=$(date -u -d '7 days ago' +%s)
  jq -n -c --arg today "$today" --argjson since "$since" \
    --argjson t "$tasks" --argjson h "$habits" --argjson p "$plans" --argjson c "$cards" '
    def ts: sub("\\.[0-9]+"; "") | sub("(?<z>[+-][0-9]{2}):(?<m>[0-9]{2})$"; "\(.z)\(.m)") | strptime("%Y-%m-%dT%H:%M:%S%z") | mktime;
    ($t|length) as $n | ([$t[]|select(.status=="DONE")]|length) as $done |
    { tasks: { dueToday: [$t[]|select(.dueDate==$today and .status!="DONE")|.id]|sort,
               overdue: [$t[]|select(.overdue)|.id]|sort,
               completedTodayCount: [$t[]|select(.completedAt!=null and (.completedAt[0:10])==$today)]|length,
               totalActive: $n, doneCount: $done,
               completionPercent: (if $n==0 then 0 else ((($done*100)/$n)+0.5|floor) end) },
      habits: { today: [$h[]|.id]|sort, activeCount: ($h|length),
                completedTodayCount: [$h[]|select(.completedToday)]|length },
      plans: { inProgress: [$p[]|select(.status=="IN_PROGRESS")|.id],
               upcomingCount: [$p[]|select(.status=="NOT_STARTED")]|length,
               completedCount: [$p[]|select(.status=="COMPLETED")]|length },
      learning: { cardsTotal: ($c|length),
                  inProgressCount: [$c[]|select(.status=="IN_PROGRESS")]|length,
                  milestonesTotal: [$c[].milestones[]]|length,
                  milestonesDone: [$c[].milestones[]|select(.done)]|length,
                  milestonesCompletedLast7Days: [$c[].milestones[]|select(.done and .completedAt!=null and ((.completedAt|ts) >= $since))]|length } }'
}
actual() {
  echo "$1" | jq -c '{ tasks: (.tasks|{dueToday:[.dueToday[].id]|sort, overdue:[.overdue[].id]|sort, completedTodayCount, totalActive, doneCount, completionPercent}),
    habits: (.habits|{today:[.today[].id]|sort, activeCount, completedTodayCount}),
    plans: (.plans|{inProgress:[.inProgress[].id], upcomingCount, completedCount}),
    learning: .learning }'
}
compare() { local id=$1 label=$2
  req GET $D; local today; today=$(j .today)
  local a e; a=$(actual "$BODY"); e=$(expected "$today")
  local ok=0; [[ "$a" == "$e" ]] && ok=1
  check "$id" 200 "$CODE" $ok "$label: dashboard==lists ${a}"
  [[ $ok == 1 ]] || echo "      expected-from-lists: $e"
}
num() { echo "$BODY" | jq -r "$1"; }

TODAY=$(date +%F); YESTERDAY=$(date -d yesterday +%F); TOMORROW=$(date -d tomorrow +%F)

# ---- BE-001 shape ----
req GET $D
check BE-001 200 "$CODE" $(jt 'has("greetingName") and has("today") and (.tasks|has("dueToday") and has("overdue") and has("completedTodayCount") and has("totalActive") and has("doneCount") and has("completionPercent")) and (.habits|has("today") and has("activeCount") and has("completedTodayCount")) and (.plans|has("inProgress") and has("upcomingCount") and has("completedCount")) and (.learning|has("cardsTotal") and has("inProgressCount") and has("milestonesTotal") and has("milestonesDone") and has("milestonesCompletedLast7Days"))') "all required fields, ct=$CT"
BASE=$BODY
check BE-002 "$TODAY" "$(j .today)" 1 "today = server local date"
SET=$(curl -s $H/api/settings | jq -r .displayName)
check BE-003 "$SET" "$(j .greetingName)" 1 "greetingName = Settings displayName"

# ---- BE-004 baseline equals list endpoints ----
compare BE-004 "baseline"

# ---- seed ----
mk() { curl -s -X POST -H 'Content-Type: application/json' --data "$2" "$H$1" | jq -r .id; }
T1=$(mk /api/tasks "{\"title\":\"P7QA due today\",\"dueDate\":\"$TODAY\"}")
T2=$(mk /api/tasks "{\"title\":\"P7QA overdue\",\"dueDate\":\"$YESTERDAY\"}")
T3=$(mk /api/tasks "{\"title\":\"P7QA archived due today\",\"dueDate\":\"$TODAY\"}")
curl -s -o /dev/null -X POST $H/api/tasks/$T3/archive
T4=$(mk /api/tasks "{\"title\":\"P7QA done\",\"status\":\"DONE\",\"dueDate\":\"$TOMORROW\"}")
H1=$(mk /api/habits '{"name":"P7QA daily","frequency":"DAILY"}')
H2=$(mk /api/habits '{"name":"P7QA inactive","frequency":"DAILY"}')
curl -s -o /dev/null -X POST $H/api/habits/$H2/deactivate
C1=$(mk /api/learning-cards '{"title":"P7QA course"}')
M1=$(curl -s -X POST -H 'Content-Type: application/json' --data '{"title":"m1"}' $H/api/learning-cards/$C1/milestones | jq -r '.milestones[0].id')
curl -s -o /dev/null -X POST -H 'Content-Type: application/json' --data '{"title":"m2"}' $H/api/learning-cards/$C1/milestones
S=$(date -u -d '10 minutes ago' +%Y-%m-%dT%H:%M:%SZ); E=$(date -u -d '50 minutes' +%Y-%m-%dT%H:%M:%SZ)
FS=$(date -u -d '2 hours' +%Y-%m-%dT%H:%M:%SZ); FE=$(date -u -d '3 hours' +%Y-%m-%dT%H:%M:%SZ)
P1=$(mk /api/plans "{\"title\":\"P7QA running\",\"estimatedDurationMinutes\":60,\"startDateTime\":\"$S\",\"endDateTime\":\"$E\",\"priorityOrder\":1,\"items\":[{\"sourceType\":\"TASK\",\"sourceId\":$T1},{\"sourceType\":\"HABIT\",\"sourceId\":$H1}]}")
P2=$(mk /api/plans "{\"title\":\"P7QA upcoming\",\"estimatedDurationMinutes\":60,\"startDateTime\":\"$FS\",\"endDateTime\":\"$FE\",\"priorityOrder\":2,\"items\":[{\"sourceType\":\"TASK\",\"sourceId\":$T2}]}")
echo "      seeded: tasks $T1 $T2 $T3(archived) $T4(done) habits $H1 $H2(inactive) card $C1 (m $M1) plans $P1 $P2"

req GET $D; AFTER=$BODY
b() { echo "$BASE" | jq -r "$1"; }
check BE-005 1 "$(j "[.tasks.dueToday[].id]|index($T1)!=null and index($T3)==null and index($T4)==null" | sed 's/true/1/;s/false/0/')" 1 "dueToday has $T1, not archived $T3 / done $T4"
check BE-006 "$(( $(b .tasks.overdue\|length) + 1 ))" "$(j '.tasks.overdue|length')" 1 "overdue +1 ($T2)"
check BE-007 "$(( $(b .tasks.totalActive) + 3 ))" "$(j .tasks.totalActive)" 1 "totalActive +3 (archived excluded)"
check BE-008 "$(( $(b .tasks.doneCount) + 1 ))/$(( $(b .tasks.completedTodayCount) + 1 ))" "$(j .tasks.doneCount)/$(j .tasks.completedTodayCount)" 1 "doneCount +1, completedTodayCount +1"
check BE-009 "$(( $(b .habits.activeCount) + 1 ))" "$(j .habits.activeCount)" "$(jt "[.habits.today[].id]|index($H2)==null")" "active habits +1, inactive excluded"
check BE-010 "$P1" "$(j '.plans.inProgress[0].id')" "$(jt "(.plans.inProgress[0].restSeconds > 2900) and .plans.inProgress[0].progressPercent==0 and .plans.upcomingCount==$(( $(b .plans.upcomingCount) + 1 ))")" "priority 1 plan first, rest ~50 min, upcoming +1"
check BE-011 "$(( $(b .learning.cardsTotal) + 1 ))/$(( $(b .learning.milestonesTotal) + 2 ))" "$(j .learning.cardsTotal)/$(j .learning.milestonesTotal)" 1 "cardsTotal +1, milestonesTotal +2"
compare BE-012 "after seed"

# ---- changes ----
curl -s -o /dev/null -X POST $H/api/tasks/$T1/complete
curl -s -o /dev/null -X POST -H 'Content-Type: application/json' --data '{}' $H/api/habits/$H1/completions
curl -s -o /dev/null -X PUT -H 'Content-Type: application/json' --data '{"title":"m1","done":true}' $H/api/learning-cards/$C1/milestones/$M1
req GET $D
check BE-013 0 "$(j "[.tasks.dueToday[].id]|index($T1)|if .==null then 0 else 1 end")" "$(jt ".tasks.doneCount==$(echo "$AFTER" | jq '.tasks.doneCount+1') and .tasks.completedTodayCount==$(echo "$AFTER" | jq '.tasks.completedTodayCount+1')")" "complete task → leaves dueToday, done +1, completedToday +1"
check BE-014 "$(( $(echo "$AFTER" | jq .habits.completedTodayCount) + 1 ))" "$(j .habits.completedTodayCount)" 1 "habit completion → completedTodayCount +1"
check BE-015 "$(( $(echo "$AFTER" | jq .learning.milestonesDone) + 1 ))/$(( $(echo "$AFTER" | jq .learning.milestonesCompletedLast7Days) + 1 ))/$(( $(echo "$AFTER" | jq .learning.inProgressCount) + 1 ))" "$(j .learning.milestonesDone)/$(j .learning.milestonesCompletedLast7Days)/$(j .learning.inProgressCount)" 1 "milestone done → done +1, last7 +1, card IN_PROGRESS"
# plan item done flags are independent of the source state: mark item 1 → 50 %, then item 2 → COMPLETED
PIS=($(curl -s $H/api/plans/$P1 | jq -r '.items[].id'))
curl -s -o /dev/null -X PUT -H 'Content-Type: application/json' --data '{"done":true}' $H/api/plans/$P1/items/${PIS[0]}
req GET $D
check BE-016a 50 "$(j ".plans.inProgress[]|select(.id==$P1)|.progressPercent")" "$(jt ".plans.inProgress[]|select(.id==$P1)|.itemsDone==1")" "one of two items done → progressPercent 50 on dashboard"
curl -s -o /dev/null -X PUT -H 'Content-Type: application/json' --data '{"done":true}' $H/api/plans/$P1/items/${PIS[1]}
req GET $D
check BE-016 COMPLETED "$(curl -s $H/api/plans/$P1 | jq -r .status)" "$(jt "([.plans.inProgress[].id]|index($P1))==null and .plans.completedCount==$(echo "$AFTER" | jq '.plans.completedCount+1')")" "all plan items done → plan leaves inProgress, completedCount +1"
compare BE-017 "after changes"

# ---- method / path errors ----
req POST $D;           check BE-018 405 "$CODE" $([[ "$CT" == application/problem+json* ]] && echo 1 || echo 0) "POST → 405 problem+json"
req PUT $D '{}';       check BE-019 405 "$CODE" 1 "PUT → 405"
req DELETE $D;         check BE-020 405 "$CODE" 1 "DELETE → 405"
req GET $D/x;          check BE-021 404 "$CODE" $([[ "$CT" == application/problem+json* ]] && echo 1 || echo 0) "unknown sub-path → 404 problem+json"

# ---- swagger ----
SW=$(curl -s $H/v3/api-docs)
check BE-022 "getDashboard|200|Dashboard" "$(echo "$SW" | jq -r '.paths["/api/dashboard"].get | "\(.operationId)|\(.responses|keys|join(","))|\(.responses["200"].content["application/json"].schema["$ref"]|split("/")|last)"')" \
  "$(echo "$SW" | jq -e '(.components.schemas.Dashboard.required|sort)==(["greetingName","habits","learning","plans","tasks","today"]) and (.components.schemas.DashboardTasks.required|length)==6 and (.components.schemas.DashboardLearning.required|length)==5 and (.components.schemas.DashboardHabits.required|length)==3 and (.components.schemas.DashboardPlans.required|length)==3 and (.paths["/api/dashboard"]|keys)==["get"]' >/dev/null && echo 1 || echo 0)" "operation + required lists of all Dashboard schemas"

# ---- cleanup ----
for p in $P1 $P2; do curl -s -o /dev/null -X DELETE $H/api/plans/$p; done
for t in $T1 $T2 $T3 $T4; do curl -s -o /dev/null -X DELETE $H/api/tasks/$t; done
for h in $H1 $H2; do curl -s -o /dev/null -X DELETE $H/api/habits/$h; done
curl -s -o /dev/null -X DELETE $H/api/learning-cards/$C1
compare BE-023 "after cleanup"
req GET $D
check BE-024 "$(echo "$BASE" | jq -c '[.tasks.totalActive,.tasks.doneCount,.habits.activeCount,.learning.cardsTotal]')" "$(echo "$BODY" | jq -c '[.tasks.totalActive,.tasks.doneCount,.habits.activeCount,.learning.cardsTotal]')" 1 "back to baseline"

echo "TOTAL pass=$pass fail=$fail"
rm -f "$OUT"
