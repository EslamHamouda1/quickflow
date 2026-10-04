#!/usr/bin/env bash
# Phase 4 curl tests (learning cards): prints "ID | expected | actual | PASS/FAIL | detail"
B=http://localhost:8080/api/learning-cards
TAG="p4qa$RANDOM"
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
T200=$(printf 'a%.0s' $(seq 1 200)); T201=${T200}a
D2000=$(printf 'd%.0s' $(seq 1 2000)); D2001=${D2000}d
N5000=$(printf 'n%.0s' $(seq 1 5000)); N5001=${N5000}n

# --- createLearningCard (AS1, FR-012)
req POST $B "{\"title\":\"  $TAG Spring  \",\"description\":\"Book: Spring in Action\"}"
C=$(j .id)
check BE-001 201 $CODE $(ok [ "$(j .title)" == "$TAG Spring" -a "$(j .status)" == NOT_STARTED -a "$(j .milestonesTotal)" == 0 -a "$(j .progressPercent)" == 0 -a "$(j '.milestones|length')" == 0 -a "$(j '.notes|length')" == 0 -a "$(j .createdAt)" != null ]) "id=$C title='$(j .title)' status=$(j .status)"
req POST $B "{\"title\":\"$TAG B\",\"status\":\"IN_PROGRESS\"}"
D=$(j .id)
check BE-002 201 $CODE $(ok [ "$(j .status)" == IN_PROGRESS -a "$(j .description)" == null ]) "id=$D explicit status=$(j .status)"
req POST $B "{\"title\":\"$T200\",\"description\":\"$D2000\"}"
L=$(j .id)
check BE-003 201 $CODE $(ok [ "$(j '.title|length')" == 200 -a "$(j '.description|length')" == 2000 ]) "boundary 200/2000 id=$L"

# --- validation (400 problem+json)
req POST $B '{"title":""}';      check BE-004 400 $CODE $(hasfield title) "empty title: $(j '.errors|map(.message)|join("; ")')"
req POST $B '{"title":"   "}';   check BE-005 400 $CODE $(hasfield title) "blank title"
req POST $B '{}';                check BE-006 400 $CODE $(hasfield title) "missing title"
req POST $B "{\"title\":\"$T201\"}"; check BE-007 400 $CODE $(hasfield title) "201 chars: $(j '.errors[0].message')"
req POST $B "{\"title\":\"x\",\"description\":\"$D2001\"}"; check BE-008 400 $CODE $(hasfield description) "2001 desc: $(j '.errors[0].message')"
req POST $B '{"title":"x","status":"DONE"}'; check BE-009 400 $CODE $(hasfield status) "invalid status enum"
req POST $B '{bad';              check BE-010 400 $CODE $(isproblem) "malformed json"

# --- getLearningCard / listLearningCards
req GET $B/$C; check BE-011 200 $CODE $(ok [ "$(j .id)" == "$C" ]) "get id=$(j .id)"
req GET $B/999999; check BE-012 404 $CODE $(ok [ "$(is404)" == 1 ]) "detail=$(j .detail)"
req GET $B/abc; check BE-013 400 $CODE $(hasfield id) "bad id"
req GET $B; check BE-014 200 $CODE $(ok [ "$(j "[.[]|select(.id==$L or .id==$D or .id==$C)|.id]|join(\",\")")" == "$L,$D,$C" ]) "newest first: $(j "[.[]|select(.id==$L or .id==$D or .id==$C)|.id]|join(\",\")")"

# --- updateLearningCard (FR-013)
req PUT $B/$C "{\"title\":\" $TAG Spring 2 \"}"
check BE-015 200 $CODE $(ok [ "$(j .title)" == "$TAG Spring 2" -a "$(j .description)" == null -a "$(j .status)" == NOT_STARTED ]) "title trimmed, description cleared, status kept=$(j .status)"
req PUT $B/$C "{\"title\":\"$TAG Spring 2\",\"status\":\"COMPLETED\"}"
check BE-016 200 $CODE $(ok [ "$(j .status)" == COMPLETED ]) "manual status=$(j .status)"
req PUT $B/$C "{\"title\":\"$TAG Spring 2\"}"
check BE-017 200 $CODE $(ok [ "$(j .status)" == COMPLETED ]) "omitted status kept=$(j .status)"
req PUT $B/$C '{"title":" "}'; check BE-018 400 $CODE $(hasfield title) "blank title"
req PUT $B/$C "{\"title\":\"$T201\"}"; check BE-019 400 $CODE $(hasfield title) "201 title"
req PUT $B/$C "{\"title\":\"x\",\"description\":\"$D2001\"}"; check BE-020 400 $CODE $(hasfield description) "2001 desc"
req PUT $B/$C '{"title":"x","status":"bogus"}'; check BE-021 400 $CODE $(hasfield status) "invalid status"
req PUT $B/999999 '{"title":"x"}'; check BE-022 404 $CODE $(is404) "unknown card"

# --- addMilestone (AS3, AS5, FR-014, FR-016)
req POST $B/$C/milestones '{"title":"  Ch 1  ","targetDate":"2026-12-01"}'
M1=$(j '.milestones[0].id')
check BE-023 201 $CODE $(ok [ "$(j '.milestones[0].title')" == "Ch 1" -a "$(j '.milestones[0].done')" == false -a "$(j '.milestones[0].completedAt')" == null -a "$(j '.milestones[0].targetDate')" == 2026-12-01 -a "$(j .status)" == NOT_STARTED -a "$(j .milestonesTotal)" == 1 ]) "m1=$M1 manual COMPLETED recomputed → $(j .status)"
req POST $B/$C/milestones '{"title":"Ch 2","done":true}'
M2=$(j '.milestones[1].id')
check BE-024 201 $CODE $(ok [ "$(j '.milestones[1].done')" == true -a "$(j '.milestones[1].completedAt')" != null -a "$(j .status)" == IN_PROGRESS -a "$(j .progressPercent)" == 50 -a "$(j .milestonesDone)" == 1 ]) "m2=$M2 created done, $(j .status) $(j .progressPercent)%"
req POST $B/$C/milestones '{"title":""}'; check BE-025 400 $CODE $(hasfield title) "blank milestone title"
req POST $B/$C/milestones '{"title":"  "}'; check BE-026 400 $CODE $(hasfield title) "whitespace milestone title"
req POST $B/$C/milestones "{\"title\":\"$T201\"}"; check BE-027 400 $CODE $(hasfield title) "201 milestone title"
req POST $B/$C/milestones '{"title":"x","targetDate":"2026-13-45"}'; check BE-028 400 $CODE $(hasfield targetDate) "invalid targetDate"
req POST $B/999999/milestones '{"title":"x"}'; check BE-029 404 $CODE $(is404) "unknown card"
req POST $B/$C/milestones "{\"title\":\"$T200\"}"; M3=$(j '.milestones[2].id')
check BE-030 201 $CODE $(ok [ "$(j .milestonesTotal)" == 3 -a "$(j .progressPercent)" == 33 -a "$(j .status)" == IN_PROGRESS ]) "200-char milestone; 1/3 → $(j .progressPercent)%"
req DELETE $B/$C/milestones/$M3; check BE-031 200 $CODE $(ok [ "$(j .milestonesTotal)" == 2 -a "$(j .progressPercent)" == 50 ]) "remove m3 → $(j .progressPercent)%"

# --- updateMilestone
req PUT $B/$C/milestones/$M1 '{"title":"Ch 1","done":true,"targetDate":"2026-12-01"}'
check BE-032 200 $CODE $(ok [ "$(j '.milestones[0].done')" == true -a "$(j '.milestones[0].completedAt')" != null -a "$(j .status)" == COMPLETED -a "$(j .progressPercent)" == 100 ]) "all done → $(j .status) $(j .progressPercent)%"
req PUT $B/$C "{\"title\":\"$TAG Spring 2\",\"status\":\"NOT_STARTED\"}"; check BE-033 200 $CODE $(ok [ "$(j .status)" == NOT_STARTED ]) "manual NOT_STARTED"
req PUT $B/$C/milestones/$M1 '{"title":"Ch 1 renamed"}'
check BE-034 200 $CODE $(ok [ "$(j .status)" == NOT_STARTED -a "$(j '.milestones[0].title')" == "Ch 1 renamed" -a "$(j '.milestones[0].done')" == true -a "$(j '.milestones[0].targetDate')" == null ]) "title-only keeps manual $(j .status), done kept, targetDate replaced→null"
req PUT $B/$C/milestones/$M1 '{"title":"Ch 1","done":false}'
check BE-035 200 $CODE $(ok [ "$(j '.milestones[0].done')" == false -a "$(j '.milestones[0].completedAt')" == null -a "$(j .status)" == IN_PROGRESS ]) "undone clears completedAt, toggle recomputes → $(j .status)"
req PUT $B/$C/milestones/$M1 '{"title":"","done":true}'; check BE-036 400 $CODE $(hasfield title) "blank title"
req PUT $B/$C/milestones/999999 '{"title":"x"}'; check BE-037 404 $CODE $(is404) "unknown milestone: $(j .detail)"
req POST $B/$D/milestones '{"title":"other"}'; MD=$(j '.milestones[0].id')
req PUT $B/$C/milestones/$MD '{"title":"x","done":true}'; check BE-038 404 $CODE $(is404) "milestone of another card"
req PUT $B/999999/milestones/$M1 '{"title":"x"}'; check BE-039 404 $CODE $(is404) "unknown card"
req PUT $B/$C/milestones/abc '{"title":"x"}'; check BE-040 400 $CODE $(hasfield milestoneId) "bad milestoneId"

# --- deleteMilestone
req DELETE $B/$C/milestones/$MD; check BE-041 404 $CODE $(is404) "delete milestone of another card"
req DELETE $B/$C/milestones/$M2; check BE-042 200 $CODE $(ok [ "$(j .milestonesTotal)" == 1 -a "$(j .status)" == NOT_STARTED -a "$(j .progressPercent)" == 0 ]) "remove done m2 → $(j .status) $(j .progressPercent)%"
req DELETE $B/$C/milestones/$M2; check BE-043 404 $CODE $(is404) "delete again"
req DELETE $B/$C/milestones/x; check BE-044 400 $CODE $(hasfield milestoneId) "bad milestoneId"
req DELETE $B/999999/milestones/$M1; check BE-045 404 $CODE $(is404) "unknown card"
req PUT $B/$C "{\"title\":\"$TAG Spring 2\",\"status\":\"COMPLETED\"}"
req DELETE $B/$C/milestones/$M1; check BE-046 200 $CODE $(ok [ "$(j .milestonesTotal)" == 0 -a "$(j .status)" == COMPLETED -a "$(j .progressPercent)" == 0 ]) "last milestone removed keeps $(j .status), 0%"

# --- addNote (AS4, FR-015)
req POST $B/$C/notes '{"text":"first note"}'; N1=$(j '.notes[0].id')
check BE-047 201 $CODE $(ok [ "$(j '.notes[0].text')" == "first note" -a "$(j '.notes[0].createdAt')" != null -a "$(j .status)" == COMPLETED ]) "n1=$N1 createdAt=$(j '.notes[0].createdAt')"
sleep 0.05
req POST $B/$C/notes '{"text":"second\nline"}'; N2=$(j '.notes[0].id')
check BE-048 201 $CODE $(ok [ "$(j '.notes|map(.id)|join(",")')" == "$N2,$N1" ]) "newest first: $(j '.notes|map(.id)|join(",")')"
req POST $B/$C/notes "{\"text\":\"$N5000\"}"; N3=$(j '.notes[0].id')
check BE-049 201 $CODE $(ok [ "$(j '.notes[0].text|length')" == 5000 ]) "5000-char note"
req POST $B/$C/notes '{"text":""}'; check BE-050 400 $CODE $(hasfield text) "empty note"
req POST $B/$C/notes '{"text":"   "}'; check BE-051 400 $CODE $(hasfield text) "blank note"
req POST $B/$C/notes '{}'; check BE-052 400 $CODE $(hasfield text) "missing text"
req POST $B/$C/notes "{\"text\":\"$N5001\"}"; check BE-053 400 $CODE $(hasfield text) "5001 chars: $(j '.errors[0].message')"
req POST $B/999999/notes '{"text":"x"}'; check BE-054 404 $CODE $(is404) "unknown card"

# --- deleteNote
req DELETE $B/$C/notes/$N3; check BE-055 200 $CODE $(ok [ "$(j '.notes|map(.id)|join(",")')" == "$N2,$N1" ]) "removed n3"
req DELETE $B/$C/notes/$N3; check BE-056 404 $CODE $(is404) "delete again"
req POST $B/$D/notes '{"text":"other"}'; ND=$(j '.notes[0].id')
req DELETE $B/$C/notes/$ND; check BE-057 404 $CODE $(is404) "note of another card"
req DELETE $B/999999/notes/$N1; check BE-058 404 $CODE $(is404) "unknown card"
req DELETE $B/$C/notes/x; check BE-059 400 $CODE $(hasfield noteId) "bad noteId"

# --- deleteLearningCard (AS6) with the generated client's Accept header
req POST $B/$C/milestones '{"title":"before delete"}'
req DELETE $B/$C "" "application/problem+json"; check BE-060 204 $CODE 1 "delete with milestones+notes (Accept problem+json)"
req GET $B/$C; check BE-061 404 $CODE $(is404) "deleted card gone"
req DELETE $B/$C/notes/$N1; check BE-062 404 $CODE $(is404) "notes of deleted card gone"
req DELETE $B/$C; check BE-063 404 $CODE $(is404) "delete again"
req DELETE $B/abc; check BE-064 400 $CODE $(hasfield id) "delete bad id"
req GET $B/$D; check BE-065 200 $CODE $(ok [ "$(j '.milestones|length')" == 1 -a "$(j '.notes|length')" == 1 ]) "other card's children untouched"
for id in $D $L; do curl -s -o /dev/null -X DELETE $B/$id; done
req GET $B; check BE-066 200 $CODE $(ok [ "$(j "map(select(.title|startswith(\"$TAG\")))|length")" == 0 ]) "cleanup: no $TAG cards left"

echo "TOTAL pass=$pass fail=$fail"
rm -f "$OUT"
