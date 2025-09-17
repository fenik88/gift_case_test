// filepath: public/vip.js
document.addEventListener("DOMContentLoaded", () => {
  // ----- DOM
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
  const resultSheet = document.getElementById("resultSheet");
  const resultOk = document.getElementById("resultOk");
  const resultImg = document.getElementById("resultImg");
  const resultName = document.getElementById("resultName");
  const resultAmount = document.getElementById("resultAmount");

  // ----- Telegram
  const tg = window.Telegram?.WebApp;
  tg?.ready?.();

  // ----- HAPTICS (как в прошлой версии)
  const PLATFORM = tg?.platform || "web";
  const SUPPORTS_TG_HAPTICS = !!tg?.HapticFeedback && (PLATFORM === "ios" || PLATFORM === "android");

  // why: iOS требует первый жест для активации тактильной отдачи
  function primeHapticsOnce() {
    try { tg?.HapticFeedback?.impactOccurred?.("light"); } catch {}
    if (!SUPPORTS_TG_HAPTICS && "vibrate" in navigator) navigator.vibrate(8);
  }
  document.addEventListener("touchstart", primeHapticsOnce, { once: true, passive: true });
  document.addEventListener("mousedown", primeHapticsOnce, { once: true });

  const H = {
    _timers: [],
    _after(ms, fn) { const id = setTimeout(fn, ms); this._timers.push(id); },
    _clear() { this._timers.forEach(clearTimeout); this._timers = []; },

    impact(style = "light") {
      try { if (SUPPORTS_TG_HAPTICS) tg.HapticFeedback.impactOccurred(style); } catch {}
      if (!SUPPORTS_TG_HAPTICS && "vibrate" in navigator) navigator.vibrate(style === "heavy" ? 25 : 12);
    },
    notify(type = "success") {
      try { if (SUPPORTS_TG_HAPTICS) tg.HapticFeedback.notificationOccurred(type); } catch {}
      if (!SUPPORTS_TG_HAPTICS && "vibrate" in navigator) navigator.vibrate(type === "error" ? [20,40,60] : [10,40,10]);
    },
    tick() {
      try { if (SUPPORTS_TG_HAPTICS) tg.HapticFeedback.impactOccurred("light"); } catch {}
      if (!SUPPORTS_TG_HAPTICS && "vibrate" in navigator) navigator.vibrate(8);
    },
    // ⚡ Быстрый бурст: ~1s, импульс каждые ~30мс (fallback: 12/8мс ON/OFF)
    winBurst1sFast() {
      this._clear();
      const TOTAL_MS = 500;
      if (SUPPORTS_TG_HAPTICS) {
        const STEP = 15;
        let elapsed = 0;
        try { tg.HapticFeedback.notificationOccurred("success"); } catch {}
        const pulse = () => {
          try { tg.HapticFeedback.impactOccurred("rigid"); } catch {}
          elapsed += STEP;
          if (elapsed < TOTAL_MS) this._after(STEP, pulse);
        };
        this._after(STEP, pulse);
        this._after(TOTAL_MS + 40, () => this._clear());
      } else if ("vibrate" in navigator) {
        const ON = 8, OFF = 4;
        const pattern = [];
        let sum = 0;
        while (sum < TOTAL_MS) { pattern.push(ON); sum += ON; if (sum >= TOTAL_MS) break; pattern.push(OFF); sum += OFF; }
        navigator.vibrate(pattern);
      }
    }
  };

  // ----- Const
  const STATIC_PATH = "/static_webp/";
  const LOOP_COUNT = 24;
  const CYCLES_BEFORE_STOP = 6;

  const gifts = [
    { name: "Plush Pepe", file: "plush_pepe.webp" },
    { name: "Heart Locket", file: "heart_locket.webp" },
    { name: "Durov's Cap", file: "cap.webp" },
    { name: "Peach", file: "peach.webp" },
    { name: "Heroic Helmet", file: "helmet.webp" },
    { name: "Perfume", file: "perfume.webp" },
    { name: "Venom", file: "venom.webp" },
    { name: "Bonded Ring", file: "bonded_ring.webp" },
    { name: "Scared Cat", file: "cat.webp" },
    { name: "Signet Ring", file: "signet_ring.webp" }
  ];

  // ----- State
  let isSpinning = false;
  let lastCenteredIndex = null;

  // Idle spin
  let idleRAF = null, idleLastTs = 0, idleOffset = 0;
  const IDLE_SPEED = 22; // px/s

  // ----- Footer pad (фиксированный footer не перекрывает контент)
  function syncFooter() {
    const h = footerBar?.offsetHeight || 96;
    document.documentElement.style.setProperty("--footer-h", `${h}px`);
    if (sliderContent) sliderContent.style.paddingBottom = `calc(${h}px + 16px)`;
  }
  const ro = ("ResizeObserver" in window) ? new ResizeObserver(syncFooter) : null;
  ro?.observe(footerBar);
  window.addEventListener("resize", syncFooter);
  window.addEventListener("orientationchange", syncFooter);
  tg?.onEvent?.("viewportChanged", syncFooter);

  // ----- Utils
  function preloadImages(list){ list.forEach(g=>{ const i=new Image(); i.src=STATIC_PATH+g.file; }); }
  function getMetrics(){
    const sample = roulette.querySelector(".roulette-item");
    if (!sample) return { itemInnerW:0,itemFullW:0,firstLeftMargin:0,contW:rouletteContainer.clientWidth };
    const rect = sample.getBoundingClientRect();
    const cs = getComputedStyle(sample);
    const ml = parseFloat(cs.marginLeft)||0, mr = parseFloat(cs.marginRight)||0;
    const itemInnerW = rect.width, itemFullW = rect.width + ml + mr, contW = rouletteContainer.clientWidth;
    return { itemInnerW, itemFullW, firstLeftMargin: ml, contW };
  }
  function translateForIndex(index){
    const { itemInnerW, itemFullW, firstLeftMargin, contW } = getMetrics();
    const itemCenterFromStart = firstLeftMargin + index*itemFullW + itemInnerW/2;
    return itemCenterFromStart - contW/2;
  }
  function waitTransitionEnd(el){
    return new Promise((resolve)=>{
      const done=()=>{ el.removeEventListener("transitionend",done,true); resolve(); };
      el.addEventListener("transitionend",done,true);
    });
  }
  function readTranslateXPx(el){
    const tr = getComputedStyle(el).transform;
    if (!tr || tr==="none") return 0;
    const m = tr.startsWith("matrix3d(") ? tr.slice(9,-1).split(",") : tr.slice(7,-1).split(",");
    return parseFloat(m[m.length===16?12:4])||0;
  }
  function indexUnderMarker(){
    const { itemInnerW, itemFullW, firstLeftMargin, contW } = getMetrics();
    const x = Math.abs(readTranslateXPx(roulette));
    const centerCoord = x + contW/2;
    const idxFloat = (centerCoord - firstLeftMargin - itemInnerW/2) / itemFullW;
    return Math.max(0, Math.round(idxFloat));
  }

  // ----- Idle spin
  function startIdleSpin(){
    if (idleRAF || isSpinning || !slider.classList.contains("is-open")) return;
    idleLastTs = performance.now();
    const loopWidth = getMetrics().itemFullW * gifts.length;
    const step=(ts)=>{
      const dt = Math.min(100, ts - idleLastTs) / 1000;
      idleLastTs = ts; idleOffset += IDLE_SPEED * dt;
      const t = (idleOffset % loopWidth);
      roulette.style.transition="none";
      roulette.style.transform=`translateX(-${t}px)`;
      idleRAF = requestAnimationFrame(step);
    };
    idleRAF = requestAnimationFrame(step);
  }
  function stopIdleSpin(){ if(idleRAF){ cancelAnimationFrame(idleRAF); idleRAF=null; } }

  // ----- Fill
  function createImg(gift){
    const img=document.createElement("img");
    img.src=STATIC_PATH+gift.file; img.alt=gift.name;
    img.width=100; img.height=100; img.loading="lazy"; img.decoding="async";
    return img;
  }
  function fillGallery(){
    gallery.innerHTML="";
    gifts.forEach(g=>{ const d=document.createElement("div"); d.appendChild(createImg(g)); gallery.appendChild(d); });
  }
  function fillRoulette(){
    roulette.innerHTML="";
    for(let i=0;i<gifts.length*LOOP_COUNT;i++){
      const g=gifts[i%gifts.length];
      const it=document.createElement("div"); it.className="roulette-item"; it.appendChild(createImg(g));
      roulette.appendChild(it);
    }
    roulette.style.transition="none"; roulette.style.transform="translateX(0px)"; void roulette.offsetHeight; roulette.style.transition="";
    idleOffset = 0;
  }

  // ----- Modal
  function openSlider(){
    slider.classList.add("is-open"); document.body.classList.add("no-scroll");
    if(!roulette.hasChildNodes()) fillRoulette();
    if(lastCenteredIndex!=null){
      roulette.style.transition="none";
      const baseIndex=CYCLES_BEFORE_STOP*gifts.length + lastCenteredIndex;
      roulette.style.transform=`translateX(-${Math.max(0, translateForIndex(baseIndex))}px)`;
      void roulette.offsetHeight; roulette.style.transition="";
    }
    syncFooter();
    startIdleSpin();
  }
  function closeSlider(){ slider.classList.remove("is-open"); document.body.classList.remove("no-scroll"); stopIdleSpin(); }

  vipCase.addEventListener("click", openSlider);
  closeBtn.addEventListener("click", closeSlider);
  sliderBackdrop.addEventListener("click", closeSlider);
  document.addEventListener("keydown",(e)=>{ if(e.key==="Escape" && slider.classList.contains("is-open")) closeSlider(); });

  // ----- Result
  function openResult({ name, imgSrc, amount = 0 }){
    resultImg.src=imgSrc; resultImg.alt=name;
    resultName.textContent=name; resultAmount.textContent=`+${amount}`;
    resultOverlay.classList.add("is-open"); resultOverlay.setAttribute("aria-hidden","false");
    stopIdleSpin();
  }
  function closeResult(){
    resultOverlay.classList.remove("is-open"); resultOverlay.setAttribute("aria-hidden","true");
    if (slider.classList.contains("is-open")) startIdleSpin();
  }
  resultOk.addEventListener("click", closeResult);
  resultOverlay.addEventListener("click",(e)=>{ if(e.target===resultOverlay) closeResult(); });

  // ----- Haptics on press
  spinBtn.addEventListener("pointerdown", () => H.impact("medium"));
  spinBtn.addEventListener("touchstart", () => H.impact("medium"), { passive: true });

  // ----- Spin
  function startRouletteTicks(){
    let rafId=null, lastIdx=-1, lastTs=0; const MIN_MS=70;
    const loop=(ts)=>{
      const idx=indexUnderMarker();
      if(idx!==lastIdx && ts-lastTs>MIN_MS){ lastIdx=idx; lastTs=ts; H.tick(); }
      rafId=requestAnimationFrame(loop);
    };
    rafId=requestAnimationFrame(loop);
    return ()=>{ if(rafId) cancelAnimationFrame(rafId); };
  }

  async function handleSpin(){
    if(isSpinning) return; isSpinning=true; spinBtn.disabled=true;
    try{
      stopIdleSpin();

      const res = await fetch("/api/case/vip", {
        method:"POST", headers:{ "Content-Type":"application/json" },
        body: JSON.stringify({ userId: "user123" })
      });
      const data = await res.json();
      if(!data.ok) throw new Error(data.error || "Server error");

      const { prize, prizeIndex: serverIndex } = data;
      let prizeIndex = typeof serverIndex==="number" ? serverIndex : gifts.findIndex(g=>g.name===prize);
      if(prizeIndex<0) throw new Error("Приз не найден на клиенте");

      const targetIndex = CYCLES_BEFORE_STOP*gifts.length + prizeIndex;
      lastCenteredIndex = prizeIndex;

      roulette.style.transition="none"; roulette.style.transform="translateX(0px)"; void roulette.offsetHeight;

      const t = translateForIndex(targetIndex);
      const stopTicks = startRouletteTicks();

      roulette.style.transition=""; roulette.style.transform=`translateX(-${Math.max(0, t)}px)`;
      await waitTransitionEnd(roulette);

      stopTicks();
      H.winBurst1sFast(); // <<< бурст 1s быстрых импульсов

      roulette.style.transition="none";
      roulette.style.transform=`translateX(-${Math.max(0, translateForIndex(targetIndex))}px)`;
      void roulette.offsetHeight; roulette.style.transition="";

      const meta = gifts[prizeIndex];
      openResult({ name: meta?.name || prize, imgSrc: STATIC_PATH + (meta?.file || ""), amount: 0 });
    }catch(err){
      console.error(err); H.notify("error"); alert("Ошибка: " + err.message); startIdleSpin();
    }finally{
      isSpinning=false; spinBtn.disabled=false;
    }
  }
  spinBtn.addEventListener("click", handleSpin);

  // ----- Init
  preloadImages(gifts);
  fillGallery();
  syncFooter();
});
