#!/usr/bin/env bash
# Phase 8 (T107): curl verification of the PRD §11 UI flow (p8-e2e-prd11.js) and persistence snapshots.
# Usage: phase-8-e2e-verify.sh verify <task> <habit> <card> <planTask> <plan> <dash-before.json>
#        phase-8-e2e-verify.sh snapshot <out.json>
B=${B:-http://localhost:8080/api}
PASS=0; FAIL=0
chk() { if [ "$2" = "true" ]; then PASS=$((PASS+1)); echo "PASS $1 ${3:-}"; else FAIL=$((FAIL+1)); echo "FAIL $1 ${3:-}"; fi; }

verify() {
  local T=$1 H=$2 C=$3 PT=$4 P=$5 BEFORE=$6 today
  today=$(curl -s $B/dashboard | jq -r .today)
  echo "# curl -s $B/tasks/$T"
  t=$(curl -s $B/tasks/$T)
  chk "E-01 task created in UI is stored" "$(jq --arg d "$today" '.title=="P8E2E task" and .dueDate==$d' <<<"$t")" "$(jq -c '{id,title,dueDate,status}' <<<"$t")"
  chk "E-02 task completed in UI is DONE with completedAt" "$(jq '.status=="DONE" and .completedAt!=null' <<<"$t")" "$(jq -c '{status,completedAt}' <<<"$t")"
  echo "# curl -s $B/habits/$H ; $B/habits/$H/completions"
  chk "E-03 habit created in UI is stored (daily, active)" "$(curl -s $B/habits/$H | jq '.name=="P8E2E habit" and .frequency=="DAILY" and .active')"
  chk "E-04 habit completion for today stored" "$(curl -s $B/habits/$H/completions | jq --arg d "$today" '[.[]|.completionDate]|index($d)!=null')" "$(curl -s $B/habits/$H/completions | jq -c '[.[].completionDate]')"
  echo "# curl -s $B/learning-cards/$C"
  chk "E-05 learning card with 2 milestones stored" "$(curl -s $B/learning-cards/$C | jq '.title=="P8E2E card" and ([.milestones[].title]|sort)==["P8E2E milestone A","P8E2E milestone B"]')"
  echo "# curl -s $B/plans/$P"
  p=$(curl -s $B/plans/$P)
  chk "E-06 plan built from existing task, habit, learning card" "$(jq --argjson pt $PT --argjson h $H --argjson c $C '([.items[]|[.sourceType,.sourceId]]|sort)==([["TASK",$pt],["HABIT",$h],["LEARNING_RESOURCE",$c]]|sort)' <<<"$p")"
  chk "E-07 all plan items done → COMPLETED, 100 %, no rest time" "$(jq '.status=="COMPLETED" and .progressPercent==100 and .itemsDone==3 and .restSeconds==null' <<<"$p")" "$(jq -c '{status,progressPercent,itemsDone,restSeconds}' <<<"$p")"
  chk "E-08 plan task item toggled the source task to DONE" "$(curl -s $B/tasks/$PT | jq '.status=="DONE"')"
  echo "# curl -s $B/dashboard (compared with $BEFORE)"
  d=$(curl -s $B/dashboard)
  chk "E-09 dashboard deltas: tasks done +2, total +2" "$(jq -n --argjson a "$(cat $BEFORE)" --argjson b "$d" '($b.tasks.doneCount-$a.tasks.doneCount)==2 and ($b.tasks.totalActive-$a.tasks.totalActive)==2')" "$(jq -c '.tasks|{doneCount,totalActive,completionPercent,completedTodayCount}' <<<"$d")"
  chk "E-10 dashboard deltas: habits active +1, completed today +1" "$(jq -n --argjson a "$(cat $BEFORE)" --argjson b "$d" '($b.habits.activeCount-$a.habits.activeCount)==1 and ($b.habits.completedTodayCount-$a.habits.completedTodayCount)==1')" "$(jq -c '.habits|del(.today)' <<<"$d")"
  chk "E-11 dashboard deltas: plans completed +1, learning cards +1, milestones +2" "$(jq -n --argjson a "$(cat $BEFORE)" --argjson b "$d" '($b.plans.completedCount-$a.plans.completedCount)==1 and ($b.learning.cardsTotal-$a.learning.cardsTotal)==1 and ($b.learning.milestonesTotal-$a.learning.milestonesTotal)==2')" "$(jq -c '{plans:(.plans|{upcomingCount,completedCount}),learning}' <<<"$d")"
  echo "TOTAL: $PASS pass, $FAIL fail"
}

snapshot() { # stable view of all stored data (no time-dependent fields such as restSeconds)
  jq -n \
    --argjson tasks "$(curl -s "$B/tasks?sort=CREATED_AT&direction=ASC")" \
    --argjson archived "$(curl -s "$B/tasks?archived=true")" \
    --argjson habits "$(curl -s $B/habits)" \
    --argjson cards "$(curl -s $B/learning-cards)" \
    --argjson plans "$(curl -s $B/plans)" \
    --argjson settings "$(curl -s $B/settings)" \
    --argjson dash "$(curl -s $B/dashboard)" \
    '{tasks:($tasks|sort_by(.id)), archived:($archived|sort_by(.id)), habits:($habits|sort_by(.id)), cards:($cards|sort_by(.id)),
      plans:($plans|map(del(.restSeconds))|sort_by(.id)), planStatuses:($plans|map({id,status,progressPercent})|sort_by(.id)),
      settings:$settings, dashboard:($dash|del(.plans.inProgress[]?.restSeconds))}' > "$1"
  for id in $(jq '.habits[].id' "$1"); do echo "habit $id $(curl -s $B/habits/$id/completions | jq -c '[.[].completionDate]')"; done >> "${1%.json}.completions.txt"
  echo "snapshot $1: $(jq '.tasks|length' "$1") tasks, $(jq '.habits|length' "$1") habits, $(jq '.cards|length' "$1") cards, $(jq '.plans|length' "$1") plans"
}

case "$1" in
  verify) shift; verify "$@";;
  snapshot) snapshot "$2";;
esac
