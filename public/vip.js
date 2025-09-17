// filepath: public/vip.js
document.addEventListener("DOMContentLoaded", () => {
  const vipCase = document.getElementById("vip-case");
  const slider = document.getElementById("slider");
  const sliderBackdrop = document.getElementById("sliderBackdrop");
  const sliderContent = document.getElementById("sliderContent");
  const closeBtn = document.getElementById("closeBtn");
  const roulette = document.getElementById("roulette");
  const rouletteContainer = document.getElementById("rouletteContainer");
  const spinBtn = document.getElementById("spinBtn");
  const gallery = document.getElementById("gallery");

  const STATIC_PATH = "/static_webp/";
  const LOOP_COUNT = 24;          // why: длиннее лента для плавности
  const CYCLES_BEFORE_STOP = 6;   // why: фиксированные обороты до призового индекса

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
  let lastCenteredIndex = null; // 0..gifts.length-1

  /** Utils */
  const $ = (sel, root = document) => root.querySelector(sel);

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
    list.forEach(g => {
      const img = new Image();
      img.src = STATIC_PATH + g.file;
    });
  }

  function itemMetrics() {
    const sample = $(".roulette-item", roulette);
    if (!sample) return { itemW: 0, innerW: 0, contW: rouletteContainer.clientWidth };
    const cs = getComputedStyle(sample);
    const rect = sample.getBoundingClientRect();
    const marginH = parseFloat(cs.marginLeft) + parseFloat(cs.marginRight);
    const itemW = rect.width + marginH;
    const contW = rouletteContainer.clientWidth;
    const innerW = roulette.scrollWidth;
    return { itemW, contW, innerW };
  }

  function centerTranslateForIndex(index) {
    const { itemW, contW } = itemMetrics();
    const sample = $(".roulette-item", roulette);
    const sampleRect = sample ? sample.getBoundingClientRect() : { width: 0 };
    const itemInnerW = sampleRect.width; // без margin
    const centerOffset = (contW / 2) - (itemInnerW / 2);
    return index * itemW - centerOffset;
  }

  function waitTransitionEnd(el) {
    return new Promise((resolve) => {
      const done = () => {
        el.removeEventListener("transitionend", done, true);
        resolve();
      };
      el.addEventListener("transitionend", done, true);
    });
  }

  /** Галерея */
  function fillGallery() {
    gallery.innerHTML = "";
    gifts.forEach(gift => {
      const div = document.createElement("div");
      div.appendChild(createImg(gift));
      gallery.appendChild(div);
    });
  }

  /** Рулетка */
  function fillRoulette() {
    roulette.innerHTML = "";
    for (let i = 0; i < gifts.length * LOOP_COUNT; i++) {
      const gift = gifts[i % gifts.length];
      const item = document.createElement("div");
      item.classList.add("roulette-item");
      item.appendChild(createImg(gift));
      roulette.appendChild(item);
    }
    // сброс позиции
    roulette.style.transition = "none";
    roulette.style.transform = "translateX(0px)";
    // force reflow
    void roulette.offsetHeight;
    roulette.style.transition = ""; // вернём по CSS
  }

  /** Открыть модалку */
  function openSlider() {
    slider.classList.add("is-open");
    document.body.classList.add("no-scroll");
    if (!roulette.hasChildNodes()) fillRoulette();
    // пересчёт и мягкое центрирование на последнем индексе при ре-открытии
    if (lastCenteredIndex != null) {
      roulette.style.transition = "none";
      const baseIndex = CYCLES_BEFORE_STOP * gifts.length + lastCenteredIndex;
      const target = centerTranslateForIndex(baseIndex);
      roulette.style.transform = `translateX(-${target}px)`;
      void roulette.offsetHeight;
      roulette.style.transition = ""; // вернуть по CSS
    }
  }

  /** Закрыть модалку */
  function closeSlider() {
    slider.classList.remove("is-open");
    document.body.classList.remove("no-scroll");
  }

  /** События открытия/закрытия */
  vipCase.addEventListener("click", openSlider);
  vipCase.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openSlider(); }
  });
  closeBtn.addEventListener("click", closeSlider);
  sliderBackdrop.addEventListener("click", closeSlider);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && slider.classList.contains("is-open")) closeSlider();
  });

  /** Спин */
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

      const { prize, prizeIndex: srvIndex } = data;
      let prizeIndex = typeof srvIndex === "number" ? srvIndex : gifts.findIndex(g => g.name === prize);
      if (prizeIndex < 0) throw new Error("Приз не найден на клиенте");

      // подготовка
      const baseCycles = CYCLES_BEFORE_STOP;
      const targetIndex = baseCycles * gifts.length + prizeIndex;
      lastCenteredIndex = prizeIndex;

      // сброс
      roulette.style.transition = "none";
      roulette.style.transform = "translateX(0px)";
      void roulette.offsetHeight; // reflow

      // целимся по пикселям на центр маркера
      const targetTranslate = centerTranslateForIndex(targetIndex);

      // анимируем
      roulette.style.transition = ""; // вернуть CSS
      roulette.style.transform = `translateX(-${Math.max(0, targetTranslate)}px)`;

      await waitTransitionEnd(roulette);

      // выравниваем позицию без дерганья
      roulette.style.transition = "none";
      roulette.style.transform = `translateX(-${Math.max(0, centerTranslateForIndex(targetIndex))}px)`;
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

  /** На изменение размеров/ориентации — перецентрировать последнюю позицию */
  const recenter = () => {
    if (!slider.classList.contains("is-open")) return;
    if (lastCenteredIndex == null) return;
    roulette.style.transition = "none";
    const baseIndex = CYCLES_BEFORE_STOP * gifts.length + lastCenteredIndex;
    const t = centerTranslateForIndex(baseIndex);
    roulette.style.transform = `translateX(-${Math.max(0, t)}px)`;
    void roulette.offsetHeight;
    roulette.style.transition = "";
  };

  window.addEventListener("resize", recenter);
  window.addEventListener("orientationchange", recenter);

  /** Инициализация */
  preloadImages(gifts);
  fillGallery();
});
