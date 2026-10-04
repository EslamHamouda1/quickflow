#!/usr/bin/env bash
# Phase 2 curl tests: prints "ID | expected | actual | PASS/FAIL | detail"
B=http://localhost:8080/api/tasks
Y=$(date -d yesterday +%F); T=$(date +%F); TM=$(date -d tomorrow +%F)
TAG="p2qa$RANDOM"
OUT=$(mktemp)
pass=0; fail=0
check() { # id expected actual detail-ok(0/1) detail
  local id=$1 exp=$2 act=$3 ok=$4 det=$5
  if [[ "$exp" == "$act" && "$ok" == 1 ]]; then r=PASS; pass=$((pass+1)); else r=FAIL; fail=$((fail+1)); fi
  echo "$id | $exp | $act | $r | $det"
}
req() { # method url [body] -> sets CODE, BODY, CT
  local m=$1 u=$2 b=$3
  if [[ -n "$b" ]]; then
    CODE=$(curl -s -o "$OUT" -w '%{http_code} %{content_type}' -X "$m" -H 'Content-Type: application/json' --data "$b" "$u")
  else
    CODE=$(curl -s -o "$OUT" -w '%{http_code} %{content_type}' -X "$m" "$u")
  fi
  CT=${CODE#* }; CODE=${CODE%% *}; BODY=$(cat "$OUT")
}
j() { echo "$BODY" | jq -r "$1"; }
isproblem() { [[ "$CT" == application/problem+json* ]] && echo 1 || echo 0; }
hasfield() { echo "$BODY" | jq -e --arg f "$1" '.errors|map(.field)|index($f)!=null' >/dev/null && [[ "$CT" == application/problem+json* ]] && echo 1 || echo 0; }

# --- create
req POST $B "{\"title\":\"  $TAG alpha  \",\"description\":\"d\",\"dueDate\":\"$Y\"}"
A=$(j .id)
check BE-001 201 $CODE $([[ $(j .title) == "$TAG alpha" && $(j .status) == TODO && $(j .priority) == MEDIUM && $(j .overdue) == true && $(j .completedAt) == null && $(j .archived) == false && $(j .createdAt) == $(j .updatedAt) ]] && echo 1 || echo 0) "id=$A title='$(j .title)' status=$(j .status) priority=$(j .priority) overdue=$(j .overdue) completedAt=$(j .completedAt)"
req POST $B "{\"title\":\"$TAG beta\",\"priority\":\"HIGH\",\"status\":\"DONE\",\"dueDate\":\"$TM\"}"
Bt=$(j .id)
check BE-002 201 $CODE $([[ $(j .status) == DONE && $(j .completedAt) != null && $(j .priority) == HIGH ]] && echo 1 || echo 0) "status=$(j .status) completedAt=$(j .completedAt)"
req POST $B "{\"title\":\"$TAG gamma\",\"status\":\"IN_PROGRESS\",\"priority\":\"LOW\",\"dueDate\":\"$T\"}"
G=$(j .id)
check BE-003 201 $CODE $([[ $(j .overdue) == false ]] && echo 1 || echo 0) "due today overdue=$(j .overdue)"
req POST $B "{\"title\":\"$TAG delta\"}"
D=$(j .id)
check BE-004 201 $CODE 1 "no due date overdue=$(j .overdue)"
T200=$(printf 'a%.0s' $(seq 1 200)); T201=${T200}a
D2000=$(printf 'd%.0s' $(seq 1 2000)); D2001=${D2000}d
req POST $B "{\"title\":\"$T200\",\"description\":\"$D2000\"}"
E=$(j .id)
check BE-005 201 $CODE $([[ $(j '.title|length') == 200 && $(j '.description|length') == 2000 ]] && echo 1 || echo 0) "boundary 200/2000 accepted"

# --- validation
req POST $B '{"title":""}';            check BE-006 400 $CODE $(hasfield title) "empty title: $(j '.errors|map(.message)|join("; ")')"
req POST $B '{"title":"   "}';         check BE-007 400 $CODE $(hasfield title) "blank title"
req POST $B '{}';                      check BE-008 400 $CODE $(hasfield title) "missing title"
req POST $B "{\"title\":\"$T201\"}";   check BE-009 400 $CODE $(hasfield title) "201 chars: $(j '.errors[0].message')"
req POST $B "{\"title\":\"t\",\"description\":\"$D2001\"}"; check BE-010 400 $CODE $(hasfield description) "2001 desc: $(j '.errors[0].message')"
req POST $B '{"title":"t","status":"NOPE"}';   check BE-011 400 $CODE $(hasfield status) "bad status"
req POST $B '{"title":"t","priority":"URGENT"}'; check BE-012 400 $CODE $(hasfield priority) "bad priority"
req POST $B '{"title":"t","dueDate":"2026-13-40"}'; check BE-013 400 $CODE $(hasfield dueDate) "bad dueDate"
req POST $B '{bad';                     check BE-014 400 $CODE $(isproblem) "malformed json fields=$(j '.errors|map(.field)|join(",")')"

# --- get
req GET $B/$A; check BE-015 200 $CODE $([[ $(j .id) == $A && $(j .overdue) == true ]] && echo 1 || echo 0) "get overdue=$(j .overdue)"
req GET $B/999999; check BE-016 404 $CODE $([[ $(isproblem) == 1 && $(j .detail) == "Task 999999 not found" ]] && echo 1 || echo 0) "detail=$(j .detail)"
req GET $B/abc; check BE-017 400 $CODE $(hasfield id) "bad id"

# --- update
U0=$(curl -s $B/$G | jq -r .updatedAt); sleep 1
req PUT $B/$G "{\"title\":\"$TAG gamma2\",\"dueDate\":\"$T\"}"
check BE-018 200 $CODE $([[ $(j .title) == "$TAG gamma2" && $(j .status) == IN_PROGRESS && $(j .priority) == LOW && $(j .updatedAt) != "$U0" ]] && echo 1 || echo 0) "keeps IN_PROGRESS/LOW, updatedAt $U0 -> $(j .updatedAt)"
req PUT $B/$G "{\"title\":\"$TAG gamma2\",\"status\":\"DONE\",\"dueDate\":\"$Y\"}"
check BE-019 200 $CODE $([[ $(j .status) == DONE && $(j .completedAt) != null && $(j .overdue) == false ]] && echo 1 || echo 0) "DONE completedAt=$(j .completedAt) overdue=$(j .overdue)"
req PUT $B/$G "{\"title\":\"$TAG gamma2\",\"status\":\"TODO\",\"dueDate\":\"$Y\"}"
check BE-020 200 $CODE $([[ $(j .status) == TODO && $(j .completedAt) == null && $(j .overdue) == true ]] && echo 1 || echo 0) "back to TODO completedAt=$(j .completedAt) overdue=$(j .overdue)"
req PUT $B/$G "{\"title\":\"$TAG gamma2\",\"status\":\"IN_PROGRESS\",\"priority\":\"LOW\",\"dueDate\":\"$T\"}"
req PUT $B/$G '{"title":""}';         check BE-021 400 $CODE $(hasfield title) "empty title"
req PUT $B/$G "{\"title\":\"$T201\"}"; check BE-022 400 $CODE $(hasfield title) "201 title"
req PUT $B/$G "{\"title\":\"t\",\"description\":\"$D2001\"}"; check BE-023 400 $CODE $(hasfield description) "2001 desc"
req PUT $B/999999 '{"title":"x"}';   check BE-024 404 $CODE $(isproblem) "missing"
req PUT $B/abc '{"title":"x"}';      check BE-025 400 $CODE $(hasfield id) "bad id"

# --- complete
req POST $B/$D/complete; C1=$(j .completedAt)
check BE-026 200 $CODE $([[ $(j .status) == DONE && $C1 != null ]] && echo 1 || echo 0) "completedAt=$C1"
sleep 1; req POST $B/$D/complete
check BE-027 200 $CODE $([[ $(j .completedAt) == "$C1" ]] && echo 1 || echo 0) "idempotent completedAt=$(j .completedAt)"
req POST $B/999999/complete; check BE-028 404 $CODE $(isproblem) "missing"
req POST $B/abc/complete;    check BE-029 400 $CODE $(hasfield id) "bad id"
req PUT $B/$D "{\"title\":\"$TAG delta\",\"status\":\"IN_PROGRESS\"}"
check BE-030 200 $CODE $([[ $(j .completedAt) == null ]] && echo 1 || echo 0) "leave DONE clears completedAt"

# --- list filters / sort  (state: alpha TODO MED due Y; beta DONE HIGH due TM; gamma2 IN_PROGRESS LOW due T; delta IN_PROGRESS MED no due)
names() { echo "$BODY" | jq -r '[.[].title|sub("^'"$TAG"' ";"")]|join(",")'; }
req GET "$B?q=$(echo $TAG | tr a-z A-Z)"; check BE-031 200 $CODE $([[ $(j length) == 4 ]] && echo 1 || echo 0) "case-insensitive q -> $(names)"
req GET "$B?q=$TAG&status=DONE"; check BE-032 200 $CODE $([[ $(names) == beta ]] && echo 1 || echo 0) "status=DONE -> $(names)"
req GET "$B?q=$TAG&priority=LOW"; check BE-033 200 $CODE $([[ $(names) == gamma2 ]] && echo 1 || echo 0) "priority=LOW -> $(names)"
req GET "$B?q=$TAG&dueFrom=$T&dueTo=$TM"; check BE-034 200 $CODE $([[ $(echo "$BODY" | jq -r '[.[].title]|length') == 2 ]] && echo 1 || echo 0) "range $T..$TM -> $(names)"
req GET "$B?q=$TAG&overdue=true"; check BE-035 200 $CODE $([[ $(names) == alpha ]] && echo 1 || echo 0) "overdue=true -> $(names)"
req GET "$B?q=$TAG&sort=DUE_DATE&direction=ASC"; check BE-036 200 $CODE $([[ $(names) == alpha,gamma2,beta,delta ]] && echo 1 || echo 0) "DUE_DATE ASC -> $(names)"
req GET "$B?q=$TAG&sort=DUE_DATE&direction=DESC"; check BE-037 200 $CODE $([[ $(names) == beta,gamma2,alpha,delta ]] && echo 1 || echo 0) "DUE_DATE DESC -> $(names)"
req GET "$B?q=$TAG&sort=CREATED_AT&direction=ASC"; check BE-038 200 $CODE $([[ $(names) == alpha,beta,gamma2,delta ]] && echo 1 || echo 0) "CREATED_AT ASC -> $(names)"
req GET "$B?q=$TAG"; check BE-039 200 $CODE $([[ $(names) == delta,gamma2,beta,alpha ]] && echo 1 || echo 0) "default -> $(names)"
req GET "$B?status=NOPE"; check BE-040 400 $CODE $(hasfield status) "bad status param"
req GET "$B?sort=BOGUS";  check BE-041 400 $CODE $(hasfield sort) "bad sort"
req GET "$B?dueFrom=notadate"; check BE-042 400 $CODE $(hasfield dueFrom) "bad dueFrom"

# --- archive / restore
req POST $B/$Bt/archive; check BE-043 200 $CODE $([[ $(j .archived) == true ]] && echo 1 || echo 0) "archived=$(j .archived)"
req GET "$B?q=$TAG"; check BE-044 200 $CODE $([[ $(names) != *beta* ]] && echo 1 || echo 0) "default excludes archived -> $(names)"
req GET "$B?q=$TAG&archived=true"; check BE-045 200 $CODE $([[ $(names) == beta ]] && echo 1 || echo 0) "archived=true -> $(names)"
req POST $B/$Bt/restore; check BE-046 200 $CODE $([[ $(j .archived) == false ]] && echo 1 || echo 0) "restored archived=$(j .archived)"
req GET "$B?q=$TAG"; check BE-047 200 $CODE $([[ $(names) == *beta* ]] && echo 1 || echo 0) "back in default -> $(names)"
req POST $B/999999/archive; check BE-048 404 $CODE $(isproblem) "archive missing"
req POST $B/999999/restore; check BE-049 404 $CODE $(isproblem) "restore missing"
req POST $B/abc/archive;    check BE-050 400 $CODE $(hasfield id) "archive bad id"

# --- delete
req DELETE $B/$D; check BE-051 204 $CODE $([[ -z "$BODY" ]] && echo 1 || echo 0) "empty body"
req GET $B/$D; check BE-052 404 $CODE 1 "deleted not returned"
req GET "$B?q=$TAG"; check BE-053 200 $CODE $([[ $(names) != *delta* ]] && echo 1 || echo 0) "not in search -> $(names)"
req DELETE $B/$D; check BE-054 404 $CODE $(isproblem) "delete again"
req DELETE $B/abc; check BE-055 400 $CODE $(hasfield id) "delete bad id"
# generated client sends Accept: application/problem+json on deleteTask
CODE=$(curl -s -o /dev/null -w '%{http_code}' -X DELETE -H 'Accept: application/problem+json' $B/$E)
check BE-056 204 $CODE 1 "DELETE with Accept: application/problem+json (as the generated client sends)"
CODE=$(curl -s -o /dev/null -w '%{http_code}' -X DELETE -H 'Accept: application/problem+json' $B/999999)
check BE-057 404 $CODE 1 "DELETE missing with Accept: application/problem+json"

# cleanup
for id in $A $Bt $G $E; do curl -s -o /dev/null -X DELETE -H 'Accept: application/json' $B/$id; done
echo "TOTAL pass=$pass fail=$fail tag=$TAG"
