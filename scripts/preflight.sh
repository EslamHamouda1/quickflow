#!/usr/bin/env bash
# Usage: scripts/preflight.sh <path-or-url>...
# Checks every argument: http(s) URLs must answer 2xx/3xx, anything else must be an existing file or dir.
# Prints one line per item; exits 1 if any item is missing or unreachable.
set -u

fail=0
for item in "$@"; do
  case "$item" in
    http://*|https://*)
      code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "$item")
      if [[ "$code" =~ ^[23] ]]; then
        echo "OK      $item ($code)"
      else
        echo "MISSING $item (http $code)"
        fail=1
      fi
      ;;
    *)
      if [[ -e "$item" ]]; then
        echo "OK      $item"
      else
        echo "MISSING $item"
        fail=1
      fi
      ;;
  esac
done
exit $fail
