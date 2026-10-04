#!/usr/bin/env bash
# Phase 7 UI seed: creates P7UI data for the Playwright dashboard checks; prints the ids as JSON.
# Cleanup: bash phase-7-ui-seed.sh cleanup '<json printed by the seed run>'
H=http://localhost:8080
if [[ "$1" == cleanup ]]; then
  echo "$2" | jq -r '.plans[]'  | while read -r id; do curl -s -o /dev/null -X DELETE $H/api/plans/$id; done
  echo "$2" | jq -r '.tasks[]'  | while read -r id; do curl -s -o /dev/null -X DELETE $H/api/tasks/$id; done
  echo "$2" | jq -r '.habits[]' | while read -r id; do curl -s -o /dev/null -X DELETE $H/api/habits/$id; done
  echo "$2" | jq -r '.cards[]'  | while read -r id; do curl -s -o /dev/null -X DELETE $H/api/learning-cards/$id; done
  echo cleaned; exit 0
fi
mk() { curl -s -X POST -H 'Content-Type: application/json' --data "$2" "$H$1" | jq -r .id; }
TODAY=$(date +%F); Y=$(date -d '2 days ago' +%F)
T1=$(mk /api/tasks "{\"title\":\"P7UI due today A\",\"priority\":\"HIGH\",\"dueDate\":\"$TODAY\"}")
T2=$(mk /api/tasks "{\"title\":\"P7UI due today B\",\"dueDate\":\"$TODAY\"}")
T3=$(mk /api/tasks "{\"title\":\"P7UI overdue\",\"dueDate\":\"$Y\"}")
H1=$(mk /api/habits '{"name":"P7UI daily habit","frequency":"DAILY"}')
H2=$(mk /api/habits '{"name":"P7UI weekly habit","frequency":"WEEKLY"}')
C1=$(mk /api/learning-cards '{"title":"P7UI course"}')
curl -s -o /dev/null -X POST -H 'Content-Type: application/json' --data '{"title":"P7UI m1","done":true}' $H/api/learning-cards/$C1/milestones
curl -s -o /dev/null -X POST -H 'Content-Type: application/json' --data '{"title":"P7UI m2"}' $H/api/learning-cards/$C1/milestones
S=$(date -u -d '5 minutes ago' +%Y-%m-%dT%H:%M:%SZ); E=$(date -u -d '55 minutes' +%Y-%m-%dT%H:%M:%SZ)
P1=$(mk /api/plans "{\"title\":\"P7UI focus plan\",\"estimatedDurationMinutes\":60,\"startDateTime\":\"$S\",\"endDateTime\":\"$E\",\"priorityOrder\":1,\"items\":[{\"sourceType\":\"TASK\",\"sourceId\":$T3},{\"sourceType\":\"HABIT\",\"sourceId\":$H2},{\"sourceType\":\"LEARNING_RESOURCE\",\"sourceId\":$C1}]}")
curl -s -o /dev/null -X POST $H/api/plans/$P1/start-notification
jq -n -c --argjson t "[$T1,$T2,$T3]" --argjson h "[$H1,$H2]" --argjson c "[$C1]" --argjson p "[$P1]" '{tasks:$t,habits:$h,cards:$c,plans:$p}'
