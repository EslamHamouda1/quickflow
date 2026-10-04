#!/usr/bin/env python3
"""Orchestrator state helpers.

  orch.py set <state.json> <dotted.key> <json-value>   # e.g. set s.json pipeline.plan '"done"'
  orch.py append <file.json> <dotted.key|.> <json-value>  # append to a list ('.' = top-level list)
  orch.py get <state.json> <dotted.key>
  orch.py log <progress.md> <step> <status> [duration] [tokens] [notes]
      # adds a row to the first table (Milestones) with the current ISO time
"""
import json
import sys
from datetime import datetime


def load(path):
    with open(path) as f:
        return json.load(f)


def save(path, data):
    with open(path, "w") as f:
        json.dump(data, f, indent=2)
        f.write("\n")


def walk(data, key, create=True):
    parts = key.split(".")
    for p in parts[:-1]:
        if isinstance(data, list):
            data = data[int(p)]
        else:
            if p not in data and create:
                data[p] = {}
            data = data[p]
    return data, parts[-1]


def main(argv):
    cmd = argv[1]
    if cmd == "set":
        path, key, value = argv[2], argv[3], json.loads(argv[4])
        data = load(path)
        parent, last = walk(data, key)
        if isinstance(parent, list):
            parent[int(last)] = value
        else:
            parent[last] = value
        save(path, data)
    elif cmd == "append":
        path, key, value = argv[2], argv[3], json.loads(argv[4])
        data = load(path)
        if key == ".":
            data.append(value)
        else:
            parent, last = walk(data, key)
            parent.setdefault(last, []).append(value)
        save(path, data)
    elif cmd == "get":
        data = load(argv[2])
        parent, last = walk(data, argv[3], create=False)
        print(json.dumps(parent[int(last)] if isinstance(parent, list) else parent[last]))
    elif cmd == "log":
        path, step, status = argv[2], argv[3], argv[4]
        rest = (argv[5:] + ["", "", ""])[:3]
        now = datetime.now().astimezone().isoformat(timespec="seconds")
        row = f"| {now} | {step} | {status} | {rest[0]} | {rest[1]} | {rest[2]} |\n"
        with open(path) as f:
            lines = f.readlines()
        # insert after the last row of the first table
        start = next(i for i, l in enumerate(lines) if l.startswith("|---"))
        end = start + 1
        while end < len(lines) and lines[end].startswith("|"):
            end += 1
        lines.insert(end, row)
        with open(path, "w") as f:
            f.writelines(lines)
        print(row.strip())
    else:
        sys.exit(__doc__)


if __name__ == "__main__":
    main(sys.argv)
