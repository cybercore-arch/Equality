import type { WidgetId } from './registry';

/**
 * Страницы виджетов. Работают в изолированном iframe (sandbox без доступа к приложению, ключам и данным),
 * общаются с приложением только сообщениями:
 *  приложение → виджет: {eq:1, state, theme, busy}
 *  виджет → приложение: {eq:1, type:'ready'|'resize'|'send', ...}
 */
const BASE = `
<style>
:root{--bg:#09090b;--fg:#fafafa;--muted:#a1a1aa;--card:#18181b;--line:#27272a;--accent:#fbbf24;--on-accent:#18181b}
*{box-sizing:border-box}
html,body{margin:0;background:transparent;color:var(--fg);font:14px/1.45 system-ui,-apple-system,Roboto,sans-serif;-webkit-tap-highlight-color:transparent}
button,input{font:inherit;color:inherit}
button{cursor:pointer;border:0}
input{background:var(--line);border:0;border-radius:12px;padding:9px 12px;outline:none;min-width:0;color:var(--fg)}
input::placeholder{color:var(--muted)}
.btn{background:var(--accent);color:var(--on-accent);border-radius:12px;padding:9px 14px;font-weight:600}
.btn:disabled{opacity:.4}
.chip{background:var(--line);border-radius:999px;padding:6px 12px;color:var(--muted);white-space:nowrap}
.chip.on{background:var(--fg);color:var(--bg)}
.row{display:flex;gap:8px;align-items:center}
.scroll{overflow-x:auto;scrollbar-width:none}.scroll::-webkit-scrollbar{display:none}
@keyframes pop{from{opacity:0;transform:translateY(6px) scale(.97)}to{opacity:1;transform:none}}
.pop{animation:pop .25s cubic-bezier(.2,.8,.2,1) both}
</style>
<script>
const $=(s,r=document)=>r.querySelector(s);
function el(tag,props,...kids){const e=document.createElement(tag);for(const k in props||{}){const v=props[k];if(k==='class')e.className=v;else if(k.startsWith('on'))e.addEventListener(k.slice(2),v);else if(k==='style')e.style.cssText=v;else e[k]=v}for(const c of kids.flat())if(c!=null)e.append(c.nodeType?c:document.createTextNode(String(c)));return e}
const post=m=>parent.postMessage(Object.assign({eq:1},m),'*');
let S=null,BUSY=false;
function resize(){post({type:'resize',h:Math.ceil(document.documentElement.scrollHeight)})}
function setTheme(t){if(!t)return;for(const k in t)document.documentElement.style.setProperty('--'+k,t[k])}
addEventListener('message',e=>{const d=e.data;if(!d||d.eq!==1)return;setTheme(d.theme);S=d.state;BUSY=!!d.busy;render();requestAnimationFrame(resize)});
new ResizeObserver(resize).observe(document.body);
addEventListener('load',()=>post({type:'ready'}));
</script>`;

const PHONE = `
<div id="app"></div>
<script>
let cur=null,adding=false,seen={};
function render(){
  const app=$('#app');app.textContent='';
  const order=S.order.slice().reverse();
  if(!cur||(!S.threads[cur]&&!adding))cur=order[0]||null;
  const unread=c=>(S.threads[c]||[]).length!==(seen[c]||0)&&c!==cur&&(S.threads[c].slice(-1)[0]||{}).from==='them';
  const bar=el('div',{class:'row scroll',style:'padding-bottom:8px'},
    ...order.map(c=>el('button',{class:'chip'+(c===cur?' on':''),onclick:()=>{cur=c;adding=false;render()}},c,unread(c)?' •':'')),
    el('button',{class:'chip',onclick:()=>{adding=true;render()}},'+ Новый'));
  app.append(bar);
  if(cur)seen[cur]=(S.threads[cur]||[]).length;
  let nameInput=null;
  if(adding){nameInput=el('input',{placeholder:'Кому написать (имя)',style:'width:100%;margin-bottom:8px'});app.append(nameInput);setTimeout(()=>nameInput.focus(),0)}
  const thread=el('div',{style:'display:flex;flex-direction:column;gap:6px;max-height:220px;overflow-y:auto;padding:2px 0 8px'});
  const msgs=cur&&S.threads[cur]?S.threads[cur].slice(-40):[];
  if(!msgs.length&&!adding)thread.append(el('div',{style:'color:var(--muted);text-align:center;padding:14px 0'},cur?'Сообщений пока нет':'Здесь появятся сообщения'));
  for(const m of msgs){const me=m.from==='me';thread.append(el('div',{class:'pop',style:'max-width:82%;padding:7px 11px;border-radius:16px;white-space:pre-wrap;word-break:break-word;align-self:'+(me?'flex-end':'flex-start')+';background:'+(me?'var(--accent)':'var(--line)')+';color:'+(me?'var(--on-accent)':'var(--fg)')},m.text))}
  app.append(thread);
  const input=el('input',{placeholder:'Сообщение…',style:'flex:1'});
  const send=()=>{
    const text=input.value.trim();const to=adding&&nameInput?nameInput.value.trim():cur;
    if(!text||!to||BUSY)return;
    input.value='';cur=to;adding=false;
    post({type:'send',text:'📱 Сообщение для '+to+': '+text,ops:[{w:'phone',t:'msg',to,text}]});
  };
  input.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();send()}});
  const btn=el('button',{class:'btn',onclick:send,disabled:BUSY},'➤');
  app.append(el('div',{class:'row'},input,btn));
  const th=thread;th.scrollTop=th.scrollHeight;
}
</script>`;

const STATUS = `
<div id="app"></div>
<script>
function render(){
  const app=$('#app');app.textContent='';
  if(!S.fields.length){app.append(el('div',{style:'color:var(--muted);padding:6px 0'},'Панель пуста. Модель заполнит её по ходу игры.'));return}
  const grid=el('div',{style:'display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:8px'});
  for(const [k,v] of S.fields){
    const m=/^\\s*(-?\\d+(?:[.,]\\d+)?)\\s*\\/\\s*(\\d+(?:[.,]\\d+)?)\\s*$/.exec(v);
    const card=el('div',{class:'pop',style:'background:var(--card);border:1px solid var(--line);border-radius:14px;padding:8px 10px'},
      el('div',{style:'color:var(--muted);font-size:12px;text-transform:capitalize'},k),
      el('div',{style:'font-weight:600;word-break:break-word'},v));
    if(m){const p=Math.max(0,Math.min(100,parseFloat(m[1].replace(',','.'))/parseFloat(m[2].replace(',','.'))*100));
      card.append(el('div',{style:'height:5px;border-radius:99px;background:var(--line);margin-top:6px;overflow:hidden'},el('div',{style:'height:100%;width:'+p+'%;background:var(--accent);transition:width .5s'})))}
    grid.append(card);
  }
  app.append(grid);
}
</script>`;

const ROLL = `
<div id="app"></div>
<script>
let die='d20',count=1,mod=0,shown=null,timer=0,lastReq='';
const SIDES={d4:4,d6:6,d8:8,d10:10,d12:12,d20:20,d100:100};
function rnd(n){const a=new Uint32Array(1);crypto.getRandomValues(a);return a[0]%n+1}
function render(){
  const app=$('#app');app.textContent='';
  const p=S.pending;
  const req=p?p.d+'|'+p.reason:'';if(req!==lastReq){lastReq=req;if(p&&SIDES[p.d]){die=p.d;shown=null}}
  if(p)app.append(el('div',{class:'pop',style:'background:var(--accent);color:var(--on-accent);border-radius:12px;padding:8px 12px;margin-bottom:8px;font-weight:600'},'Нужен бросок '+p.d+(p.reason?': '+p.reason:'')));
  app.append(el('div',{class:'row scroll',style:'padding-bottom:8px'},...Object.keys(SIDES).map(d=>el('button',{class:'chip'+(d===die?' on':''),onclick:()=>{die=d;shown=null;render()}},d))));
  const step=(label,val,fn)=>el('div',{class:'row'},el('span',{style:'color:var(--muted)'},label),el('button',{class:'chip',onclick:()=>{fn(-1);render()}},'−'),el('b',{style:'min-width:26px;text-align:center'},val),el('button',{class:'chip',onclick:()=>{fn(1);render()}},'+'));
  app.append(el('div',{class:'row',style:'justify-content:space-between;padding-bottom:10px'},
    step('Кубиков',count,d=>{count=Math.max(1,Math.min(10,count+d))}),
    step('Бонус',(mod>0?'+':'')+mod,d=>{mod=Math.max(-20,Math.min(20,mod+d))})));
  const out=el('div',{style:'text-align:center;font-size:34px;font-weight:700;min-height:48px;padding:2px 0 8px'},shown?String(shown.total):'—');
  app.append(out);
  const roll=()=>{
    if(BUSY||timer)return;
    const rolls=Array.from({length:count},()=>rnd(SIDES[die]));
    const total=rolls.reduce((a,b)=>a+b,0)+mod;
    let n=0;timer=setInterval(()=>{out.textContent=String(rnd(SIDES[die])*count);if(++n>=8){clearInterval(timer);timer=0;shown={total};out.textContent=String(total);
      const txt='🎲 '+count+die+(mod?(mod>0?'+':'')+mod:'')+': ['+rolls.join(', ')+']'+(mod?' '+(mod>0?'+':'−')+Math.abs(mod):'')+' = '+total;
      post({type:'send',text:txt,ops:[{w:'roll',t:'rolled'}]})}},60);
  };
  app.append(el('button',{class:'btn',style:'width:100%',onclick:roll,disabled:BUSY},BUSY?'Подожди ответа…':'Бросить'));
}
</script>`;

const PAGES: Record<WidgetId, string> = { phone: PHONE, status: STATUS, roll: ROLL };

export const widgetHtml = (id: WidgetId) =>
  `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${BASE}</head><body>${PAGES[id]}</body></html>`;
