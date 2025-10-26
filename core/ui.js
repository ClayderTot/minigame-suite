export function Keyboard(onKey){
  const rows=["q w e r t y u i o p","a s d f g h j k l","enter z x c v b n m backspace"];
  const wrap=document.createElement('div'); wrap.className='kbd';
  rows.forEach(line=>{
    const r=document.createElement('div'); r.className='kbd-row'; wrap.appendChild(r);
    line.split(' ').forEach(k=>{
      const b=document.createElement('button'); b.className='key'+(k.length>1?' wide':'');
      b.dataset.key=k; b.textContent=k.length>1?(k==='enter'?'Enter':'⌫'):k.toUpperCase();
      b.onclick=()=>onKey(k); r.appendChild(b);
    });
  });
  return { node:wrap, set:(ch,st)=>{const btn=wrap.querySelector(`.key[data-key="${ch}"]`); if(!btn) return; btn.classList.remove('gray','yellow','green'); if(st) btn.classList.add(st); }, reset:()=>wrap.querySelectorAll('.key').forEach(k=>k.classList.remove('gray','yellow','green')) };
}
export function RowClearButton(onClick){
  const cell=document.createElement('div'); cell.className='clear-cell';
  const btn=document.createElement('button'); btn.className='clear-btn'; btn.textContent='⟲'; btn.title='Clear colors'; btn.onclick=e=>{e.stopPropagation(); onClick();};
  cell.appendChild(btn); return cell;
}
