/* Academia de Guitarra: cursos, aulas, tablatura com reprodução, mapa do braço, biblioteca, treinos e progresso. */
(function(){
"use strict";
const $=s=>document.querySelector(s),el=id=>document.getElementById(id),G=GPAudio;
const AS=()=>GPX.ext("acad",{v:"cursos",c:null,l:null,done:{},qz:{note:{ok:0,n:0},intv:{ok:0,n:0},theo:{ok:0,n:0}},wrong:{},hist:[],fb:{root:"A",sc:"minPent",rg:"0-12",lab:"names",tun:"std"}});
const STD=G.TUNINGS[0].midi;
const lessons=()=>COURSES.flatMap(c=>c.l.map(l=>Object.assign({c:c.id,ct:c.t},l)));
const findL=id=>lessons().find(l=>l.id===id);
const NOTE=n=>G.SHARP[((n%12)+12)%12];
const pcOf=r=>G.SHARP.indexOf(r)>=0?G.SHARP.indexOf(r):G.FLAT.indexOf(r);
const notesOf=e=>!e?[]:Array.isArray(e)&&typeof e[0]==="number"?[e]:e.n||[];
const opt=(a,v)=>a.map(([k,t])=>`<option value="${k}" ${String(k)===String(v)?"selected":""}>${esc(t)}</option>`).join("");

/* ---------- tablatura: texto ASCII <-> eventos, e player ---------- */
function parseTab(text){
 const lines=String(text).split(/\r?\n/),blocks=[];let cur=[];
 lines.forEach(l=>{if(/^\s*[eEBGDAdg]?\s*[|:]/.test(l)||/^\s*[a-gA-G]#?[|]/.test(l))cur.push(l.replace(/^\s*[A-Za-z#]*\s*[|:]/,""));else{if(cur.length>=6)blocks.push(cur.slice(0,6));cur=[]}});
 if(cur.length>=6)blocks.push(cur.slice(0,6));
 const ev=[];blocks.forEach(b=>{const W=Math.max(...b.map(x=>x.length));
  for(let c=0;c<W;c++){const nt=[];b.forEach((ln,si)=>{const ch=ln[c];if(/\d/.test(ch||"")&&!/\d/.test(ln[c-1]||"")){let j=c,s="";while(/\d/.test(ln[j]||"")){s+=ln[j];j++}nt.push([si+1,+s])}});
   if(nt.length)ev.push(nt.length===1?nt[0]:{n:nt})}});
 return ev}
function tabHTML(ev,id){
 const names=["e","B","G","D","A","E"];let rows=names.map(n=>`<span class="tl">${n}|</span>`);
 ev.forEach((e,i)=>{const N=notesOf(e);for(let s=1;s<=6;s++){const m=N.find(x=>x[0]===s);rows[s-1]+=m?`<span class="tn" data-i="${i}">${String(m[1]).padStart(2,"-")}-</span>`:(e?"---":"---")}});
 return`<div class="tab-box" id="${id||"tabbox"}" role="img" aria-label="Tablatura: ${ev.filter(Boolean).length} notas">${rows.map(r=>`<div>${r}|</div>`).join("")}</div>`}
const TP={on:false,timer:null,ev:null,tun:STD};
function click(c,t,acc){const o=c.createOscillator(),g=c.createGain();o.frequency.value=acc?1500:1000;g.gain.setValueAtTime(acc?.5:.3,t);g.gain.exponentialRampToValueAtTime(.001,t+.04);o.connect(g).connect(c.destination);o.start(t);o.stop(t+.05)}
function playerHTML(ev,o){o=o||{};const n=ev.length;
 return`<div class="tp" data-tp>${tabHTML(ev)}
 <div class="grid"><div><label for="tp-sp">Velocidade</label><select id="tp-sp">${opt([[50,"50%"],[60,"60%"],[75,"75%"],[100,"100%"]],100)}</select></div>
 <div><label for="tp-bpm">BPM (a 100%)</label><input id="tp-bpm" type="number" min="20" max="300" value="${o.bpm||60}"></div>
 <div><label for="tp-sub">Subdivisão</label><select id="tp-sub">${opt([[1,"semínima"],[2,"colcheias"],[3,"tercinas"],[4,"semicolcheias"],[6,"sextinas"]],o.sub||2)}</select></div>
 <div><label for="tp-a">Trecho: da nota</label><input id="tp-a" type="number" min="1" max="${n}" value="1"></div><div><label for="tp-b">até a nota</label><input id="tp-b" type="number" min="1" max="${n}" value="${n}"></div></div>
 <div class="row" style="margin-top:.4rem"><button class="pri" data-ac="tplay">Tocar</button><button data-ac="tstop">Parar</button><label style="margin:0"><input id="tp-loop" type="checkbox" checked> Loop do trecho</label><label style="margin:0"><input id="tp-clk" type="checkbox" checked> Clique do metrônomo</label></div>
 <p class="mu">Som de corda sintetizado só para acompanhar a tablatura. A nota acesa mostra onde a reprodução está. BPM de referência: ${o.bpm||60} (${n} notas).</p></div>`}
async function tplay(root){
 tstop();const ev=TP.ev;if(!ev||!ev.length)return;const c=await GPX.ac(),bpm=+el("tp-bpm").value||60,sub=+el("tp-sub").value||2,sp=(+el("tp-sp").value||100)/100,step=60/(bpm*sp*sub);
 let from=Math.max(0,(+el("tp-a").value||1)-1),to=Math.min(ev.length-1,(+el("tp-b").value||ev.length)-1);if(to<from)to=from;const loop=el("tp-loop").checked,clk=el("tp-clk").checked;
 let i=from,t=c.currentTime+.08;TP.on=true;
 TP.timer=setInterval(()=>{while(t<c.currentTime+.15){const e=ev[i];notesOf(e).forEach(([s,f])=>GPX.pluck(c,GPX.mf(TP.tun[6-s]+f),t,.4));
   if(clk&&(i-from)%sub===0)click(c,t,(i-from)%(sub*4)===0);
   const idx=i,d=Math.max(0,(t-c.currentTime)*1000);setTimeout(()=>mark(idx),d);t+=step;i++;
   if(i>to){if(loop)i=from;else{clearInterval(TP.timer);TP.timer=null;setTimeout(tstop,Math.max(0,(t-c.currentTime)*1000)+200);return}}}},25)}
function mark(i){document.querySelectorAll(".tab-box .tn").forEach(n=>n.classList.toggle("on",+n.dataset.i===i))}
function tstop(){clearInterval(TP.timer);TP.timer=null;TP.on=false;mark(-1)}

/* ---------- mapa do braço ---------- */
function fbMarks(tun,root,sc,f0,f1,lab){const iv=SC[sc][1],rp=pcOf(root),m=[];
 tun.forEach((t,s)=>{for(let f=f0;f<=f1;f++){const pc=(t+f)%12,rel=(pc-rp+12)%12;if(iv.includes(rel))m.push({s,f,label:lab==="deg"?DEG[rel]:NOTE(pc),cls:rel===0?"root":""})}});return m}
function scaleNotes(root,sc){return SC[sc][1].map(r=>NOTE(pcOf(root)+r))}
function fbView(){const a=AS().fb,[f0,f1]=a.rg.split("-").map(Number),tun=(G.TUNINGS.find(t=>t.id===a.tun)||G.TUNINGS[0]).midi;
 return`<div class="g c"><h3>Mapa do braço</h3><p class="mu">Escolha uma nota e uma escala ou acorde. Toque em qualquer ponto para ouvir a nota.</p>
 <div class="grid"><div><label for="fb-r">Nota (fundamental)</label><select id="fb-r" data-fbf="root">${opt(G.SHARP.map(n=>[n,n]),a.root)}</select></div>
 <div><label for="fb-s">Escala / acorde</label><select id="fb-s" data-fbf="sc">${opt(Object.entries(SC).map(([k,v])=>[k,v[0]]),a.sc)}</select></div>
 <div><label for="fb-g">Casas</label><select id="fb-g" data-fbf="rg">${opt([["0-12","0 a 12"],["0-5","0 a 5"],["5-12","5 a 12"],["12-24","12 a 24"]],a.rg)}</select></div>
 <div><label for="fb-l">Rótulos</label><select id="fb-l" data-fbf="lab">${opt([["names","Nomes das notas"],["deg","Graus"]],a.lab)}</select></div>
 <div><label for="fb-t">Afinação</label><select id="fb-t" data-fbf="tun">${opt(G.TUNINGS.map(t=>[t.id,t.name]),a.tun)}</select></div></div>
 <div id="fb-box">${GPX.fretboard({tuning:tun,f0,f1,marks:fbMarks(tun,a.root,a.sc,f0,f1,a.lab),alt:SC[a.sc][0]+" de "+a.root})}</div>
 <p><b>${esc(SC[a.sc][0])} de ${a.root}:</b> ${scaleNotes(a.root,a.sc).join(" – ")} <span class="mu">(graus: ${SC[a.sc][1].map(r=>DEG[r]).join(" ")})</span></p>
 <div class="row"><button data-ac="fbplay">Ouvir a escala</button></div><p class="mu">Pontos laranja são a fundamental.</p></div>`}
async function fbPlay(){const a=AS().fb,c=await GPX.ac(),base=48+pcOf(a.root);SC[a.sc][1].concat([12]).forEach((r,i)=>GPX.pluck(c,GPX.mf(base+r),c.currentTime+.05+i*.3,.4))}

/* ---------- aula ---------- */
function demoHTML(l){const tun=STD;
 if(l.fb){const marks=fbMarks(tun,l.fb.root,l.fb.scale,l.fb.f0,l.fb.f1,"names");return GPX.fretboard({tuning:tun,f0:l.fb.f0,f1:l.fb.f1,marks,alt:SC[l.fb.scale][0]+" de "+l.fb.root})+`<p class="mu">${esc(SC[l.fb.scale][0])} de ${l.fb.root}: ${scaleNotes(l.fb.root,l.fb.scale).join(" – ")}. Toque nos pontos para ouvir.</p>`}
 if(l.tab&&l.tab.length){const fs=l.tab.filter(Boolean).flatMap(notesOf),lo=Math.max(0,Math.min(...fs.map(x=>x[1]))-1),hi=Math.max(...fs.map(x=>x[1]))+1;
  const marks=l.tab.filter(Boolean).flatMap(notesOf).map(([s,f],i)=>({s:6-s,f,label:NOTE(tun[6-s]+f),cls:""}));
  return GPX.fretboard({tuning:tun,f0:lo,f1:Math.max(hi,lo+4),marks,alt:"Posições do exercício"})+`<p class="mu">Posições usadas pelo exercício. Toque para ouvir cada nota.</p>`}
 return`<p class="mu">Esta aula não tem uma demonstração visual própria; use o Mapa do braço ou o vídeo vinculado, quando houver.</p>`}
function lessonView(id){
 const L=findL(id);if(!L)return courses();const a=AS(),done=a.done[id],all=lessons(),i=all.findIndex(x=>x.id===id),nx=all[i+1],pv=all[i-1];
 TP.ev=L.tab;TP.tun=STD;
 const li=x=>`<ul>${x.map(t=>`<li>${esc(t)}</li>`).join("")}</ul>`;
 const rel=L.r.map(r=>typeof BY!=="undefined"&&BY[r]?`<span class="tag">${esc(BY[r].name)}</span>`:"").join(" ");
 return`<p><button data-ac="back">← ${esc(L.ct)}</button></p><h2>${esc(L.t)}</h2><p class="mu">${esc(L.ct)} · aula ${i+1} de ${all.length}${done?` · concluída em ${GPX.dt(done)}`:""}</p>
 <div class="g c"><h3>1. Objetivo</h3><p>${esc(L.o)}</p><h3>2. Explicação da técnica</h3><p>${esc(L.e)}</p></div>
 <details class="g c"><summary><b>3. Por que funciona</b></summary><p>${esc(L.w)}</p></details>
 <div class="g c"><h3>4. Demonstração visual</h3>${demoHTML(L)}</div>
 <div class="g c"><h3>5. Exercício prático</h3><p>${esc(L.x)}</p>${rel?`<p class="mu">No plano: ${rel}</p>`:""}
  <h3>6. Tablatura ou diagrama</h3>${L.tab&&L.tab.length?playerHTML(L.tab,{bpm:L.bpm||60,sub:L.bpm?2:2}):`<p class="mu">Esta aula não usa tablatura; o diagrama acima e o exercício bastam.</p>`}
  <p class="mu">As sequências são exercícios didáticos originais, não transcrições de músicas.</p></div>
 <div class="g c"><h3>7. Tutorial em vídeo</h3>${window.GPTut?GPTut.block(L.r,{lesson:L.id}):`<p class="mu">Módulo de tutoriais indisponível.</p>`}</div>
 <div class="g c"><div class="grid"><div><h3>8. BPM inicial</h3><p>${L.bpm?`<b>${L.bpm} BPM</b> (comece abaixo se sentir tensão)`:"Não se aplica a esta aula."}</p></div><div><h3>9. Critério de execução</h3><p>${esc(L.c)}</p></div></div></div>
 <details class="g c"><summary><b>10–11. Erros comuns e como corrigir</b></summary><h4>Erros comuns</h4>${li(L.er)}<h4>Como corrigir</h4>${li(L.fx)}</details>
 <details class="g c"><summary><b>12. Aplicação musical</b></summary><p>${esc(L.ap)}</p></details>
 <div class="g c"><h3>13. Exercício de revisão</h3><p>${esc(L.rv)}</p></div>
 <div class="g c row"><h3 style="margin:0;flex:1">14. Registro de conclusão</h3><button class="pri" data-ac="done" data-id="${id}" aria-pressed="${!!done}">${done?"Concluída · desfazer":"Marcar como concluída"}</button>${window.GPRec?`<button data-ac="rec" data-id="${id}">Gravar este exercício</button>`:""}</div>
 <div class="row">${pv?`<button data-ac="go" data-id="${pv.id}">← ${esc(pv.t)}</button>`:""}${nx?`<button data-ac="go" data-id="${nx.id}">${esc(nx.t)} →</button>`:""}</div>`}

/* ---------- cursos ---------- */
function courses(){const a=AS();
 return`<div class="grid">`+COURSES.map((c,i)=>{const d=c.l.filter(l=>a.done[l.id]).length;
  return`<div class="g c"><h3>Curso ${i+1} · ${esc(c.t)}</h3><p class="mu">${esc(c.d)}</p><div class="bar" role="img" aria-label="${d} de ${c.l.length} aulas concluídas"><i style="width:${d/c.l.length*100}%"></i></div><p class="mu">${d} de ${c.l.length} aulas</p>
  <details><summary class="mu">Tópicos do curso</summary><ul>${c.topics.map(t=>`<li>${esc(t)}</li>`).join("")}</ul></details><button data-ac="course" data-id="${c.id}">Abrir curso</button></div>`}).join("")+`</div>`}
function courseView(id){const c=COURSES.find(x=>x.id===id),a=AS();if(!c)return courses();
 return`<p><button data-ac="back">← Todos os cursos</button></p><h2>${esc(c.t)}</h2><p class="mu">${esc(c.d)}</p>`+c.l.map(l=>`<div class="g c row"><b style="flex:1">${esc(l.t)}${a.done[l.id]?' <span class="tag">concluída</span>':""}</b>${l.bpm?`<span class="tag">${l.bpm} BPM</span>`:""}<button data-ac="go" data-id="${l.id}">Abrir aula</button></div>`).join("")}

/* ---------- biblioteca ---------- */
function library(){const r=e=>esc(e);
 return`<h3>Técnicas de guitarra</h3><p class="mu">Consulta permanente. Cada ficha segue os mesmos 12 itens. Há mais de uma forma válida de executar a maioria das técnicas: use o que for confortável e soe limpo.</p>`
 +TECHS.map(t=>`<details class="g c"><summary><b>${r(t.n)}</b></summary><dl class="lib">${LIB_FIELDS.map((f,i)=>`<dt>${i+1}. ${r(f)}</dt><dd>${r(t.f[i])}</dd>`).join("")}</dl></details>`).join("")
 +`<h3>Teoria musical</h3><p class="mu">Conceitos de teoria (o que as notas são) são diferentes de movimentos físicos e de estratégias de estudo.</p>`
 +THEORY.map(t=>`<details class="g c"><summary><b>${r(t[0])}</b></summary><p>${r(t[1])}</p><p><b>No braço:</b> ${r(t[2])}</p><p class="mu">Aplicação: ${r(t[3])}</p></details>`).join("")}

/* ---------- treinos ---------- */
const Q={t:"note",cur:null,done:false};
function newQ(){const a=AS();
 if(Q.t==="note"){const s=Math.floor(Math.random()*6),f=Math.floor(Math.random()*13);Q.cur={s,f,ans:NOTE(STD[s]+f)}}
 else if(Q.t==="intv"){const base=48+Math.floor(Math.random()*14),i=1+Math.floor(Math.random()*12);Q.cur={base,i,ans:i}}
 else{const bad=QUIZ.filter(q=>a.wrong[q.id]),pool=bad.length&&Math.random()<.5?bad:QUIZ;Q.cur=pool[Math.floor(Math.random()*pool.length)]}Q.done=false}
function quizView(){if(!Q.cur)newQ();const a=AS(),st=a.qz[Q.t];
 const tabs=[["note","Notas no braço"],["intv","Intervalos de ouvido"],["theo","Teoria"]].map(([k,n])=>`<button data-ac="qt" data-id="${k}" aria-pressed="${Q.t===k}" class="${Q.t===k?"pri":""}">${n}</button>`).join("");
 let body="";
 if(Q.t==="note"){const c=Q.cur;body=`<p>Que nota está marcada? (afinação padrão, corda ${6-c.s}, casa ${c.f})</p>${GPX.fretboard({tuning:STD,f0:0,f1:12,marks:[{s:c.s,f:c.f,label:"?",cls:"root"}],alt:"Posição a identificar"})}<div class="row">${G.SHARP.map(n=>`<button data-ac="ans" data-id="${n}">${n}</button>`).join("")}</div>`}
 else if(Q.t==="intv"){body=`<p>Ouça duas notas em sequência (ascendente) e identifique o intervalo.</p><div class="row"><button class="pri" data-ac="hear">Ouvir intervalo</button></div><div class="row" style="margin-top:.5rem">${IVN.slice(1).map(([n,v])=>`<button data-ac="ans" data-id="${v}">${n}</button>`).join("")}</div>`}
 else{const q=Q.cur;body=`<p><b>${esc(q.q)}</b></p><div class="col">${q.o.map((o,i)=>`<button data-ac="ans" data-id="${i}" style="display:block;width:100%;margin:.25rem 0;text-align:left">${esc(o)}</button>`).join("")}</div>`}
 return`<div class="g c"><h3>Treinos de percepção e teoria</h3><div class="row">${tabs}</div><p class="mu">Acertos neste tipo: ${st.ok} de ${st.n}${st.n?" ("+Math.round(st.ok/st.n*100)+"%)":""}</p><div id="qz-body">${body}</div><div id="qz-fb" role="status" aria-live="polite"></div>${Q.done?`<button class="pri" data-ac="next">Próxima</button>`:""}</div>`}
async function hearIv(){const c=await GPX.ac(),q=Q.cur;GPX.pluck(c,GPX.mf(q.base),c.currentTime+.05,.4);GPX.pluck(c,GPX.mf(q.base+q.i),c.currentTime+.75,.4)}
function answer(v){if(Q.done)return;const a=AS(),st=a.qz[Q.t];let ok,msg;
 if(Q.t==="note"){ok=v===Q.cur.ans;msg=`Era ${Q.cur.ans}.`}
 else if(Q.t==="intv"){ok=+v===Q.cur.ans;msg=`Era ${IVN.find(x=>x[1]===Q.cur.ans)[0]}.`}
 else{ok=+v===Q.cur.a;msg=Q.cur.x;if(ok){if(a.wrong[Q.cur.id]){a.wrong[Q.cur.id]=Math.max(0,a.wrong[Q.cur.id]-1);if(!a.wrong[Q.cur.id])delete a.wrong[Q.cur.id]}}else a.wrong[Q.cur.id]=(a.wrong[Q.cur.id]||0)+1}
 st.n++;if(ok)st.ok++;save();Q.done=true;
 el("qz-fb").innerHTML=`<div class="adv ${ok?"":"alert"}"><b>${ok?"Correto.":"Não foi dessa vez."}</b> ${esc(msg)}</div>`;
 const b=el("qz-body"),btn=document.createElement("button");btn.className="pri";btn.dataset.ac="next";btn.textContent="Próxima";b.parentNode.appendChild(btn)}

/* ---------- progresso e revisão ---------- */
function weakEx(){const out=[];if(typeof BY==="undefined"||typeof ratio==="undefined")return out;Object.keys(BY).forEach(id=>{const L=S.logs.filter(l=>l.ex===id&&!l.legacy).sort((a,b)=>b.t-a.t)[0];if(L&&(ratio(L)<.6||L.tens>=6))out.push(id)});return out}
function progress(){const a=AS(),all=lessons(),n=all.filter(l=>a.done[l.id]).length,now=Date.now();
 const due=all.filter(l=>a.done[l.id]&&now-Date.parse(a.done[l.id])>14*864e5);
 const weak=weakEx(),wl=[...new Set(weak.flatMap(id=>all.filter(l=>l.r.includes(id)).map(l=>l.id)))].map(findL).filter(l=>!a.done[l.id]||due.includes(l));
 const wq=Object.keys(a.wrong).map(id=>QUIZ.find(q=>q.id===id)).filter(Boolean);
 const hist=a.hist.slice(0,10);
 return`<div class="g c"><h3>Seu progresso</h3><div class="bar"><i style="width:${n/all.length*100}%"></i></div><p>${n} de ${all.length} aulas concluídas.</p>
 <p class="mu">Treinos: notas ${a.qz.note.ok}/${a.qz.note.n} · intervalos ${a.qz.intv.ok}/${a.qz.intv.n} · teoria ${a.qz.theo.ok}/${a.qz.theo.n}</p></div>
 <div class="g c"><h3>Recomendações de revisão</h3>${[...wl.map(l=>`<div class="row"><span style="flex:1">Aula “${esc(l.t)}”: o Diário mostra dificuldade em exercício relacionado.</span><button data-ac="go" data-id="${l.id}">Abrir</button></div>`),...due.filter(l=>!wl.includes(l)).map(l=>`<div class="row"><span style="flex:1">Revisar “${esc(l.t)}” (concluída há mais de 14 dias).</span><button data-ac="go" data-id="${l.id}">Abrir</button></div>`)].join("")||`<p class="mu">Nenhuma revisão pendente. As recomendações aparecem quando o Diário mostra dificuldade ou quando uma aula passa de 14 dias.</p>`}
 ${wq.length?`<p class="mu">Questões de teoria que você errou: ${wq.length}. Elas voltam com mais frequência nos treinos.</p><button data-ac="qt" data-id="theo" data-go="quiz">Treinar teoria</button>`:""}</div>
 <div class="g c"><h3>Histórico de aulas</h3>${hist.length?hist.map(h=>`<div class="row"><span style="flex:1">${esc((findL(h.id)||{t:h.id}).t)}</span><span class="tag">${GPX.dt(h.when)}</span></div>`).join(""):`<p class="mu">Nenhuma aula concluída ainda.</p>`}</div>`}

/* ---------- aba ---------- */
function view(){const a=AS(),V=[["cursos","Cursos"],["lib","Biblioteca"],["mapa","Mapa do braço"],["quiz","Treinos"],["prog","Progresso"]];
 let body;if(a.v==="aula")body=lessonView(a.l);else if(a.v==="curso")body=courseView(a.c);else if(a.v==="lib")body=library();else if(a.v==="mapa")body=fbView();else if(a.v==="quiz")body=quizView();else if(a.v==="prog")body=progress();else body=courses();
 const top=a.v==="aula"?"cursos":a.v==="curso"?"cursos":a.v;
 return`<h2>Academia de Guitarra</h2><div class="row ac-nav" role="tablist">${V.map(([k,n])=>`<button data-ac="v" data-id="${k}" class="${top===k?"pri":""}" aria-pressed="${top===k}">${n}</button>`).join("")}</div>${body}`}
function refresh(keep){if(typeof tab==="undefined"||tab!=="academia")return;const y=scrollY;tstop();$("#view").innerHTML=view();bindV();document.dispatchEvent(new CustomEvent("viewrendered",{detail:{tab:"academia",changed:false}}));scrollTo(0,keep?y:0)}
function bindV(){const v=$("#view");if(!v.__fb){v.__fb=true;GPX.bindFretboards(v,()=>{const t=AS().fb.tun;return(G.TUNINGS.find(x=>x.id===t)||G.TUNINGS[0]).midi},()=>440)}
 const a=AS();if(a.v==="aula"){const L=findL(a.l);TP.ev=L&&L.tab;/* fretboards da aula sempre em afinação padrão */}}
function open(id){const a=AS(),L=findL(id);if(!L)return;a.v="aula";a.l=id;a.c=L.c;save();if(typeof tab!=="undefined"&&tab==="academia")refresh();else show("academia")}

document.addEventListener("click",async e=>{const b=e.target.closest("[data-ac]");if(!b)return;const d=b.dataset,a=AS();
 if(d.ac==="go"){open(d.id);return}
 if(d.ac==="tplay"){if(typeof tab!=="undefined"&&tab==="academia")TP.ev=(findL(a.l)||{}).tab;tplay();return}
 if(d.ac==="tstop"){tstop();return}
 if(typeof tab==="undefined"||tab!=="academia")return;
 if(d.ac==="v"){a.v=d.id;save();refresh();return}
 if(d.ac==="course"){a.v="curso";a.c=d.id;save();refresh();return}
 if(d.ac==="back"){a.v=a.v==="aula"?"curso":"cursos";save();refresh();return}
 if(d.ac==="done"){if(a.done[d.id])delete a.done[d.id];else{a.done[d.id]=GPX.iso();a.hist.unshift({id:d.id,when:a.done[d.id]});a.hist=a.hist.slice(0,60)}save();refresh(true);return}
 if(d.ac==="rec"){const L=findL(d.id);GPRec.open({ex:(L.r||[])[0]||"",bpm:L.bpm||"",name:"Aula: "+L.t});return}
 if(d.ac==="fbplay"){fbPlay();return}
 if(d.ac==="qt"){Q.t=d.id;Q.cur=null;if(d.go||a.v!=="quiz"){a.v="quiz";save()}refresh(true);return}
 if(d.ac==="hear"){hearIv();return}
 if(d.ac==="ans"){answer(d.id);return}
 if(d.ac==="next"){newQ();refresh(true)}});
document.addEventListener("change",e=>{const t=e.target;if(!t.dataset||t.dataset.fbf===undefined||tab!=="academia")return;AS().fb[t.dataset.fbf]=t.value;save();refresh(true)});

const X={view,bind(){bindV()},leave(){tstop()}};
window.addEventListener("load",()=>addTab("academia","Academia",X,"rep"));
/* usado pelo plano: aulas ligadas a um exercício */
window.GPAcad={open,parseTab,playerHTML,tabHTML,startPlayer(ev,tun){TP.ev=ev;TP.tun=tun||STD},play:tplay,stop:tstop,
 related(exId){const L=lessons().filter(l=>l.r.includes(exId));return L.length?`<div class="row ac-rel"><span class="mu">Aulas relacionadas:</span>${L.map(l=>`<button data-ac="go" data-id="${l.id}">${esc(l.t)}</button>`).join("")}</div>`:""},
 lessonsFor:exId=>lessons().filter(l=>l.r.includes(exId))};
})();
