/* Utilidades compartilhadas pelos módulos novos (afinador, academia, gravação, repertório).
   Depende de app.js (S, save, esc, toast) e de audio-core.js. Dados novos ficam em S.ext (dentro do backup JSON). */
const GPX=(function(){
"use strict";
let ctx=null;
async function ac(){if(!ctx)ctx=new (window.AudioContext||window.webkitAudioContext)();if(ctx.state!=="running")await ctx.resume();return ctx}
/* estado persistente de cada módulo: S.ext[nome], com valores padrão preenchidos */
function ext(name,def){S.ext=S.ext||{};const o=S.ext[name]=S.ext[name]||{};for(const k in def)if(!(k in o))o[k]=JSON.parse(JSON.stringify(def[k]));return o}
const iso=()=>new Date().toISOString();
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,7);
const pad=n=>String(n).padStart(2,"0");
const dt=s=>{const d=new Date(s);return isNaN(d)?"":pad(d.getDate())+"/"+pad(d.getMonth()+1)+"/"+d.getFullYear()+" "+pad(d.getHours())+":"+pad(d.getMinutes())};
const mmss=ms=>{const s=Math.floor(ms/1000);return pad(Math.floor(s/60))+":"+pad(s%60)};
const mf=(m,a4)=>GPAudio.midiToFreq(m,a4||440);

/* tom puro (referência sonora): onda senoidal, claramente sintética */
async function tone(freq,dur,vol){const c=await ac(),o=c.createOscillator(),g=c.createGain(),t=c.currentTime;dur=dur||1.5;vol=vol||.22;
 o.type="sine";o.frequency.value=freq;g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(vol,t+.03);g.gain.setValueAtTime(vol,t+dur-.12);g.gain.linearRampToValueAtTime(0,t+dur);
 o.connect(g).connect(c.destination);o.start(t);o.stop(t+dur+.02)}

/* corda dedilhada (Karplus-Strong); só para demonstração, não é timbre real de guitarra */
const cache=new Map();
function pluckBuf(c,f){const k=Math.round(f*10)+"@"+c.sampleRate;if(cache.has(k))return cache.get(k);
 const sr=c.sampleRate,N=Math.max(2,Math.round(sr/f)),len=Math.round(sr*1.1),b=c.createBuffer(1,len,sr),d=b.getChannelData(0),w=new Float32Array(N);
 let s=1234567+Math.round(f);for(let i=0;i<N;i++){s=(s*1103515245+12345)&0x7fffffff;w[i]=s/0x40000000-1}
 for(let i=0;i<len;i++){const j=i%N,n=(j+1)%N;d[i]=w[j];w[j]=.5*(w[j]+w[n])*.9965}
 let mx=0;for(let i=0;i<len;i++)mx=Math.max(mx,Math.abs(d[i]));for(let i=0;i<len;i++)d[i]/=mx||1;cache.set(k,b);return b}
function pluck(c,f,when,vol){const s=c.createBufferSource(),g=c.createGain();s.buffer=pluckBuf(c,f);g.gain.value=vol||.35;s.connect(g).connect(c.destination);s.start(when||c.currentTime);return s}

/* diagrama de braço (SVG). opts: {tuning(midi[] grave→agudo), f0,f1 (casas), marks:[{s,f,label,cls}], a4, flats}
   s = índice da corda (0 = mais grave). Cada marca é um botão-ponto clicável (data-fb="s,f") para tocar a nota. */
function fretboard(o){
 const T=o.tuning||GPAudio.TUNINGS[0].midi,n=T.length,f0=o.f0||0,f1=o.f1==null?12:o.f1,nf=f1-f0+1,W=640,L=34,R=10,top=22,gap=22,H=top+(n-1)*gap+30,fw=(W-L-R)/(nf);
 const X=f=>L+(f-f0+.5)*fw,Y=s=>top+(n-1-s)*gap;let g=`<svg class="fbd" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(o.alt||"Diagrama do braço da guitarra")}">`;
 for(let i=0;i<=nf;i++)g+=`<line class="fr${f0+i===0?" nut":""}" x1="${L+i*fw}" x2="${L+i*fw}" y1="${top}" y2="${top+(n-1)*gap}"/>`;
 for(let s=0;s<n;s++)g+=`<line class="st" x1="${L}" x2="${W-R}" y1="${Y(s)}" y2="${Y(s)}" style="stroke-width:${1+(n-1-s)*.28}"/>`;
 [3,5,7,9,12,15,17,19,21].forEach(f=>{if(f>=f0&&f<=f1)g+=`<text class="fn" x="${X(f)}" y="${H-6}" text-anchor="middle">${f}</text>`});
 if(f0===0)g+=`<text class="fn" x="${L-14}" y="${H-6}" text-anchor="middle">solta</text>`;
 for(let s=0;s<n;s++)g+=`<text class="sl" x="4" y="${Y(s)+4}">${n-s}</text>`;
 (o.marks||[]).forEach(m=>{if(m.f<f0||m.f>f1)return;const cx=m.f===0&&f0===0?L-14:X(m.f);
  g+=`<g class="mk ${m.cls||""}" data-fb="${m.s},${m.f}" tabindex="0" role="button" aria-label="${esc((m.label||"")+" — corda "+(n-m.s)+", casa "+m.f)}"><circle cx="${cx}" cy="${Y(m.s)}" r="9.5"/><text x="${cx}" y="${Y(m.s)+3.6}" text-anchor="middle">${esc(m.label||"")}</text></g>`});
 return g+"</svg>"}
/* toca a nota de um clique/tecla em um .mk */
function bindFretboards(root,tuning,a4){root.addEventListener("click",e=>{const m=e.target.closest(".mk");if(!m)return;const [s,f]=m.dataset.fb.split(",").map(Number);playFret(tuning(),s,f,a4?a4():440)});
 root.addEventListener("keydown",e=>{if(e.key!=="Enter"&&e.key!==" ")return;const m=e.target.closest(".mk");if(!m)return;e.preventDefault();const [s,f]=m.dataset.fb.split(",").map(Number);playFret(tuning(),s,f,a4?a4():440)})}
async function playFret(T,s,f,a4){const c=await ac();pluck(c,mf(T[s]+f,a4),c.currentTime,.4)}

return{ac,ext,iso,uid,dt,mmss,mf,tone,pluck,fretboard,bindFretboards,playFret};
})();
