import subprocess, time, sys, re, os
E_BIN='/Users/wraith/workspace/personal/ding-dong-dang/node_modules/.bin/electron'
APP=os.path.dirname(os.path.abspath(__file__))
def tree(pid):
    rows=[l.split(None,3) for l in subprocess.check_output(['ps','-axo','pid=,ppid=,time=,command=']).decode().splitlines()]
    pids={pid}; grew=True
    while grew:
        grew=False
        for r in rows:
            if int(r[1]) in pids and int(r[0]) not in pids: pids.add(int(r[0])); grew=True
    out={}
    for r in rows:
        if int(r[0]) in pids:
            p=r[2].replace('.',':').split(':')  # mm:ss.cc
            m,s,c=int(p[0]),int(p[1]),int(p[2]) if len(p)>2 else 0
            sec=m*60+s+c/100
            t=re.search(r'--type=([\w-]+)',r[3]); out[int(r[0])]=(t.group(1) if t else 'main',sec)
    return out
for mode in sys.argv[3:]:
    warm=float(sys.argv[1]); dur=float(sys.argv[2])
    p=subprocess.Popen([E_BIN,APP,'--mode='+mode],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
    time.sleep(warm); a=tree(p.pid); t0=time.time(); l0=os.getloadavg()[0]
    time.sleep(dur); b=tree(p.pid); w=time.time()-t0; l1=os.getloadavg()[0]
    by={}
    for k,(ty,s) in b.items(): by[ty]=by.get(ty,0)+s-(a.get(k,(0,0))[1])
    tot=sum(by.values())
    print(f"{mode:18s} total={tot/w*100:5.1f}%  "+' '.join(f"{k}={v/w*100:.1f}" for k,v in sorted(by.items()) if v>0)+f"  load={l0:.0f}->{l1:.0f}",flush=True)
    p.terminate(); time.sleep(2)
