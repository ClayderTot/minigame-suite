// minimal shell
const REGISTRY = new Map();
let current=null, appEl, menuEl, toast;
export function boot({games, defaultGameId}){
  appEl = document.getElementById('app');
  menuEl = document.getElementById('gameMenu');
  toast = (msg,ms=1200)=>{const t=document.getElementById('toaster');t.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),ms);};
  games.forEach(g=>REGISTRY.set(g.meta.id,g));
  renderMenu();
  addEventListener('hashchange', navigate);
  if(!location.hash) location.hash='#'+(defaultGameId||games[0].meta.id);
  navigate();
}
function renderMenu(){
  menuEl.innerHTML='';
  REGISTRY.forEach(g=>{
    const b=document.createElement('button'); b.textContent=g.meta.title; b.onclick=()=>location.hash='#'+g.meta.id; menuEl.appendChild(b);
  });
}
function navigate(){ const id=(location.hash||'').slice(1); const game=REGISTRY.get(id); if(game) mount(game); }
function mount(game){
  current?.destroy?.();
  appEl.replaceChildren();
  const host=document.createElement('div'); host.className='game-host'; appEl.appendChild(host);
  const ctx={host, toast, routeTo:id=>location.hash='#'+id};
  game.init?.(ctx); game.render?.(ctx);
}
