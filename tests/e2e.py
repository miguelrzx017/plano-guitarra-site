import asyncio,http.server,threading,functools,json
from playwright.async_api import async_playwright
H=functools.partial(http.server.SimpleHTTPRequestHandler,directory='.')
H.log_message=lambda *a:None
srv=http.server.ThreadingHTTPServer(('127.0.0.1',8765),H);threading.Thread(target=srv.serve_forever,daemon=True).start()
res=[]
def ck(n,c,x=''):
    res.append(c);print(('OK  ' if c else 'FALHA'),n,x if not c else '')
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch(args=['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream','--use-file-for-fake-audio-capture=tests/a2.wav','--autoplay-policy=no-user-gesture-required'])
    ctx=await b.new_context(permissions=['microphone'],viewport={'width':1100,'height':900})
    pg=await ctx.new_page();errs=[]
    pg.on('pageerror',lambda e:errs.append(str(e)));pg.on('console',lambda m:m.type=='error' and 'ERR_NAME_NOT_RESOLVED' not in m.text and errs.append(m.text));pg.on('requestfailed',lambda r:print('REDE:',r.url[:60]))
    await pg.goto('http://127.0.0.1:8765/index.html');await pg.wait_for_timeout(500)
    tabs=await pg.evaluate('TABS.map(t=>t[0])');ck('abas novas registradas',all(x in tabs for x in['afinador','academia','gravar']),tabs)
    # auto-teste original do app
    st=await pg.evaluate('typeof selfTest==="function"?selfTest():null');print('selfTest:',json.dumps(st)[:200] if st is not None else 'n/d')
    # afinador
    await pg.evaluate('show("afinador")');await pg.click('[data-tn=start]');await pg.wait_for_timeout(1800)
    note=await pg.inner_text('#tn-note');cents=await pg.inner_text('#tn-cents');hz=await pg.inner_text('#tn-hz')
    print('afinador leu:',note,cents,hz)
    ck('afinador detecta A',note=='A',note)
    v=int(cents.split()[0].replace('+',''));ck('cents ≈ +7 (±4)',abs(v-7)<=4,cents)
    # bend: alvo é A2? usar corda 5 (A) casa 0, intervalo 1 tom -> alvo B; só verifica que tentativa roda e não inventa
    await pg.select_option('#tb-s','1');await pg.select_option('#tb-f','0');await pg.select_option('#tb-i','2')
    await pg.click('[data-tn=arm]');await pg.wait_for_timeout(4500)
    await pg.click('[data-tn=end]') if await pg.is_enabled('[data-tn=end]') else None
    await pg.wait_for_timeout(600)
    txt=await pg.inner_text('#view');ck('tentativa de bend gerou resultado',('cents' in txt and 'abaixo' in txt) or 'Sem medição' in txt,txt[txt.find('Histórico'):][:200])
    i=txt.find('Histórico');print('RESULTADO BEND:',txt[txt.find('→'):][:330].replace('\n',' | '));ck('A2 contra alvo B2: reporta abaixo da nota-alvo','abaixo' in txt.lower())
    h=await pg.evaluate('S.ext.tuner.hist[0]');print('HIST:',{k:h.get(k) for k in ['name','ok','verdict','diff','kind','msg']} if h else None);ck('histórico: alvo B2, sinal fixo em A2+7c -> ~-193 cents abaixo',bool(h) and h['ok'] and h['verdict']=='abaixo' and abs(h['diff']+193)<=6,h)
    await pg.click('[data-tn=stop]')
    # academia
    await pg.evaluate('show("academia")');ck('10 cursos',await pg.locator('[data-ac=course]').count()==10)
    await pg.click('[data-ac=course][data-id=c2]');await pg.click('[data-ac=go][data-id=c2a]')
    vt=await pg.inner_text('#view');ck('aula tem itens 1 a 14',all((f'{i}.' in vt or f'{i}–' in vt) for i in range(1,15)))
    await pg.click('[data-ac=tplay]');await pg.wait_for_timeout(900);ck('tablatura acende nota',await pg.locator('.tab-box .tn.on').count()>=1);await pg.click('[data-ac=tstop]')
    await pg.click('[data-ac=done]');ck('concluir aula',(await pg.evaluate('S.ext.acad.done.c2a'))is not None)
    await pg.evaluate('show("academia")');await pg.click('[data-ac=v][data-id=mapa]');ck('mapa do braço com pontos',await pg.locator('.fbd .mk').count()>10)
    await pg.click('[data-ac=v][data-id=quiz]');await pg.click('[data-ac=ans] >> nth=0');ck('quiz responde',await pg.locator('#qz-fb .adv').count()==1)
    await pg.click('[data-ac=v][data-id=lib]');ck('biblioteca 16 técnicas',await pg.locator('details.g.c').count()>=26)
    # tutoriais em exercício
    await pg.evaluate('show("exer")');t=await pg.inner_html('#view');ck('exercícios mostram tutoriais/aviso','Nenhum tutorial verificado' in t and 'Pickslanting' in t)
    # gravação
    await pg.evaluate('show("gravar")');await pg.click('[data-rc=start]');await pg.wait_for_timeout(1800);await pg.click('[data-rc=stop]');await pg.wait_for_timeout(1200)
    ck('gravação salva e listada',await pg.locator('.rc-take').count()==1)
    await pg.reload();await pg.evaluate('show("gravar")');await pg.wait_for_timeout(700);ck('gravação persiste após recarregar',await pg.locator('.rc-take').count()==1)
    await pg.once('dialog',lambda d:asyncio.ensure_future(d.accept())) if False else None
    pg.on('dialog',lambda d:asyncio.ensure_future(d.accept('Take renomeado')))
    await pg.click('[data-rc=ren]');await pg.wait_for_timeout(400);ck('renomear','Take renomeado' in await pg.inner_text('#view'))
    await pg.click('[data-rc=del]');await pg.wait_for_timeout(500);ck('excluir',await pg.locator('.rc-take').count()==0)
    # repertório
    await pg.evaluate('show("rep")');t=await pg.inner_html('#view');ck('repertório: fontes e licença','Cifra Club' in t and 'Licença' in t)
    await pg.evaluate("S.rep.te.sections.length||(S.rep.te.sections.push({name:'Solo A',bpm:90,sub:6,dif:3,status:'em estudo'}),save());show('rep')")
    await pg.check('[data-rps=te] [data-rp=tech][data-k=bend]');await pg.select_option('[data-rps=te] [data-rp=ver]','audio')
    t=await pg.inner_text('#view');ck('seção com bends verificada gera explicação','pedem' in t or 'aumentam a prioridade' in t)
    ck('boost do motor',(await pg.evaluate('GPRep.boost().bend'))>0)
    await pg.evaluate("document.querySelectorAll('details').forEach(d=>d.open=true)");await pg.fill('[data-rpform=te] [name=name]','Minha tab');await pg.fill('[data-rpform=te] [name=license]','autoria própria')
    await pg.fill('[data-rpform=te] [name=text]','e|-----------|\nB|-----------|\nG|--10-11-13--|\nD|-----------|\nA|-----------|\nE|-----------|');await pg.click('[data-rpform=te] button[type=submit]');await pg.wait_for_timeout(300)
    await pg.click('[data-rp=open]');await pg.wait_for_timeout(200);ck('tab própria interpretada (3 notas)',await pg.locator('.rp-tab .tab-box .tn').count()==3)
    # sem erros / todas as abas antigas
    for t in ['hoje','plano','exer','diario','dados','metro','meta','diag','inicio']: await pg.evaluate(f'show("{t}")')
    ck('sem erros de console/JS',not errs,errs[:3])
    await pg.screenshot(path='/home/claude/shot.png')
    await b.close()
asyncio.run(main());print(sum(res),'de',len(res),'passaram')
