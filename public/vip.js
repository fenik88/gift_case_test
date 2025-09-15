const vipCase = document.getElementById("vip-case");
const slider = document.getElementById("slider");
const closeBtn = document.getElementById("closeBtn");
const roulette = document.getElementById("roulette");
const spinBtn = document.getElementById("spinBtn");

const gifts = [
  { name: "Signet Ring", file: "signet_ring.webp" },
  { name: "Perfume", file: "perfume.webp" },
  { name: "Plush Pepe", file: "plush_pepe.webp" },
  { name: "Peach", file: "peach.webp" },
  { name: "Durov's Cap", file: "cap.webp" },
  { name: "Venom", file: "venom.webp" },
  { name: "Scared Cat", file: "cat.webp" },
  { name: "Heroic Helmet", file: "helmet.webp" },
  { name: "Bonded Ring", file: "bonded_ring.webp" },
  { name: "Heart Locket", file: "heart_locket.webp" }
];

const LOOP_COUNT = 20;

/* ---------- УТИЛИТА ДЛЯ ПРЕЛОАДА АНИМАЦИЙ ---------- */
function preloadWebp(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = `/gifs/${file}`;
    img.onload = () => resolve(file);
    img.onerror = reject;
  });
}

/* ---------- РУЛЕТКА (изначально static_webp) ---------- */
function fillRoulette() {
  roulette.innerHTML = "";
  for (let i = 0; i < gifts.length * LOOP_COUNT; i++) {
    const gift = gifts[i % gifts.length];
    const item = document.createElement("div");
    item.classList.add("roulette-item");

    const img = document.createElement("img");
    img.src = `/static_webp/${gift.file}`; // сначала статичные
    img.alt = gift.name;
    img.width = 80;
    img.height = 80;

    item.appendChild(img);
    roulette.appendChild(item);
  }
}

/* ---------- ЗАМЕНА PNG → webp (анимированных) ---------- */
function swapToAnimated() {
  // галерея
  document.querySelectorAll(".gallery img").forEach(img => {
    img.src = img.src.replace("/static_webp/", "/gifs/");
  });

  // рулетка
  document.querySelectorAll(".roulette-item img").forEach(img => {
    img.src = img.src.replace("/static_webp/", "/gifs/");
  });
}

/* ---------- ИНИЦИАЛИЗАЦИЯ ---------- */
fillRoulette();

// когда все webp загружены → заменяем в рулетке и галерее
Promise.all(gifts.map(g => preloadWebp(g.file))).then(() => {
  swapToAnimated();
});

/* ---------- СЛАЙДЕР ---------- */
vipCase.addEventListener("click", () => {
  slider.style.display = "flex";
});

closeBtn.addEventListener("click", () => {
  slider.style.display = "none";
});

/* ---------- ЛОГИКА РУЛЕТКИ ---------- */
spinBtn.addEventListener("click", async () => {
  spinBtn.disabled = true;

  try {
    const res = await fetch("/api/case/vip", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: "user123" })
    });
    const data = await res.json();
    if (!data.ok) {
      alert(data.error);
      spinBtn.disabled = false;
      return;
    }

    const { prize } = data;

    const items = Array.from(roulette.children);
    const prizeElement = items.find(el =>
      el.querySelector("img").alt === prize
    );

    if (!prizeElement) {
      alert("Ошибка: приз не найден на рулетке!");
      spinBtn.disabled = false;
      return;
    }

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
    alert("Ошибка соединения с сервером");
    spinBtn.disabled = false;
  }
});
