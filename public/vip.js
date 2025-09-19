// filepath: public/vip.js
// Одно непрерывное движение: быстро → нормальное замедление → очень медленное затухание (без овершутов/тиков/докруток)
document.addEventListener("DOMContentLoaded", () => {
  // --- DOM
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

  // --- Telegram + haptics (без тиков)
  const tg = window.Telegram?.WebApp; tg?.ready?.();
  const PLATFORM = tg?.platform || "web";
  const SUPPORTS_TG_HAPTICS = !!tg?.HapticFeedback && (PLATFORM === "ios" || PLATFORM === "android");
  function primeHapticsOnce(){ try{ tg?.HapticFeedback?.impactOccurred?.("light"); }catch{} if(!SUPPORTS_TG_HAPTICS && "vibrate" in navigator) navigator.vibrate(8); }
  document.addEventListener("touchstart", primeHapticsOnce, { once:true, passive:true });
  document.addEventListener("mousedown", primeHapticsOnce, { once:true });
  const H = {
    impact(s="light"){ try{ if(SUPPORTS_TG_HAPTICS) tg.HapticFeedback.impactOccurred(s);}catch{} if(!SUPPORTS_TG_HAPTICS && "vibrate" in navigator) navigator.vibrate(s==="heavy"?25:12); },
    notify(t="success"){ try{ if(SUPPORTS_TG_HAPTICS) tg.HapticFeedback.notificationOccurred(t);}catch{} if(!SUPPORTS_TG_HAPTICS && "vibrate" in navigator) navigator.vibrate(t==="error"?[20,40,60]:[10,40,10]); },
    winBurst1sFast(){
      // why: короткий бурст победы без тиков по плиткам
      if(SUPPORTS_TG_HAPTICS){
        try{ tg.HapticFeedback.notificationOccurred("success"); }catch{}
      } else if("vibrate" in navigator){
        navigator.vibrate([40,30,40,30,60]);
      }
    }
  };

  // --- Const
  const STATIC_PATH="/static_webp/";
  const LOOP_COUNT=24, CYCLES_BEFORE_STOP=6;
  const gifts=[
    {name:"Plush Pepe",file:"plush_pepe.webp"},
    {name:"Heart Locket",file:"heart_locket.webp"},
    {name:"Durov's Cap",file:"cap.webp"},
    {name:"Peach",file:"peach.webp"},
    {name:"Heroic Helmet",file:"helmet.webp"},
    {name:"Perfume",file:"perfume.webp"},
    {name:"Venom",file:"venom.webp"},
    {name:"Bonded Ring",file:"bonded_ring.webp"},
    {name:"Scared Cat",file:"cat.webp"},
    {name:"Signet Ring",file:"signet_ring.webp"},
  ];

  // --- State
  let isSpinning=false, lastCenteredIndex=null;
  let idleRAF=null, idleLast=0, idleOffset=0; const IDLE_SPEED=22;

  // --- Footer pad
  function syncFooter(){
    const h=footerBar?.offsetHeight||96;
    document.documentElement.style.setProperty("--footer-h",`${h}px`);
    if(sliderContent) sliderContent.style.paddingBottom=`calc(${h}px + 16px)`;
  }
  const ro=("ResizeObserver" in window)? new ResizeObserver(syncFooter):null;
  ro?.observe(footerBar);
  window.addEventListener("resize", syncFooter);
  window.addEventListener("orientationchange", syncFooter);
  tg?.onEvent?.("viewportChanged", syncFooter);

  // --- Metrics / center (учитываем padding у .roulette)
  function preload(){ gifts.forEach(g=>{ const i=new Image(); i.src=STATIC_PATH+g.file; }); }
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
    const padL = parseFloat(getComputedStyle(roulette).paddingLeft)||0;
    return { w, full, ml, cw, padL };
  }
  function xFor(i){
    const { w, full, ml, cw, padL } = metrics();
    return (padL + ml + i*full + w/2) - cw/2;
  }
  function curX(el){
    const tr=getComputedStyle(el).transform;
    if(!tr||tr==="none") return 0;
    const m = tr.startsWith("matrix3d(")? tr.slice(9,-1).split(",") : tr.slice(7,-1).split(",");
    return parseFloat(m[m.length===16?12:4])||0;
  }

  // --- Idle spin (фоновое плавное движение при открытом слайдере)
  function idleStart(){
    if(idleRAF||isSpinning||!slider.classList.contains("is-open")) return;
    idleLast=performance.now();
    const loopW=metrics().full*gifts.length;
    const step=(ts)=>{
      const dt=Math.min(100,ts-idleLast)/1000;
      idleLast=ts; idleOffset+=IDLE_SPEED*dt;
      roulette.style.transition="none";
      roulette.style.transform=`translateX(-${(idleOffset%loopW)}px)`;
      idleRAF=requestAnimationFrame(step);
    };
    idleRAF=requestAnimationFrame(step);
  }
  function idleStop(){ if(idleRAF){ cancelAnimationFrame(idleRAF); idleRAF=null; } }

  // --- Hybrid easing: непрерывное «быстро → норм → очень медленно»
  const easeOutCubic = t => 1 - Math.pow(1 - t, 3);
  const easeOutExpo  = t => (t===1)?1:1 - Math.pow(2, -10*t);
  const smoothstep   = (a,b,x)=>{ const t=Math.min(1,Math.max(0,(x-a)/(b-a))); return t*t*(3-2*t); };
  function easeOutHybrid(t){
    // s=0 — чистый cubic (норм темп), s=1 — expo (длинный хвост)
    const s = smoothstep(0.45, 0.85, t);             // плавный морф к expo ближе к финишу
    const c = easeOutCubic(t);
    const e = easeOutExpo(t);
    return c*(1-s) + e*s;                             // одно непрерывное движение
  }

  function animateHybridTo(endX, durationMs){
    return new Promise(resolve => {
      const startX = Math.max(0, Math.abs(curX(roulette))); // why: продолжаем с текущей позиции
      const dist   = Math.max(0, endX - startX);
      if (dist <= 0.25 || durationMs <= 0) {
        roulette.style.transition="none";
        roulette.style.transform = `translateX(-${endX}px)`; // без фикса после — это последний кадр
        resolve(); return;
      }
      const t0 = performance.now();
      roulette.style.transition="none";
      const step = (now) => {
        let t = (now - t0) / durationMs;
        if (t >= 1) {
          roulette.style.transform = `translateX(-${endX}px)`; // ровно в цель, без “докрутки”
          resolve(); return;
        }
        t = Math.max(0, Math.min(1, t));
        const x = startX + dist * easeOutHybrid(t);
        roulette.style.transform = `translateX(-${x}px)`;
        requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
  }

  // --- Fill
  function img(g){ const i=document.createElement("img"); i.src=STATIC_PATH+g.file; i.alt=g.name; i.width=100; i.height=100; i.loading="lazy"; i.decoding="async"; return i; }
  function fillGallery(){ gallery.innerHTML=""; gifts.forEach(g=>{ const d=document.createElement("div"); d.appendChild(img(g)); gallery.appendChild(d); }); }
  function fillRoulette(){
    roulette.innerHTML="";
    for(let i=0;i<gifts.length*LOOP_COUNT;i++){
      const g=gifts[i%gifts.length]; const d=document.createElement("div");
      d.className="roulette-item"; d.appendChild(img(g));
      roulette.appendChild(d);
    }
    // не сбрасываем при спине — только при первичной генерации можно оставить 0
    roulette.style.transition="none";
    roulette.style.transform="translateX(0px)";
    idleOffset=0;
  }

  // --- Modal
  function openSlider(){
    slider.classList.add("is-open"); document.body.classList.add("no-scroll");
    if(!roulette.hasChildNodes()) fillRoulette();
    if(lastCenteredIndex!=null){
      roulette.style.transition="none";
      const base=CYCLES_BEFORE_STOP*gifts.length+lastCenteredIndex;
      roulette.style.transform=`translateX(-${Math.max(0,xFor(base))}px)`;
    }
    syncFooter(); idleStart();
  }
  function closeSlider(){ slider.classList.remove("is-open"); document.body.classList.remove("no-scroll"); idleStop(); }
  vipCase.addEventListener("click", openSlider);
  closeBtn.addEventListener("click", closeSlider);
  sliderBackdrop.addEventListener("click", closeSlider);
  document.addEventListener("keydown",(e)=>{ if(e.key==="Escape" && slider.classList.contains("is-open")) closeSlider(); });

  // --- Result
  function openResult({name,imgSrc,amount=0}){
    resultImg.src=imgSrc; resultImg.alt=name;
    resultName.textContent=name; resultAmount.textContent=`+${amount}`;
    resultOverlay.classList.add("is-open"); resultOverlay.setAttribute("aria-hidden","false");
    idleStop();
  }
  function closeResult(){ resultOverlay.classList.remove("is-open"); resultOverlay.setAttribute("aria-hidden","true"); if(slider.classList.contains("is-open")) idleStart(); }
  resultOk.addEventListener("click", closeResult);
  resultOverlay.addEventListener("click",(e)=>{ if(e.target===resultOverlay) closeResult(); });

  // --- Haptic press
  spinBtn.addEventListener("pointerdown", ()=>H.impact("medium"));
  spinBtn.addEventListener("touchstart", ()=>H.impact("medium"), { passive:true });

  // === SPIN: одно непрерывное движение по гибридной кривой
  async function handleSpin(){
    if(isSpinning) return; isSpinning=true; spinBtn.disabled=true;
    try{
      idleStop();

      const res=await fetch("/api/case/vip",{
        method:"POST", headers:{ "Content-Type":"application/json" },
        body:JSON.stringify({ userId:"user123" })
      });
      const data=await res.json();
      if(!data.ok) throw new Error(data.error || "Server error");

      const { prize, prizeIndex:serverIdx } = data;
      let prizeIndex = typeof serverIdx==="number" ? serverIdx : gifts.findIndex(g=>g.name===prize);
      if(prizeIndex<0) throw new Error("Приз не найден на клиенте");

      const targetIndex = CYCLES_BEFORE_STOP*gifts.length + prizeIndex;
      lastCenteredIndex = prizeIndex;

      // стартуем С ТЕКУЩЕЙ позиции (никаких сбросов)
      const targetX = Math.max(0, xFor(targetIndex));
      const startX  = Math.max(0, Math.abs(curX(roulette)));
      const dist    = Math.max(0, targetX - startX);

      // одна общая длительность (px / Vavg) с клампами
      const Vavg = 1500; // px/s субъективно комфортный средний темп
      const duration = Math.min(5200, Math.max(2800, (dist / Vavg) * 1000));

      await animateHybridTo(targetX, duration);

      H.winBurst1sFast();

      const g=gifts[prizeIndex];
      openResult({ name:g?.name||prize, imgSrc: STATIC_PATH+(g?.file||""), amount:0 });
    }catch(err){
      console.error(err);
      H.notify("error");
      alert("Ошибка: " + err.message);
      idleStart();
    }finally{
      isSpinning=false; spinBtn.disabled=false;
    }
  }
  spinBtn.addEventListener("click", handleSpin);

  // --- init
  preload(); fillGallery(); syncFooter();
});
