#!/bin/zsh
# PROTOTYPE: 강아지를 눌렀을 때 맨 앞 앱이 바뀌는지 본다. 인자: 이름, 나머지는 앱 옵션.
cd "$(dirname "$0")"; E=../bell-probe/node_modules/.bin/electron; name=$1; shift
front(){ lsappinfo info -only name $(lsappinfo front) | head -1 | cut -d'"' -f2; }
mkdir -p logs/focus; rm -f logs/focus/$name.jsonl
B0=$(front)
($E . --port=47850 --sec=break --startx=760 --lift=300 --log=logs/focus/$name.jsonl "$@" >/dev/null 2>&1 &); sleep 3.5
B1=$(front)
curl -s localhost:47850/arm >/dev/null; sleep 0.15
cliclick -r c:760,634; sleep 0.7
B2=$(front); ST=$(curl -s localhost:47850/state | python3 -c "import json,sys;d=json.load(sys.stdin);print('winFocused',d['focused'],'appFocused',d['appFocused'])")
[[ "$B2" != "$B0" ]] && osascript -e "tell application \"$B0\" to activate" >/dev/null 2>&1
EV=$(grep -o '"ev":"\(click\|app-did-become-active\|win-focus\|pointerdown\)"' logs/focus/$name.jsonl | tr '\n' ' ')
curl -s localhost:47850/quit >/dev/null; sleep 0.8
echo "$name | 띄우기 전 [$B0] 띄운 뒤 [$B1] 누른 뒤 [$B2] | $ST | $EV"
