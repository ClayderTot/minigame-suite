// games/hardle.js
import { Keyboard, RowClearButton } from '../core/ui.js';

export const meta = { id: 'hardle', title: 'Hardle' };

// ===== Config =====
const ROWS = 8, COLS = 5;
const EXCEPTIONS_NON_PLURAL_S = new Set(['glass','class','grass','press','chess']); // keep as answers
const PRECEDENCE_SCORE = { gray:1, yellow:2, green:3 };
const WIN_DELAY_MS = 140;

// Small fallback list so it runs even before you import a big one
const DEFAULT_LIST = ("about other which their there first could sound light those point right three small large group place great young water never under words world night state today thing heart house sweet train truth apple grape lemon berry crane flint charm pride siren trace storm vital rigid ghoul creak shard blaze spice fable crown knack gamer linen brave truly loose tight rhyme mirth quilt zesty oxide quirk phase sigma align alone angel arose axial beach beast began belch belly bench boast boost bravo brood brown budge cadre camel candy canon cargo carve cedar chain chair chant chard chase cheap check chest chewy civic clerk climb clock clone close cloth cloud coast cobra count crash craze cream crisp crown cycle dance debut decay decor delay delta depth diner dizzy dodge doubt draft drain drape dream dress drink drive eager early earth edict elder elite enact enemy entry equal error evoke exact faith false feast ferry field final finer flare float floor focal focus forge forth frame fresh frost giant giver glade globe gloom gnash grace grade grain grape graph grasp great green greet groan group habit haunt heart heavy hinge honey honor horse house humor image imply inlet inner jolly judge knead knack lemon linen loamy logic loose magic mirth moist month motif noble noise north nurse occur ocean orbit order oxide paint panic party pause pearl pedal penal perky piano piece pilot pinch pixel pivot place plaid plain plane plant plead pluck point poise porch pride prime print prism prize proof proud prove prune quota quote radar rainy ratio reach react regal reign relax remit renew reset resin rhyme ridge right rigid rinse rival river rough round royal ruler rumor rural sauce scale scare scarf scene scent scope score scout serve seven shade shake shame shape share shard shark sharp shear sheen sheep shine shirt shock shoot shore short shout shove shown siege siren skill slate sleep smell smile smoke snack sober solar solid sound spare speak spear spice spicy spike split spoil spoke spore sport spray sprig stare stark start state steel steep stern stick stiff still stint stone stony store storm story stout stove strap straw stray strew strip stuck study stuff suite sweet swift table tacit tango taper taste teach tempo thank theft their theme there these thick thief thing think third those three thigh tight timer trace track trade trail train trait tread treat trend trial tried trite truly trunk trust truth ultra until vapor vault venue verge verse vicar video vigor villa viral vital vivid vowel wagon waist watch water weave wedge wheel where which while whisk white whole widen width wield windy wiser witch woman women world words worry worth woven wrist wrong yacht yearn yeast yield young youth zesty zonal").split(/\s+/);

// ===== State =====
let ctx, host, kb;
let allowed = new Set(DEFAULT_LIST.map(w=>w.toLowerCase()));
let answer = '';
let curRow = 0, curCol = 0, gameOver = false;

// ===== Lifecycle =====
export function init(context){ ctx = context; }
export function render(context){
  host = context.host;
  host.innerHTML = '';
  renderControls();
  renderBoard();
  renderLegend();
  setupKeyboard();
  newGame();
  wireKeydown();
}

export function destroy(){ /* nothing needed for now */ }

// ===== UI =====
function renderControls(){
  const bar = document.createElement('div');
  bar.className = 'game-controls';
  bar.innerHTML = `
    <button class="btn" id="h-new">New</button>
    <label class="btn" id="h-load">Load List<input id="h-file" type="file" accept=".txt,text/plain" hidden></label>
    <button class="btn" id="h-help">Help</button>
    <span class="hint" id="h-status"></span>
  `;
  host.appendChild(bar);

  bar.querySelector('#h-new').onclick = () => { newGame(); toast('New game'); };
  bar.querySelector('#h-help').onclick = () => {
    alert(
      "Hardle – How to play:\n" +
      "• Type a 5-letter word and press Enter.\n" +
      "• We show only counts of greens and yellows (no positions).\n" +
      "• After submitting, click tiles to mark: gray → yellow → green → gray.\n" +
      "• The keyboard mirrors your marks (green > yellow > gray).\n" +
      "• ⟲ left button clears that row's colors.\n" +
      "• 8 guesses. The chosen answer never ends with 's' (plural filter)."
    );
  };
  const fileInput = bar.querySelector('#h-file');
  bar.querySelector('#h-load').onclick = () => fileInput.click();
  fileInput.onchange = async (e)=>{
    const f = e.target.files?.[0]; if(!f) return;
    try{
      const text = await f.text();
      const words = text.split(/\r?\n/).map(w=>w.trim().toLowerCase()).filter(w=>/^[a-z]{5}$/.test(w));
      const uniq = Array.from(new Set(words));
      if(uniq.length < 100){ toast('List too small; keeping default'); return; }
      allowed = new Set(uniq);
      newGame();
      toast(`Loaded ${uniq.length} words`);
    }catch{ toast("Couldn't read file"); }
    finally{ fileInput.value=''; }
  };
}

function renderBoard(){
  const board = document.createElement('div');
  board.className = 'board';
  for(let r=0;r<ROWS;r++){
    const row = document.createElement('div');
    row.className = 'row';
    row.dataset.row = r;

    row.appendChild(RowClearButton(()=> clearRowColors(r)));

    for(let c=0;c<COLS;c++){
      const t = document.createElement('div');
      t.className = 'tile';
      t.dataset.row = r; t.dataset.col = c; t.dataset.state='blank';
      t.onclick = () => cycleTile(t);
      row.appendChild(t);
    }
    const counts = document.createElement('div');
    counts.className = 'counts'; counts.id = `counts-${r}`;
    row.appendChild(counts);

    board.appendChild(row);
  }
  host.appendChild(board);
}

function renderLegend(){
  const wrap = document.createElement('div');
  wrap.className = 'legend';
  wrap.innerHTML = `
    <span>Click tiles to mark:</span>
    <span class="chip gray"></span> Gray
    <span class="chip yellow"></span> Yellow
    <span class="chip green"></span> Green
  `;
  host.appendChild(wrap);
}

function setupKeyboard(){
  kb = Keyboard(onVirtualKey);
  host.appendChild(kb.node);
}

function status(text){
  const el = host.querySelector('#h-status'); if(el) el.textContent = text;
}

function toast(msg){ ctx.toast?.(msg, 1200); }

// ===== Game control =====
function newGame(){
  curRow=0; curCol=0; gameOver=false;

  // reset UI
  host.querySelectorAll('.tile').forEach(t=>{ t.textContent=''; t.className='tile'; t.dataset.state='blank'; });
  host.querySelectorAll('.counts').forEach(c=>{ c.textContent=''; c.removeAttribute('data-locked'); });
  kb?.reset();

  // choose a random answer that is NOT a plural ending in 's' (with a few exceptions kept)
  const arr = Array.from(allowed);
  let candidates = arr.filter(w => !(w.endsWith('s') && !EXCEPTIONS_NON_PLURAL_S.has(w)));
  if(!candidates.length) candidates = arr;
  answer = candidates[Math.floor(Math.random()*candidates.length)];
  status(`Words: ${allowed.size} • Ready`);
}

function onVirtualKey(key){
  if(gameOver) return;
  if(key==='enter') submit();
  else if(key==='backspace') backspace();
  else if(/^[a-z]$/.test(key)) typeLetter(key);
}

function wireKeydown(){
  document.addEventListener('keydown', (e)=>{
    if(gameOver || !host.isConnected) return;
    const k = e.key.toLowerCase();
    if(k==='enter'){ e.preventDefault(); submit(); }
    else if(k==='backspace' || k==='delete'){ e.preventDefault(); backspace(); }
    else if(/^[a-z]$/.test(k)){ typeLetter(k); }
  });
}

// ===== Input helpers =====
function typeLetter(ch){
  if(curCol>=COLS) return;
  const t = tileAt(curRow, curCol);
  t.textContent = ch.toUpperCase();
  t.classList.add('filled');
  curCol++;
}

function backspace(){
  if(curCol<=0) return;
  curCol--;
  const t = tileAt(curRow, curCol);
  t.textContent=''; t.classList.remove('filled','gray','yellow','green'); t.dataset.state='blank';
}

function tileAt(r,c){ return host.querySelector(`.tile[data-row="${r}"][data-col="${c}"]`); }

function getRowWord(r){
  let s=''; for(let c=0;c<COLS;c++){ const t=tileAt(r,c); s += (t.textContent||'').toLowerCase(); }
  return s;
}

// ===== Submit & scoring =====
function submit(){
  if(gameOver) return;
  const guess = getRowWord(curRow);
  if(guess.length!==COLS){ toast('Not enough letters'); return; }
  if(!/^[a-z]{5}$/.test(guess)){ toast('Letters only'); return; }
  if(allowed.size && !allowed.has(guess)){ toast('Not in word list'); return; }

  const {greens,yellows} = evaluate(guess, answer);
  const label = host.querySelector(`#counts-${curRow}`);
  label.textContent = `🟩 ${greens}   🟨 ${yellows}`;
  label.dataset.locked = '1';

  for(let c=0;c<COLS;c++){ tileAt(curRow,c).classList.add('filled'); }

  recomputeKeyboardFromSubmitted();

  if(greens===5){
    gameOver = true;
    animateWinRow(curRow).then(()=>{
      setTimeout(()=> alert(`You cracked it in ${curRow+1} tries!\nAnswer: ${answer.toUpperCase()}`), 10);
    });
    return;
  }

  curRow++; curCol=0;
  if(curRow>=ROWS){
    gameOver = true;
    setTimeout(()=> alert(`Out of tries!\nThe word was ${answer.toUpperCase()}`), 10);
  }
}

function evaluate(g,a){
  const G=g.split(''), A=a.split('');
  const used = Array(COLS).fill(false);
  let greens=0, yellows=0;
  const freq = {};
  for(let i=0;i<COLS;i++){
    if(G[i]===A[i]){ used[i]=true; greens++; }
    else{ freq[A[i]]=(freq[A[i]]||0)+1; }
  }
  for(let i=0;i<COLS;i++){
    if(used[i]) continue;
    const ch = G[i];
    if(freq[ch]>0){ yellows++; freq[ch]--; }
  }
  return {greens,yellows};
}

// ===== Tile marking & keyboard sync =====
function cycleTile(tile){
  if(gameOver) return;
  const r = +tile.dataset.row;
  const counts = host.querySelector(`#counts-${r}`);
  if(!counts || !counts.dataset.locked) return; // can only mark after submission

  const order = ['blank','gray','yellow','green'];
  const idx = order.indexOf(tile.dataset.state);
  const next = order[(idx+1) % order.length];
  tile.dataset.state = next;
  applyTileClass(tile);

  recomputeKeyboardFromSubmitted(); // ensures gray shows unless a better color exists
}

function clearRowColors(r){
  host.querySelectorAll(`.tile[data-row="${r}"]`).forEach(t=>{
    t.dataset.state='blank'; t.classList.remove('gray','yellow','green');
  });
  recomputeKeyboardFromSubmitted();
}

function applyTileClass(tile){
  tile.classList.remove('gray','yellow','green');
  const st = tile.dataset.state;
  if(st==='gray'||st==='yellow'||st==='green') tile.classList.add(st);
}

function recomputeKeyboardFromSubmitted(){
  kb.reset();
  const best = Object.create(null);
  for(let r=0;r<ROWS;r++){
    const locked = host.querySelector(`#counts-${r}`)?.dataset.locked;
    if(!locked) continue;
    host.querySelectorAll(`.tile[data-row="${r}"]`).forEach(t=>{
      const ch = (t.textContent||'').toLowerCase();
      const st = t.dataset.state;
      if(!/^[a-z]$/.test(ch) || !PRECEDENCE_SCORE[st]) return;
      const cur = best[ch];
      if(!cur || PRECEDENCE_SCORE[st] > PRECEDENCE_SCORE[cur]) best[ch] = st;
    });
  }
  Object.entries(best).forEach(([ch,st])=> kb.set(ch, st));
}

// ===== Cinematic win =====
async function animateWinRow(r){
  for(let i=0;i<COLS;i++){
    const t = tileAt(r,i);
    t.dataset.state='green'; t.classList.remove('gray','yellow'); t.classList.add('green','win-anim');
    const ch = (t.textContent||'').toLowerCase(); if(ch) kb.set(ch,'green');
    await delay(WIN_DELAY_MS);
    t.classList.remove('win-anim');
  }
}

const delay = ms => new Promise(res=>setTimeout(res,ms));
