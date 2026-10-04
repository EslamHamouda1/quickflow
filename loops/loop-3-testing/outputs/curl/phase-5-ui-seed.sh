#!/usr/bin/env bash
# Phase 5 seed data for Playwright UI cases (needs learning card id as $1)
H=http://localhost:8080/api
C=${1:?card id}
d() { date -u -d "$1" +%Y-%m-%dT%H:%M:%SZ; }
mk() {
  curl -s -X POST $H/plans -H 'Content-Type: application/json' \
    -d "{\"title\":\"$1\",\"estimatedDurationMinutes\":30,\"startDateTime\":\"$2\",\"endDateTime\":\"$3\",\"priorityOrder\":$4,\"items\":$5}" | jq -c '{id,status,priorityOrder}'
}
LONG="P5E2E long $(printf 'x%.0s' $(seq 1 140))"
CARD="[{\"sourceType\":\"LEARNING_RESOURCE\",\"sourceId\":$C}]"
mk "$LONG" "$(d '+1 day')" "$(d '+1 day +1 hour')" 1 "$CARD"
mk "P5E2E upcoming P3" "$(d '+2 hour')" "$(d '+3 hour')" 3 "$CARD"
TT=$(curl -s -X POST $H/tasks -H 'Content-Type: application/json' -d '{"title":"P5E2E temp task"}' | jq .id)
mk "P5E2E removed source plan" "$(d '+3 hour')" "$(d '+4 hour')" 4 "[{\"sourceType\":\"TASK\",\"sourceId\":$TT},{\"sourceType\":\"LEARNING_RESOURCE\",\"sourceId\":$C}]"
curl -s -o /dev/null -w "delete temp task $TT %{http_code}\n" -X DELETE $H/tasks/$TT
TA=$(curl -s -X POST $H/tasks -H 'Content-Type: application/json' -d '{"title":"P5E2E archived task"}' | jq .id)
curl -s -o /dev/null -X POST $H/tasks/$TA/archive
HI=$(curl -s -X POST $H/habits -H 'Content-Type: application/json' -d '{"name":"P5E2E inactive habit","frequency":"DAILY"}' | jq .id)
curl -s -o /dev/null -X POST $H/habits/$HI/deactivate
TL=$(curl -s -X POST $H/tasks -H 'Content-Type: application/json' -d '{"title":"P5E2E late archive"}' | jq .id)
echo "TT=$TT TA=$TA HI=$HI TL=$TL"
