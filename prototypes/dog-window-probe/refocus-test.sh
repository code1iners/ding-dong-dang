#!/bin/zsh
# PROTOTYPE: 강아지를 누른 뒤 원래 앱으로 포커스를 돌려주는 대책과, 내려오는 중 다시 잡기를 본다.
cd "$(dirname "$0")"; E=../bell-probe/node_modules/.bin/electron; SHOT=${SHOT:-/tmp}; mkdir -p logs/refocus
front(){ lsappinfo info -only name $(lsappinfo front) | head -1 | cut -d'"' -f2; }
P=48000
for v in "overlay 0" "overlay 1" "small 1"; do set -- ${=v}; P=$((P+1)); L=logs/refocus/$1-refocus$2.jsonl; rm -f $L
  ($E . --port=$P --log=$L --mode=$1 --refocus=$2 --sec=break --startx=760 --lift=300 >/dev/null 2>&1 &); for i in {1..60}; do curl -s localhost:$P/state 2>/dev/null | grep -q '"pos":{' && break; sleep 0.2; done; sleep 0.8
  B0=$(front); cliclick m:760,634; sleep 0.2; cliclick c:760,634; sleep 0.12; screencapture -x -R 560,480,400,230 $SHOT/refocus-$1-$2-a.png; sleep 0.6; B1=$(front)
  screencapture -x -R 560,480,400,230 $SHOT/refocus-$1-$2-b.png
  echo "$1 refocus=$2: 누르기 전 [$B0] 누른 뒤 [$B1] visible=$(curl -s localhost:$P/state | python3 -c "import json,sys;print(json.load(sys.stdin)['visible'])") | $(grep -o '"ev":"\(click\|app-did-become-active\|app-did-resign-active\|pointerdown\|refocus\)"[^}]*' $L | cut -d'"' -f4- | tr '\n' ' ')"
  if [[ $2 == 1 ]]; then
    # 끌어서 놓고, 내려오는 중에 다시 잡아 옮긴다.
    cliclick dd:760,634 w:150 dm:760,500 w:80 dm:700,250 w:150 du:700,250; sleep 1.0
    Q=$(curl -s localhost:$P/state | python3 -c "import json,sys;p=json.load(sys.stdin)['pos'];print(p['sx'],p['sy']+60)"); set -- $1 $2 ${=Q}
    cliclick m:$3,$(( $4 - 40 )); sleep 0.25
    Q=$(curl -s localhost:$P/state | python3 -c "import json,sys;p=json.load(sys.stdin)['pos'];print(p['sx'],p['sy']-30)"); set -- $1 $2 ${=Q}
    cliclick dd:$3,$4 w:150 dm:1000,400 w:150 du:1000,400; sleep 0.4
    echo "  다시 잡아 놓은 뒤: $(curl -s localhost:$P/state | python3 -c "import json,sys;d=json.load(sys.stdin);print(d['pos'], 'front')") [$(front)]"
    sleep 3; echo "  이벤트: $(grep -o '"ev":"\(drag-start\|drag-end\|landed\|refocus\)"' $L | cut -d'"' -f4 | tr '\n' ' ') 맨 앞 [$(front)]"
  fi
  curl -s localhost:$P/quit >/dev/null; sleep 0.4
done
cliclick m:756,500; echo "남은 프로세스 $(ps -axo args | grep -c 'MacOS/Electron \. ')"
