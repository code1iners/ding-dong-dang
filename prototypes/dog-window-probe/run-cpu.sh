#!/bin/zsh
# PROTOTYPE: 수업 시간 행동(걷기 5~10초, 쉬기 10~20초)을 실제 간격으로 11분 돌려 CPU를 잰다.
cd "$(dirname "$0")"; E=../bell-probe/node_modules/.bin/electron; rm -rf logs/cpu; mkdir -p logs/cpu
run(){ name=$1; port=$2; shift 2; ($E . --port=$port --log=logs/cpu/$name.jsonl --dock=0 "$@" >/dev/null 2>&1 &); }
run overlay-30-10 47831 --mode=overlay --fps=30 --idlefps=10 --timer=1 --startx=150
run small-30-10   47832 --mode=small   --fps=30 --idlefps=10 --timer=1 --startx=400
run overlay-24-8  47833 --mode=overlay --fps=24 --idlefps=8  --timer=1 --startx=650
run small-24-8    47834 --mode=small   --fps=24 --idlefps=8  --timer=1 --startx=900
run overlay-30-still 47835 --mode=overlay --fps=30 --still=1 --timer=1 --startx=1150
run small-30-still   47836 --mode=small   --fps=30 --still=1 --timer=1 --startx=1400
sleep 580
for p in 47831 47832 47833 47834 47835 47836; do curl -s localhost:$p/quit >/dev/null; done
python3 summarize.py logs/cpu/*.jsonl
