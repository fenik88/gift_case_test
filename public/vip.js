// filepath: public/vip.js
// функционально как у тебя; изменены только metrics()/xFor()/idxUnder()
document.addEventListener("DOMContentLoaded", () => {
  const vipCase = document.getElementById("vip-case");
  const slider = document.getElementById("slider");
  const sliderBackdrop = document.getElementById("sliderBackdrop");
  const closeBtn = document.getElementById("closeBtn");
  const roulette = document.getElementById("roulette");
  const rouletteContainer = document.getElementById("rouletteContainer");
  const sliderContent = document.getElementById("sliderContent");
  const footerBar = document.getElementById("footer-bar");
  const spinBtn = document.getElementById("spinBtn");
  const gallery = document.getElementById("gallery");
  const resultOverlay = document.getElementById("resultOverlay");
  const resultOk = document.getElementById("resultOk");
  const resultImg = document.getElementById("resultImg");
  const resultName = document.getElementById("resultName");
  const resultAmount = document.getElementById("resultAmount");

  const tg = window.Telegram?.WebApp; tg?.ready?.();

  const PLATFORM = tg?.platform || "web";
  const SUPPORTS_TG_HAPTICS = !!tg?.HapticFeedback && (PLATFORM === "ios" || PLATFORM === "android");

  function primeHapticsOnce(){ try{ tg?.HapticFeedback?.impactOccurred?.("light"); }catch{} if(!SUPPORTS_TG_HAPTICS && "vibrate" in navigator) navigator.vibrate(8); }
  document.addEventListener("touchstart", primeHapticsOnce, { once:true, passive:true });
  document.addEventListener("mousedown", primeHapticsOnce, { once:true });

  const H = {
    _t:[], _after(ms,fn){const id=setTimeout(fn,ms); this._t.push(id);}, _clear(){this._t.forEach(clearTimeout); this._t=[];},
    impact(s="light"){ try{ if(SUPPORTS_TG_HAPTICS) tg.HapticFeedback.impactOccurred(s);}catch{} if(!SUPPORTS_TG_HAPTICS && "vibrate" in navigator) navigator.vibrate(s==="heavy"?25:12); },
    notify(t="success"){ try{ if(SUPPORTS_TG_HAPTICS) tg.HapticFeedback.notificationOccurred(t);}catch{} if(!SUPPORTS_TG_HAPTICS && "vibrate" in navigator) navigator.vibrate(t==="error" ? [20,40,60] : [10,40,10]); },
    tick(){ try{ if(SUPPORTS_TG_HAPTICS) tg.HapticFeedback.impactOccurred("light"); }catch{} if(!SUPPORTS_TG_HAPTICS && "vibrate" in navigator) navigator.vibrate(8); },
    winBurst1sFast(){
      this._clear(); const TOTAL=500;
      if(SUPPORTS_TG_HAPTICS){ const STEP=15; let t=0; try{ tg.HapticFeedback.notificationOccurred("success"); }catch{} const p=()=>{ try{ tg.HapticFeedback.impactOccurred("rigid"); }catch{} t+=STEP; if(t<TOTAL) this._after(STEP,p); }; this._after(STEP,p); this._after(TOTAL+40,()=>this._clear()); }
      else if("vibrate" in navigator){ const ON=8,OFF=4,pat=[]; let s=0; while(s<TOTAL){ pat.push(ON); s+=ON; if(s>=TOTAL)break; pat.push(OFF); s+=OFF; } navigator.vibrate(pat); }
    }
  };

  const STATIC_PATH="/static_webp/", LOOP_COUNT=24, CYCLES_BEFORE_STOP=6;
  const gifts=[{name:"Plush Pepe",file:"plush_pepe.webp"},{name:"Heart Locket",file:"heart_locket.webp"},{name:"Durov's Cap",file:"cap.webp"},{name:"Peach",file:"peach.webp"},{name:"Heroic Helmet",file:"helmet.webp"},{name:"Perfume",file:"perfume.webp"},{name:"Venom",file:"venom.webp"},{name:"Bonded Ring",file:"bonded_ring.webp"},{name:"Scared Cat",file:"cat.webp"},{name:"Signet Ring",file:"signet_ring.webp"}];

  let isSpinning=false, lastCenteredIndex=null;
  let idleRAF=null, idleLast=0, idleOffset=0; const IDLE_SPEED=22;

  function syncFooter(){ const h=footerBar?.offsetHeight||96; document.documentElement.style.setProperty("--footer-h",`${h}px`); if(sliderContent) sliderContent.style.paddingBottom=`calc(${h}px + 16px)`; }
  const ro=("ResizeObserver" in window)? new ResizeObserver(syncFooter):null; ro?.observe(footerBar);
  window.addEventListener("resize", syncFooter); window.addEventListener("orientationchange", syncFooter); tg?.onEvent?.("viewportChanged", syncFooter);

  function preload(){ gifts.forEach(g=>{ const i=new Image(); i.src=STATIC_PATH+g.file; }); }

  // === ФИКС ЦЕНТРОВКИ: учитываем padding-left у .roulette ===
  function metrics(){
    const s = roulette.querySelector(".roulette-item");
    const cw = rouletteContainer.clientWidth;
    if(!s) return { w:0, full:0, ml:0, cw, padL:0 };
    const r = s.getBoundingClientRect();
    const cs = getComputedStyle(s);
    const ml = parseFloat(cs.marginLeft)||0;
    const mr = parseFloat(cs.marginRight)||0;
    const w  = r.width;
    const full = w + ml + mr;

    const padL = parseFloat(getComputedStyle(roulette).paddingLeft)||0; // <— ВАЖНО

    return { w, full, ml, cw, padL };
  }

  function xFor(i){
    const { w, full, ml, cw, padL } = metrics();
    // центр тайла = padL + ml + i*full + w/2
    return (padL + ml + i*full + w/2) - cw/2;
  }

  function onEnd(el){ return new Promise(res=>{ const fn=()=>{ el.removeEventListener("transitionend",fn,true); res();}; el.addEventListener("transitionend",fn,true); }); }
  function curX(el){ const tr=getComputedStyle(el).transform; if(!tr||tr==="none") return 0; const m=tr.startsWith("matrix3d(")?tr.slice(9,-1).split(","):tr.slice(7,-1).split(","); return parseFloat(m[m.length===16?12:4])||0; }

  function idxUnder(){
    const { w, full, ml, cw, padL } = metrics();
    const x = Math.abs(curX(roulette));
    const center = x + cw/2;
    const i = (center - padL - ml - w/2) / full;   // <— вычитаем padL
    return Math.max(0, Math.round(i));
  }
  // =========================================================

  function idleStart(){ if(idleRAF||isSpinning||!slider.classList.contains("is-open")) return; idleLast=performance.now(); const loopW=metrics().full*gifts.length; const step=(ts)=>{ const dt=Math.min(100,ts-idleLast)/1000; idleLast=ts; idleOffset+=IDLE_SPEED*dt; roulette.style.transition="none"; roulette.style.transform=`translateX(-${(idleOffset%loopW)}px)`; idleRAF=requestAnimationFrame(step); }; idleRAF=requestAnimationFrame(step); }
  function idleStop(){ if(idleRAF){ cancelAnimationFrame(idleRAF); idleRAF=null; } }

  function img(g){ const i=document.createElement("img"); i.src=STATIC_PATH+g.file; i.alt=g.name; i.width=100; i.height=100; i.loading="lazy"; i.decoding="async"; return i; }
  function fillGallery(){ gallery.innerHTML=""; gifts.forEach(g=>{ const d=document.createElement("div"); d.appendChild(img(g)); gallery.appendChild(d); }); }
  function fillRoulette(){ roulette.innerHTML=""; for(let i=0;i<gifts.length*LOOP_COUNT;i++){ const g=gifts[i%gifts.length]; const d=document.createElement("div"); d.className="roulette-item"; d.appendChild(img(g)); roulette.appendChild(d); } roulette.style.transition="none"; roulette.style.transform="translateX(0px)"; void roulette.offsetHeight; roulette.style.transition=""; idleOffset=0; }

  function openSlider(){ slider.classList.add("is-open"); document.body.classList.add("no-scroll"); if(!roulette.hasChildNodes()) fillRoulette(); if(lastCenteredIndex!=null){ roulette.style.transition="none"; const base=CYCLES_BEFORE_STOP*gifts.length+lastCenteredIndex; roulette.style.transform=`translateX(-${Math.max(0,xFor(base))}px)`; void roulette.offsetHeight; roulette.style.transition=""; } syncFooter(); idleStart(); }
  function closeSlider(){ slider.classList.remove("is-open"); document.body.classList.remove("no-scroll"); idleStop(); }

  vipCase.addEventListener("click", openSlider);
  closeBtn.addEventListener("click", closeSlider);
  sliderBackdrop.addEventListener("click", closeSlider);
  document.addEventListener("keydown",(e)=>{ if(e.key==="Escape" && slider.classList.contains("is-open")) closeSlider(); });

  function openResult({name,imgSrc,amount=0}){ resultImg.src=imgSrc; resultImg.alt=name; resultName.textContent=name; resultAmount.textContent=`+${amount}`; resultOverlay.classList.add("is-open"); resultOverlay.setAttribute("aria-hidden","false"); idleStop(); }
  function closeResult(){ resultOverlay.classList.remove("is-open"); resultOverlay.setAttribute("aria-hidden","true"); if(slider.classList.contains("is-open")) idleStart(); }
  resultOk.addEventListener("click", closeResult);
  resultOverlay.addEventListener("click",(e)=>{ if(e.target===resultOverlay) closeResult(); });

  spinBtn.addEventListener("pointerdown", ()=>H.impact("medium"));
  spinBtn.addEventListener("touchstart", ()=>H.impact("medium"), { passive:true });

  function rouletteTicks(){ let raf=null,last=-1,lastTs=0; const MIN=70; const loop=(ts)=>{ const i=idxUnder(); if(i!==last && ts-lastTs>MIN){ last=i; lastTs=ts; H.tick(); } raf=requestAnimationFrame(loop); }; raf=requestAnimationFrame(loop); return ()=>{ if(raf) cancelAnimationFrame(raf); }; }

  async function handleSpin(){
    if(isSpinning) return; isSpinning=true; spinBtn.disabled=true;
    try{
      idleStop();
      const res=await fetch("/api/case/vip",{ method:"POST", headers:{ "Content-Type":"application/json" }, body:JSON.stringify({ userId:"user123" }) });
      const data=await res.json(); if(!data.ok) throw new Error(data.error||"Server error");

      const { prize, prizeIndex:serverIdx } = data;
      let prizeIndex = typeof serverIdx==="number" ? serverIdx : gifts.findIndex(g=>g.name===prize);
      if(prizeIndex<0) throw new Error("Приз не найден на клиенте");

      const target = CYCLES_BEFORE_STOP*gifts.length + prizeIndex; lastCenteredIndex=prizeIndex;

      roulette.style.transition="none"; roulette.style.transform="translateX(0px)"; void roulette.offsetHeight;
      const t=xFor(target); const stopTicks=rouletteTicks();
      roulette.style.transition=""; roulette.style.transform=`translateX(-${Math.max(0,t)}px)`;
      await onEnd(roulette);
      stopTicks(); H.winBurst1sFast();

      roulette.style.transition="none"; roulette.style.transform=`translateX(-${Math.max(0, xFor(target))}px)`; void roulette.offsetHeight; roulette.style.transition="";

      const g=gifts[prizeIndex];
      openResult({ name:g?.name||prize, imgSrc: STATIC_PATH+(g?.file||""), amount:0 });
    }catch(err){ console.error(err); H.notify("error"); alert("Ошибка: "+err.message); idleStart(); }
    finally{ isSpinning=false; spinBtn.disabled=false; }
  }
  spinBtn.addEventListener("click", handleSpin);

  preload(); fillGallery(); syncFooter();
});
