/* Testes do núcleo de áudio. Rodar: node tests/audio-core.test.js */
const A=require("../js/audio-core.js");
let ok=0,bad=0;const t=(n,c,x)=>{if(c){ok++}else{bad++;console.log("✘",n,x===undefined?"":x)}};
const near=(a,b,e)=>Math.abs(a-b)<=e;
let seed=12345;const rnd=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296};
function tone(f,sr,N,harm=[1,.5,.33,.25,.15],noise=0,ph=0){const b=new Float32Array(N);for(let i=0;i<N;i++){let s=0;harm.forEach((a,k)=>s+=a*Math.sin(2*Math.PI*f*(k+1)*i/sr+ph*(k+1)));b[i]=.25*s+noise*(rnd()-.5)}return b}

/* 1) cents e notas */
t("cents: oitava = 1200",near(A.cents(880,440),1200,1e-9));
t("cents: alvo A=440, f=440 -> 0",A.cents(440,440)===0);
const g3=A.midiToFreq(55),a3=A.midiToFreq(57);
t("G3=196,00 Hz",near(g3,195.998,.01));t("A3=220 Hz",near(a3,220,.001));
t("bend de 1 tom: G3->A3 = 200 cents",near(A.cents(a3,g3),200,.01));
t("-18 cents abaixo do alvo",near(A.cents(a3*Math.pow(2,-18/1200),a3),-18,1e-6));
t("A4 configurável: 432 Hz",near(A.midiToFreq(69,432),432,1e-9));
const n=A.nearest(82.41,440);t("82,41 Hz = E2 +0",n.name==="E"&&n.oct===2&&Math.abs(n.cents)<.2,n);
t("closestString padrão: 110 Hz -> corda 2 (A2)",A.closestString(110,A.TUNINGS[0],440).index===1);
t("Drop D: corda 1 = D2 (73,42 Hz)",near(A.midiToFreq(A.TUNINGS[1].midi[0]),73.416,.01));
t("noteLabel Eb",A.noteLabel(63,true)==="Eb4");

/* 2) YIN: precisão em várias frequências e taxas */
let worst=0;
[44100,48000].forEach(sr=>{
 [65.41,73.42,82.41,110,146.83,196,246.94,329.63,440,659.25,880,1174.66].forEach(f=>{
  [0,.02].forEach(nz=>{
   const r=A.yin(tone(f,sr,4096,[1,.5,.33,.25,.15],nz,.7),sr);
   const e=r.ok?Math.abs(A.cents(r.freq,f)):999;worst=Math.max(worst,e);
   t(`YIN ${f}Hz sr${sr} ruído${nz}: erro<=2 cents`,r.ok&&e<=2,{e,r});
  });
 });
});
console.log("pior erro YIN (cents):",worst.toFixed(3));
/* fundamental fraca (harmônicos fortes): não pode cair uma oitava */
{const sr=48000,r=A.yin(tone(110,sr,4096,[.55,1,.8,.5,.3]),sr);t("fundamental fraca ainda ~110 Hz",r.ok&&near(r.freq,110,1.5),r)}
/* silêncio e ruído */
{const sr=48000,r=A.yin(new Float32Array(4096),sr);t("silêncio -> low",!r.ok&&r.reason==="low")}
{const sr=48000,b=new Float32Array(4096);for(let i=0;i<b.length;i++)b[i]=.3*(rnd()-.5)*2;const r=A.yin(b,sr);t("ruído branco não vira nota",!r.ok||r.clarity<.8,r)}
{const sr=48000,b=tone(220,sr,4096);for(let i=0;i<b.length;i++)b[i]*=.002;const r=A.yin(b,sr);t("sinal muito fraco -> low",!r.ok&&r.reason==="low")}

/* 3) rastreador: estável, instável, sem sinal */
{const tr=A.PitchTracker();let o;const sr=48000;for(let i=0;i<8;i++)o=tr.push(A.yin(tone(196,sr,4096,[1,.5,.3],.005),sr),i*30);t("tracker estável",o.state==="stable"&&near(o.freq,196,.5),o)}
{const tr=A.PitchTracker();let o;for(let i=0;i<8;i++)o=tr.push({ok:true,freq:196*Math.pow(2,((i%2?60:-60))/1200),clarity:.95,rms:.1},i*30);t("tracker instável",o.state==="unstable",o)}
{const tr=A.PitchTracker();let o;for(let i=0;i<5;i++)o=tr.push({ok:false,reason:"low",rms:0},i*30);t("tracker sinal insuficiente",o.state==="low",o)}

/* 4) analisador de bends com trajetórias sintéticas (alvo A3, 220 Hz) */
const TG=a3;
const mk=(fn,T=2200,dt=25)=>{const fr=[];for(let t=0;t<T;t+=dt){const c=fn(t);if(c!==null)fr.push({t,f:TG*Math.pow(2,c/1200)})}return fr};
const bendTo=(c0,end,vib)=>t=>t<300?-200:t<700?-200+(end+200)*(t-300)/400:t<1900?end+vib(t):t<2100?end-(t-1900)*.8:null;
{const r=A.analyzeBend(mk(bendTo(0,-18,()=>0)),TG);t("bend 18 cents abaixo detectado",r.ok&&r.verdict==="abaixo"&&near(r.diff,-18,2),r)}
{const r=A.analyzeBend(mk(bendTo(0,0,()=>0)),TG);t("bend afinado",r.ok&&r.verdict==="afinada"&&r.stability.kind==="estavel",r)}
{const r=A.analyzeBend(mk(bendTo(0,+23,()=>0)),TG);t("bend acima",r.ok&&r.verdict==="acima"&&near(r.diff,23,2),r)}
{const r=A.analyzeBend(mk(bendTo(0,0,t=>20*Math.sin(2*Math.PI*5.5*t/1000))),TG);t("vibrato 5,5 Hz ±20 reconhecido",r.ok&&r.stability.kind==="vibrato"&&near(r.stability.rate,5.5,.8),r.stability);t("vibrato: centro continua afinado",r.verdict==="afinada",r.diff)}
{seed=777;const r=A.analyzeBend(mk(bendTo(0,0,()=>(rnd()-.5)*50)),TG);t("jitter aleatório NÃO vira vibrato",r.ok&&(r.stability.kind==="instavel"||r.stability.kind==="incerto"),r.stability)}
{const r=A.analyzeBend(mk(t=>t<2000?-200:null),TG);t("só nota inicial: reporta -200 (bend não feito)",r.ok&&r.verdict==="abaixo"&&near(r.diff,-200,3),r)}
{const r=A.analyzeBend(mk(bendTo(0,0,t=>(t-1000)*0.05)),TG);t("deriva de altura detectada",r.ok&&r.stability.kind==="deriva",r.stability)}
{const r=A.analyzeBend(mk(t=>t<200?0:null,400),TG);t("poucos dados -> sem medição falsa",!r.ok,r)}
{const r=A.analyzeBend(mk(t=>t<1500?(t%200<100?0:-300):null),TG);t("sem platô -> sem medição falsa",!r.ok||r.plateau.dur>=300,r)}
{const r=A.analyzeBend(mk(bendTo(0,0,()=>0),2000).slice(0,22).filter((x,i)=>i%1===0),TG);t("sustentação curta -> estabilidade 'insuficiente' ou aviso",r.ok?["insuficiente","estavel"].includes(r.stability.kind):true,r.stability)}
/* revisão independente: ultrapassar o alvo e voltar; salto de oitava isolado */
{const f=t=>t<300?-200:t<600?-200+(t-300)*(80+200)/300:t<800?80:t<1100?-5:t<1900?-5:null;const r=A.analyzeBend(mk(f),TG);t("overshoot curto e depois afinado: avalia o trecho próximo do alvo",r.ok&&r.verdict==="afinada",r.diff)}
{const fr=mk(bendTo(0,0,()=>0));fr[40].f*=2;fr[41].f/=2;const r=A.analyzeBend(fr,TG);t("quadros isolados em oitava errada são ignorados",r.ok&&r.verdict==="afinada"&&Math.abs(r.diff)<3,r)}
console.log(`\n${ok} passaram, ${bad} falharam`);process.exit(bad?1:0);
