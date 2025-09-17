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

  // ----- Telegram + haptics detect
  const tg = window.Telegram?.WebApp;
  tg?.ready?.(); // why: активирует WebApp-фичи
  const PLATFORM = tg?.platform || "web";
  const SUPPORTS_TG_HAPTICS = !!tg?.HapticFeedback && (PLATFORM === "ios" || PLATFORM === "android");

  // первый user-gesture для iOS
  function primeHapticsOnce() {
    try { tg?.HapticFeedback?.impactOccurred?.("light"); } catch {}
    if (!SUPPORTS_TG_HAPTICS && "vibrate" in navigator) navigator.vibrate(8);
  }
  document.addEventListener("touchstart", primeHapticsOnce, { once: true, passive: true });
  document.addEventListener("mousedown", primeHapticsOnce, { once: true });

  // ----- HAPTICS
  const H = {
    impact(style = "light") {
      try { if (SUPPORTS_TG_HAPTICS) tg.HapticFeedback.impactOccurred(style); } catch {}
      if (!SUPPORTS_TG_HAPTICS && "vibrate" in navigator) navigator.vibrate(style === "heavy" ? 25 : 12);
    },
    notify(type = "success") {
      try { if (SUPPORTS_TG_HAPTICS) tg.HapticFeedback.notificationOccurred(type); } catch {}
      if (!SUPPORTS_TG_HAPTICS && "vibrate" in navigator) navigator.vibrate(type === "error" ? [20, 40, 60] : [10, 40, 10]);
    },
    tick() {
      try { if (SUPPORTS_TG_HAPTICS) tg.HapticFeedback.impactOccurred("light"); } catch {}
      if (!SUPPORTS_TG_HAPTICS && "vibrate" in navigator) navigator.vibrate(8);
    },
    // ДЛИННАЯ и СИЛЬНАЯ вибрация при выигрыше
    winLong() {
      if (SUPPORTS_TG_HAPTICS) {
        try {
          tg.HapticFeedback.notificationOccurred("success");
          setTimeout(() => tg.HapticFeedback.impactOccurred("heavy"), 120);
          setTimeout(() => tg.HapticFeedback.impactOccurred("heavy"), 260);
          setTimeout(() => tg.HapticFeedback.impactOccurred("rigid"), 420);
          setTimeout(() => tg.HapticFeedback.impactOccurred("heavy"), 580);
        } catch {}
      } else if ("vibrate" in navigator) {
        // Длинный паттерн: вибро/пауза чередуются
        navigator.vibrate([160, 80, 180, 90, 220, 120, 160]);
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

  // ----- Utils
  function preloadImages(list) { list.forEach(g => { const i = new Image(); i.src = STATIC_PATH + g.file; }); }
  function getMetrics() {
    const sample = roulette.querySelector(".roulette-item");
    if (!sample) return { itemInnerW: 0, itemFullW: 0, firstLeftMargin: 0, contW: rouletteContainer.clientWidth };
    const rect = sample.getBoundingClientRect();
    const cs = getComputedStyle(sample);
    const ml = parseFloat(cs.marginLeft) || 0;
    const mr = parseFloat(cs.marginRight) || 0;
    const itemInnerW = rect.width;
    const itemFullW  = rect.width + ml + mr;
    const contW = rouletteContainer.clientWidth;
    return { itemInnerW, itemFullW, firstLeftMargin: ml, contW };
  }
  function translateForIndex(index) {
    const { itemInnerW, itemFullW, firstLeftMargin, contW } = getMetrics();
    const itemCenterFromStart = firstLeftMargin + index * itemFullW + itemInnerW / 2;
    return itemCenterFromStart - contW / 2;
  }
  function waitTransitionEnd(el) {
    return new Promise((resolve) => {
      const done = () => { el.removeEventListener("transitionend", done, true); resolve(); };
      el.addEventListener("transitionend", done, true);
    });
  }
  function readTranslateXPx(el) {
    const tr = getComputedStyle(el).transform;
    if (!tr || tr === "none") return 0;
    const m = tr.startsWith("matrix3d(") ? tr.slice(9, -1).split(",") : tr.slice(7, -1).split(",");
    return parseFloat(m[m.length === 16 ? 12 : 4]) || 0;
  }
  function indexUnderMarker() {
    const { itemInnerW, itemFullW, firstLeftMargin, contW } = getMetrics();
    const x = Math.abs(readTranslateXPx(roulette));
    const centerCoord = x + contW / 2;
    const idxFloat = (centerCoord - firstLeftMargin - itemInnerW / 2) / itemFullW;
    return Math.max(0, Math.round(idxFloat));
  }
  function startRouletteTicks() {
    let rafId = null, lastIdx = -1, lastTs = 0;
    const MIN_INTERVAL_MS = 70; // why: не душить ОС частотой
    const loop = (ts) => {
      const idx = indexUnderMarker();
      if (idx !== lastIdx && ts - lastTs > MIN_INTERVAL_MS) {
        lastIdx = idx; lastTs = ts;
        H.tick();
      }
      rafId = requestAnimationFrame(loop);
    };
    rafId = requestAnimationFrame(loop);
    return () => { if (rafId) cancelAnimationFrame(rafId); };
  }

  // ----- Footer dynamic sizing
  function syncFooter() {
    const h = footerBar?.offsetHeight || 0;
    document.documentElement.style.setProperty("--footer-h", `${h}px`);
    if (sliderContent) {
      sliderContent.style.paddingBottom = `calc(16px + ${h}px)`;
      sliderContent.style.maxHeight = `calc(100vh - ${h}px - 24px)`;
    }
  }
  const ro = ("ResizeObserver" in window) ? new ResizeObserver(syncFooter) : null;
  ro?.observe(footerBar);
  window.addEventListener("resize", syncFooter);
  window.addEventListener("orientationchange", syncFooter);
  tg?.onEvent?.("viewportChanged", syncFooter);

  // ----- Fill
  function createImg(gift) {
    const img = document.createElement("img");
    img.src = STATIC_PATH + gift.file;
    img.alt = gift.name;
    img.width = 80; img.height = 80;
    img.loading = "lazy"; img.decoding = "async";
    return img;
  }
  function fillGallery() {
    gallery.innerHTML = "";
    gifts.forEach(gift => {
      const div = document.createElement("div");
      div.appendChild(createImg(gift));
      gallery.appendChild(div);
    });
  }
  function fillRoulette() {
    roulette.innerHTML = "";
    for (let i = 0; i < gifts.length * LOOP_COUNT; i++) {
      const gift = gifts[i % gifts.length];
      const item = document.createElement("div");
      item.classList.add("roulette-item");
      item.appendChild(createImg(gift));
      roulette.appendChild(item);
    }
    roulette.style.transition = "none";
    roulette.style.transform = "translateX(0px)";
    void roulette.offsetHeight;
    roulette.style.transition = "";
  }

  // ----- Modal open/close
  function openSlider() {
    slider.classList.add("is-open");
    document.body.classList.add("no-scroll");
    if (!roulette.hasChildNodes()) fillRoulette();
    if (lastCenteredIndex != null) {
      roulette.style.transition = "none";
      const baseIndex = CYCLES_BEFORE_STOP * gifts.length + lastCenteredIndex;
      const t = translateForIndex(baseIndex);
      roulette.style.transform = `translateX(-${Math.max(0, t)}px)`;
      void roulette.offsetHeight;
      roulette.style.transition = "";
    }
    syncFooter();
  }
  function closeSlider() {
    slider.classList.remove("is-open");
    document.body.classList.remove("no-scroll");
  }

  vipCase.addEventListener("click", openSlider);
  vipCase.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openSlider(); } });
  closeBtn.addEventListener("click", closeSlider);
  sliderBackdrop?.addEventListener("click", closeSlider);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && slider.classList.contains("is-open")) closeSlider(); });

  // ----- Result sheet
  function openResult({ name, imgSrc, amount = 0 }) {
    resultImg.src = imgSrc;
    resultImg.alt = name;
    resultName.textContent = name;
    resultAmount.textContent = `+${amount}`;
    resultOverlay.classList.add("is-open");
    resultSheet.classList.remove("collapsed");
    resultSheet.classList.add("expanded");
    resultOverlay.setAttribute("aria-hidden", "false");
  }
  function closeResult() {
    resultSheet.classList.remove("expanded","collapsed");
    resultOverlay.classList.remove("is-open");
    resultOverlay.setAttribute("aria-hidden", "true");
  }
  function toggleCollapse() {
    if (!resultOverlay.classList.contains("is-open")) return;
    resultSheet.classList.toggle("collapsed");
    resultSheet.classList.toggle("expanded");
  }
  sheetHandle?.addEventListener("click", toggleCollapse);
  resultOk?.addEventListener("click", closeResult);
  resultOverlay?.addEventListener("click", (e) => { if (e.target === resultOverlay) closeResult(); });

  // ----- Haptic on press "Открыть"
  spinBtn.addEventListener("pointerdown", () => H.impact("medium"));
  spinBtn.addEventListener("touchstart", () => H.impact("medium"), { passive: true });

  // ----- Spin
  async function handleSpin() {
    if (isSpinning) return;
    isSpinning = true;
    spinBtn.disabled = true;

    try {
      const res = await fetch("/api/case/vip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: "user123" })
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "Server error");

      const { prize, prizeIndex: serverIndex } = data;
      let prizeIndex = typeof serverIndex === "number" ? serverIndex : gifts.findIndex(g => g.name === prize);
      if (prizeIndex < 0) throw new Error("Приз не найден на клиенте");

      const targetIndex = CYCLES_BEFORE_STOP * gifts.length + prizeIndex;
      lastCenteredIndex = prizeIndex;

      roulette.style.transition = "none";
      roulette.style.transform = "translateX(0px)";
      void roulette.offsetHeight;

      const t = translateForIndex(targetIndex);

      const stopTicks = startRouletteTicks();
      roulette.style.transition = ""; // CSS
      roulette.style.transform = `translateX(-${Math.max(0, t)}px)`;

      await waitTransitionEnd(roulette);

      stopTicks();
      H.winLong(); // <<< длинная и сильная вибрация при выигрыше

      roulette.style.transition = "none";
      roulette.style.transform = `translateX(-${Math.max(0, translateForIndex(targetIndex))}px)`;
      void roulette.offsetHeight;
      roulette.style.transition = "";

      const giftMeta = gifts[prizeIndex];
      openResult({
        name: giftMeta?.name || prize,
        imgSrc: STATIC_PATH + (giftMeta?.file || ""),
        amount: 0
      });
    } catch (err) {
      console.error(err);
      H.notify("error");
      alert("Ошибка: " + err.message);
    } finally {
      isSpinning = false;
      spinBtn.disabled = false;
    }
  }

  spinBtn.addEventListener("click", handleSpin);

  // ----- Recenter & init
  const recenter = () => {
    if (!slider.classList.contains("is-open")) return;
    if (lastCenteredIndex == null) return;
    roulette.style.transition = "none";
    const baseIndex = CYCLES_BEFORE_STOP * gifts.length + lastCenteredIndex;
    const t = translateForIndex(baseIndex);
    roulette.style.transform = `translateX(-${Math.max(0, t)}px)`;
    void roulette.offsetHeight;
    roulette.style.transition = "";
    syncFooter();
  };
  window.addEventListener("resize", recenter);
  window.addEventListener("orientationchange", recenter);

  preloadImages(gifts);
  fillGallery();
  syncFooter();

  console.log("[haptics] tg:", !!tg, "platform:", PLATFORM, "HF:", !!tg?.HapticFeedback);
});
