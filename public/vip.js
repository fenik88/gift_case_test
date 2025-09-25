// filepath: public/vip.js
// Таб-бар с SVG и текущая логика рулетки/вибраций. Убраны только дубли переменных (why: исключить redeclaration).
document.addEventListener("DOMContentLoaded", () => {
  // ----- Tabs (SPA)
  const tabbar = document.getElementById("app-tabbar");
  const tabs = {
    cases:   document.getElementById("tab-cases"),
    upgrade: document.getElementById("tab-upgrade"),
    profile: document.getElementById("tab-profile"),
  };
  const btns = {
    cases:   document.getElementById("btn-tab-cases"),
    upgrade: document.getElementById("btn-tab-upgrade"),
    profile: document.getElementById("btn-tab-profile"),
  };
  function setActiveTab(name){
    Object.entries(tabs).forEach(([k, el]) => {
      const active = k === name;
      el.classList.toggle("is-active", active);
      el.setAttribute("aria-hidden", active ? "false" : "true");
    });
    Object.entries(btns).forEach(([k, b]) => {
      const active = k === name;
      b.classList.toggle("is-active", active);
      b.setAttribute("aria-selected", active ? "true" : "false");
    });
    if (location.hash !== `#${name}`) history.replaceState(null, "", `#${name}`);
  }

  function pickInitialTab(){ const h=(location.hash||"#cases").slice(1); setActiveTab(tabs[h]?h:"cases"); }
  btns.cases.addEventListener("click", () => setActiveTab("cases"));
  btns.upgrade.addEventListener("click", () => setActiveTab("upgrade"));
  btns.profile.addEventListener("click", () => setActiveTab("profile"));
  window.addEventListener("hashchange", pickInitialTab);

function syncTabbar(){
    if(!tabbar) return;
    const h = Math.round(tabbar.getBoundingClientRect().height) || 64;
    document.documentElement.style.setProperty("--tabbar-offset", `${h}px`);
  }
  const roTab = ("ResizeObserver" in window) ? new ResizeObserver(() => requestAnimationFrame(syncTabbar)) : null;
  roTab?.observe(tabbar);
  window.addEventListener("resize", () => requestAnimationFrame(syncTabbar));
  window.addEventListener("orientationchange", () => requestAnimationFrame(syncTabbar));
  window.addEventListener("load", () => {
    // двойной rAF + таймаут — чтобы поймать обновление safe-area в Telegram
    requestAnimationFrame(() => {
      syncTabbar();
      requestAnimationFrame(() => {
        setTimeout(syncTabbar, 50);
      });
    });
  });
  if (window.Telegram?.WebApp?.onEvent) {
    window.Telegram.WebApp.onEvent("viewportChanged", () => requestAnimationFrame(syncTabbar));
  }
  pickInitialTab();
  requestAnimationFrame(syncTabbar);

  // ====== Текущая логика рулетки ======
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

  // Telegram + haptics
  const tg = window.Telegram?.WebApp; tg?.ready?.(); tg?.expand?.();
  const PLATFORM = tg?.platform || "web";
  const SUPPORTS_TG_HAPTICS = !!tg?.HapticFeedback && (PLATFORM === "ios" || PLATFORM === "android");
  function primeHapticsOnce(){ try{ tg?.HapticFeedback?.impactOccurred?.("light"); }catch{} if(!SUPPORTS_TG_HAPTICS && "vibrate" in navigator) navigator.vibrate(8); }
  document.addEventListener("touchstart", primeHapticsOnce, { once:true, passive:true });
  document.addEventListener("mousedown", primeHapticsOnce, { once:true });

  const H = {
    _timers: [],
    _after(ms, fn){ const id=setTimeout(fn,ms); this._timers.push(id); },
    _clear(){ this._timers.forEach(clearTimeout); this._timers=[]; },
    impact(style="light"){ try{ if(SUPPORTS_TG_HAPTICS) tg.HapticFeedback.impactOccurred(style);}catch{} if(!SUPPORTS_TG_HAPTICS && "vibrate" in navigator) navigator.vibrate(style==="heavy"?25:12); },
    notify(type="success"){ try{ if(SUPPORTS_TG_HAPTICS) tg.HapticFeedback.notificationOccurred(type);}catch{} if(!SUPPORTS_TG_HAPTICS && "vibrate" in navigator) navigator.vibrate(type==="error" ? [20,40,60] : [10,40,10]); },
    tick(){ try{ if(SUPPORTS_TG_HAPTICS) tg.HapticFeedback.impactOccurred("light"); }catch{} if(!SUPPORTS_TG_HAPTICS && "vibrate" in navigator) navigator.vibrate(8); },
    winBurst1sFast(){
      this._clear(); const TOTAL_MS=500;
      if(SUPPORTS_TG_HAPTICS){
        const STEP=15; let t=0; try{ tg.HapticFeedback.notificationOccurred("success"); }catch{}
        const pulse=()=>{ try{ tg.HapticFeedback.impactOccurred("rigid"); }catch{} t+=STEP; if(t<TOTAL_MS) this._after(STEP,pulse); };
        this._after(STEP,pulse); this._after(TOTAL_MS+40,()=>this._clear());
      } else if("vibrate" in navigator){
        const ON=8,OFF=4,pattern=[]; let s=0; while(s<TOTAL_MS){ pattern.push(ON); s+=ON; if(s>=TOTAL_MS)break; pattern.push(OFF); s+=OFF; }
        navigator.vibrate(pattern);
      }
    }
  };

  // Const/state
  const STATIC_PATH="/static_webp/", LOOP_COUNT=24, CYCLES_BEFORE_STOP=6;
  const gifts=[{name:"Plush Pepe",file:"plush_pepe.webp"},{name:"Heart Locket",file:"heart_locket.webp"},{name:"Durov's Cap",file:"cap.webp"},{name:"Peach",file:"peach.webp"},{name:"Heroic Helmet",file:"helmet.webp"},{name:"Perfume",file:"perfume.webp"},{name:"Venom",file:"venom.webp"},{name:"Bonded Ring",file:"bonded_ring.webp"},{name:"Scared Cat",file:"cat.webp"},{name:"Signet Ring",file:"signet_ring.webp"}];
  let isSpinning=false, lastCenteredIndex=null;
  let idleRAF=null, idleLastTs=0, idleOffset=0; const IDLE_SPEED=22;

  // Footer pad
  function syncFooter(){ const h=footerBar?.offsetHeight||96; document.documentElement.style.setProperty("--footer-h",`${h}px`); if(sliderContent) sliderContent.style.paddingBottom=`calc(${h}px + 16px)`; }
  const ro=("ResizeObserver" in window)? new ResizeObserver(syncFooter):null; ro?.observe(footerBar);
  window.addEventListener("resize", syncFooter); window.addEventListener("orientationchange", syncFooter);
  tg?.onEvent?.("viewportChanged", syncFooter);

  // Metrics & helpers
  function preloadImages(list){ list.forEach(g=>{ const i=new Image(); i.src=STATIC_PATH+g.file; }); }
  function getMetrics(){
    const sample=roulette.querySelector(".roulette-item");
    const cw=rouletteContainer.clientWidth;
    if(!sample) return { w:0, full:0, ml:0, cw, padL:0 };
    const rect=sample.getBoundingClientRect();
    const cs=getComputedStyle(sample);
    const ml=parseFloat(cs.marginLeft)||0;
    const mr=parseFloat(cs.marginRight)||0;
    const w=rect.width;
    const full=w+ml+mr;
    const padL=parseFloat(getComputedStyle(roulette).paddingLeft)||0;
    return { w, full, ml, cw, padL };
  }
  function translateForIndex(index){
    const { w, full, ml, cw, padL }=getMetrics();
    const centerFromStart=padL + ml + index*full + w/2;
    return centerFromStart - cw/2;
  }
  function readTranslateXPx(el){
    const tr=getComputedStyle(el).transform;
    if(!tr || tr==="none") return 0;
    const m=tr.startsWith("matrix3d(")? tr.slice(9,-1).split(","): tr.slice(7,-1).split(",");
    return parseFloat(m[m.length===16?12:4])||0;
  }
  function idxUnderByX(x){
    const { w, full, ml, cw, padL }=getMetrics();
    const centerCoord=x + cw/2;
    const idxFloat=(centerCoord - padL - ml - w/2)/full;
    return Math.max(0, Math.round(idxFloat));
  }

  // Idle spin
  function startIdleSpin(){
    if(idleRAF || isSpinning || !slider.classList.contains("is-open")) return;
    idleLastTs=performance.now();
    const loopWidth=getMetrics().full * gifts.length;
    const step=(ts)=>{
      const dt=Math.min(100, ts-idleLastTs)/1000;
      idleLastTs=ts; idleOffset+=IDLE_SPEED*dt;
      roulette.style.transition="none";
      roulette.style.transform=`translateX(-${(idleOffset%loopWidth)}px)`;
      idleRAF=requestAnimationFrame(step);
    };
    idleRAF=requestAnimationFrame(step);
  }
  function stopIdleSpin(){ if(idleRAF){ cancelAnimationFrame(idleRAF); idleRAF=null; } }

  // Easing (одно непрерывное движение)
  const easeOutCubic = t => 1 - Math.pow(1 - t, 3);
  const easeOutExpo  = t => (t===1)?1:1 - Math.pow(2, -10*t);
  const smoothstep   = (a,b,x)=>{ const t=Math.min(1,Math.max(0,(x-a)/(b-a))); return t*t*(3-2*t); };
  function easeOutHybrid(t){ const s=smoothstep(0.45,0.85,t); return easeOutCubic(t)*(1-s) + easeOutExpo(t)*s; }

  function animateHybridTo(endX, durationMs){
    return new Promise(resolve=>{
      const startX=Math.max(0, Math.abs(readTranslateXPx(roulette)));
      const dist=Math.max(0, endX-startX);
      if(dist<=0.25 || durationMs<=0){ roulette.style.transition="none"; roulette.style.transform=`translateX(-${endX}px)`; resolve(); return; }
      const t0=performance.now(); roulette.style.transition="none";
      let lastTickIdx=idxUnderByX(startX), lastTickTs=t0; const MIN_TICK_MS=70;
      const step=(now)=>{
        let t=(now-t0)/durationMs;
        if(t>=1){ roulette.style.transform=`translateX(-${endX}px)`; const finalIdx=idxUnderByX(endX); if(finalIdx!==lastTickIdx && now-lastTickTs>MIN_TICK_MS){ lastTickIdx=finalIdx; lastTickTs=now; H.tick(); } resolve(); return; }
        t=Math.max(0,Math.min(1,t));
        const x=startX + dist*easeOutHybrid(t);
        roulette.style.transform=`translateX(-${x}px)`;
        const idx=idxUnderByX(x);
        if(idx!==lastTickIdx && now-lastTickTs>MIN_TICK_MS){ lastTickIdx=idx; lastTickTs=now; H.tick(); }
        requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
  }

  // Fill
  function createImg(g){ const img=document.createElement("img"); img.src=STATIC_PATH+g.file; img.alt=g.name; img.width=100; img.height=100; img.loading="lazy"; img.decoding="async"; return img; }
  function fillGallery(){ gallery.innerHTML=""; gifts.forEach(g=>{ const d=document.createElement("div"); d.appendChild(createImg(g)); gallery.appendChild(d); }); }
  function fillRoulette(){
    roulette.innerHTML="";
    for(let i=0;i<gifts.length*LOOP_COUNT;i++){ const g=gifts[i%gifts.length]; const it=document.createElement("div"); it.className="roulette-item"; it.appendChild(createImg(g)); roulette.appendChild(it); }
    roulette.style.transition="none"; roulette.style.transform="translateX(0px)"; idleOffset=0;
  }

  // Modal
  function openSlider(){
    const sliderEl=document.getElementById("slider");
    sliderEl.classList.add("is-open"); document.body.classList.add("no-scroll");
    if(!roulette.hasChildNodes()) fillRoulette();
    if(lastCenteredIndex!=null){
      roulette.style.transition="none";
      const baseIndex=CYCLES_BEFORE_STOP*gifts.length + lastCenteredIndex;
      roulette.style.transform=`translateX(-${Math.max(0, translateForIndex(baseIndex))}px)`;
    }
    syncFooter(); startIdleSpin();
  }
  function closeSlider(){ slider.classList.remove("is-open"); document.body.classList.remove("no-scroll"); stopIdleSpin(); }
  vipCase.addEventListener("click", openSlider);
  closeBtn.addEventListener("click", closeSlider);
  sliderBackdrop.addEventListener("click", closeSlider);
  document.addEventListener("keydown",(e)=>{ if(e.key==="Escape" && slider.classList.contains("is-open")) closeSlider(); });

  // Result
  function openResult({ name, imgSrc, amount = 0 }){
    resultImg.src=imgSrc; resultImg.alt=name; resultName.textContent=name; resultAmount.textContent=`+${amount}`;
    resultOverlay.classList.add("is-open"); resultOverlay.setAttribute("aria-hidden","false"); stopIdleSpin();
  }
  function closeResult(){ resultOverlay.classList.remove("is-open"); resultOverlay.setAttribute("aria-hidden","true"); if(slider.classList.contains("is-open")) startIdleSpin(); }
  resultOk.addEventListener("click", closeResult);
  resultOverlay.addEventListener("click",(e)=>{ if(e.target===resultOverlay) closeResult(); });

  // Haptics on press
  spinBtn.addEventListener("pointerdown", () => H.impact("medium"));
  spinBtn.addEventListener("touchstart", () => H.impact("medium"), { passive:true });

  btns.cases.addEventListener("pointerdown", () => H.impact("medium"));
  btns.cases.addEventListener("touchstart", () => H.impact("medium"), { passive: true });

  btns.upgrade.addEventListener("pointerdown", () => H.impact("medium"));
  btns.upgrade.addEventListener("touchstart", () => H.impact("medium"), { passive: true });

  btns.profile.addEventListener("pointerdown", () => H.impact("medium"));
  btns.profile.addEventListener("touchstart", () => H.impact("medium"), { passive: true });

  vipCase.addEventListener("pointerdown", () => H.impact("medium"));
  vipCase.addEventListener("touchstart", () => H.impact("medium"), { passive: true });

    closeBtn.addEventListener("pointerdown", () => H.impact("medium"));
    closeBtn.addEventListener("touchstart", () => H.impact("medium"), { passive: true });

  // Spin
  async function handleSpin(){
    if(isSpinning) return; isSpinning=true; spinBtn.disabled=true;
    try{
      stopIdleSpin();
      const res=await fetch("/api/case/vip",{ method:"POST", headers:{ "Content-Type":"application/json" }, body:JSON.stringify({ userId:"user123" }) });
      const data=await res.json(); if(!data.ok) throw new Error(data.error||"Server error");

      const { prize, prizeIndex: serverIndex } = data;
      let prizeIndex = typeof serverIndex==="number" ? serverIndex : gifts.findIndex(g=>g.name===prize);
      if(prizeIndex<0) throw new Error("Приз не найден на клиенте");

      const targetIndex=CYCLES_BEFORE_STOP*gifts.length + prizeIndex;
      lastCenteredIndex=prizeIndex;

      const targetX=Math.max(0, translateForIndex(targetIndex));
      const startX=Math.max(0, Math.abs(readTranslateXPx(roulette)));
      const dist=Math.max(0, targetX-startX);

      const Vavg=1500; // px/s
      const duration=Math.min(5200, Math.max(2800, (dist/Vavg)*1000));

      await animateHybridTo(targetX, duration);
      H.winBurst1sFast();

      const meta=gifts[prizeIndex];
      openResult({ name: meta?.name || prize, imgSrc: STATIC_PATH + (meta?.file || ""), amount: 0 });
    }catch(err){
      console.error(err); H.notify("error"); alert("Ошибка: " + err.message); startIdleSpin();
    }finally{
      isSpinning=false; spinBtn.disabled=false;
    }
  }
  spinBtn.addEventListener("click", handleSpin);

  // Init
  preloadImages(gifts); fillGallery(); syncFooter();
});
