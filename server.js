const express = require("express");
const bodyParser = require("body-parser");
const path = require("path");

const app = express();
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "public")));

const PORT = process.env.PORT || 3000;

// --- Хранилище пользователей (MVP, в памяти)
let users = {};

// --- Временный userId для MVP
const TEMP_USER_ID = "user123";
if (!users[TEMP_USER_ID]) {
  users[TEMP_USER_ID] = { name: "Игрок", balance: 1000000000000 };
}

// --- Получить пользователя
app.post("/api/user", (req, res) => {
  res.json({ ok: true, user: users[TEMP_USER_ID], userId: TEMP_USER_ID });
});

// --- Кейсы
app.post("/api/case/vip", (req, res) => {
  const { userId } = req.body;
  const user = users[userId];
  if (!user) return res.status(400).json({ ok: false, error: "Пользователь не найден" });

  const cost = 200;
  if (user.balance < cost) return res.status(400).json({ ok: false, error: "Недостаточно средств" });

  user.balance -= cost;

  const gifts = [
    "Plush Pepe",
    "Heart Locket",
    "Durov's Cap",
    "Peach",
    "Heroic Helmet",
    "Perfume",
    "Venom",
    "Bonded Ring",
    "Scared Cat",
    "Signet Ring"
  ];

  const prizeIndex = Math.floor(Math.random() * gifts.length);
  const prize = gifts[prizeIndex];

  res.json({ ok: true, prize, prizeIndex, newBalance: user.balance });
});

// --- Запуск сервера
app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Server running on port ${PORT}`);
});
