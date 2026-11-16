#!/bin/sh
# usage: sh tools/flagbench.sh N "flags1" "flags2" ...   (one bench line per flag set, interleaved runs are per set)
N=$1; shift
for f in "$@"; do
  printf '%-40s ' "[$f]"
  FLAGS="$f" node tools/bench.mjs "$N" ../kit3/markdown-render-speed-02-kit/practice/input tools/flagmain.mjs | head -1 | sed 's/^tools.flagmain.mjs *//'
done
