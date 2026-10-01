import { launch, routesFrom, urlFor } from './common.mjs';
import fs from 'fs';
const BASE=process.argv[2];
const routes=await routesFrom(BASE);
const base=JSON.parse(fs.readFileSync(process.argv[3],'utf8')); // baseline page data (capture.mjs output, widths 1440,390)
const b=await launch();
const norm=s=>(s||'').replace(/\s+/g,' ').trim();
const report={nojs:[],motion:[],slowjs:[],notfound:[]};
// 1. JavaScript disabled
{ const ctx=await b.newContext({viewport:{width:1440,height:900},javaScriptEnabled:false}); const p=await ctx.newPage();
  for(const l of ['en','ru','zh','tr','ar','es']) for(const r of routes){
    const url=BASE+(l==='en'?r:(r==='/'?'/'+l:'/'+l+r)); await p.goto(url,{waitUntil:'load'});
    const t=norm(await p.evaluate(()=>document.querySelector('main')?.innerText));
    const vis=await p.evaluate(()=>{const h=document.querySelector('h1'); if(!h) return false; const r=h.getBoundingClientRect(); return r.height>0 && getComputedStyle(h).opacity!=='0';});
    const exp=base[`${l} 1440 ${r}`].main;
    if(t!==exp || !vis) report.nojs.push({url, same:t===exp, h1visible:vis, len:[t.length,exp.length]});
  } await ctx.close(); }
// 2. Motion enabled: hydration errors, reveals complete
for(const l of ['en','ar','ru']) for(const r of ['/','/epcm','/company','/projects/solbar-israel','/technologies/pectin']){
  const ctx=await b.newContext({viewport:{width:1440,height:900}}); const p=await ctx.newPage(); const errs=[];
  p.on('console',m=>{ if(['error','warning'].includes(m.type()) && !/net::|Failed to load|fonts\.g/.test(m.text())) errs.push(m.text().slice(0,200)); }); p.on('pageerror',e=>errs.push(e.message));
  const url=BASE+(l==='en'?r:(r==='/'?'/'+l:'/'+l+r)); await p.goto(url,{waitUntil:'networkidle'});
  const ready=await p.evaluate(()=>document.documentElement.classList.contains('motion-ready'));
  await p.evaluate(async()=>{ for(let y=0;y<document.body.scrollHeight;y+=400){ window.scrollTo(0,y); await new Promise(r=>setTimeout(r,60)); } });
  await p.waitForTimeout(2600);
  const hidden=await p.evaluate(()=>[...document.querySelectorAll('[data-reveal]')].filter(e=>!e.dataset.rv).length);
  const total=await p.evaluate(()=>document.querySelectorAll('[data-reveal]').length);
  report.motion.push({url, motionReady:ready, revealsTotal:total, notRevealed:hidden, errors:errs});
  await ctx.close(); }
// 3. JavaScript fails to load: safety timer reveals content
{ const ctx=await b.newContext({viewport:{width:1440,height:900}}); const p=await ctx.newPage();
  await p.route('**/*.js', r=>r.abort());
  await p.goto(BASE+'/company',{waitUntil:'load'});
  const at0=await p.evaluate(()=>document.documentElement.classList.contains('motion-ready'));
  await p.waitForTimeout(4500);
  const after=await p.evaluate(()=>({ready:document.documentElement.classList.contains('motion-ready'), h2op:getComputedStyle(document.querySelectorAll('h2')[0]).clipPath+' '+getComputedStyle(document.querySelectorAll('[data-reveal]')[0]).opacity}));
  report.slowjs.push({motionReadyAtLoad:at0, after}); await ctx.close(); }
// 4. Not found pages in browser
{ const ctx=await b.newContext({viewport:{width:1440,height:900}}); const p=await ctx.newPage(); const errs=[];
  p.on('console',m=>{ if(m.type()==='error' && !/net::|fonts\.g/.test(m.text())) errs.push(m.text().slice(0,160)); });
  for(const u of ['/does-not-exist','/ru/nichego','/ar/x/y','/projects/unknown']){
    const resp=await p.goto(BASE+u,{waitUntil:'networkidle'});
    report.notfound.push({u,status:resp.status(),h1:norm(await p.evaluate(()=>document.querySelector('h1')?.innerText)),robots:await p.evaluate(()=>document.querySelector('meta[name=robots]')?.content), lang:await p.evaluate(()=>document.documentElement.lang), errs:[...errs]});
    errs.length=0;
  } await ctx.close(); }
await b.close();
console.log(JSON.stringify(report,null,1));
