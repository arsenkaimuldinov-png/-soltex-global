import { launch, routesFrom, urlFor } from './common.mjs';
import fs from 'fs';
// usage: node capture.mjs BASE OUT LANGS WIDTHS SHOTS(0|1)
const [,,BASE,OUT,LANGS,WIDTHS,SHOTS='0']=process.argv;
const routes=await routesFrom(BASE);
const langs=LANGS.split(','); const widths=WIDTHS.split(',').map(Number);
fs.mkdirSync(OUT,{recursive:true}); if(SHOTS==='1') fs.mkdirSync(OUT+'/shots',{recursive:true});
const b=await launch();
const jobs=[]; for(const l of langs) for(const w of widths) jobs.push([l,w]);
const data={};
async function worker(){
  while(jobs.length){ const [l,w]=jobs.shift();
    const ctx=await b.newContext({viewport:{width:w,height:w<600?844:(w<1100?1024:900)},reducedMotion:'reduce'});
    const p=await ctx.newPage(); const errs=[];
    p.on('pageerror',e=>errs.push(e.message));
    p.on('console',m=>{ if(m.type()==='error' && !/fonts\.g|ERR_TUNNEL|net::ERR|Failed to load resource/.test(m.text())) errs.push('console: '+m.text().slice(0,200)); });
    for(const r of routes){
      const url=urlFor(BASE,l,r);
      try{ await p.goto(url,{waitUntil:'networkidle',timeout:30000}); }catch(e){ errs.push('goto '+url); continue; }
      await p.evaluate(async()=>{ for(let y=0;y<document.body.scrollHeight;y+=500){ window.scrollTo(0,y); await new Promise(r=>setTimeout(r,20)); } window.scrollTo(0,0); });
      // make screenshots deterministic: load and decode every image (including lazy ones)
      await p.evaluate(async()=>{ for(const i of document.images) i.loading='eager'; await Promise.all([...document.images].map(i=>i.decode().catch(()=>{}))); });
      await p.waitForFunction(()=>[...document.images].every(i=>i.complete), null, {timeout:8000}).catch(()=>{});
      await p.waitForTimeout(200);
      const out=await p.evaluate(()=>{
        const q=(s)=>document.querySelector(s);
        const meta=(sel,a='content')=>q(sel)?.getAttribute(a)??null;
        const norm=s=>(s||'').replace(/\s+/g,' ').trim();
        const attrs=(root)=>root?[...root.querySelectorAll('img,a,[aria-label],[title],input,textarea,select,option,video,source,button')].map(e=>[e.tagName.toLowerCase(),e.getAttribute('src'),e.getAttribute('alt'),e.getAttribute('href'),e.getAttribute('aria-label'),e.getAttribute('title'),e.getAttribute('placeholder'),e.getAttribute('poster'),e.tagName==='OPTION'?e.textContent:null].map(x=>x??'').join('|')):[];
        const header=q('body header')||q('nav'); const main=q('main'); const footer=q('footer');
        return {
          title:document.title, description:meta('meta[name="description"]'), robots:meta('meta[name="robots"]'),
          canonical:meta('link[rel="canonical"]','href'),
          hreflang:[...document.querySelectorAll('link[rel="alternate"][hreflang]')].map(e=>e.hreflang+' '+e.href).sort(),
          og:[...document.querySelectorAll('meta[property^="og:"],meta[name^="twitter:"]')].map(e=>(e.getAttribute('property')||e.getAttribute('name'))+'='+e.content).sort(),
          lang:document.documentElement.lang, dir:document.documentElement.dir,
          h1:document.querySelectorAll('h1').length,
          header:norm(header?.innerText), main:norm(main?.innerText), footer:norm(footer?.innerText),
          headerAttrs:attrs(header), mainAttrs:attrs(main), footerAttrs:attrs(footer),
          overflow:document.documentElement.scrollWidth-innerWidth,
          brokenImgs:[...document.images].filter(i=>i.complete&&i.naturalWidth===0).map(i=>i.getAttribute('src')),
        };
      });
      data[`${l} ${w} ${r}`]=out;
      if(SHOTS==='1'){ const name=`${l}_${w}_${r.replace(/\//g,'_')||'_'}.png`; await p.screenshot({path:`${OUT}/shots/${name}`,fullPage:true}); }
    }
    if(errs.length) data[`${l} ${w} __errors`]=[...new Set(errs)].slice(0,20);
    await ctx.close();
  }
}
await Promise.all([worker(),worker(),worker(),worker()]);
await b.close();
fs.writeFileSync(`${OUT}/data-${LANGS.replace(/,/g,'')}-${WIDTHS.replace(/,/g,'_')}.json`,JSON.stringify(data,null,1));
console.log('captured',Object.keys(data).length);
