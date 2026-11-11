/* Afinador cromático em cents + treinador de bends (microfone real, YIN em audio-core.js).
   Áudio processado só no navegador: nada é enviado a servidores. */
(function(){
"use strict";
const A=GPAudio,$=s=>document.querySelector(s),el=id=>document.getElementById(id);
const D={a4:440,tun:"std",mode:"chrom",bs:4,bf:8,bi:2,tol:10,hist:[]};
const cfg=()=>GPX.ext("tuner",D);
const tuning=()=>A.TUNINGS.find(t=>t.id===cfg().tun)||A.TUNINGS[0];
const T={stream:null,src:null,an:null,buf:null,timer:null,run:false,tr:A.PitchTracker(),atk:null,view:null,err:"",info:""};
const lbl=(m)=>A.noteLabel(m,tuning().flats);
const sgn=c=>(c>0?"+":"")+Math.round(c);
const fm=h=>h.toFixed(h<100?2:1).replace(".",",");
const bendInfo=()=>{const c=cfg(),t=tuning(),n=t.midi.length,i=Math.min(c.bs,n-1),sm=t.midi[i]+c.bf,tm=sm+c.bi;return{i,sm,tm,sf:GPX.mf(sm,c.a4),tf:GPX.mf(tm,c.a4),iv:A.INTERVALS.find(x=>x.semi===c.bi)||A.INTERVALS[1]}};

/* ---------- microfone ---------- */
function micError(e){const n=e&&e.name;
 if(n==="NotAllowedError"||n==="SecurityError")return"Permissão negada. Clique no cadeado ou no ícone de microfone na barra de endereço, permita o microfone para este site e tente de novo.";
 if(n==="NotFoundError"||n==="DevicesNotFoundError")return"Nenhum microfone encontrado. Conecte uma interface de áudio ou verifique a entrada de som do sistema.";
 if(n==="NotReadableError"||n==="AbortError")return"O microfone está em uso por outro aplicativo ou foi bloqueado pelo sistema.";
 return"Não foi possível abrir o microfone ("+(n||"erro desconhecido")+").";}
async function start(){
 T.err="";
 if(!window.isSecureContext){T.err="A captura de áudio exige uma conexão segura (HTTPS). Abra o site pelo endereço https:// ou por localhost.";return false}
 if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia){T.err="Este navegador não oferece acesso ao microfone. Use uma versão recente do Chrome, Edge, Firefox ou Safari.";return false}
 try{
  const raw={echoCancellation:false,noiseSuppression:false,autoGainControl:false};
  try{T.stream=await navigator.mediaDevices.getUserMedia({audio:raw})}
  catch(e){if(e&&e.name==="OverconstrainedError")T.stream=await navigator.mediaDevices.getUserMedia({audio:true});else throw e}
  const c=await GPX.ac(),s=T.stream.getAudioTracks()[0].getSettings?T.stream.getAudioTracks()[0].getSettings():{};
  T.src=c.createMediaStreamSource(T.stream);T.an=c.createAnalyser();T.an.fftSize=4096;T.an.smoothingTimeConstant=0;T.src.connect(T.an);/* não liga ao alto-falante: evita microfonia */
  T.buf=new Float32Array(T.an.fftSize);T.tr.reset();T.run=true;
  const on=[s.echoCancellation&&"cancelamento de eco",s.noiseSuppression&&"supressão de ruído",s.autoGainControl&&"ganho automático"].filter(Boolean);
  T.info=`Captando a ${Math.round(c.sampleRate)} Hz.`+(on.length?` Atenção: o navegador manteve ${on.join(", ")} ligado; isso pode atrapalhar a medição de notas sustentadas.`:"");
  clearInterval(T.timer);T.timer=setInterval(tick,25);return true;
 }catch(e){T.err=micError(e);stop(true);return false}
}
function stop(keepErr){clearInterval(T.timer);T.timer=null;if(T.stream)T.stream.getTracks().forEach(t=>t.stop());try{T.src&&T.src.disconnect()}catch(e){}
 T.stream=T.src=T.an=null;T.run=false;if(!keepErr)T.err="";T.info="";if(T.atk)T.atk=null;T.tr.reset()}

/* ---------- laço de medição ---------- */
function fmin(){return Math.max(40,Math.min(...tuning().midi.map(m=>GPX.mf(m,cfg().a4)))*0.85)}
let ctxRate=48000;
function tick(){
 if(!T.an)return;const c=T.an.context;ctxRate=c.sampleRate;T.an.getFloatTimeDomainData(T.buf);
 const r=A.yin(T.buf,c.sampleRate,{fmin:fmin(),fmax:1400}),now=performance.now(),o=T.tr.push(r,now);
 paint(o);if(T.atk)bendTick(r,now);
}
function paint(o){
 if(!el("tn-note"))return;const c=cfg(),tun=tuning(),ok=o.state==="stable";
 if(!ok){el("tn-note").textContent="–";el("tn-oct").textContent="";el("tn-hz").textContent="– Hz";el("tn-cents").textContent="–";el("tn-str").textContent="";
  el("tn-msg").textContent=o.msg||"";el("tn-msg").className="mu";el("tn-needle").style.opacity=0;setChips(-1);el("tn-state").textContent=o.state==="low"?"sinal insuficiente":o.state==="unstable"?"nota instável":"sem nota";return}
 const f=o.freq;let tgt,idx=-1;
 if(c.mode==="string"){const s=A.closestString(f,tun,c.a4);tgt={freq:s.freq,midi:s.midi};idx=s.index}else{const n=A.nearest(f,c.a4);tgt={freq:n.freq,midi:n.midi}}
 const cs=A.cents(f,tgt.freq);
 el("tn-note").textContent=A.noteName(tgt.midi,tun.flats);el("tn-oct").textContent=A.octave(tgt.midi);el("tn-hz").textContent=fm(f)+" Hz";
 el("tn-str").textContent=idx>=0?`corda ${tun.midi.length-idx} · alvo ${fm(tgt.freq)} Hz`:`alvo ${fm(tgt.freq)} Hz`;
 el("tn-cents").textContent=sgn(cs)+" cents";
 const n=el("tn-needle");n.style.opacity=1;n.style.left=Math.max(0,Math.min(100,(cs+50)/100*100))+"%";n.classList.toggle("out",Math.abs(cs)>50);
 const good=Math.abs(cs)<=5;el("tn-state").textContent=good?"afinada":cs<0?"abaixo da nota":"acima da nota";
 el("tn-msg").textContent=good?"Afinada (dentro de ±5 cents).":cs<0?`${Math.abs(Math.round(cs))} cents abaixo da nota-alvo: aperte a corda (aumente a tensão).`:`${Math.round(cs)} cents acima da nota-alvo: afrouxe a corda.`;
 el("tn-msg").className=good?"tn-ok":"mu";el("tn-disp").classList.toggle("good",good);setChips(idx);
}
function setChips(i){document.querySelectorAll(".tn-chip").forEach(b=>b.classList.toggle("on",+b.dataset.i===i))}

/* ---------- treinador de bends ---------- */
function arm(){const b=bendInfo();T.atk={armed:true,armedAt:performance.now(),started:false,frames:[],raw:[],t0:0,last:0,tf:b.tf,sf:b.sf,info:b};refreshStatus()}
function bendTick(r,now){
 const a=T.atk;if(!a||!a.armed)return;const valid=r&&r.ok&&r.clarity>=0.8;
 if(valid){a.raw.push(r.freq);if(a.raw.length>3)a.raw.shift();if(!a.started){a.started=true;a.t0=now;const eb=document.querySelector("[data-tn=end]");if(eb)eb.disabled=false;refreshStatus()}a.last=now;a.frames.push({t:now-a.t0,f:r.freq});live(A.cents(A.median(a.raw),a.tf))}
 else if(a.started&&now-a.last>600)finish();
 if(a.started&&now-a.t0>10000)finish();
 else if(!a.started&&now-a.armedAt>20000){T.atk=null;refreshStatus("Nenhum som detectado em 20 s. Confira o microfone e tente de novo.")}
}
function live(c){const e=el("tb-live");if(!e)return;e.textContent=sgn(c)+" cents";const m=el("tb-needle");if(m){m.style.left=Math.max(0,Math.min(100,(c+Math.max(100,cfg().bi*100+20))/(Math.max(100,cfg().bi*100+20)+60)*100))+"%"}
 el("tb-hint").textContent=Math.abs(c)<=cfg().tol?"Na nota-alvo: sustente sem mexer.":c<0?`Faltam ~${Math.abs(Math.round(c))} cents até a nota-alvo.`:`${Math.round(c)} cents acima da nota-alvo.`}
function finish(){
 const a=T.atk;if(!a)return;T.atk=null;const c=cfg(),b=a.info,res=A.analyzeBend(a.frames,a.tf,{tol:c.tol});
 const h={id:GPX.uid(),when:GPX.iso(),tun:c.tun,s:b.i,f:c.bf,semi:c.bi,a4:c.a4,name:lbl(b.sm)+" → "+lbl(b.tm),tf:a.tf,tol:c.tol,ok:!!res.ok};
 if(res.ok){Object.assign(h,{verdict:res.verdict,diff:res.diff,kind:res.stability.kind,st:res.stability.text,dur:res.plateau.dur,p:[res.plateau.t0,res.plateau.t1],ser:res.series.slice(0,160)})}
 else h.msg=res.msg;
 c.hist.unshift(h);c.hist=c.hist.slice(0,30);save();refresh();setTimeout(()=>{const r=el("tb-result");if(r)r.scrollIntoView({block:"nearest",behavior:"smooth"})},50)}
function refreshStatus(msg){const s=el("tb-status");if(!s)return;const a=T.atk;s.textContent=msg||(a?(a.started?"Gravando a tentativa… sustente a nota-alvo e solte para encerrar.":"Armada: toque a nota inicial e faça o bend."):"")}

/* ---------- gráfico e textos de resultado ---------- */
function chart(h){
 const S=h.ser||[];if(S.length<2)return"";const W=640,H=210,L=44,R=12,Tp=14,B=24,tmax=S[S.length-1].t||1;
 const ys=S.map(p=>p.c),lo=Math.min(...ys,-h.tol-10)-15,hi=Math.max(...ys,h.tol+10)+15,X=t=>L+t/tmax*(W-L-R),Y=c=>Tp+(hi-c)/(hi-lo)*(H-Tp-B);
 const pl=S.filter(p=>h.p&&p.t>=h.p[0]&&p.t<=h.p[1]);
 const startC=-h.semi*100;
 return`<svg class="tbc" viewBox="0 0 ${W} ${H}" role="img" aria-label="Altura ao longo da tentativa, em cents em relação à nota-alvo. Resultado: ${esc(h.ok?h.verdict+" ("+sgn(h.diff)+" cents)":"sem medição")}">
 <rect class="band" x="${L}" y="${Y(h.tol)}" width="${W-L-R}" height="${Math.max(2,Y(-h.tol)-Y(h.tol))}"/>
 <line class="ta" x1="${L}" x2="${W-R}" y1="${Y(0)}" y2="${Y(0)}"/><text class="lb" x="${L-4}" y="${Y(0)+4}" text-anchor="end">alvo</text>
 ${startC>=lo?`<line class="in" x1="${L}" x2="${W-R}" y1="${Y(startC)}" y2="${Y(startC)}"/><text class="lb" x="${L-4}" y="${Y(startC)+4}" text-anchor="end">início</text>`:""}
 <polyline class="ln" points="${S.map(p=>X(p.t).toFixed(1)+","+Y(p.c).toFixed(1)).join(" ")}"/>
 ${pl.length>1?`<polyline class="pl" points="${pl.map(p=>X(p.t).toFixed(1)+","+Y(p.c).toFixed(1)).join(" ")}"/>`:""}
 <text class="lb" x="${L}" y="${H-6}">0 s</text><text class="lb" x="${W-R}" y="${H-6}" text-anchor="end">${(tmax/1000).toFixed(1).replace(".",",")} s</text></svg>
 <p class="mu">Linha laranja: altura medida em cents em relação à nota-alvo (0). Faixa: tolerância de ±${h.tol} cents. Trecho verde: parte sustentada avaliada.</p>`}
function verdictText(h){
 if(!h.ok)return`<b>Sem medição confiável.</b> ${esc(h.msg||"")}`;
 const d=Math.abs(Math.round(h.diff));
 return h.verdict==="afinada"?`<b>${sgn(h.diff)} cents: nota afinada</b> (dentro de ±${h.tol}).`:h.verdict==="abaixo"?`<b>${sgn(h.diff)} cents: ${d} cents abaixo da nota-alvo.</b>`:`<b>${sgn(h.diff)} cents: ${d} cents acima da nota-alvo.</b>`}
function coach(h){if(!h.ok)return"";return h.verdict==="abaixo"?"Continue empurrando o bend um pouco mais antes de sustentar. Toque a nota-alvo na casa correspondente, ouça e repita o bend tentando igualar.":h.verdict==="acima"?"Você passou da nota. Relaxe um pouco a pressão no fim do bend e confira a altura contra a nota-alvo.":"Boa. Repita algumas vezes para ver se a afinação se mantém, e depois tente sem olhar a tela."}
function resultHTML(h){return`<div class="g c" id="tb-result"><h3>${esc(h.name)} <span class="tag">${esc((A.INTERVALS.find(x=>x.semi===h.semi)||{}).name||"")}</span> <span class="tag">${GPX.dt(h.when)}</span></h3><p>${verdictText(h)}</p>${h.ok?`<p class="tb-st tb-${h.kind}">${esc(h.st)}</p><p class="mu">${esc(coach(h))}</p>`:""}${chart(h)}</div>`}

function histHTML(){
 const H=cfg().hist;if(!H.length)return`<p class="mu">Nenhuma tentativa ainda.</p>`;
 const ok=H.filter(h=>h.ok).slice(0,10),good=ok.filter(h=>h.verdict==="afinada").length;
 return`<p class="mu">${ok.length?`Nas últimas ${ok.length} tentativas medidas: ${good} afinadas (±${cfg().tol} cents).`:"Nenhuma tentativa medida ainda."}</p><div class="scroll"><table><thead><tr><th>Data</th><th>Bend</th><th>Resultado</th><th>Estabilidade</th><th></th></tr></thead><tbody>${H.slice(0,12).map(h=>`<tr><td>${GPX.dt(h.when)}</td><td>${esc(h.name)}</td><td>${h.ok?sgn(h.diff)+" cents ("+h.verdict+")":"sem medição"}</td><td>${h.ok?esc(({estavel:"estável",vibrato:"vibrato provável",instavel:"instável",deriva:"deriva",incerto:"incerto",insuficiente:"curta demais"})[h.kind]||h.kind):"–"}</td><td><button data-tn="hv" data-id="${h.id}" aria-label="Ver gráfico desta tentativa">Ver</button></td></tr>`).join("")}</tbody></table></div>`}

/* ---------- visual ---------- */
function view(){
 const c=cfg(),tun=tuning(),b=bendInfo(),n=tun.midi.length,opt=(a,v)=>a.map(([k,t])=>`<option value="${k}" ${String(v)===String(k)?"selected":""}>${esc(t)}</option>`).join("");
 const secure=window.isSecureContext&&navigator.mediaDevices&&navigator.mediaDevices.getUserMedia;
 return`<h2>Afinador e treinador de bends</h2>
<p class="mu">Mede o som real do seu microfone (algoritmo YIN, calculado no próprio navegador). O áudio não é gravado nem enviado a nenhum servidor.</p>
${T.err?`<div class="g c alert" role="alert"><b>Microfone indisponível.</b> ${esc(T.err)}</div>`:""}${!secure&&!T.err?`<div class="g c warn" role="alert">Este contexto não permite captura de áudio: é preciso abrir o site por HTTPS.</div>`:""}
<section class="g c tn" aria-labelledby="tn-h"><h3 id="tn-h">Afinador cromático</h3>
 <div class="grid"><div><label for="tn-a4">Referência A4 (Hz)</label><input id="tn-a4" data-tnf="a4" type="number" min="400" max="480" step="0.5" value="${c.a4}"></div>
 <div><label for="tn-tun">Afinação</label><select id="tn-tun" data-tnf="tun">${opt(A.TUNINGS.map(t=>[t.id,t.name]),c.tun)}</select></div>
 <div><label for="tn-mode">Modo</label><select id="tn-mode" data-tnf="mode">${opt([["chrom","Cromático (qualquer nota)"],["string","Por corda da afinação"]],c.mode)}</select></div></div>
 <div class="row" style="margin:.7rem 0"><button class="pri" data-tn="${T.run?"stop":"start"}">${T.run?"Parar captura":"Iniciar afinador"}</button><span class="mu" id="tn-mic" role="status">${T.run?esc(T.info):"Microfone desligado."}</span></div>
 <div class="tn-disp" id="tn-disp" aria-live="off"><div class="tn-note"><span id="tn-note">–</span><sup id="tn-oct"></sup></div><div class="tn-meta"><span id="tn-hz">– Hz</span><span id="tn-str"></span></div>
  <div class="tn-meter" role="img" aria-label="Medidor de afinação de menos 50 a mais 50 cents"><span class="zero"></span><i id="tn-needle" style="opacity:0"></i><div class="sc"><span>-50</span><span>-25</span><span>0</span><span>+25</span><span>+50</span></div></div>
  <div class="tn-read"><span class="big" id="tn-cents">–</span><span class="tag" id="tn-state">aguardando</span></div><p id="tn-msg" class="mu">Inicie a captura e toque uma corda solta.</p></div>
 <div class="tn-chips" role="group" aria-label="Notas de referência da afinação">${tun.midi.map((m,i)=>`<button class="tn-chip" data-i="${i}" data-tn="ref" data-hz="${GPX.mf(m,c.a4)}" aria-label="Ouvir corda ${n-i}, ${lbl(m)}">${n-i} · ${lbl(m)}</button>`).join("")}</div>
 <p class="mu">Os botões acima tocam um tom puro (senoidal) de referência para afinar de ouvido; não é o timbre de uma guitarra.</p>
 <details><summary>Como permitir o microfone</summary><p>Na primeira vez o navegador pergunta se o site pode usar o microfone: escolha <b>Permitir</b>. Se negou sem querer, clique no cadeado (ou no ícone de microfone) ao lado do endereço, mude o microfone para <b>Permitir</b> e recarregue a página. No celular, confira também Ajustes do sistema &gt; navegador &gt; Microfone.</p></details>
 <details><summary>Limitações da medição</summary><ul><li>Distorção forte, ruído de fundo, harmônicos exagerados e vibrato largo atrapalham a detecção. Para medir, use som limpo.</li><li>Com captador e interface de áudio (ou um microfone perto do amplificador) o resultado é muito melhor do que com o microfone do celular longe da guitarra.</li><li>Quando o sinal é fraco ou a nota oscila, o aparelho mostra “sinal insuficiente” ou “nota instável” em vez de inventar um número.</li></ul></details>
</section>

<section class="g c tn" aria-labelledby="tb-h"><h3 id="tb-h">Treinador de bends</h3>
 <div class="grid"><div><label for="tb-s">Corda</label><select id="tb-s" data-tnf="bs">${opt(tun.midi.map((m,i)=>[i,`Corda ${n-i} (${lbl(m)} solta)`]),b.i)}</select></div>
 <div><label for="tb-f">Casa</label><select id="tb-f" data-tnf="bf">${opt(Array.from({length:23},(_,i)=>[i,i===0?"Solta (0)":"Casa "+i]),c.bf)}</select></div>
 <div><label for="tb-i">Intervalo do bend</label><select id="tb-i" data-tnf="bi">${opt(A.INTERVALS.map(x=>[x.semi,x.name]),c.bi)}</select></div>
 <div><label for="tb-t">Tolerância de “afinada”</label><select id="tb-t" data-tnf="tol">${opt([[5,"±5 cents (exigente)"],[10,"±10 cents"],[15,"±15 cents"],[20,"±20 cents"]],c.tol)}</select></div></div>
 <p class="tb-path"><span class="tag">nota inicial</span> <b>${lbl(b.sm)}</b> · ${fm(b.sf)} Hz <span aria-hidden="true">→</span> <span class="tag">nota-alvo</span> <b>${lbl(b.tm)}</b> · ${fm(b.tf)} Hz <span class="mu">(${esc(b.iv.name)})</span></p>
 <div class="row"><button data-tn="hear" data-hz="${b.sf}">Ouvir nota inicial</button><button data-tn="hear" data-hz="${b.tf}">Ouvir nota-alvo</button><button data-tn="rand">Sortear alvo</button></div>
 <p class="mu">Referência sonora: tom puro calculado em ${c.a4} Hz para A4. Toque você mesmo a nota-alvo na casa correspondente para comparar com o timbre da sua guitarra.</p>
 <div class="tn-disp tb-disp"><div class="tn-read"><span class="big" id="tb-live">–</span><span class="tag">cents até o alvo</span></div>
  <div class="tn-meter tb"><span class="zero" style="left:${Math.max(100,c.bi*100+20)/(Math.max(100,c.bi*100+20)+60)*100}%"></span><i id="tb-needle"></i></div>
  <p class="mu" id="tb-hint">Arme uma tentativa, toque a nota inicial e faça o bend.</p><p class="mu" id="tb-status" role="status">${T.atk?(T.atk.started?"Gravando a tentativa…":"Armada: toque a nota inicial e faça o bend."):""}</p></div>
 <div class="row"><button class="pri" data-tn="arm" ${T.atk?"disabled":""}>Iniciar tentativa</button><button data-tn="end" ${T.atk&&T.atk.started?"":"disabled"}>Encerrar tentativa</button></div>
 <p class="mu">A tentativa termina sozinha quando o som para (ou após 10 s). A avaliação usa a parte sustentada mais aguda: o sistema separa vibrato de instabilidade só quando há evidência suficiente; caso contrário, avisa que não sabe.</p>
 <details><summary>Como sustentar sem oscilar</summary><ul><li>Chegue à nota em um movimento contínuo e só então segure: a pressão do dedo guia deve ficar constante.</li><li>Apoie os três dedos juntos (um bend com reforço) em vez de empurrar só com um dedo.</li><li>Se for fazer vibrato, comece depois de chegar na altura certa e confira se ele volta ao centro da nota.</li><li>Grave a tentativa e compare com a nota-alvo tocada no braço.</li></ul></details>
</section>
${cfg().hist[0]?resultHTML(cfg().hist[0]):""}
<section class="g c"><h3>Histórico de tentativas</h3><div id="tb-hist">${histHTML()}</div>${cfg().hist.length?`<div class="row"><button data-tn="clr">Apagar histórico de bends</button></div>`:""}</section>`}

function refresh(){if(typeof tab==="undefined"||tab!=="afinador")return;const v=$("#view"),y=scrollY;v.innerHTML=view();document.dispatchEvent(new CustomEvent("viewrendered",{detail:{tab:"afinador",changed:false}}));scrollTo(0,y)}

/* ---------- eventos (delegados; ativos só na aba Afinador) ---------- */
document.addEventListener("click",async e=>{const b=e.target.closest("[data-tn]");if(!b||tab!=="afinador")return;const d=b.dataset,c=cfg();
 if(d.tn==="start"){const ok=await start();refresh();if(ok)toast("Microfone ligado."); return}
 if(d.tn==="stop"){stop();refresh();return}
 if(d.tn==="ref"||d.tn==="hear"){GPX.tone(+d.hz,1.6);return}
 if(d.tn==="arm"){if(!T.run){const ok=await start();if(!ok){refresh();return}}arm();refresh();return}
 if(d.tn==="end"){if(T.atk&&T.atk.started)finish();return}
 if(d.tn==="rand"){const t=tuning(),n=t.midi.length;c.bs=Math.floor(Math.random()*n);c.bf=Math.floor(Math.random()*13);c.bi=[1,2,2,3][Math.floor(Math.random()*4)];save();refresh();return}
 if(d.tn==="hv"){const h=c.hist.find(x=>x.id===d.id);if(h){const r=el("tb-result");if(r)r.outerHTML=resultHTML(h);const n=el("tb-result");n&&n.scrollIntoView({block:"nearest",behavior:"smooth"})}return}
 if(d.tn==="clr"&&confirm("Apagar o histórico de bends deste navegador?")){c.hist=[];save();refresh()}
});
document.addEventListener("change",e=>{const t=e.target;if(!t.dataset||!t.dataset.tnf||tab!=="afinador")return;const c=cfg(),k=t.dataset.tnf;
 if(k==="a4"){const v=parseFloat(String(t.value).replace(",","."));c.a4=Number.isFinite(v)?Math.min(480,Math.max(400,v)):440}
 else if(k==="tun"||k==="mode")c[k]=t.value;else c[k]=+t.value;
 if(k==="tun"){c.bs=Math.min(c.bs,tuning().midi.length-1)}
 save();refresh()});

const ext={view,bind(){if(T.atk)refreshStatus()},leave(){stop();T.atk=null}};
window.addEventListener("load",()=>{addTab("afinador","Afinador",ext,"rep")});
document.addEventListener("visibilitychange",()=>{if(document.hidden&&T.run&&!T.atk){stop();refresh()}});
window.GPTuner={analyze:A.analyzeBend,_state:T};
})();
