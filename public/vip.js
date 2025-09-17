// filepath: public/vip.js
document.addEventListener("DOMContentLoaded", () => {
  const vipCase = document.getElementById("vip-case");
  const slider = document.getElementById("slider");
  const sliderBackdrop = document.getElementById("sliderBackdrop");
  const closeBtn = document.getElementById("closeBtn");
  const roulette = document.getElementById("roulette");
  const rouletteContainer = document.getElementById("rouletteContainer");
  const spinBtn = document.getElementById("spinBtn");
  const gallery = document.getElementById("gallery");

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

  let isSpinning = false;
  let lastCenteredIndex = null;

  function createImg(gift) {
    const img = document.createElement("img");
    img.src = STATIC_PATH + gift.file;
    img.alt = gift.name;
    img.width = 80;
    img.height = 80;
    img.loading = "lazy";
    img.decoding = "async";
    return img;
  }

  function preloadImages(list) {
    list.forEach(g => { const i = new Image(); i.src = STATIC_PATH + g.file; });
  }

  function getMetrics() {
    const sample = roulette.querySelector(".roulette-item");
    if (!sample) return { itemInnerW: 0, itemFullW: 0, firstLeftMargin: 0, contW: rouletteContainer.clientWidth };
    const rect = sample.getBoundingClientRect();
    const cs = getComputedStyle(sample);
    const ml = parseFloat(cs.marginLeft) || 0;
    const mr = parseFloat(cs.marginRight) || 0;
    const itemInnerW = rect.width;               // без внешних маргинов
    const itemFullW  = rect.width + ml + mr;     // шаг по ленте
    const contW = rouletteContainer.clientWidth;
    return { itemInnerW, itemFullW, firstLeftMargin: ml, contW };
  }

  // точный пиксельный translate для центра индекса
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
    roulette.style.transition = ""; // вернуть CSS
  }

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
  }

  function closeSlider() {
    slider.classList.remove("is-open");
    document.body.classList.remove("no-scroll");
  }

  vipCase.addEventListener("click", openSlider);
  vipCase.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openSlider(); }
  });
  closeBtn.addEventListener("click", closeSlider);
  document.getElementById("sliderBackdrop").addEventListener("click", closeSlider);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && slider.classList.contains("is-open")) closeSlider();
  });

  // Спин с точным прицеливанием по индексу
  spinBtn.addEventListener("click", async () => {
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
      let prizeIndex = typeof serverIndex === "number"
        ? serverIndex
        : gifts.findIndex(g => g.name === prize);
      if (prizeIndex < 0) throw new Error("Приз не найден на клиенте");

      const targetIndex = CYCLES_BEFORE_STOP * gifts.length + prizeIndex;
      lastCenteredIndex = prizeIndex;

      roulette.style.transition = "none";
      roulette.style.transform = "translateX(0px)";
      void roulette.offsetHeight;

      const t = translateForIndex(targetIndex);
      roulette.style.transition = ""; // CSS
      roulette.style.transform = `translateX(-${Math.max(0, t)}px)`;

      await waitTransitionEnd(roulette);

      roulette.style.transition = "none";
      roulette.style.transform = `translateX(-${Math.max(0, translateForIndex(targetIndex))}px)`;
      void roulette.offsetHeight;
      roulette.style.transition = "";

      alert(`🎉 Поздравляем! Вы выиграли: ${prize}`);
    } catch (err) {
      console.error(err);
      alert("Ошибка: " + err.message);
    } finally {
      isSpinning = false;
      spinBtn.disabled = false;
    }
  });

  // Перецентрировать при ресайзе/смене ориентации
  const recenter = () => {
    if (!slider.classList.contains("is-open")) return;
    if (lastCenteredIndex == null) return;
    roulette.style.transition = "none";
    const baseIndex = CYCLES_BEFORE_STOP * gifts.length + lastCenteredIndex;
    const t = translateForIndex(baseIndex);
    roulette.style.transform = `translateX(-${Math.max(0, t)}px)`;
    void roulette.offsetHeight;
    roulette.style.transition = "";
  };
  window.addEventListener("resize", recenter);
  window.addEventListener("orientationchange", recenter);

  // init
  preloadImages(gifts);
  fillGallery();
});
