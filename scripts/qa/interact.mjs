import { launch } from './common.mjs';
import fs from 'fs';
const [,,BASE,OUT]=process.argv;
const b=await launch();
const res={};
const norm=s=>(s||'').replace(/\s+/g,' ').replace(/SOL-\d{4}/g,'SOL-####').trim();
async function dialogText(p){ await p.waitForTimeout(450); return norm(await p.evaluate(()=>{const d=[...document.querySelectorAll('[role="dialog"]')].map(e=>e.innerText).join(' || '); return d;})); }
async function closeAll(p){ await p.keyboard.press('Escape'); await p.waitForTimeout(450); }
for(const l of ['en','ru','zh','tr','ar','es']){
  const ctx=await b.newContext({viewport:{width:1440,height:900},reducedMotion:'reduce'});
  const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message)); p.on('console',m=>{if(m.type()==='error'&&!/net::|Failed to load/.test(m.text()))errs.push(m.text().slice(0,200))});
  const home=BASE+(l==='en'?'/':'/'+l);
  await p.goto(home,{waitUntil:'networkidle'});
  const out=[];
  // SPECS dialogs
  const specs=await p.$$('#technologies button[type="button"]');
  for(let i=0;i<specs.length;i++){ const s=(await p.$$('#technologies button[type="button"]'))[i]; await s.scrollIntoViewIfNeeded(); await s.click(); out.push(['specs'+i, await dialogText(p)]);
    // inquire button inside -> opens inquiry modal with topic
    if(i===0){ const btns=await p.$$('[role="dialog"] button'); await btns[btns.length-1].click(); out.push(['specs-inquire', await dialogText(p)]); }
    await closeAll(p); }
  // patent cards
  const pats=await p.$$('#intellectual-property [role="button"]');
  for(let i=0;i<pats.length;i++){ const s=(await p.$$('#intellectual-property [role="button"]'))[i]; await s.scrollIntoViewIfNeeded(); await s.click(); out.push(['patent'+i, await dialogText(p)]); await closeAll(p); }
  // EPCM steps (home stepper buttons)
  const steps=await p.$$('section button:has(svg) >> nth=0');
  const epcmBtns=await p.$$eval('button', bs=>bs.map((b,i)=>[i,b.innerText.trim()]).filter(x=>/^0?\d/.test(x[1])||false).length);
  // navbar CTA → inquiry modal, submit
  await p.evaluate(()=>window.scrollTo(0,0));
  const cta=await p.$('header button.s-btn, nav button.s-btn');
  if(cta){ await cta.click(); out.push(['inquiry', await dialogText(p)]);
    await p.fill('[role="dialog"] input[type="text"]','Test Name'); await p.fill('[role="dialog"] input[type="tel"]','+7 777 000 00 00');
    await p.click('[role="dialog"] button[type="submit"]'); await p.waitForTimeout(900); out.push(['inquiry-submitted', await dialogText(p)]); await closeAll(p); }
  // footer privacy
  const priv=await p.$$('footer button'); if(priv[0]){ await priv[0].click(); out.push(['footer-privacy', await dialogText(p)]); await closeAll(p); }
  // video lightbox
  const vid=await p.$('[aria-label^="'+''+'"] video');
  const vbtn=(await p.$$('section [role="button"], section button[aria-label]')).length;
  // EPCM page stage inquiry + contact form submit
  await p.goto(BASE+(l==='en'?'':'/'+l)+'/epcm',{waitUntil:'networkidle'});
  const ib=await p.$$('main button'); const labels=[];
  for(const x of ib) labels.push(norm(await x.innerText()));
  out.push(['epcm-buttons', labels.join('|')]);
  // click first stage inquiry
  for(const x of ib){ const t=norm(await x.innerText()); if(t && !/request|inquire for plant/i.test(t) && x!==ib[0]){ await x.scrollIntoViewIfNeeded(); await x.click(); out.push(['epcm-stage-inquiry', await dialogText(p)]); await closeAll(p); break; } }
  await p.goto(BASE+(l==='en'?'':'/'+l)+'/contact',{waitUntil:'networkidle'});
  await p.fill('main input[type="text"] >> nth=0','Jane'); await p.fill('main input[type="tel"]','+1 555'); await p.fill('main input[type="email"]','a@b.co');
  await p.click('main button[type="submit"]'); await p.waitForTimeout(900);
  out.push(['contact-submitted', norm(await p.evaluate(()=>document.querySelector('main').innerText)).slice(0,900)]);
  res[l]={out,errs};
  await ctx.close();
}
await b.close();
fs.writeFileSync(OUT,JSON.stringify(res,null,1)); console.log('ok');
