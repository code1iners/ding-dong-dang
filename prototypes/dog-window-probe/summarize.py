# PROTOTYPE: metrics 로그를 상태별 평균 CPU로 요약한다. 값은 한 코어 기준 %이고 누적 CPU 시간의 차이로 계산한다.
import json,sys,datetime
T=lambda s: datetime.datetime.fromisoformat(s.replace('Z','+00:00')).timestamp()
for p in sys.argv[1:]:
    rows=[json.loads(l) for l in open(p)]
    ms=[r for r in rows if r['ev']=='metrics' and r.get('stat')]
    if len(ms)<3: print(p,'no data'); continue
    iv=[]
    for a,b in zip(ms,ms[1:]):
        dt=T(b['t'])-T(a['t']); ca={q['type']:q.get('cum',0) for q in a['m']}
        per={q['type']:(q.get('cum',0)-ca.get(q['type'],0))/dt*100 for q in b['m']}
        iv.append(dict(tot=sum(per.values()),per=per,st=b['stat'],idle=b['idle'],dt=dt))
    avg=lambda a: round(sum(a)/len(a),1) if a else None
    span=sum(i['dt'] for i in iv)
    first={q['type']:q.get('cum',0) for q in ms[0]['m']}; lastm={q['type']:q.get('cum',0) for q in ms[-1]['m']}
    overall=sum(lastm[k]-first.get(k,0) for k in lastm)/span*100
    walk=sum(i['st']['walk'] for i in iv); pause=sum(i['st']['pause'] for i in iv); other=sum(i['st']['other'] for i in iv)
    w=[i['tot'] for i in iv if i['st']['walk']>4.5]; s=[i['tot'] for i in iv if i['st']['walk']<0.01 and i['st']['other']<0.01]
    types=sorted({k for i in iv for k in i['per']})
    print(f"{p}: {span:.0f}s 평균 {overall:.1f}% 최대 {max(i['tot'] for i in iv):.1f}% | 걷기 구간 {avg(w)}% (n={len(w)}) 멈춤 구간 {avg(s)}% (n={len(s)}) | 걷기 {walk:.0f}s 멈춤 {pause:.0f}s 기타 {other:.0f}s | 초당 그리기 {avg([i['st']['draws']/5 for i in iv])} | " + ' '.join(f"{k} {avg([i['per'].get(k,0) for i in iv])}" for k in types) + f" | 입력 없음 최대 {max(i['idle'] for i in iv)}s")
