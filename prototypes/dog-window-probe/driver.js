// PROTOTYPE: 창 방식 두 가지가 같이 쓰는 강아지 행동. 위치는 화면 좌표(발끝 가운데)로 들고 있다.
if(CFG.debug)document.body.classList.add('debug');
let sx=0, sy=0, sec=CFG.sec, act='pause', until=0, ringing=false, happyUntil=0, vx=0, clock=0, on=CFG.on;
let PADB=6, winW=0, winH=0, sentX=null, sentY=null, grab=null, down=false, ringTimer;
const gap=(a,b)=>rnd(a,b)*(CFG.fast?.3:1);
const stat={frames:0,draws:0,walk:0,pause:0,other:0};
const log=(ev,d)=>ipcRenderer.send('log',Object.assign({ev},d||{}));

load();
if(CFG.mode==='small'){
  // 낙하산 · 하트 · 끌 때의 흔들림이 들어갈 만큼만 강아지보다 크게 잡는다.
  winW=Math.ceil(Math.max(1.6*W+92,W+.75*H,1.5*H)+8); winH=Math.ceil(1.925*H+12+PADB);
}
ipcRenderer.send('layout',{W,H,winW,winH,PADB});
sx=CFG.startX!=null?CFG.startX:rnd(CFG.minX+W,CFG.maxX-W); sy=CFG.floorY;
sentX=Math.round(sx);sentY=Math.round(sy);ipcRenderer.send('pos',{sx:sentX,sy:sentY,W,H,label:'start'});
// 강아지의 창 안 위치. 작은 창에서는 고정이고, 화면 전체 창에서는 화면 좌표에서 창 원점을 뺀 값이다.
const local=()=>CFG.mode==='small'?{x:winW/2,y:winH-PADB}:{x:sx-CFG.winX,y:sy-CFG.winY};

function hearts(){
  const l=local();
  for(let i=0;i<8;i++){const h=document.createElement('span');h.className='heart';h.textContent='♥';
    h.style.cssText='left:'+(l.x+rnd(-W*.8,W*.8))+'px;top:'+(l.y-rnd(H*.3,H*1.2))+'px;font-size:'+rnd(14,28)*H/96+'px;animation-delay:'+rnd(0,.3)+'s;--dx:'+rnd(-18,18)+'px';
    stage.appendChild(h);setTimeout(()=>h.remove(),1500)}
}
function ring(v){ringing=v;clearTimeout(ringTimer);
  if(v){if(!on){sx=CFG.maxX-140;sy=CFG.floorY;sentX=null}ringTimer=setTimeout(()=>ring(false),CFG.ringMs||8000)}
  ipcRenderer.send('ringing',v);log('ring',{v})}
ipcRenderer.on('ring',(_,v)=>ring(v));
ipcRenderer.on('sec',(_,v)=>{sec=v;if(act!=='drag'&&act!=='fall'){act='pause';until=clock+1}});
ipcRenderer.on('on',(_,v)=>{on=v});
ipcRenderer.on('frozen',(_,v)=>{frozen=v;log('frozen',{v})});
let frozen=false, last=0, lastDraw=0, lastAct='';
function tick(ms){
  schedule();
  stat.frames++;
  if(frozen)return;
  if(CFG.fps&&ms-lastDraw<1000/rate()-2)return;
  const dt=Math.min(.25,(ms-(lastDraw||ms))/1000);lastDraw=ms;clock+=dt;const t=clock,F=CFG.floorY;
  stat.draws++;
  let anim='idle',hopY=0,rot=0,label;
  if(down){
    const c=ipcRenderer.sendSync('cursor'),dx=c.x-grab.px,dy=c.y-grab.py;
    if(!grab.moved&&Math.hypot(dx,dy)>5&&!(ringing&&!on)){grab.moved=true;act='drag';chute.setAttribute('class','');flip.classList.add('drag');if(ringing)ring(false);ipcRenderer.send('drag',true);log('drag-start',{sx,sy})}
    if(grab.moved){const nx=Math.max(CFG.minX+W/2,Math.min(CFG.maxX-W/2,grab.ox+dx));vx=(nx-sx)/Math.max(dt,.008);sx=nx;sy=Math.max(CFG.topY+H,Math.min(F,grab.oy+dy));
      grab.maxLag=Math.max(grab.maxLag||0,0)}
  }
  if(act==='drag'){anim='hang';rot=Math.max(-20,Math.min(20,-vx*.04));vx*=.9;label='drag'}
  else if(act==='fall'){sy+=CFG.fall*dt;anim='hang';rot=5*Math.sin(t*2.2);label='fall';
    if(sy>=F){sy=F;act='pause';until=t+1;chute.setAttribute('class','fold');log('landed',{sx,sy})}}
  else if(ringing){sy=F;anim='happy';label='ring'}
  else if(t<happyUntil){anim='happy';label='happy'}
  else if(sec==='break'){anim='sleepy';label='rest'}
  else{
    if(t>=until){if(act==='walk'){act='pause';until=t+gap(10,20)}else{act='walk';until=t+rnd(5,10);dir=Math.random()<.5?-1:1}}
    if(act==='walk'){
      const walks=th.walk,s=H/96;
      sx+=dir*(walks?45:38)*s*dt;
      if(sx<CFG.minX+W/2+8){sx=CFG.minX+W/2+8;dir=1}if(sx>CFG.maxX-W/2-8){sx=CFG.maxX-W/2-8;dir=-1}
      if(walks){anim='walk';label='walk'}else{anim='hop';hopY=-12*s*Math.abs(Math.sin(t*7));label='hopping'}
    }else label='pause';
  }
  stat[label==='walk'||label==='hopping'?'walk':label==='pause'?'pause':'other']+=dt;
  if(label!==lastAct){lastAct=label;log('act',{label,sx:Math.round(sx),sy:Math.round(sy)})}
  const l=local();
  dog.style.transform='translate('+l.x+'px,'+l.y+'px)';
  hop.style.transform='translateY('+hopY+'px)';
  flip.style.transformOrigin=(act==='drag'||act==='fall')?'50% 0':'50% 100%';
  flip.style.transform='rotate('+rot+'deg) scaleX('+(th.face?dir*th.face:1)+')';
  // 멈춰 있는 동안의 숨쉬기 · 깜빡임을 그리지 않는 조건(still)에서는 이동 · 신남 · 끌기 때만 부위를 움직인다.
  if(!(CFG.still&&(label==='pause'||label==='rest')))pose(anim,t);
  const rx=Math.round(sx),ry=Math.round(sy);
  if(rx!==sentX||ry!==sentY){sentX=rx;sentY=ry;ipcRenderer.send('pos',{sx:rx,sy:ry,W,H,label})}
}
// 멈춰 있을 때는 더 낮은 프레임 수로 그린다.
function rate(){return (CFG.idlefps&&(lastAct==='pause'||lastAct==='rest'))?CFG.idlefps:CFG.fps}
function schedule(){ if(CFG.timer&&CFG.fps)setTimeout(()=>tick(performance.now()),1000/rate()); else requestAnimationFrame(tick); }
flip.addEventListener('pointerdown',e=>{const c=ipcRenderer.sendSync('cursor');grab={px:c.x,py:c.y,ox:sx,oy:sy,moved:false};down=true;flip.setPointerCapture(e.pointerId);ipcRenderer.send('down',true);log('pointerdown',{c,sx,sy,client:[e.clientX,e.clientY]})});
const up=why=>e=>{if(!down)return;down=false;flip.classList.remove('drag');const c=ipcRenderer.sendSync('cursor');
  if(grab.moved){ipcRenderer.send('drag',false);log('drag-end',{why,c,sx,sy,expect:{x:grab.ox+c.x-grab.px,y:grab.oy+c.y-grab.py}});
    if(sy<CFG.floorY-4){if(CFG.reduced){sy=CFG.floorY;act='pause';until=clock+1}else{act='fall';chute.setAttribute('class','open')}}else{sy=CFG.floorY;act='pause';until=clock+1}}
  else{hearts();log('click',{why,wasRinging:ringing});if(ringing)ring(false);happyUntil=clock+2}
  ipcRenderer.send('down',false);grab=null};
flip.addEventListener('pointerup',up('pointerup'));flip.addEventListener('pointercancel',up('pointercancel'));flip.addEventListener('lostpointercapture',up('lostpointercapture'));
document.addEventListener('visibilitychange',()=>log('visibility',{state:document.visibilityState}));
setInterval(()=>{ipcRenderer.send('stat',Object.assign({},stat));for(const k in stat)stat[k]=0},5000);
schedule();
