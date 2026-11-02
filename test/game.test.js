const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { WebSocket } = require('ws');

test('a local multiplayer round enforces the lobby and shares movement', async t => {
  const port = 18193;
  const server = spawn(process.execPath, ['server.js'], { env: { ...process.env, PORT: String(port), COFFEE_NO_TUNNEL: '1' } });
  t.after(() => server.kill());
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('server did not start')), 5000);
    server.stdout.once('data', () => { clearTimeout(timeout); resolve(); });
    server.once('error', reject);
  });
  assert.equal((await fetch(`http://127.0.0.1:${port}/`)).status, 200);
  const clients = [];
  t.after(() => clients.forEach(c => c.close()));
  function waitFor(ws, predicate) { return new Promise((resolve, reject) => { const timeout=setTimeout(()=>{ws.off('message',onMessage);reject(new Error('message timeout'));},6000); function onMessage(raw){const m=JSON.parse(raw);if(predicate(m)){clearTimeout(timeout);ws.off('message',onMessage);resolve(m);}}ws.on('message',onMessage); }); }
  async function join(name) { const ws=new WebSocket(`ws://127.0.0.1:${port}`);clients.push(ws);await new Promise(resolve=>ws.once('open',resolve));let joined=waitFor(ws,m=>m.type==='joined');ws.send(JSON.stringify({type:'join',name}));let info=await joined;return {ws,id:info.id,token:info.token}; }
  const a=await join('Alice');
  assert.equal((await waitFor(a.ws,m=>m.type==='state')).duration,180);
  a.ws.send(JSON.stringify({type:'start'}));
  assert.equal((await waitFor(a.ws,m=>m.type==='state')).phase,'lobby');
  const b=await join('Bob');
  b.ws.send(JSON.stringify({type:'duration',minutes:10}));
  assert.equal((await waitFor(b.ws,m=>m.type==='state')).duration,180);
  a.ws.send(JSON.stringify({type:'duration',minutes:0}));
  assert.equal((await waitFor(a.ws,m=>m.type==='state')).duration,180);
  a.ws.send(JSON.stringify({type:'duration',minutes:3}));
  assert.equal((await waitFor(b.ws,m=>m.type==='state'&&m.duration===180)).duration,180);
  a.ws.send(JSON.stringify({type:'ready',ready:true}));
  b.ws.send(JSON.stringify({type:'ready',ready:true}));
  await waitFor(a.ws,m=>m.type==='state'&&m.players.filter(p=>p.ready).length===2);
  let countdown=waitFor(a.ws,m=>m.type==='state'&&m.phase==='countdown');
  a.ws.send(JSON.stringify({type:'start'}));
  assert.equal((await countdown).players.length,2);
  const playing=await waitFor(a.ws,m=>m.type==='state'&&m.phase==='playing');
  assert.equal(playing.players.length,2);
  assert.equal(playing.cups.length,2,'two cups keep the round competitive');
  const furniture=[{x:485,y:262,w:230,h:120},{x:260,y:155,w:125,h:75},{x:815,y:155,w:125,h:75},{x:260,y:490,w:125,h:75},{x:815,y:490,w:125,h:75}];
  for(const cup of playing.cups){
    assert.ok(Math.hypot(cup.x-600,cup.y-360)<=240,'cups spawn inside the central radius');
    assert.ok(!furniture.some(o=>cup.x+19>o.x&&cup.x-19<o.x+o.w&&cup.y+19>o.y&&cup.y-19<o.y+o.h),'players can reach every spawned cup');
  }
  assert.ok(Math.hypot(playing.cups[0].x-playing.cups[1].x,playing.cups[0].y-playing.cups[1].y)>=48,'cups do not overlap');
  assert.ok(playing.remaining<=180 && playing.remaining>=179);
  a.ws.send(JSON.stringify({type:'dash'}));
  const dashing=await waitFor(a.ws,m=>m.type==='state'&&m.players.some(p=>p.id===a.id&&p.dashing));
  assert.ok(dashing.players.find(p=>p.id===a.id).cooldown>0,'dash charge reflects the active cooldown');
  await waitFor(a.ws,m=>m.type==='state'&&m.players.some(p=>p.id===a.id&&p.cooldown===0));
  a.ws.send(JSON.stringify({type:'duration',minutes:10}));
  assert.equal((await waitFor(a.ws,m=>m.type==='state'&&m.phase==='playing')).duration,180);
  b.ws.send(JSON.stringify({type:'input',x:-1,y:0}));
  let moved=await waitFor(a.ws,m=>m.type==='state'&&m.players.some(p=>p.id===b.id&&p.x<1100));
  assert.ok(moved.cups.length>0);
  const late=await join('Late');
  const lateState=await waitFor(late.ws,m=>m.type==='state'&&m.phase==='playing'&&m.players.some(p=>p.id===late.id));
  assert.equal(lateState.players.find(p=>p.id===late.id).name,'Late');
  assert.equal(lateState.players.find(p=>p.id===late.id).score,0);
  await join('Fourth');
  await join('Fifth');
  const overflow=new WebSocket(`ws://127.0.0.1:${port}`);clients.push(overflow);await new Promise(resolve=>overflow.once('open',resolve));
  let rejected=waitFor(overflow,m=>m.type==='error');overflow.send(JSON.stringify({type:'join',name:'Sixth'}));
  assert.match((await rejected).message,/full/);
  let disconnected=waitFor(b.ws,m=>m.type==='state'&&m.players.some(p=>p.id===a.id&&!p.connected));a.ws.close();
  assert.equal((await disconnected).players.find(p=>p.id===a.id).ready,false);
  const resumed=new WebSocket(`ws://127.0.0.1:${port}`);clients.push(resumed);await new Promise(resolve=>resumed.once('open',resolve));
  let restored=waitFor(resumed,m=>m.type==='joined');resumed.send(JSON.stringify({type:'join',name:'Alice',token:a.token,resume:true}));
  assert.equal((await restored).id,a.id);
  assert.equal((await waitFor(b.ws,m=>m.type==='state'&&m.players.some(p=>p.id===a.id&&p.connected))).hostId,a.id);
});
