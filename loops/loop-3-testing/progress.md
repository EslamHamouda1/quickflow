# loop-3-testing — Progress

Current phase: 3 · Mode: test · Status: passed

## Milestones

| Time | Phase / mode | Status | Duration | Tokens | Notes |
|---|---|---|---|---|---|
| 2026-10-03T18:55:57+03:00 | phase 1 test t0 | started | | | T018, T019, T020 |
| 2026-10-03T19:03:07+03:00 | phase 1 test t0 | passed | ~7 min | | 21/21 passed; BE line 96.3%, FE line 68.95%; 0 bugs; T018–T020 ticked |
| 2026-10-03T19:21:14+03:00 | phase 2 test t0 | started | | | T032, T033, T034, T035 |
| 2026-10-03T19:32:09+03:00 | phase 2 test t0 | failed | ~11 min | | 26/27 passed; BE line 97.8%, FE line 61.61%; BUG-P2-001 (backend-dev, T025: DELETE 406 with Accept problem+json); T032–T034 ticked, T035 open |
| 2026-10-03T19:34:50+03:00 | phase 2 retest t1 | started | | | TC-P2-BE-012 + regression |
| 2026-10-03T19:38:06+03:00 | phase 2 retest t1 | passed | ~3 min | | 27/27 passed; BUG-P2-001 closed; BE line 97.8%, FE line 61.61%; T035 ticked |
| 2026-10-03T19:51:56+03:00 | phase 3 test t0 | started | | | T047, T048, T049, T050 |
| 2026-10-03T20:05:18+03:00 | phase 3 test t0 | passed | ~13 min | | 37/37 passed (BE 15, FE 15, E2E 7); 0 bugs; BE line 98.0%, FE line 57.68%; T047-T050 ticked |
| 2026-10-03T20:19:20+03:00 | phase 4 test t0 | started | | | T062, T063, T064, T065 |
| 2026-10-03T20:31:00+03:00 | phase 4 test t0 | passed | ~13 min | | 34/34 passed (BE 14, FE 13, E2E 7); 0 bugs; BE line 97.7%, FE line 56.09%; T062-T065 ticked |
| 2026-10-03T20:44:55+03:00 | phase 5 test t0 | started | | |
| 2026-10-03T20:59:30+03:00 | phase 5 test t0 | passed | ~15 min | | 33/33 passed (BE 11, FE 14, E2E 8); 0 bugs; BE line 97.8%, FE line 55.34%; T079-T082 ticked |
| 2026-10-03T21:10:15+03:00 | phase 6 test t0 | started | | |
| 2026-10-03T21:17:18+03:00 | phase 6 test t0 | passed | ~7 min | | 31/31 passed (BE 13, FE 12, E2E 6); 0 bugs; BE line 97.7%, FE line 57.22%; T089-T091 ticked |
| 2026-10-04T00:23:55+03:00 | phase 7 test t0 | started | | |
| 2026-10-04T00:37:00+03:00 | phase 7 test t0 | passed | ~13 min | | 35/35 passed (BE 15, FE 12, E2E 8); 0 bugs; BE line 97.8%, FE line 65.68%; T098-T100 ticked |
| 2026-10-04T00:47:45+03:00 | phase 8 test t0 | started | | |
| 2026-10-04T01:22:17+03:00 | phase 8 test t0 | failed | ~35 min | | 26/28 passed (BE 8/8, FE 11/12, E2E 7/8); bugs BUG-P8-001 (UI filter 3.5-37 s with 1,000 tasks, frontend-dev, T106), BUG-P8-002 (focus lost after in-place keyboard actions, frontend-dev, T105); BE line 97.8%, FE line 65.78%; T107 ticked |
| 2026-10-04T01:33:52+03:00 | phase 8 retest t1 | started | | |
| 2026-10-04T01:39:14+03:00 | phase 8 retest t1 | passed | ~6 min | | 28/28 passed (BE 8/8, FE 12/12, E2E 8/8); BUG-P8-001 and BUG-P8-002 closed; UI filter max 346 ms with 1,013 tasks; focus kept 9/9; BE line 97.8%, FE line 65.51%; T105, T106 ticked |
