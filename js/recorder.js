/* Gravações dos treinos: grava, guarda (IndexedDB local), reproduz e organiza.
   Nesta etapa NÃO há análise de técnica. Nada é enviado a servidores. */
(function(){
"use strict";
const $=s=>document.querySelector(s),el=id=>document.getElementById(id);
const DB="gp_media",ST="takes";
const R={mr:null,stream:null,chunks:[],t0:0,acc:0,paused:false,timer:null,an:null,ac:null,err:"",urls:[],pre:null,list:[],mime:""};
/* ---------- IndexedDB ---------- */
function open(){return new Promise((ok,no)=>{if(!window.indexedDB)return no(new Error("sem IndexedDB"));const q=indexedDB.open(DB,1);q.onupgradeneeded=()=>q.result.createObjectStore(ST,{keyPath:"id"});q.onsuccess=()=>ok(q.result);q.onerror=()=>no(q.error)})}
async function tx(mode,fn){const db=await open();return new Promise((ok,no)=>{const t=db.transaction(ST,mode),s=t.objectStore(ST),r=fn(s);t.oncomplete=()=>{db.close();ok(r&&r.result)};t.onerror=t.onabort=()=>{db.close();no(t.error)}})}
const all=()=>tx("readonly",s=>s.getAll()),put=o=>tx("readwrite",s=>s.put(o)),del=id=>tx("readwrite",s=>s.delete(id));
/* ---------- opções ---------- */
const MIMES=["audio/webm;codecs=opus","audio/mp4","audio/webm","audio/ogg;codecs=opus"];
function pickMime(){if(!window.MediaRecorder||!MediaRecorder.isTypeSupported)return"";return MIMES.find(m=>{try{return MediaRecorder.isTypeSupported(m)}catch(e){return false}})||""}
const ext=m=>/mp4/.test(m)?"m4a":/ogg/.test(m)?"ogg":/webm/.test(m)?"webm":"audio";
const fmtSize=b=>b>1048576?(b/1048576).toFixed(1).replace(".",",")+" MB":Math.max(1,Math.round(b/1024))+" KB";
const exName=id=>(typeof BY!=="undefined"&&BY[id])?BY[id].name:"";
const SONGS={te:"Te Escolhi",em:"Espelhos Mágicos"};
const secs=k=>(S.rep&&S.rep[k]&&S.rep[k].sections||[]).map((s,i)=>[i,s.name]);

/* ---------- gravação ---------- */
async function startRec(){
 R.err="";
 if(!window.isSecureContext){R.err="Gravar áudio exige HTTPS (ou localhost).";return}
 if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia||!window.MediaRecorder){R.err="Este navegador não oferece gravação de áudio (MediaRecorder).";return}
 try{R.stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:false,noiseSuppression:false,autoGainControl:false}})}
 catch(e){R.err=e&&e.name==="NotAllowedError"?"Permissão do microfone negada. Libere o microfone nas configurações do site e tente de novo.":e&&e.name==="NotFoundError"?"Nenhum microfone encontrado.":"Não foi possível abrir o microfone ("+(e&&e.name||"erro")+").";return}
 R.mime=pickMime();R.chunks=[];
 try{R.mr=R.mime?new MediaRecorder(R.stream,{mimeType:R.mime}):new MediaRecorder(R.stream)}catch(e){R.err="Formato de gravação não suportado neste navegador.";stopStream();return}
 R.mime=R.mr.mimeType||R.mime;
 R.mr.ondataavailable=e=>{if(e.data&&e.data.size)R.chunks.push(e.data)};
 R.mr.onstop=onStop;R.mr.start(1000);R.t0=performance.now();R.acc=0;R.paused=false;
 try{R.ac=await GPX.ac();const s=R.ac.createMediaStreamSource(R.stream);R.an=R.ac.createAnalyser();R.an.fftSize=1024;s.connect(R.an);R.buf=new Float32Array(1024)}catch(e){R.an=null}
 R.timer=setInterval(tickRec,120);
}
function stopStream(){if(R.stream)R.stream.getTracks().forEach(t=>t.stop());R.stream=null;R.an=null}
function elapsed(){return R.acc+(R.paused?0:performance.now()-R.t0)}
function tickRec(){const t=el("rc-time");if(t)t.textContent=GPX.mmss(elapsed());const m=el("rc-lvl");
 if(m&&R.an){R.an.getFloatTimeDomainData(R.buf);let s=0;for(const v of R.buf)s+=v*v;m.style.width=Math.min(100,Math.sqrt(s/R.buf.length)*400)+"%"}}
function pauseRec(){if(!R.mr||typeof R.mr.pause!=="function")return;if(R.mr.state==="recording"){R.acc+=performance.now()-R.t0;R.mr.pause();R.paused=true}else if(R.mr.state==="paused"){R.t0=performance.now();R.mr.resume();R.paused=false}refresh()}
function endRec(){if(R.mr&&R.mr.state!=="inactive"){R.acc=elapsed();R.mr.stop()}}
async function onStop(){
 clearInterval(R.timer);const ms=Math.round(R.acc),blob=new Blob(R.chunks,{type:R.mime||"audio/webm"});stopStream();R.mr=null;R.paused=false;
 if(!blob.size){R.err="A gravação saiu vazia.";refresh();return}
 const f=document.getElementById("rc-form"),g=k=>f&&f.querySelector("[name="+k+"]")?f.querySelector("[name="+k+"]").value:"";
 const rec={id:GPX.uid(),name:g("name")||"Gravação "+GPX.dt(GPX.iso()),created:GPX.iso(),ms,mime:blob.type,size:blob.size,ex:g("ex"),song:g("song"),sec:g("sec"),bpm:+g("bpm")||0,sub:+g("sub")||0,note:g("note"),blob};
 try{await put(rec);toast("Gravação salva neste navegador.")}catch(e){R.err="Não foi possível salvar (armazenamento cheio ou bloqueado). Baixe o arquivo antes de sair: "+(e&&e.message||"");R.pending=rec}
 await load();refresh();
}
async function load(){try{R.list=(await all()).sort((a,b)=>b.created<a.created?-1:1)}catch(e){R.list=[];R.dbErr=true}}

/* ---------- interface ---------- */
function opts(a,v,blank){return(blank?`<option value="">${blank}</option>`:"")+a.map(([k,t])=>`<option value="${k}" ${String(k)===String(v)?"selected":""}>${esc(t)}</option>`).join("")}
function takeHTML(r){const u=URL.createObjectURL(r.blob);R.urls.push(u);
 const meta=[r.ex&&"Exercício: "+exName(r.ex),r.song&&"Música: "+SONGS[r.song]+(r.sec!==""&&r.sec!=null&&secs(r.song)[r.sec]?" · "+secs(r.song)[r.sec][1]:""),r.bpm&&r.bpm+" BPM"+(r.sub?" × "+r.sub:"")].filter(Boolean);
 return`<div class="g c rc-take" data-id="${r.id}"><div class="row"><b style="flex:1">${esc(r.name)}</b><span class="tag">${GPX.dt(r.created)}</span><span class="tag">${GPX.mmss(r.ms)}</span><span class="tag">${fmtSize(r.size)}</span></div>
 <audio controls preload="none" src="${u}" aria-label="Reproduzir ${esc(r.name)}"></audio>${meta.length?`<p class="mu">${meta.map(esc).join(" · ")}</p>`:""}${r.note?`<p class="mu">${esc(r.note)}</p>`:""}
 <div class="row"><button data-rc="ren" data-id="${r.id}">Renomear</button><button data-rc="edit" data-id="${r.id}">Editar dados</button><a class="btn" href="${u}" download="${esc((r.name||"gravacao").replace(/[^\w\- ]+/g,"_"))}.${ext(r.mime)}">Baixar</a><button data-rc="del" data-id="${r.id}">Excluir</button></div></div>`}
function view(){
 R.urls.forEach(u=>URL.revokeObjectURL(u));R.urls=[];
 const p=R.pre||{},recording=!!R.mr,mime=pickMime();
 const exs=(typeof EX!=="undefined"?EX:[]).map(e=>[e[0],e[1]]);
 const filt=R.filter||"";const L=R.list.filter(r=>!filt||r.ex===filt||r.song===filt);
 const byDay={};L.forEach(r=>{const d=r.created.slice(0,10);(byDay[d]=byDay[d]||[]).push(r)});
 return`<h2>Gravações</h2>
<p class="mu">Grave seus treinos, ouça depois e organize por exercício, música e andamento. Nesta etapa o site só grava e guarda: não analisa sua técnica.</p>
${R.err?`<div class="g c alert" role="alert">${esc(R.err)}${R.pending?` <a class="btn" href="${URL.createObjectURL(R.pending.blob)}" download="gravacao.${ext(R.pending.mime)}">Baixar esta gravação agora</a>`:""}</div>`:""}${R.dbErr?`<div class="g c warn">O armazenamento local (IndexedDB) está indisponível neste navegador ou modo privado: as gravações não serão guardadas. Baixe cada arquivo logo após gravar.</div>`:""}
<form id="rc-form" class="g c" novalidate><h3>Nova gravação</h3>
 <div class="grid"><div><label for="rc-name">Nome</label><input id="rc-name" name="name" placeholder="ex.: Sextina a 90 BPM" value="${esc(p.name||"")}"></div>
 <div><label for="rc-ex">Exercício</label><select id="rc-ex" name="ex">${opts(exs,p.ex,"— nenhum —")}</select></div>
 <div><label for="rc-song">Música</label><select id="rc-song" name="song" data-rcsong>${opts(Object.entries(SONGS),p.song,"— nenhuma —")}</select></div>
 <div><label for="rc-sec">Seção</label><select id="rc-sec" name="sec">${opts(secs(p.song||""),p.sec,"— nenhuma —")}</select></div>
 <div><label for="rc-bpm">BPM</label><input id="rc-bpm" name="bpm" type="number" min="20" max="300" value="${p.bpm||""}"></div>
 <div><label for="rc-sub">Subdivisão</label><select id="rc-sub" name="sub">${opts(Object.entries(typeof SUBS!=="undefined"?SUBS:{}),p.sub||4,"—")}</select></div></div>
 <label for="rc-note">Observações pessoais</label><textarea id="rc-note" name="note" rows="2">${esc(p.note||"")}</textarea>
 <div class="rc-bar" role="status" aria-live="polite">${recording?`<span class="rc-dot ${R.paused?"p":""}" aria-hidden="true"></span><b>${R.paused?"Pausado":"Gravando"}</b> <span id="rc-time" class="rc-time">${GPX.mmss(elapsed())}</span><span class="rc-meter" aria-hidden="true"><i id="rc-lvl"></i></span>`:`<span class="mu">Pronto para gravar.</span>`}</div>
 <div class="row">${recording?`<button type="button" data-rc="pause">${R.paused?"Continuar":"Pausar"}</button><button type="button" class="pri" data-rc="stop">Parar e salvar</button>`:`<button type="button" class="pri" data-rc="start">Gravar</button>`}</div>
 <p class="mu">Formato usado: ${mime?esc(mime):"padrão do navegador"}. Use fones se tocar com metrônomo ou base, para o microfone não captar o som do alto-falante.</p></form>
<section class="g c"><h3>Onde ficam os arquivos</h3><p>As gravações ficam <b>somente neste aparelho e neste navegador</b> (IndexedDB). Nada é enviado à internet. O navegador pode apagar esses dados se faltar espaço, se você limpar dados do site e, no Safari, após cerca de 7 dias sem abrir o site. Por isso, <b>baixe</b> as gravações importantes. Elas não entram no backup JSON do plano.</p><p class="mu" id="rc-quota">Verificando espaço…</p>
 <div class="row"><button data-rc="persist">Pedir armazenamento persistente</button><button data-rc="dlall" ${R.list.length?"":"disabled"}>Baixar todas</button><button data-rc="meta" ${R.list.length?"":"disabled"}>Exportar lista (JSON)</button></div></section>
<section><h3>Suas gravações (${L.length})</h3><div class="grid"><div><label for="rc-f">Filtrar</label><select id="rc-f" data-rcf>${opts([...exs,["te","Música: Te Escolhi"],["em","Música: Espelhos Mágicos"]],filt,"Todas")}</select></div></div>
 ${L.length?Object.keys(byDay).sort().reverse().map(d=>`<h4 class="mu">${d.split("-").reverse().join("/")}</h4>`+byDay[d].map(takeHTML).join("")).join(""):`<p class="mu">Nenhuma gravação ainda. Escolha o exercício, toque em Gravar e toque.</p>`}</section>`}
function refresh(){if(typeof tab==="undefined"||tab!=="gravar")return;const v=$("#view"),y=scrollY,keep=document.getElementById("rc-form")&&!R.mr?null:null;v.innerHTML=view();quota();scrollTo(0,y)}
async function quota(){const q=el("rc-quota");if(!q)return;try{if(navigator.storage&&navigator.storage.estimate){const e=await navigator.storage.estimate(),pe=navigator.storage.persisted?await navigator.storage.persisted():null;const el2=el("rc-quota");if(el2)el2.textContent=`Uso estimado: ${fmtSize(e.usage||0)} de ~${fmtSize(e.quota||0)} (estimativa do navegador). Armazenamento persistente: ${pe===null?"não informado":pe?"concedido":"não concedido"}.`}else q.textContent="Este navegador não informa o espaço disponível."}catch(e){q.textContent="Não foi possível consultar o espaço."}}
function dl(blob,name){const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),4000)}

document.addEventListener("click",async e=>{const b=e.target.closest("[data-rc]");if(!b||tab!=="gravar")return;const d=b.dataset.rc,id=b.dataset.id,r=R.list.find(x=>x.id===id);
 if(d==="start"){await startRec();refresh();return}
 if(d==="pause"){pauseRec();return}
 if(d==="stop"){endRec();return}
 if(d==="ren"&&r){const n=prompt("Novo nome:",r.name);if(n&&n.trim()){r.name=n.trim().slice(0,120);await put(r);refresh()}return}
 if(d==="edit"&&r){const bpm=prompt("BPM (vazio para limpar):",r.bpm||"");if(bpm===null)return;r.bpm=Math.min(300,Math.max(0,+bpm||0));const n=prompt("Observações:",r.note||"");if(n!==null)r.note=n.slice(0,500);await put(r);refresh();return}
 if(d==="del"&&r&&confirm("Excluir “"+r.name+"”? Isto não pode ser desfeito.")){await del(id);await load();refresh();return}
 if(d==="persist"){try{const ok=navigator.storage&&navigator.storage.persist?await navigator.storage.persist():false;toast(ok?"Armazenamento persistente concedido.":"O navegador não concedeu armazenamento persistente. Baixe as gravações importantes.")}catch(x){toast("Não suportado neste navegador.")}quota();return}
 if(d==="dlall"){R.list.forEach((x,i)=>setTimeout(()=>dl(x.blob,(x.name||"gravacao").replace(/[^\w\- ]+/g,"_")+"-"+(i+1)+"."+ext(x.mime)),i*400));return}
 if(d==="meta"){dl(new Blob([JSON.stringify(R.list.map(({blob,...m})=>m),null,1)],{type:"application/json"}),"gravacoes-lista-"+today()+".json")}
});
document.addEventListener("change",e=>{const t=e.target;if(tab!=="gravar")return;
 if(t.dataset&&t.dataset.rcsong!==undefined){const s=el("rc-sec");s.innerHTML=opts(secs(t.value),"","— nenhuma —")}
 if(t.dataset&&t.dataset.rcf!==undefined){R.filter=t.value;refresh()}});

const X={view,async bind(){await load();if(R.pre&&!R.shown){R.shown=true}R.pre=R.pre;refresh();R.pre=null},leave(){if(R.mr)endRec();R.urls.forEach(u=>URL.revokeObjectURL(u));R.urls=[]}};
window.addEventListener("load",()=>{addTab("gravar","Gravações",X,"afinador");load()});
/* outros módulos abrem a aba já com exercício/música/seção preenchidos */
window.GPRec={open(pre){R.pre=pre||null;show("gravar")},count:()=>R.list.length};
})();
