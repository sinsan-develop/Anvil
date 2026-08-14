import {configure,runDesignFlow} from '../api/design-flow-client.js';
const byId=id=>document.getElementById(id); await configure();
function payload(action){return {action,intent:byId('intent').value,proposals:[byId('proposal-a').value,byId('proposal-b').value],selected:byId('selected').value,actor:{id:'sinsan',authenticated:true}};}
function render(body){byId('result').dataset.state=body.state;byId('state').textContent=body.state;byId('message').textContent=body.message;byId('events').replaceChildren(...body.events.map(e=>{const li=document.createElement('li');li.textContent=`${e.event_id} · ${e.type} · ${e.occurred_at} · ${e.actor.type}:${e.actor.id}`;return li;}));}
byId('normal').addEventListener('click',async()=>render((await runDesignFlow(payload('normal'))).body));
byId('blocked').addEventListener('click',async()=>render((await runDesignFlow(payload('baseline'))).body));
byId('error').addEventListener('click',async()=>{const value=payload('normal');value.proposals=['단일 대안'];render((await runDesignFlow(value)).body);});
