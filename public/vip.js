document.addEventListener("DOMContentLoaded", () => {
  const vipCase = document.getElementById("vip-case");
  const slider = document.getElementById("slider");
  const closeBtn = document.getElementById("closeBtn");
  const roulette = document.getElementById("roulette");
  const spinBtn = document.getElementById("spinBtn");
  const gallery = document.getElementById("gallery");

  const STATIC_PATH = "/static_webp/";

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

  const LOOP_COUNT = 20;

  /** Создает <img> */
  function createImg(gift) {
    const img = document.createElement("img");
    img.src = STATIC_PATH + gift.file;
    img.alt = gift.name;
    img.width = 80;
    img.height = 80;
    img.loading = "lazy";
    return img;
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
  }

  /** СЛАЙДЕР */
  vipCase.addEventListener("click", () => {
    slider.style.display = "flex";
    if (!roulette.hasChildNodes()) {
      fillRoulette();
    }
  });

  closeBtn.addEventListener("click", () => {
    slider.style.display = "none";
  });

  /** Галерея — сразу */
  fillGallery();

  /** РУЛЕТКА */
  spinBtn.addEventListener("click", async () => {
    spinBtn.disabled = true;
    try {
      const res = await fetch("/api/case/vip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: "user123" })
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);

      const { prize } = data;
      const items = Array.from(roulette.children);
      const prizeElement = items.find(el => el.querySelector("img").alt === prize);
      if (!prizeElement) throw new Error("Приз не найден!");

      const itemWidth = items[0].offsetWidth + 20;
      const markerCenter = roulette.parentElement.offsetWidth / 2;
      const prizeCenter = prizeElement.offsetLeft + prizeElement.offsetWidth / 2;

      roulette.style.transition = "none";
      roulette.style.transform = `translateX(0px)`;

      requestAnimationFrame(() => {
        const extraSpins = gifts.length * itemWidth * 8;
        const target = prizeCenter - markerCenter + extraSpins;
        roulette.style.transition = "transform 4s cubic-bezier(0.25, 1, 0.5, 1)";
        roulette.style.transform = `translateX(-${target}px)`;
      });

      setTimeout(() => {
        alert(`🎉 Поздравляем! Вы выиграли: ${prize}`);
        roulette.style.transition = "none";
        roulette.style.transform = `translateX(-${prizeCenter - markerCenter}px)`;
        spinBtn.disabled = false;
      }, 4000);
    } catch (err) {
      console.error(err);
      alert("Ошибка: " + err.message);
      spinBtn.disabled = false;
    }
  });
});