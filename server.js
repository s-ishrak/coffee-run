const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { WebSocketServer, WebSocket } = require('ws');
const { spawn } = require('child_process');

const PORT = Number(process.env.PORT) || 3000;
const WIDTH = 1200, HEIGHT = 720, RADIUS = 19, SPEED = 205, DEFAULT_DURATION = 180;
const desks = [{x:70,y:70},{x:1130,y:70},{x:70,y:650},{x:1130,y:650},{x:600,y:650}];
const obstacles = [{x:485,y:262,w:230,h:120},{x:260,y:155,w:125,h:75},{x:815,y:155,w:125,h:75},{x:260,y:490,w:125,h:75},{x:815,y:490,w:125,h:75}];
const CUP_SPAWN_RADIUS = 240;
let round=0, goldenAt=0, eventAt=0, eventUntil=0, event='', notice='', noticeUntil=0, powerups=[], layout=0, tunnelUrl='';
const layouts=[[],[{x:420,y:90,w:85,h:55},{x:695,y:575,w:85,h:55}],[{x:80,y:300,w:90,h:70},{x:1030,y:350,w:90,h:70}]];
function announce(text){notice=text;noticeUntil=Date.now()+4000;}
function spot(){for(let i=0;i<1000;i++){let x=80+Math.random()*1040,y=80+Math.random()*560;if(valid(x,y))return {x,y};}return {x:600,y:120};}
let players = new Map(), cups = [], phase = 'lobby', endAt = 0, countdownAt = 0, last = Date.now(), hostId = null, cupId = 0, duration = DEFAULT_DURATION;
const GRACE = 30000;
function send(ws, msg) { if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg)); }
function broadcast(msg) { for (const p of players.values()) send(p.ws,msg); }
function spawnCup(golden=false) {
 let x,y;
 do {
  const angle=Math.random()*Math.PI*2, radius=Math.sqrt(Math.random())*CUP_SPAWN_RADIUS;
  x=WIDTH/2+Math.cos(angle)*radius; y=HEIGHT/2+Math.sin(angle)*radius;
 } while(!valid(x,y)||cups.some(c=>!c.held&&Math.hypot(c.x-x,c.y-y)<48));
 cups.push({id:++cupId,x,y,held:null,golden});
}
function restart() {
 if(round>=3){round=0;for(const p of players.values())p.total=0;}
 round++;layout=(round-1)%layouts.length; phase='countdown'; countdownAt=Date.now()+3000; endAt=0; cups=[];powerups=[];event='';goldenAt=0;eventAt=0;
 const roster=[...players.values()].sort((a,b)=>a.slot-b.slot); if(round>1&&roster.length>1){const slots=roster.map(p=>p.slot);roster.forEach((p,i)=>p.slot=slots[(i+1)%slots.length]);}
 for(let i=0;i<Math.max(2,Math.min(4,players.size));i++)spawnCup();
 for(const p of players.values()){const d=desks[p.slot];Object.assign(p,{x:d.x,y:d.y,score:0,held:null,dx:0,dy:0,dashUntil:0,cooldown:0,ready:false,knockdowns:0,pickups:0,losses:0,shield:false,boostUntil:0,protectedUntil:0,lastDelivery:0,recoveries:0,wasHit:false});}
}
function valid(x,y) { if(x<RADIUS||y<RADIUS||x>WIDTH-RADIUS||y>HEIGHT-RADIUS)return false; return !obstacles.concat(layouts[layout]).some(o=>x+RADIUS>o.x&&x-RADIUS<o.x+o.w&&y+RADIUS>o.y&&y-RADIUS<o.y+o.h); }
function snapshot() { return {type:'state',phase,duration,round,layout,extraObstacles:layouts[layout],event:eventUntil>Date.now()?event:'',notice:noticeUntil>Date.now()?notice:'',powerups,tunnelUrl,remaining:Math.max(0,Math.ceil((endAt-Date.now())/1000)),countdown:Math.max(0,Math.ceil((countdownAt-Date.now())/1000)),hostId,players:[...players.values()].map(({id,name,slot,x,y,dx,dy,score,held,dashUntil,cooldown,ready,connected,knockdowns,pickups,losses,total,shield,boostUntil,protectedUntil,recoveries,lastDelivery})=>({id,name,slot,x:Math.round(x),y:Math.round(y),dx,dy,score,held,ready,connected,knockdowns,pickups,losses,total:total||0,shield,boosting:boostUntil>Date.now(),protected:protectedUntil>Date.now(),recoveries,lastDelivery,dashing:dashUntil>Date.now(),cooldown:Math.max(0,cooldown-Date.now())})),cups}; }
function tick() {
 const now=Date.now(),dt=Math.min((now-last)/1000,.05); last=now;
 for(const p of players.values()) if(!p.connected && now>=p.expiresAt){players.delete(p.id);if(hostId===p.id)hostId=[...players.values()].find(q=>q.connected)?.id||players.keys().next().value||null;}
 if(!players.size){phase='lobby';cups=[];hostId=null;duration=DEFAULT_DURATION;round=0;}
 if(phase==='countdown'&&now>=countdownAt){phase='playing';endAt=now+duration*1000;goldenAt=now+30000;eventAt=now+40000;}
 if(phase==='playing') {
  if(now>=endAt){phase='results';for(const p of players.values()){p.ready=false;p.total=(p.total||0)+p.score;} broadcast(snapshot()); return;}
  if(now>=goldenAt){if(!cups.some(c=>c.golden)){spawnCup(true);announce('Golden Coffee is here — worth 3 points!');}goldenAt=now+35000;}
  if(now>=eventAt){event=event==='Espresso Rush'?'Coffee Break':'Espresso Rush';eventUntil=now+12000;eventAt=now+40000;announce(event==='Espresso Rush'?'Espresso Rush: faster dash recharge!':'Coffee Break: extra coffee!');if(event==='Coffee Break')spawnCup();}
  if(powerups.length<2 && Math.random()<.0015){powerups.push({...spot(),type:Math.random()<.5?'lid':'shoes'});}
  for(const p of players.values()) {
   if(!p.connected)continue;
   const item=powerups.find(i=>Math.hypot(i.x-p.x,i.y-p.y)<30);if(item&&!p.shield&&p.boostUntil<now){powerups=powerups.filter(i=>i!==item);if(item.type==='lid')p.shield=true;else p.boostUntil=now+8000;announce(p.name+(item.type==='lid'?' found a Cup Lid!':' found Sneakers!'));}
   const speed=SPEED*(p.boostUntil>now?1.25:1)*(p.held?0.84:1)*(p.dashUntil>now?2.2:1); let nx=p.x+p.dx*speed*dt, ny=p.y+p.dy*speed*dt;
   if(valid(nx,p.y))p.x=nx; if(valid(p.x,ny))p.y=ny;
   if(p.dashUntil>now) for(const q of players.values()) if(q!==p && q.held && (q.protectedUntil||0)<now && Math.hypot(q.x-p.x,q.y-p.y)<43 && !p.hit.has(q.id)) { if(q.shield){q.shield=false;q.protectedUntil=now+1200;p.hit.add(q.id);announce(q.name+' blocked a dash!');continue;} const cup=cups.find(c=>c.id===q.held); if(cup){cup.held=null;cup.x=q.x;cup.y=q.y;} q.held=null;q.pickupAfter=now+1000;q.losses++;q.wasHit=true;q.protectedUntil=now+1500;p.knockdowns++;announce(p.name+' knocked '+q.name+'’s coffee loose!');p.hit.add(q.id); }
   if(!p.held && (p.pickupAfter||0)<now) { const cup=cups.find(c=>!c.held&&Math.hypot(c.x-p.x,c.y-p.y)<30); if(cup){cup.held=p.id;p.held=cup.id;p.pickups++;} }
   if(p.held && Math.hypot(p.x-desks[p.slot].x,p.y-desks[p.slot].y)<48){const delivered=cups.find(c=>c.id===p.held);cups=cups.filter(c=>c.id!==p.held);p.held=null;p.score+=delivered&&delivered.golden?3:1;p.lastDelivery=Math.max(0,Math.ceil((endAt-now)/1000));if(p.wasHit){p.recoveries++;p.wasHit=false;}if(!delivered||!delivered.golden)spawnCup();}
  }
 }
}
const root=path.join(__dirname,'public');
const server=http.createServer((req,res)=>{let pathname; try{pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);}catch{return res.writeHead(400).end();} let f=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname)); if(!f.startsWith(root+path.sep))return res.writeHead(403).end(); fs.readFile(f,(err,data)=>{if(err)return res.writeHead(404).end('Not found'); const ext=path.extname(f);res.writeHead(200,{'Content-Type':({'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.jpg':'image/jpeg','.png':'image/png','.svg':'image/svg+xml'})[ext]||'application/octet-stream','Cache-Control':'no-cache'});res.end(data);});});
const wss=new WebSocketServer({server,maxPayload:2048});
wss.on('connection',ws=>{let p=null; ws.on('message',raw=>{let m;try{m=JSON.parse(raw)}catch{return} if(!m||typeof m!=='object')return;
 if(m.type==='join'&&!p){
  const old=typeof m.token==='string'?[...players.values()].find(q=>q.token===m.token&&!q.connected&&Date.now()<q.expiresAt):null;
  if(old){p=old;p.ws=ws;p.connected=true;p.expiresAt=0;send(ws,{type:'joined',id:p.id,token:p.token,addresses:addresses()});broadcast(snapshot());return;}
  if(m.resume)return send(ws,{type:'error',message:'Your reconnection window expired. Reload to join again.'});
  if(players.size>=5)return send(ws,{type:'error',message:'The office is full (5 players).'});
  let name=String(m.name||'').trim().replace(/[\x00-\x1f<>]/g,'').slice(0,16);if(!name)return send(ws,{type:'error',message:'Please enter a name.'});
  let slot=[0,1,2,3,4].find(i=>![...players.values()].some(x=>x.slot===i)),id=require('crypto').randomUUID(),token=require('crypto').randomUUID(),d=desks[slot];
  p={ws,id,token,name,slot,x:d.x,y:d.y,score:0,held:null,dx:0,dy:0,dashUntil:0,cooldown:0,hit:new Set(),ready:false,connected:true,total:0,shield:false,boostUntil:0,protectedUntil:0,knockdowns:0,pickups:0,losses:0};players.set(id,p);if(!hostId)hostId=id;send(ws,{type:'joined',id,token,addresses:addresses()});broadcast(snapshot());
 }
 else if(p&&m.type==='input'&&phase==='playing'){let x=Number(m.x),y=Number(m.y);if(!Number.isFinite(x)||!Number.isFinite(y))return;let len=Math.hypot(x,y);p.dx=len?x/Math.max(1,len):0;p.dy=len?y/Math.max(1,len):0;}
 else if(p&&m.type==='dash'&&phase==='playing'&&Date.now()>=p.cooldown){p.dashUntil=Date.now()+230;p.cooldown=Date.now()+(event==='Espresso Rush'&&eventUntil>Date.now()?1100:2200);p.hit=new Set();}
 else if(p&&m.type==='ready'&&(phase==='lobby'||phase==='results')){p.ready=!!m.ready;broadcast(snapshot());}
 else if(p&&m.type==='duration'&&p.id===hostId&&(phase==='lobby'||phase==='results')&&Number.isInteger(m.minutes)&&m.minutes>=1&&m.minutes<=60){duration=m.minutes*60;broadcast(snapshot());}
 else if(p&&m.type==='start'&&p.id===hostId&&(phase==='lobby'||phase==='results')&&[...players.values()].filter(q=>q.connected&&q.ready).length>=2){restart();broadcast(snapshot());}
 }); ws.on('close',()=>{if(!p||p.ws!==ws)return;if(p.held){let cup=cups.find(c=>c.id===p.held);if(cup){cup.held=null;cup.x=p.x;cup.y=p.y;}p.held=null;}p.dx=0;p.dy=0;p.dashUntil=0;p.ready=false;p.connected=false;p.ws=null;p.expiresAt=Date.now()+GRACE;broadcast(snapshot());});});
function addresses(){return Object.values(os.networkInterfaces()).flat().filter(item=>item&&item.family==='IPv4'&&!item.internal).map(item=>item.address);}
setInterval(tick,1000/60);setInterval(()=>broadcast(snapshot()),50);
server.listen(PORT,'0.0.0.0',()=>{console.log(`Coffee Run is ready! Open http://localhost:${PORT}`);
 if(process.env.COFFEE_NO_TUNNEL!=='1'){
  const executable=path.join(__dirname,'cloudflared-windows-amd64.exe');
  const tunnel=spawn(executable,['tunnel','--url',`http://localhost:${PORT}`],{windowsHide:true});let buffer='';
  function output(data){buffer+=data.toString();const match=buffer.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/i);if(match&&!tunnelUrl){tunnelUrl=match[0];console.log(`\nCloudflare invite link (copy and share): ${tunnelUrl}\n`);broadcast(snapshot());}if(buffer.length>10000)buffer=buffer.slice(-10000);}
  tunnel.stdout.on('data',output);tunnel.stderr.on('data',output);tunnel.on('error',err=>console.error('Cloudflare tunnel failed:',err.message));tunnel.on('exit',code=>{if(code!==0)console.error('Cloudflare tunnel stopped:',code);tunnelUrl='';});process.on('exit',()=>tunnel.kill());
 }
for(const net of Object.values(os.networkInterfaces()))for(const item of net||[])if(item.family==='IPv4'&&!item.internal)console.log(`Share with colleagues: http://${item.address}:${PORT}`);});

