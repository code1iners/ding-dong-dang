#!/bin/bash
# 세 방식 × (고리 안 / 돌아다니는 창 / 둘 다)를 차례로 잰다. 앞 둘은 300초, 둘 다는 600초(예열 30초 별도). 결과는 results.jsonl에 쌓는다.
cd "$(dirname "$0")/../.."
OUT=${1:-/tmp/dog-probe/results.jsonl}
for cfg in both ring roam; do
  secs=300; [ "$cfg" = both ] && secs=600
  for v in base sprite waapi; do
    node prototypes/dog-render-probe/measure.mjs $v $cfg $secs $OUT
    sleep 5
  done
done
echo ALL-DONE >> $OUT
