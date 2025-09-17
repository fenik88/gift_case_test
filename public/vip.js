// filepath: public/vip.js
document.addEventListener("DOMContentLoaded", () => {
  // ----- DOM
  const vipCase = document.getElementById("vip-case");
  const slider = document.getElementById("slider");
  const sliderBackdrop = document.getElementById("sliderBackdrop");
  const closeBtn = document.getElementById("closeBtn");
  const roulette = document.getElementById("roulette");
  const rouletteContainer = document.getElementById("rouletteContainer");
  const footerBar = document.getElementById("footer-bar");
  const spinBtn = document.getElementById("spinBtn");
  const sliderContent = document.getElementById("sliderContent");
  const gallery = document.getElementById("gallery");

  // Result overlay
  const resultOverlay = document.getElementById("resultOverlay");
  const resultSheet = document.getElementById("resultSheet");
  const sheetHandle = document.getElementById("sheetHandle");
  const resultOk = document.getElementById("resultOk");
  const resultImg = document.getElementById("resultImg");
  const resultName = document.getElementById("resultName");
  const resultAmount = document.getElementById("resultAmount");

  // Telegram
  const tg = window.Telegram?.WebApp;
  tg?.ready?.();

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

  // Idle spin state
  let idleRAF = null;
  let idleLastTs = 0;
  let idleOffset = 0;        // px пройдено
  const IDLE_SPEED = 22;     // px/сек — медленно

  // ===== HAPTICS (у тебя уже есть версия — оставляю короткую)
  const PLATFORM = tg?.platform || "web";
  const SUPPORTS_TG_HAPTICS = !!tg?.HapticFeedback && (PLATFORM === "ios" || PLATFORM === "android");
  function hapticImpact(style="light"){
    try{ if (SUPPORTS_TG_HAPTICS) tg.HapticFeedback.impactOccurred(style); }catch{}
  }

  // ----- Utils
  function preloadImages(list){ list.forEach(g=>{ const i=new Image(); i.src=STATIC_PATH+g.file; }); }

  function getMetrics(){
    const sample = roulette.querySelector(".roulette-item");
    if (!sample) return { itemInnerW:0, itemFullW:0, firstLeftMargin:0, contW:rouletteContainer.clientWidth };
    const rect = sample.getBoundingClientRect();
    const cs = getComputedStyle(sample);
    const ml = parseFloat(cs.marginLeft)||0;
    const mr = parseFloat(cs.marginRight)||0;
    const itemInnerW = rect.width;
    const itemFullW  = rect.width + ml + mr;
    const contW = rouletteContainer.clientWidth;
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

  // ===== Idle slow spin (автопролистывание)
  function startIdleSpin(){
    if (idleRAF || isSpinning || !slider.classList.contains("is-open")) return;
    idleLastTs = performance.now();
    const loopWidth = getMetrics().itemFullW * gifts.length; // период узора
    const step = (ts)=>{
      const dt = Math.min(100, ts - idleLastTs) / 1000; // s
      idleLastTs = ts;
      idleOffset += IDLE_SPEED * dt;
      // модуль по длине одного цикла
      const t = (idleOffset % loopWidth);
      roulette.style.transition = "none";
      roulette.style.transform = `translateX(-${t}px)`;
      idleRAF = requestAnimationFrame(step);
    };
    idleRAF = requestAnimationFrame(step);
  }
  function stopIdleSpin(){
    if (idleRAF){ cancelAnimationFrame(idleRAF); idleRAF = null; }
  }

  // ----- Fill
  function createImg(gift){
    const img=document.createElement("img");
    img.src=STATIC_PATH+gift.file; img.alt=gift.name;
    img.width=96; img.height=96; img.loading="lazy"; img.decoding="async";
    return img;
  }
  function fillGallery(){
    gallery.innerHTML="";
    gifts.forEach(gift=>{
      const div=document.createElement("div");
      div.appendChild(createImg(gift));
      gallery.appendChild(div);
    });
  }
  function fillRoulette(){
    roulette.innerHTML="";
    for(let i=0;i<gifts.length*LOOP_COUNT;i++){
      const gift = gifts[i % gifts.length];
      const item = document.createElement("div");
      item.classList.add("roulette-item");
      item.appendChild(createImg(gift));
      roulette.appendChild(item);
    }
    roulette.style.transition="none";
    roulette.style.transform="translateX(0px)";
    void roulette.offsetHeight;
    roulette.style.transition="";
    idleOffset = 0; // сбросим автоскролл
  }

  // ----- Modal open/close
  function openSlider(){
    slider.classList.add("is-open");
    document.body.classList.add("no-scroll");
    if (!roulette.hasChildNodes()) fillRoulette();
    // центрируем последнюю позицию если есть
    if (lastCenteredIndex != null) {
      roulette.style.transition = "none";
      const baseIndex = CYCLES_BEFORE_STOP * gifts.length + lastCenteredIndex;
      const t = translateForIndex(baseIndex);
      roulette.style.transform = `translateX(-${Math.max(0, t)}px)`;
      void roulette.offsetHeight;
      roulette.style.transition = "";
    }
    startIdleSpin();
  }
  function closeSlider(){
    slider.classList.remove("is-open");
    document.body.classList.remove("no-scroll");
    stopIdleSpin();
  }

  vipCase.addEventListener("click", openSlider);
  vipCase.addEventListener("keydown", (e)=>{ if(e.key==="Enter"||e.key===" "){ e.preventDefault(); openSlider(); }});
  closeBtn.addEventListener("click", closeSlider);
  sliderBackdrop.addEventListener("click", closeSlider);
  document.addEventListener("keydown", (e)=>{ if(e.key==="Escape" && slider.classList.contains("is-open")) closeSlider(); });

  // ----- Result sheet (минимум)
  function openResult({ name, imgSrc, amount = 0 }){
    resultImg.src = imgSrc;
    resultImg.alt = name;
    resultName.textContent = name;
    resultAmount.textContent = `+${amount}`;
    resultOverlay.classList.add("is-open");
    resultOverlay.setAttribute("aria-hidden","false");
    stopIdleSpin(); // why: не отвлекаем под оверлеем
  }
  function closeResult(){
    resultOverlay.classList.remove("is-open");
    resultOverlay.setAttribute("aria-hidden","true");
    // если слайдер открыт — снова медленно крутим
    if (slider.classList.contains("is-open")) startIdleSpin();
  }
  resultOk.addEventListener("click", closeResult);
  resultOverlay.addEventListener("click",(e)=>{ if(e.target===resultOverlay) closeResult(); });

  // ----- Haptic on press "Открыть"
  spinBtn.addEventListener("pointerdown", ()=>hapticImpact("medium"));
  spinBtn.addEventListener("touchstart", ()=>hapticImpact("medium"), { passive:true });

  // ----- Spin
  function startRouletteTicks(){
    let rafId=null, lastIdx=-1, lastTs=0;
    const MIN_INTERVAL_MS=70;
    const loop=(ts)=>{
      const idx=indexUnderMarker();
      if(idx!==lastIdx && ts-lastTs>MIN_INTERVAL_MS){
        lastIdx=idx; lastTs=ts;
        hapticImpact("soft"); // лёгкий тик
      }
      rafId=requestAnimationFrame(loop);
    };
    rafId=requestAnimationFrame(loop);
    return ()=>{ if(rafId) cancelAnimationFrame(rafId); };
  }

  async function handleSpin(){
    if (isSpinning) return;
    isSpinning = true;
    spinBtn.disabled = true;

    try{
      stopIdleSpin(); // стопим автоскролл перед настоящим спином

      const res = await fetch("/api/case/vip", {
        method:"POST",
        headers:{ "Content-Type":"application/json" },
        body: JSON.stringify({ userId: "user123" })
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "Server error");

      const { prize, prizeIndex: serverIndex } = data;
      let prizeIndex = typeof serverIndex === "number" ? serverIndex : gifts.findIndex(g => g.name === prize);
      if (prizeIndex < 0) throw new Error("Приз не найден на клиенте");

      const targetIndex = CYCLES_BEFORE_STOP * gifts.length + prizeIndex;
      lastCenteredIndex = prizeIndex;

      roulette.style.transition="none";
      roulette.style.transform="translateX(0px)";
      void roulette.offsetHeight;

      const t = translateForIndex(targetIndex);

      const stopTicks = startRouletteTicks();
      roulette.style.transition = ""; // CSS
      roulette.style.transform = `translateX(-${Math.max(0, t)}px)`;

      await waitTransitionEnd(roulette);

      stopTicks();
      hapticImpact("heavy");

      // фикс позиции
      roulette.style.transition="none";
      roulette.style.transform=`translateX(-${Math.max(0, translateForIndex(targetIndex))}px)`;
      void roulette.offsetHeight; roulette.style.transition="";

      const giftMeta = gifts[prizeIndex];
      openResult({
        name: giftMeta?.name || prize,
        imgSrc: STATIC_PATH + (giftMeta?.file || ""),
        amount: 0
      });
    }catch(err){
      console.error(err);
      alert("Ошибка: " + err.message);
      // если ошибка — вернуть автоскролл
      startIdleSpin();
    }finally{
      isSpinning = false;
      spinBtn.disabled = false;
    }
  }
  spinBtn.addEventListener("click", handleSpin);

  // ----- Init
  preloadImages(gifts);
  fillGallery();
});
