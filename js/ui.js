/* Camada visual: ícones automáticos, entrada animada e efeito de toque.
   Não altera dados nem lógica do app. */
(function(){
"use strict";
const NS="http://www.w3.org/2000/svg",view=document.getElementById("view");
const icon=n=>{const s=document.createElementNS(NS,"svg");s.setAttribute("class","ic");s.setAttribute("aria-hidden","true");const u=document.createElementNS(NS,"use");u.setAttribute("href","#i-"+n);s.appendChild(u);return s};

/* título -> ícone */
const H=[[/^afinador|bends/i,"afinador"],[/academia/i,"academia"],[/grava/i,"gravar"],[/^meta/i,"meta"],[/metr/i,"metro"],[/di[aá]rio/i,"diario"],[/diagn/i,"diag"],[/plano/i,"plano"],[/exerc|biblioteca/i,"exer"],[/repert/i,"rep"],[/dados|relat/i,"dados"],[/sess/i,"hoje"]];
/* botão -> ícone */
const B=[[/^(iniciar|tocar|come[cç]ar)/i,"play"],[/^pausar|^continuar/i,"pause"],[/^parar|^encerrar/i,"stop"],[/^gravar/i,"gravar"],[/^baixar/i,"down"],[/^gerar|^copiar/i,"copy"],[/^adicionar|^nova/i,"plus"],[/^apagar/i,"trash"],[/^ordenar/i,"sort"],[/^restaurar|^repetir/i,"refresh"],[/^rodar/i,"flask"],[/^tap/i,"hand"],[/conclu|^salvar|^registrar|^marcar/i,"check"]];
const pick=(map,t)=>{for(const[r,n]of map)if(r.test(t))return n;return null};

function decorate(){
  view.querySelectorAll("h2:not([data-ic])").forEach(h=>{
    h.dataset.ic="1";const n=pick(H,h.textContent.trim());if(!n)return;
    const c=document.createElement("span");c.className="chip";c.appendChild(icon(n));h.prepend(c);
  });
  view.querySelectorAll("button:not([data-tab]):not([data-noic])").forEach(b=>{
    if(b.querySelector(":scope>svg.ic"))return;
    const n=pick(B,b.textContent.trim());if(n)b.prepend(icon(n));else b.dataset.noic="1";
  });
}

/* sincroniza ícone quando o app troca o texto do botão (ex.: Iniciar/Pausar) */
let busy=false;
new MutationObserver(()=>{if(busy)return;busy=true;requestAnimationFrame(()=>{decorate();busy=false})})
  .observe(view,{childList:true,subtree:true,characterData:true});

/* entrada em cascata ao trocar de aba (não repete ao salvar/marcar) */
document.addEventListener("viewrendered",e=>{
  decorate();document.getElementById("nav").classList.remove("open");
  if(!e.detail.changed)return;
  [...view.children].forEach((el,i)=>el.style.setProperty("--i",Math.min(i,10)));
  view.classList.remove("anim");void view.offsetWidth;view.classList.add("anim");
  setTimeout(()=>view.classList.remove("anim"),1400);
  window.scrollTo({top:0,behavior:"smooth"});
  const on=document.querySelector("#nav button.on");
  if(on&&on.scrollIntoView)on.scrollIntoView({inline:"center",block:"nearest",behavior:"smooth"});
});

/* menu "Mais" no celular */
document.addEventListener("click",e=>{const n=document.getElementById("nav"),m=e.target.closest("[data-more]");if(m){const o=n.classList.toggle("open");m.setAttribute("aria-expanded",o)}else n.classList.remove("open")});
/* ripple nos botões */
document.addEventListener("pointerdown",e=>{
  const b=e.target.closest("button");if(!b||b.disabled||matchMedia("(prefers-reduced-motion:reduce)").matches)return;
  const r=b.getBoundingClientRect(),d=Math.max(r.width,r.height),s=document.createElement("span");
  s.className="ripple";s.style.cssText=`width:${d}px;height:${d}px;left:${e.clientX-r.left-d/2}px;top:${e.clientY-r.top-d/2}px`;
  b.appendChild(s);setTimeout(()=>s.remove(),600);
});

/* primeira renderização (app.js já chamou show("inicio") antes deste arquivo) */
document.dispatchEvent(new CustomEvent("viewrendered",{detail:{tab:"inicio",changed:true}}));
})();
