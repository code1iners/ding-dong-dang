#!/bin/zsh
# PROTOTYPE: 합성 마우스 입력으로 클릭 · 끌기 · Dock · 전체 화면을 확인한다.
cd "$(dirname "$0")"; E=../bell-probe/node_modules/.bin/electron
SHOT=${SHOT:-/tmp}; mkdir -p logs/input; PORT=47900
st(){ curl -s localhost:$PORT/state | python3 -c "import json,sys;d=json.load(sys.stdin);p=d['pos'];print(f\"pos=({p['sx']},{p['sy']}) {p['label']} cursor=({d['cursor']['x']},{d['cursor']['y']}) bounds={list(d['bounds'].values())} ignoring={d['ignoring']} winFocused={d['focused']}\")"; }
up(){ name=$1; shift; PORT=$((PORT+1)); L=logs/input/$name.jsonl; rm -f $L
  ($E . --port=$PORT --log=$L "$@" >/dev/null 2>&1 &); for i in {1..60}; do curl -s localhost:$PORT/state 2>/dev/null | grep -q '"pos":{' && break; sleep 0.2; done; sleep 0.8; }
down(){ curl -s localhost:$PORT/quit >/dev/null; sleep 0.4; }
evs(){ grep -o '"ev":"\(click\|app-did-become-active\|win-focus\|pointerdown\|drag-start\|drag-end\|landed\|uncaught\)"' $L | cut -d'"' -f4 | tr '\n' ' '; }

echo "## 1. 누르기와 포커스"
for v in "overlay 1 1" "overlay 0 1" "small 1 1" "small 0 1" "overlay 1 0" "small 1 0"; do set -- ${=v}
  up click-$1-panel$2-dock$3 --mode=$1 --panel=$2 --dock=$3 --sec=break --startx=760 --lift=300 --outline=1
  curl -s localhost:$PORT/arm >/dev/null; sleep 0.1; cliclick c:760,634; sleep 0.35
  [[ "$2$3" == "11" ]] && screencapture -x -R 560,430,400,280 $SHOT/hearts-$1.png
  sleep 0.6; echo "$1 panel=$2 dock=$3 → $(evs)| $(st)"; down
done

echo "## 2. 끌기"
for m in overlay small; do
  up drag-$m --mode=$m --panel=1 --sec=break --startx=760 --lift=300 --outline=1
  curl -s localhost:$PORT/arm >/dev/null; sleep 0.1
  cliclick dd:760,634 w:120 dm:760,560 w:60 dm:820,480 w:60 dm:900,400; sleep 0.25; echo "$m 끄는 중(900,400): $(st)"
  cliclick -e 60 dm:1300,250; sleep 0.25; echo "$m 끄는 중(1300,250): $(st)"
  screencapture -x -R 1100,20,400,300 $SHOT/drag-$m.png
  cliclick dm:1300,=-250; sleep 0.3; echo "$m 위 모니터로(1300,-250): $(st)"
  cliclick dm:1505,300; sleep 0.3; echo "$m 오른쪽 끝(1505,300): $(st)"
  cliclick dm:5,300; sleep 0.3; echo "$m 왼쪽 끝(5,300): $(st)"
  cliclick dm:700,200 w:200 du:700,200; sleep 1.2; echo "$m 놓은 뒤 1.2초: $(st)"
  screencapture -x -R 500,60,400,400 $SHOT/fall-$m.png
  # 내려오는 중에 다시 잡는다.
  P=$(curl -s localhost:$PORT/state | python3 -c "import json,sys;p=json.load(sys.stdin)['pos'];print(p['sx'],p['sy'])"); set -- ${=P}
  cliclick dd:$1,$(( $2 - 20 )) w:150 dm:1000,480 w:150 du:1000,480; sleep 0.3; echo "$m 다시 잡아 놓은 뒤: $(st)"
  sleep 2.6; echo "$m 착지: $(st)"; echo "  이벤트: $(evs)"
  grep -o '"ev":"drag-end".*' $L | cut -c1-230
  down
done

[[ -n "$ONLY12" ]] && exit 0; echo "## 3. Dock 위 표시"
for lv in floating pop-up-menu screen-saver; do
  up dock-$lv --mode=overlay --panel=1 --sec=break --startx=560 --level=$lv
  cliclick m:756,900 w:100 m:756,981 w:80 m:756,982 w:80 m:756,982; sleep 1.3
  screencapture -x -R 300,800,912,182 $SHOT/dock-$lv.png; down
done
cliclick m:756,500

echo "## 4. 전체 화면 앱 위"
PORT=47950; ($E . --mode=target --port=47950 --log=logs/input/target.jsonl >/dev/null 2>&1 &); sleep 2.5
TP=47950
for v in "overlay 1" "overlay 0" "small 1"; do set -- ${=v}
  PORT=$((47960 + ${#v} + $2)); L=logs/input/fs-$1-panel$2.jsonl; rm -f $L
  ($E . --port=$PORT --log=$L --mode=$1 --panel=$2 --sec=break --startx=$((400 + 300*$2 + (${#1}==5 ? 400 : 0))) >/dev/null 2>&1 &)
  eval "FS_$1_$2=$PORT"
done; sleep 3
curl -s "localhost:$TP/fullscreen?v=1" >/dev/null; sleep 3
screencapture -x -R 0,700,1512,282 $SHOT/fullscreen.png
curl -s "localhost:$TP/fullscreen?v=0" >/dev/null; sleep 2.5
screencapture -x -R 0,700,1512,282 $SHOT/after-fullscreen.png
grep -o '"ev":"target-[a-z-]*"' logs/input/target.jsonl | tr '\n' ' '; echo
for p in 47950 $FS_overlay_1 $FS_overlay_0 $FS_small_1; do curl -s localhost:$p/quit >/dev/null; done
sleep 0.5; echo "남은 프로세스 $(ps -axo args | grep -c 'MacOS/Electron \. ')"
