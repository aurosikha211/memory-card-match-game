

const emojis = [
  "🍎", "🍌", "🍇", "🍉",
  "🍓", "🍒", "🥝", "🍍"
];

const PREVIEW_SECONDS = 5;
const TOTAL_PAIRS = emojis.length;

// HTML elements
const gameBoard = document.getElementById("game-board");
const movesDisplay = document.getElementById("moves");
const timerDisplay = document.getElementById("timer");
const bestScoreDisplay = document.getElementById("best-score");
const messageDisplay = document.getElementById("message");
const progressDisplay = document.getElementById("progress");
const progressFill = document.getElementById("progress-fill");
const restartButton = document.getElementById("restart");

/* ---------- SOUND EFFECTS ---------- */

let audioContext = null;

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

// Prepare audio after the player's first interaction.
document.addEventListener("pointerdown", getAudioContext, {
  once: true
});

function playTone(frequency, duration = 0.12, type = "sine", volume = 0.05) {
  const ctx = getAudioContext();
  if (!ctx || ctx.state !== "running") return;

  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();

  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, ctx.currentTime);

  gain.gain.setValueAtTime(Math.max(volume, 0.001), ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(
    0.001,
    ctx.currentTime + duration
  );

  oscillator.connect(gain);
  gain.connect(ctx.destination);

  oscillator.start();
  oscillator.stop(ctx.currentTime + duration);
}

// Quiet clock tick
function playTickSound() {
  playTone(1000, 0.035, "square", 0.012);
}

// Short card-shuffling effect
function playShuffleSound() {
  [0, 55, 110, 165, 220].forEach((delay) => {
    setTimeout(() => {
      playTone(
        300 + Math.random() * 500,
        0.045,
        "triangle",
        0.025
      );
    }, delay);
  });
}

// Cheerful matching chime
function playMatchSound() {
  playTone(660, 0.12, "sine", 0.06);

  setTimeout(() => {
    playTone(880, 0.16, "sine", 0.06);
  }, 100);
}

// Winning melody
function playWinSound() {
  [523, 659, 784, 1047, 784, 1047].forEach((frequency, index) => {
    setTimeout(() => {
      playTone(frequency, 0.22, "sine", 0.07);
    }, index * 140);
  });
}

// Confetti celebration
function launchConfetti() {
  const colors = [
    "#ff4757",
    "#ffa502",
    "#2ed573",
    "#1e90ff",
    "#e056fd",
    "#f9ca24"
  ];

  for (let i = 0; i < 120; i++) {
    const piece = document.createElement("span");

    piece.className = "confetti-piece";
    piece.style.left = Math.random() * 100 + "vw";
    piece.style.backgroundColor =
      colors[Math.floor(Math.random() * colors.length)];

    piece.style.animationDuration =
      (2 + Math.random() * 2) + "s";

    piece.style.animationDelay =
      Math.random() * 0.5 + "s";

    piece.style.setProperty(
      "--drift",
      (Math.random() * 200 - 100) + "px"
    );

    document.body.appendChild(piece);

    piece.addEventListener("animationend", () => {
      piece.remove();
    });
  }
}


// Game state
let cards = [];
let flippedCards = [];
let matchedPairs = 0;
let moves = 0;
let seconds = 0;

let gameStarted = false;
let gameLocked = true;
let gameOver = false;

let timerInterval = null;
let countdownInterval = null;
let previewTimeout = null;
let mismatchTimeout = null;

// Load best score safely from localStorage
function loadBestScore() {
  try {
    const savedScore = Number(
      localStorage.getItem("memoryBestScore")
    );

    return Number.isInteger(savedScore) && savedScore > 0
      ? savedScore
      : 0;
  } catch (error) {
    return 0;
  }
}

let bestScore = loadBestScore();

// Save best score safely
function saveBestScore(score) {
  try {
    localStorage.setItem("memoryBestScore", String(score));
  } catch (error) {
    console.warn("Could not save the best score.", error);
  }
}

// Shuffle cards using the Fisher-Yates algorithm
function shuffleCards(values) {
  const shuffled = [...values];

  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));

    [shuffled[i], shuffled[j]] = [
      shuffled[j],
      shuffled[i]
    ];
  }

  return shuffled;
}

// Create 16 cards containing 8 matching pairs
function createCards() {
  const values = shuffleCards([...emojis, ...emojis]);

  return values.map((emoji, index) => ({
    id: index,
    emoji,
    revealed: true,
    matched: false
  }));
}

// Create the HTML for each card
function renderCards() {
  gameBoard.innerHTML = "";

  cards.forEach((card) => {
    const button = document.createElement("button");

    button.type = "button";
    button.className = "card";
    button.dataset.id = card.id;

    button.setAttribute("aria-label", `Card ${card.id + 1}`);

    button.innerHTML = `
      <span class="card-inner">
        <span class="card-front" aria-hidden="true">?</span>
        <span class="card-back" aria-hidden="true">
          ${card.emoji}
        </span>
      </span>
    `;

    button.addEventListener("click", () => {
      handleCardClick(card.id);
    });

    gameBoard.appendChild(button);

    updateCardAppearance(card.id);
  });
}

// Update the appearance and accessibility of a card
function updateCardAppearance(cardId) {
  const card = cards[cardId];

  const element = gameBoard.querySelector(
    `[data-id="${cardId}"]`
  );

  if (!card || !element) return;

  const isVisible = card.revealed || card.matched;

  element.classList.toggle("flipped", isVisible);
  element.classList.toggle("matched", card.matched);

  element.disabled =
    gameLocked ||
    card.matched ||
    card.revealed;

  if (card.matched) {
    element.setAttribute("aria-label", `Matched ${card.emoji}`);
  } else if (card.revealed) {
    element.setAttribute("aria-label", card.emoji);
  } else {
    element.setAttribute("aria-label", `Hidden card ${card.id + 1}`);
  }
}

// Update the progress bar and pair count
function updateProgress() {
  progressDisplay.textContent =
    `${matchedPairs} / ${TOTAL_PAIRS}`;

  const percentage = (matchedPairs / TOTAL_PAIRS) * 100;

  progressFill.style.width = `${percentage}%`;
}

// Update the timer display
function updateTimerDisplay() {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  timerDisplay.textContent =
    `${String(minutes).padStart(2, "0")}:` +
    `${String(remainingSeconds).padStart(2, "0")}`;
}

// Start the timer after the preview
function startTimer() {
  clearInterval(timerInterval);

  timerInterval = setInterval(() => {
    if (!gameStarted || gameOver) return;

    seconds++;
    updateTimerDisplay();
    playTickSound();
  }, 1000);
}

// Show all cards for five seconds, then hide them
function startPreview() {
  gameStarted = false;
  gameLocked = true;

  cards.forEach((card) => {
    card.revealed = true;
    updateCardAppearance(card.id);
  });

  let countdown = PREVIEW_SECONDS;

  messageDisplay.textContent =
    `Memorize the cards! Hiding in ${countdown}...`;

  countdownInterval = setInterval(() => {
    countdown--;

    if (countdown > 0) {
      messageDisplay.textContent =
        `Memorize the cards! Hiding in ${countdown}...`;
    }
  }, 1000);

  previewTimeout = setTimeout(() => {
    clearInterval(countdownInterval);
    countdownInterval = null;

    cards.forEach((card) => {
      if (!card.matched) {
        card.revealed = false;
        updateCardAppearance(card.id);
      }
    });

    gameStarted = true;
    gameLocked = false;

    // Update all cards so they can now be clicked
    cards.forEach((card) => {
      updateCardAppearance(card.id);
    });

    messageDisplay.textContent =
      "Find the matching pairs!";

    startTimer();
  }, PREVIEW_SECONDS * 1000);
}

// Handle a card click
function handleCardClick(cardId) {
  if (gameLocked || !gameStarted || gameOver) return;

  const card = cards[cardId];

  if (
    !card ||
    card.matched ||
    card.revealed ||
    flippedCards.length >= 2
  ) {
    return;
  }

  // Reveal the selected card
  card.revealed = true;
  flippedCards.push(card);

  updateCardAppearance(cardId);

  // Wait until two cards have been selected
  if (flippedCards.length !== 2) return;

  moves++;
  movesDisplay.textContent = moves;

  const [firstCard, secondCard] = flippedCards;

  // Lock the board while processing the pair
  gameLocked = true;

  // The two cards match
  if (firstCard.emoji === secondCard.emoji) {
    firstCard.matched = true;
    secondCard.matched = true;

    matchedPairs++;

    playMatchSound();

    updateCardAppearance(firstCard.id);
    updateCardAppearance(secondCard.id);
    updateProgress();

    flippedCards = [];
    gameLocked = false;

    messageDisplay.textContent = "Great match! 🎉";

    // Check whether all pairs have been matched
    if (matchedPairs === TOTAL_PAIRS) {
      endGame();
      return;
    }

    // Refresh card availability
    cards.forEach((item) => {
      updateCardAppearance(item.id);
    });
  } else {
    // The cards do not match
    messageDisplay.textContent = "Not a match. Try again!";

    mismatchTimeout = setTimeout(() => {
      firstCard.revealed = false;
      secondCard.revealed = false;

      updateCardAppearance(firstCard.id);
      updateCardAppearance(secondCard.id);

      flippedCards = [];
      gameLocked = false;
      mismatchTimeout = null;

      messageDisplay.textContent =
        "Find the matching pairs!";

      // Re-enable unmatched, hidden cards
      cards.forEach((item) => {
        updateCardAppearance(item.id);
      });
    }, 900);
  }
}

// Finish the game and save the best score
function endGame() {
  gameOver = true;
  gameStarted = false;
  gameLocked = true;

  clearInterval(timerInterval);
  timerInterval = null;

  const isNewBest = bestScore === 0 || moves < bestScore;

  if (isNewBest) {
    bestScore = moves;
    saveBestScore(bestScore);
  }

  bestScoreDisplay.textContent = bestScore;

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  const formattedTime =
    `${String(minutes).padStart(2, "0")}:` +
    `${String(remainingSeconds).padStart(2, "0")}`;

  messageDisplay.textContent =
    `🎉 You won in ${moves} moves and ${formattedTime}!` +
    (isNewBest ? " New best score!" : " Well played!");

  // Keep all matched cards visible and disabled
  cards.forEach((card) => {
    updateCardAppearance(card.id);
  });

  // Celebrate the player's victory
playWinSound();
launchConfetti();
}

// Reset everything and start a fresh game
function restartGame() {
  // Cancel all timers from the previous game
  clearInterval(timerInterval);
  clearInterval(countdownInterval);
  clearTimeout(previewTimeout);
  clearTimeout(mismatchTimeout);

  timerInterval = null;
  countdownInterval = null;
  previewTimeout = null;
  mismatchTimeout = null;

  // Reset game state
  flippedCards = [];
  matchedPairs = 0;
  moves = 0;
  seconds = 0;

  gameStarted = false;
  gameLocked = true;
  gameOver = false;

  // Reset the displays
  movesDisplay.textContent = "0";
  timerDisplay.textContent = "00:00";
  bestScoreDisplay.textContent =
    bestScore > 0 ? bestScore : "--";

  progressDisplay.textContent = `0 / ${TOTAL_PAIRS}`;
  progressFill.style.width = "0%";

  messageDisplay.textContent = "Preparing your cards...";

  // Create and shuffle a new set of cards
  cards = createCards();
  renderCards();

  playShuffleSound();

  // Start the five-second preview
  startPreview();
}

// Start or restart the game when the button is clicked
restartButton.addEventListener("click", restartGame);

// Start the first game
restartGame();

// Invite a Friend feature
const inviteBtn = document.getElementById("inviteBtn");

inviteBtn.addEventListener("click", async () => {
    const inviteLink = window.location.href;

    try {
        await navigator.clipboard.writeText(inviteLink);
        alert("Game link copied! Share it with your friend.");
    } catch (error) {
        prompt("Copy this game link and share it:", inviteLink);
    }
});

