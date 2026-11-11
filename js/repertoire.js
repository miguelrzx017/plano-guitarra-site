/* Repertório (Te Escolhi e Espelhos Mágicos): fontes autorizadas, tablaturas próprias/importadas com origem e licença,
   técnicas confirmadas por trecho e ligação com o motor de treino.
   O site NÃO copia, extrai nem incorpora tablaturas de terceiros. */
(function(){
"use strict";
const $=s=>document.querySelector(s),G=GPAudio;
const SONGS={te:"Te Escolhi",em:"Espelhos Mágicos"};
const RT=[["pick","Palhetada alternada e troca de corda","pick",["pk2","pk3","te2"],"a troca de corda é onde a palheta costuma prender"],
 ["leg","Legato (hammer-on / pull-off)","leg",["lg1","lg2"],"o volume das notas ligadas precisa ser igual ao das palhetadas"],
 ["bend","Bends","bend",["bd1","bd3"],"o bend precisa chegar afinado na nota-alvo"],
 ["vib","Vibrato","bend",["bd2"],"a oscilação deve ser estável e voltar ao centro da nota"],
 ["sweep","Sweep picking","comp",["sw1"],"o gesto contínuo exige notas separadas"],
 ["tap","Tapping","comp",["tp1"],"o tap precisa ter volume parecido com as notas tocadas"],
 ["skip","String skipping","pick",["pk4"],"o salto exige precisão da palheta na corda de destino"]];
const VER=[["nao","Ainda não verificado"],["audio","Conferido ouvindo a gravação"],["transc","Conferido na transcrição"],["ambos","Transcrição e gravação"]];
const ORI=[["own","Criada por mim"],["user","Arquivo/texto meu, tenho direito de usar"],["lic","De fonte autorizada, com licença registrada"]];
const R=()=>GPX.ext("rep",{info:{te:{rec:"",tun:"std",bpm:135,sub:6},em:{rec:"",tun:"std",bpm:"",sub:4}},tabs:[]});
const opt=(a,v)=>a.map(([k,t])=>`<option value="${k}" ${String(k)===String(v)?"selected":""}>${esc(t)}</option>`).join("");
const tunMidi=id=>(G.TUNINGS.find(t=>t.id===id)||G.TUNINGS[0]).midi;
const secs=k=>S.rep[k].sections;

function recs(sec){const t=sec.techs||[];if(!t.length)return`<p class="mu">Nenhuma técnica confirmada neste trecho. Marque só o que você verificou: o site não presume técnica por gênero.</p>`;
 const v=sec.verif||"nao",unv=v==="nao";
 return`<ul class="rp-why">${t.map(k=>{const r=RT.find(x=>x[0]===k);if(!r)return"";const ex=r[3].filter(id=>typeof BY!=="undefined"&&BY[id]);
  return`<li><b>${esc(r[1])}</b>: ${esc(r[4])}. Exercícios: ${ex.map(id=>`<button data-ac="go" data-id="${(GPAcad.lessonsFor(id)[0]||{}).id||""}" ${GPAcad.lessonsFor(id)[0]?"":"hidden"}>${esc(BY[id].name)}</button>${GPAcad.lessonsFor(id)[0]?"":`<span class="tag">${esc(BY[id].name)}</span>`}`).join(" ")}</li>`}).join("")}</ul>
  <p class="mu">${unv?"Técnica ainda não verificada na transcrição ou no áudio: as recomendações acima são provisórias e não pesam no plano diário.":"Verificação registrada: "+esc(VER.find(x=>x[0]===v)[1])+". Estas técnicas aumentam a prioridade dos exercícios relacionados no plano (aba Hoje)."}</p>`}

function secBlock(k,i,s){
 return`<div class="g c rp-sec" data-rps="${k}" data-i="${i}"><div class="row"><b style="flex:1">${esc(s.name)}</b><span class="tag">${esc(s.status||"")}</span>${s.hard?'<span class="tag">trecho difícil</span>':""}</div>
 <fieldset class="rp-tech"><legend class="mu">Técnicas confirmadas neste trecho</legend>${RT.map(r=>`<label class="inl"><input type="checkbox" data-rp="tech" data-k="${r[0]}" ${(s.techs||[]).includes(r[0])?"checked":""}> ${esc(r[1])}</label>`).join("")}</fieldset>
 <div class="grid"><div><label>Como você verificou</label><select data-rp="ver">${opt(VER,s.verif||"nao")}</select></div><div><label class="inl"><input type="checkbox" data-rp="hard" ${s.hard?"checked":""}> Marcar como trecho difícil</label></div></div>
 ${recs(s)}<div class="row"><button data-rp="rec" data-k="${k}" data-i="${i}">Gravar esta seção</button></div></div>`}

function tabsFor(k){return R().tabs.filter(t=>t.song===k).map(t=>`<div class="g c rp-tab"><div class="row"><b style="flex:1">${esc(t.name)}</b><span class="tag">${esc(t.sec!==""&&secs(k)[t.sec]?secs(k)[t.sec].name:"sem seção")}</span><span class="tag">${esc(ORI.find(o=>o[0]===t.origin)[1])}</span></div>
 <p class="mu">Licença/origem: ${esc(t.license)}</p><div class="row"><button data-rp="open" data-id="${t.id}">Abrir e tocar</button><button data-rp="dtab" data-id="${t.id}">Remover</button></div><div id="rp-p-${t.id}"></div></div>`).join("")||`<p class="mu">Nenhuma tablatura cadastrada para esta música.</p>`}

function songView(k){const I=R().info[k];
 return`<section class="g c" data-rpsong="${k}"><h3>${SONGS[k]} · Oficina G3 · material de estudo</h3>
 <div class="grid"><div><label>Gravação de referência (título/versão)</label><input data-rp="info" data-f2="rec" value="${esc(I.rec)}" placeholder="ex.: álbum e faixa que você usa"></div>
 <div><label>Afinação da gravação</label><select data-rp="info" data-f2="tun">${opt(G.TUNINGS.map(t=>[t.id,t.name]),I.tun)}</select></div>
 <div><label>BPM de referência</label><input data-rp="info" data-f2="bpm" type="number" min="20" max="300" value="${esc(I.bpm)}"></div>
 <div><label>Subdivisão</label><select data-rp="info" data-f2="sub">${opt(Object.entries(typeof SUBS!=="undefined"?SUBS:{}),I.sub||4)}</select></div></div>
 <p class="mu">Informe só o que você confirmou. O site não pesquisa nem copia tablaturas.</p>
 <h4>Tablaturas e materiais</h4>${tabsFor(k)}
 <details><summary>Cadastrar tablatura própria ou importar um arquivo meu</summary><form data-rpform="${k}" novalidate>
  <div class="grid"><div><label>Nome</label><input name="name" required></div><div><label>Seção</label><select name="sec"><option value="">— nenhuma —</option>${secs(k).map((s,i)=>`<option value="${i}">${esc(s.name)}</option>`).join("")}</select></div>
  <div><label>Origem</label><select name="origin">${opt(ORI,"own")}</select></div><div><label>Licença / permissão (obrigatório)</label><input name="license" required placeholder="ex.: autoria própria; ou licença e link da fonte"></div></div>
  <label>Tablatura em texto (6 linhas e|B|G|D|A|E|)</label><textarea name="text" rows="7" class="mono" spellcheck="false" placeholder="e|-----------|
B|-----------|
G|--10-11-13--|
D|-----------|
A|-----------|
E|-----------|"></textarea>
  <label>…ou importar um arquivo de texto (.txt) seu</label><input type="file" name="file" accept=".txt,text/plain">
  <button class="pri" type="submit">Salvar tablatura</button><p class="mu">Só envie material que você criou ou tem direito de usar. O arquivo fica no seu navegador, não é enviado a lugar nenhum.</p></form></details>
 <details><summary>Abrir fontes autorizadas de tablaturas</summary><p>Estes sites têm direitos e termos próprios. O link abre o site em outra aba; o seu plano não copia nem incorpora o conteúdo deles, e nenhum deles é tratado como fonte com API pública para este uso.</p>
 <div class="row"><a class="btn" href="https://www.cifraclub.com.br/" target="_blank" rel="noopener noreferrer">Cifra Club</a><a class="btn" href="https://www.ultimate-guitar.com/" target="_blank" rel="noopener noreferrer">Ultimate Guitar</a><a class="btn" href="https://www.songsterr.com/" target="_blank" rel="noopener noreferrer">Songsterr</a></div></details>
 <h4>Técnicas por trecho</h4>${secs(k).length?secs(k).map((s,i)=>secBlock(k,i,s)).join(""):`<p class="mu">Cadastre as células acima para marcar as técnicas de cada trecho.</p>`}</section>`}
function view(){return`<h2>Material de estudo e técnicas por trecho</h2>`+songView("te")+songView("em")}

/* quanto cada habilidade é pedida por trechos verificados que ainda não estão prontos */
function boost(){const b={};["te","em"].forEach(k=>secs(k).forEach(s=>{if(!s.techs||!s.techs.length||(s.verif||"nao")==="nao"||s.status==="integral")return;s.techs.forEach(t=>{const r=RT.find(x=>x[0]===t);if(r)b[r[2]]=Math.min(18,(b[r[2]]||0)+6)})}));return b}

document.addEventListener("change",e=>{const t=e.target;if(!t.dataset||!t.dataset.rp||typeof tab==="undefined"||tab!=="rep")return;const d=t.dataset;
 if(d.rp==="info"){const k=t.closest("[data-rpsong]").dataset.rpsong;R().info[k][d.f2]=t.type==="number"?(t.value===""?"":Math.min(300,Math.max(20,+t.value))):t.value;save();return}
 const sc=t.closest("[data-rps]");if(!sc)return;const s=secs(sc.dataset.rps)[+sc.dataset.i];if(!s)return;
 if(d.rp==="tech"){s.techs=s.techs||[];s.techs=t.checked?[...new Set([...s.techs,d.k])]:s.techs.filter(x=>x!==d.k)}
 if(d.rp==="ver")s.verif=t.value;if(d.rp==="hard")s.hard=t.checked;save();show("rep")});
document.addEventListener("click",e=>{const b=e.target.closest("[data-rp]");if(!b||typeof tab==="undefined"||tab!=="rep")return;const d=b.dataset;
 if(d.rp==="rec"){const s=secs(d.k)[+d.i];GPRec.open({song:d.k,sec:+d.i,bpm:s.bpm,sub:s.sub,name:SONGS[d.k]+": "+s.name});return}
 if(d.rp==="dtab"&&confirm("Remover esta tablatura?")){const r=R();r.tabs=r.tabs.filter(t=>t.id!==d.id);save();show("rep");return}
 if(d.rp==="open"){const t=R().tabs.find(x=>x.id===d.id),box=document.getElementById("rp-p-"+d.id);if(!t||!box)return;const ev=GPAcad.parseTab(t.text);
  if(!ev.length){box.innerHTML=`<pre class="tab-box">${esc(t.text)}</pre><p class="mu">Não consegui interpretar notas neste texto (esperado: 6 linhas começando por e|, B|, G|, D|, A| e E|). Ele é mostrado como texto simples.</p>`;return}
  GPAcad.startPlayer(ev,tunMidi(R().info[t.song].tun));box.innerHTML=GPAcad.playerHTML(ev,{bpm:+R().info[t.song].bpm||60,sub:+R().info[t.song].sub||2})}});
document.addEventListener("submit",e=>{const f=e.target;if(!f.dataset||f.dataset.rpform===undefined)return;e.preventDefault();const k=f.dataset.rpform,v=n=>(f.elements[n].value||"").trim();
 const save1=text=>{if(!v("name")||!v("license")){toast("Informe o nome e a licença/permissão.");return}if(!text.trim()){toast("Cole a tablatura ou importe um arquivo.");return}
  if(text.length>20000){toast("Texto grande demais (limite de 20 mil caracteres).");return}
  R().tabs.push({id:GPX.uid(),song:k,name:v("name").slice(0,100),sec:v("sec"),origin:v("origin"),license:v("license").slice(0,200),text:text.slice(0,20000),added:GPX.iso()});save();toast("Tablatura salva.");show("rep")};
 const fl=f.elements.file.files[0];if(fl){if(fl.size>100000){toast("Arquivo grande demais (máx. 100 KB).");return}const r=new FileReader();r.onload=()=>save1(String(r.result));r.readAsText(fl)}else save1(f.elements.text.value)});

window.GPRep={view,boost,RT};
})();
