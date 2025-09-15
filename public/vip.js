document.addEventListener("DOMContentLoaded", () => {
  const vipCase = document.getElementById("vip-case");
  const slider = document.getElementById("slider");
  const closeBtn = document.getElementById("closeBtn");
  const roulette = document.getElementById("roulette");
  const spinBtn = document.getElementById("spinBtn");
  const gallery = document.getElementById("gallery");

  const STATIC_PATH = "/static_webp/";

  const gifts = [
    { name: "Plush Pepe", file: "plush_pepe.webp", price: 5165.00 },
    { name: "Heart Locket", file: "heart_locket.webp", price: 1468.00 },
    { name: "Durov's Cap", file: "cap.webp", price: 890.00 },
    { name: "Peach", file: "peach.webp", price: 390.79 },
    { name: "Heroic Helmet", file: "helmet.webp", price: 264.72 },
    { name: "Perfume", file: "perfume.webp", price: 1200.00 },
    { name: "Venom", file: "venom.webp", price: 76.00 },
    { name: "Bonded Ring", file: "bonded_ring.webp", price: 450.00 },
    { name: "Scared Cat", file: "cat.webp", price: 300.00 },
    { name: "Signet Ring", file: "signet_ring.webp", price: 700.00 }
  ];

  const LOOP_COUNT = 20;

  function createImg(gift) {
    const img = document.createElement("img");
    img.src = STATIC_PATH + gift.file;
    img.alt = gift.name;
    return img;
  }

  function fillGallery() {
    gallery.innerHTML = "";
    gifts.forEach(gift => {
      const div = document.createElement("div");
      div.classList.add("gallery-item");

      const price = document.createElement("span");
      price.classList.add("price-tag");
      price.innerText = `💎 ${gift.price}`;

      div.appendChild(price);
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

      const img = createImg(gift);
      const price = document.createElement("span");
      price.classList.add("price-tag");
      price.innerText = `💎 ${gift.price}`;

      item.appendChild(img);
      item.appendChild(price);
      roulette.appendChild(item);
    }
  }

  vipCase.addEventListener("click", () => {
    slider.style.display = "block";
    if (!roulette.hasChildNodes()) {
      fillRoulette();
    }
  });

  closeBtn.addEventListener("click", () => {
    slider.style.display = "none";
  });

  fillGallery();

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

      const itemWidth = items[0].offsetWidth + 10;
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
