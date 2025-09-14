const vipCase = document.getElementById("vip-case");
const slider = document.getElementById("slider");
const closeBtn = document.getElementById("closeBtn");
const roulette = document.getElementById("roulette");
const spinBtn = document.getElementById("spinBtn");

// Список подарков с путями к твоим гифкам
const gifts = [
  { name: "Signet Ring", file: "signet_ring.gif" },
  { name: "Perfume", file: "perfume.gif" },
  { name: "Plush Pepe", file: "plush_pepe.gif" },
  { name: "Peach", file: "peach.gif" },
  { name: "Durov's Cap", file: "cap.gif" },
  { name: "Venom", file: "venom.gif" },
  { name: "Scared Cat", file: "cat.gif" },
  { name: "Heroic Helmet", file: "helmet.gif" },
  { name: "Bonded Ring", file: "bonded_ring.gif" },
  {name: "Heart Locket", file: "heart_locket.gif"}
];

const LOOP_COUNT = 20;

function fillRoulette() {
  roulette.innerHTML = "";
  for (let i = 0; i < gifts.length * LOOP_COUNT; i++) {
    const gift = gifts[i % gifts.length];
    const item = document.createElement("div");
    item.classList.add("roulette-item");

    const img = document.createElement("img");
    img.src = `/gifs/${gift.file}`;
    img.alt = gift.name;
    img.style.width = "80px";
    img.style.height = "80px";
    item.appendChild(img);

    roulette.appendChild(item);
  }
}

fillRoulette();

vipCase.addEventListener("click", () => {
  slider.style.display = "flex";
});

closeBtn.addEventListener("click", () => {
  slider.style.display = "none";
});

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

    const { prize } = data; // сервер теперь возвращает строку, например "Perfume"

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
