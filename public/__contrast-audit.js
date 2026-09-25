window.__audit = () => {
  const c = document.createElement('canvas'); c.width = c.height = 1; const cx = c.getContext('2d', { willReadFrequently: true });
  const cache = new Map();
  const toRGBA = (col) => { if (!col || col === 'transparent') return [0,0,0,0]; if (cache.has(col)) return cache.get(col).slice(); cx.clearRect(0,0,1,1); cx.fillStyle = col; cx.fillRect(0,0,1,1); const d = cx.getImageData(0,0,1,1).data; const v = [d[0], d[1], d[2], d[3]/255]; cache.set(col, v); return v.slice(); };
  const blend = (fg, bg) => [0,1,2].map(i => fg[i]*fg[3] + bg[i]*(1-fg[3])).concat(1);
  const lum = ([r,g,b]) => { const f = v => { v/=255; return v<=0.03928 ? v/12.92 : Math.pow((v+0.055)/1.055, 2.4); }; return 0.2126*f(r)+0.7152*f(g)+0.0722*f(b); };
  const ratio = (a,b) => { const [x,y] = [lum(a),lum(b)].sort((p,q)=>q-p); return (x+0.05)/(y+0.05); };
  const bgOf = (el) => { const st=[]; for (let e=el; e; e=e.parentElement) { const col=toRGBA(getComputedStyle(e).backgroundColor); if (col[3]>0) { st.push(col); if (col[3]>=0.999) break; } } let bg=toRGBA(getComputedStyle(document.documentElement).backgroundColor); for (let i=st.length-1;i>=0;i--) bg=blend(st[i],bg); return bg; };
  const opOf = (el) => { let o=1; for (let e=el; e; e=e.parentElement) o*=parseFloat(getComputedStyle(e).opacity); return o; };
  const out = new Map();
  document.querySelectorAll('body *').forEach(el => {
    if (el.closest('svg,.sr-only,nextjs-portal')) return;
    if (![...el.childNodes].some(n => n.nodeType===3 && n.textContent.trim())) return;
    const r = el.getBoundingClientRect(); if (!r.width || !r.height) return;
    const cs = getComputedStyle(el); if (cs.visibility==='hidden') return;
    const op = opOf(el); if (op < 0.05) return;
    const fg = toRGBA(cs.color); fg[3]*=op; const bg = bgOf(el);
    const size = parseFloat(cs.fontSize), w = parseInt(cs.fontWeight);
    const need = (size>=24 || (size>=18.66 && w>=700)) ? 3 : 4.5;
    const cr = ratio(blend(fg,bg), bg);
    if (cr < need) { const sec = el.closest('section,footer,header'); const key = (el.getAttribute('class')||el.tagName).slice(0,60); const p=out.get(key); if(!p||cr<p.cr) out.set(key,{cr:+cr.toFixed(2),need,text:el.textContent.trim().slice(0,28),size,op:+op.toFixed(2),sec:sec?.getAttribute('aria-label')||sec?.tagName||'-'}); }
  });
  return [...out.entries()].map(([k,v]) => v.cr+'/'+v.need+' ['+v.sec+'] "'+v.text+'" '+v.size+'px op'+v.op+' :: '+k).sort();
};
