# fastmark-md-v2

[![make.fun · markdown-render-speed-02](https://make.fun/badge/markdown-render-speed-02.svg)](https://make.fun/bounty/markdown-render-speed-02?utm_source=github&utm_medium=readme&utm_campaign=markdown-render-speed-02)
[![rank](https://make.fun/badge/markdown-render-speed-02/elangrr/fastmark-md-v2/rank.svg)](https://make.fun/bounty/markdown-render-speed-02/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=markdown-render-speed-02)
[![reward](https://make.fun/badge/markdown-render-speed-02/elangrr/fastmark-md-v2/reward.svg)](https://make.fun/bounty/markdown-render-speed-02?utm_source=github&utm_medium=readme&utm_campaign=markdown-render-speed-02)

An entry for the make.fun bounty [Make Markdown rendering faster](https://make.fun/bounty/markdown-render-speed-02):
`parse.js` is a dependency-free ES module whose `parse(markdown)` returns exactly the HTML that
marked 18.1.3's `marked.parse(markdown)` returns with default options, only faster. It follows
marked's lexing rules (see NOTICE) but renders inline content straight to strings, skips the
token tree and the option/extension machinery, and uses cheap first-character dispatch.

## Run

    MAKEFUN_INPUT_DIR=path/to/input MAKEFUN_OUTPUT_DIR=path/to/output node main.ts

reads `cases.json` (an array of `{id, markdown}`) and writes `html.json` (an array of HTML strings).
Without the overrides it uses `/input` and `/output`.

## Test

- `node tools/compare.mjs [extra-sets-dir]` checks the kit's practice set and every generated set
  (`<dir>/setN/out/{input,reference}`) against marked's reference HTML and prints the first difference.
- `sh tools/gen-sets.sh <dir> <n>` draws extra sets from new seeds with the kit's generator.
- `node tools/bench.mjs [runs]` reports the median CPU time of fresh `node main.ts` runs against the
  kit's baseline (marked itself) and a do-nothing control.
