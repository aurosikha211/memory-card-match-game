
"use strict";

// Memory Match: 50 levels, coins, reveal, sounds and confetti.
const MAX_LEVEL = 50;
const STARTING_COINS = 30;
const LEVEL_REWARD = 20;
const PERFECT_BONUS = 10;
const REVEAL_COST = 10;
const REVEAL_SECONDS = 3;
const PREVIEW_SECONDS = 5;

const EMOJI_POOL = [
  "🍎", "🍌", "🍇", "🍉", "🍓", "🍒", "🥝", "🍍",
  "🥑", "🍋", "🍑", "🥥", "🍐", "🫐", "🥕", "🌽",
  "🍄", "🌶️", "🥦", "🍪", "🍩", "🍕", "🍔", "🍟",
  "🌮", "🍿", "🧁", "🍰", "🍭", "🍫"
];

const $ = id => document.getElementById(id);

const gameBoard = $("game-board");
const movesDisplay = $("moves");
const timerDisplay = $("timer");
const bestScoreDisplay = $("best-score");
const messageDisplay = $("message");
const progressDisplay = $("progress");
const progressFill = $("progress-fill");
const restartButton = $("restart");
const revealButton = $("reveal");
const levelDisplay = $("level");
const coinsDisplay = $("coins");
const pairsLabel = $("pairs-label");

if (
  !gameBoard || !movesDisplay || !timerDisplay ||
  !bestScoreDisplay || !messageDisplay || !progressDisplay ||
  !progressFill || !restartButton || !revealButton ||
  !levelDisplay || !coinsDisplay
) {
  throw new Error("A required game element is missing from index.html.");
}

function loadNumber(key, fallback, min, max = Number.MAX_SAFE_INTEGER) {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;

    const value = Number(raw);
    return Number.isInteger(value) && value >= min && value <= max
      ? value
      : fallback;
  } catch {
    return fallback;
  }
}

let currentLevel = loadNumber("memoryCurrentLevel", 1, 1, MAX_LEVEL);
let unlockedLevel = loadNumber("memoryUnlockedLevel", 1, 1, MAX_LEVEL);
let coins = loadNumber("memoryCoins", STARTING_COINS, 0);
let bestScore = loadNumber("memoryBestScore", 0, 0);

let activeEmojis = [];
let cards = [];
let flippedCards = [];
let matchedPairs = 0;
let moves = 0;
let seconds = 0;

let gameStarted = false;
let gameLocked = true;
let gameOver = false;
let revealActive = false;

let timerInterval = null;
let countdownInterval = null;
let previewTimeout = null;
let mismatchTimeout = null;
let revealTimeout = null;
let audioContext = null;

function pairsForLevel(level) {
  if (level <= 10) return 8;
  if (level <= 20) return 10;
  if (level <= 30) return 12;
  if (level <= 40) return 14;
  return 16;
}

function shuffleCards(values) {
  const shuffled = [...values];

  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  return shuffled;
}

function saveProgress() {
  try {
    localStorage.setItem("memoryCurrentLevel", String(currentLevel));
    localStorage.setItem("memoryUnlockedLevel", String(unlockedLevel));
    localStorage.setItem("memoryCoins", String(coins));
    localStorage.setItem("memoryBestScore", String(bestScore));
  } catch (error) {
    console.warn("Could not save game progress.", error);
  }
}

// Audio
function getAudioContext() {
  if (!audioContext) {
    const AudioContextClass =
      window.AudioContext || window.webkitAudioContext;

    if (!AudioContextClass) return null;
    audioContext = new AudioContextClass();
  }

  if (audioContext.state === "suspended") {
    audioContext.resume().catch(() => {});
  }

  return audioContext;
}

document.addEventListener("pointerdown", getAudioContext, { once: true });

function playTone(frequency, duration = 0.12, type = "sine", volume = 0.04) {
  const context = getAudioContext();
  if (!context || context.state !== "running") return;

  const oscillator = context.createOscillator();
  const gain = context.createGain();

  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, context.currentTime);
  gain.gain.setValueAtTime(Math.max(volume, 0.001), context.currentTime);
  gain.gain.exponentialRampToValueAtTime(
    0.001,
    context.currentTime + duration
  );

  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start();
  oscillator.stop(context.currentTime + duration);
}

function playTickSound() {
  playTone(1000, 0.035, "square", 0.01);
}

function playShuffleSound() {
  [0, 55, 110, 165].forEach((delay, index) => {
    setTimeout(() => {
      playTone(320 + index * 100, 0.05, "triangle", 0.02);
    }, delay);
  });
}

function playMatchSound() {
  playTone(660, 0.12);
  setTimeout(() => playTone(880, 0.15), 100);
}

function playWinSound() {
  [523, 659, 784, 1047].forEach((frequency, index) => {
    setTimeout(() => playTone(frequency, 0.2), index * 130);
  });
}

function playCoinSound() {
  playTone(880, 0.1);
  setTimeout(() => playTone(1175, 0.12), 90);
}

// Confetti
function launchConfetti() {
  const colors = [
    "#ff4757", "#ffa502", "#2ed573",
    "#1e90ff", "#e056fd", "#f9ca24"
  ];

  for (let i = 0; i < 100; i++) {
    const piece = document.createElement("span");
    piece.className = "confetti-piece";
    piece.style.left = `${Math.random() * 100}vw`;
    piece.style.backgroundColor =
      colors[Math.floor(Math.random() * colors.length)];
    piece.style.animationDuration = `${2 + Math.random() * 2}s`;
    piece.style.animationDelay = `${Math.random() * 0.4}s`;
    piece.style.setProperty("--drift", `${Math.random() * 200 - 100}px`);

    document.body.appendChild(piece);
    piece.addEventListener("animationend", () => piece.remove());
  }
}

function clearConfetti() {
  document.querySelectorAll(".confetti-piece").forEach(piece => piece.remove());
}

// Display
function updateLevelDisplay() {
  levelDisplay.textContent = currentLevel;
  if (pairsLabel) {
    pairsLabel.textContent = `${pairsForLevel(currentLevel)} pairs`;
  }
}

function updateCoins() {
  coinsDisplay.textContent = coins;

  revealButton.disabled =
    coins < REVEAL_COST ||
    !gameStarted ||
    gameOver ||
    gameLocked ||
    revealActive ||
    flippedCards.length > 0;

  revealButton.textContent = revealActive
    ? "Revealing..."
    : `Reveal · ${REVEAL_COST} 🪙`;
}

function updateProgress() {
  const totalPairs = activeEmojis.length;
  progressDisplay.textContent = `${matchedPairs} / ${totalPairs}`;
  progressFill.style.width = `${(matchedPairs / totalPairs) * 100}%`;
}

function updateTimerDisplay() {
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;

  timerDisplay.textContent =
    `${String(minutes).padStart(2, "0")}:${String(remaining).padStart(2, "0")}`;
}

function updateStats() {
  movesDisplay.textContent = moves;
  bestScoreDisplay.textContent = bestScore > 0 ? bestScore : "--";
  updateTimerDisplay();
  updateProgress();
  updateCoins();
}

// Cards
function createCards() {
  const values = shuffleCards([...activeEmojis, ...activeEmojis]);

  return values.map((emoji, index) => ({
    id: index,
    emoji,
    revealed: true,
    matched: false
  }));
}

function renderCards() {
  gameBoard.innerHTML = "";

  const pairCount = activeEmojis.length;
  const columns = pairCount / 2;

  gameBoard.style.setProperty("--board-columns", columns);
  gameBoard.style.gridTemplateColumns =
    `repeat(${columns}, minmax(0, 1fr))`;
  gameBoard.style.gridTemplateRows = "repeat(4, minmax(0, 1fr))";

  cards.forEach(card => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "card";
    button.dataset.id = card.id;

    button.innerHTML = `
      <span class="card-inner">
        <span class="card-front" aria-hidden="true">?</span>
        <span class="card-back" aria-hidden="true">${card.emoji}</span>
      </span>
    `;

    button.addEventListener("click", () => handleCardClick(card.id));
    gameBoard.appendChild(button);
    updateCardAppearance(card.id);
  });
}

function updateCardAppearance(cardId) {
  const card = cards[cardId];
  const element = gameBoard.querySelector(`[data-id="${cardId}"]`);

  if (!card || !element) return;

  const visible = card.revealed || card.matched;

  element.classList.toggle("flipped", visible);
  element.classList.toggle("matched", card.matched);

  element.disabled =
    gameLocked || gameOver || card.matched || card.revealed || revealActive;

  element.setAttribute(
    "aria-label",
    card.matched
      ? `Matched ${card.emoji}`
      : visible
        ? card.emoji
        : `Hidden card ${card.id + 1}`
  );
}

function refreshCards() {
  cards.forEach(card => updateCardAppearance(card.id));
}

// Timer and preview
function clearGameTimers() {
  clearInterval(timerInterval);
  clearInterval(countdownInterval);
  clearTimeout(previewTimeout);
  clearTimeout(mismatchTimeout);
  clearTimeout(revealTimeout);

  timerInterval = null;
  countdownInterval = null;
  previewTimeout = null;
  mismatchTimeout = null;
  revealTimeout = null;
}

function startTimer() {
  if (timerInterval) return;

  timerInterval = setInterval(() => {
    if (!gameStarted || gameOver) return;

    seconds++;
    updateTimerDisplay();
    playTickSound();
  }, 1000);
}

function startPreview() {
  gameStarted = false;
  gameLocked = true;

  cards.forEach(card => {
    card.revealed = true;
  });

  refreshCards();
  updateCoins();

  let countdown = PREVIEW_SECONDS;
  messageDisplay.textContent =
    `Level ${currentLevel}: memorize ${activeEmojis.length} pairs! Hiding in ${countdown}...`;

  countdownInterval = setInterval(() => {
    countdown--;

    if (countdown > 0) {
      messageDisplay.textContent = `Memorize the cards! Hiding in ${countdown}...`;
    }
  }, 1000);

  previewTimeout = setTimeout(() => {
    clearInterval(countdownInterval);
    countdownInterval = null;

    cards.forEach(card => {
      if (!card.matched) card.revealed = false;
    });

    gameStarted = true;
    gameLocked = false;
    refreshCards();

    messageDisplay.textContent = "Find the matching pairs!";
    updateCoins();
    startTimer();
  }, PREVIEW_SECONDS * 1000);
}

// Gameplay
function handleCardClick(cardId) {
  if (gameLocked || !gameStarted || gameOver || revealActive) return;

  const card = cards[cardId];

  if (
    !card ||
    card.matched ||
    card.revealed ||
    flippedCards.length >= 2
  ) {
    return;
  }

  card.revealed = true;
  flippedCards.push(card);
  updateCardAppearance(cardId);
  playTone(440, 0.06, "sine", 0.025);

  if (flippedCards.length !== 2) return;

  moves++;
  gameLocked = true;
  updateStats();

  const [firstCard, secondCard] = flippedCards;

  if (firstCard.emoji === secondCard.emoji) {
    firstCard.matched = true;
    secondCard.matched = true;
    matchedPairs++;

    flippedCards = [];
    playMatchSound();

    refreshCards();
    updateStats();

    if (matchedPairs === activeEmojis.length) {
      endGame();
      return;
    }

    messageDisplay.textContent = "Great match! 🎉";
    gameLocked = false;
    refreshCards();
    updateCoins();
  } else {
    messageDisplay.textContent = "Not a match. Try again!";

    mismatchTimeout = setTimeout(() => {
      firstCard.revealed = false;
      secondCard.revealed = false;
      flippedCards = [];
      mismatchTimeout = null;

      gameLocked = false;
      messageDisplay.textContent = "Find the matching pairs!";

      refreshCards();
      updateCoins();
    }, 850);
  }
}

// Reveal power-up
function revealCards() {
  if (
    !gameStarted ||
    gameOver ||
    gameLocked ||
    revealActive ||
    flippedCards.length > 0 ||
    coins < REVEAL_COST
  ) {
    return;
  }

  coins -= REVEAL_COST;
  saveProgress();

  revealActive = true;
  gameLocked = true;

  cards.forEach(card => {
    if (!card.matched) card.revealed = true;
  });

  refreshCards();
  updateCoins();

  messageDisplay.textContent =
    `Cards revealed for ${REVEAL_SECONDS} seconds! Remember their positions.`;

  revealTimeout = setTimeout(() => {
    cards.forEach(card => {
      if (!card.matched) card.revealed = false;
    });

    revealActive = false;
    gameLocked = false;
    revealTimeout = null;

    refreshCards();
    updateCoins();

    messageDisplay.textContent = "Find the matching pairs!";
  }, REVEAL_SECONDS * 1000);
}

// Level completion
function endGame() {
  gameOver = true;
  gameStarted = false;
  gameLocked = true;

  clearInterval(timerInterval);
  timerInterval = null;

  const isNewBest = bestScore === 0 || moves < bestScore;
  if (isNewBest) bestScore = moves;

  const bonus = moves <= activeEmojis.length * 2 ? PERFECT_BONUS : 0;
  const reward = LEVEL_REWARD + bonus;

  coins += reward;

  playWinSound();
  playCoinSound();
  launchConfetti();

  if (currentLevel < MAX_LEVEL) {
    unlockedLevel = Math.max(unlockedLevel, currentLevel + 1);
    messageDisplay.textContent =
      `🎉 Level ${currentLevel} complete! +${reward} coins. Next level unlocked!`;
  } else {
    messageDisplay.textContent =
      `🏆 You completed all 50 levels! +${reward} coins. Amazing!`;
  }

  // Persist the completed level and newly unlocked progress.
  saveProgress();

  // Resume at the next level if the player refreshes after winning.
  if (currentLevel < MAX_LEVEL) {
    try {
      localStorage.setItem("memoryCurrentLevel", String(currentLevel + 1));
    } catch (error) {
      console.warn("Could not save next level.", error);
    }
  }

  restartButton.textContent =
    currentLevel < MAX_LEVEL ? "➜ Next Level" : "↻ Play Level 50 Again";

  refreshCards();
  updateStats();
}

function startLevel(level) {
  currentLevel = Math.max(1, Math.min(MAX_LEVEL, level));
  unlockedLevel = Math.max(unlockedLevel, currentLevel);

  activeEmojis = shuffleCards(EMOJI_POOL).slice(
    0,
    pairsForLevel(currentLevel)
  );

  saveProgress();
  updateLevelDisplay();

  restartButton.textContent = "↻ Restart Level";
  restartGame();
}

function restartGame() {
  clearGameTimers();
  clearConfetti();

  revealActive = false;
  flippedCards = [];
  matchedPairs = 0;
  moves = 0;
  seconds = 0;

  gameStarted = false;
  gameLocked = true;
  gameOver = false;

  activeEmojis = activeEmojis.length
    ? activeEmojis
    : shuffleCards(EMOJI_POOL).slice(0, pairsForLevel(currentLevel));

  cards = createCards();

  restartButton.textContent = "↻ Restart Game";

  updateLevelDisplay();
  renderCards();
  updateStats();

  messageDisplay.textContent = "Preparing your cards...";
  playShuffleSound();
  startPreview();
}

// Button events
restartButton.addEventListener("click", () => {
  if (gameOver && currentLevel < MAX_LEVEL) {
    startLevel(currentLevel + 1);
  } else {
    restartGame();
  }
});

revealButton.addEventListener("click", revealCards);

// Initialize
activeEmojis = shuffleCards(EMOJI_POOL).slice(0, pairsForLevel(currentLevel));
updateLevelDisplay();
restartGame();
