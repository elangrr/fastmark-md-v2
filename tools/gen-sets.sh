#!/bin/sh
# Draw N extra case sets from fresh seeds with the kit's generator, outside the repository.
# usage: sh tools/gen-sets.sh <out-dir> <count>
KIT=${KIT:-../kit3/markdown-render-speed-02-kit}
OUT=$1; N=${2:-20}
i=1
while [ $i -le $N ]; do
  d="$OUT/set$i"; mkdir -p "$d/in" "$d/out"
  seed=$(node -e "console.log(require('crypto').createHash('sha256').update('extra-seed-'+$i).digest('hex'))")
  printf '{"schema":"agent-fun/instance-seed/v1","seed":"%s"}' "$seed" > "$d/in/seed.json"
  MAKEFUN_INPUT_DIR="$d/in" MAKEFUN_OUTPUT_DIR="$d/out" node "$KIT/program/generator/draw.ts" || exit 1
  i=$((i+1))
done
