
/* ---------- Game settings ---------- */

const symbols = [
  "🍎", "🍌", "🍇", "🍉",
  "🍓", "🍒", "🍍", "🥝"
];

const totalPairs = symbols.length;

/* ---------- HTML elements ---------- */

const cardGrid = document.getElementById("card-grid");
const movesElement = document.getElementById("moves");
const timerElement = document.getElementById("timer");
const matchedElement = document.getElementById("matched");
const bestScoreElement = document.getElementById("best-score");
const messageElement = document.getElementById("game-message");
const restartButton = document.getElementById("restart-button");

/* ---------- Game state ---------- */

let firstCard = null;
let secondCard = null;
let lockBoard = false;

let moves = 0;
let matchedPairs = 0;
let seconds = 0;

let timerInterval = null;
let mismatchTimeout = null;
let gameStarted = false;

/* ---------- Best score ---------- */

function getBestScore() {
  try {
    const savedScore = localStorage.getItem("memoryMatchBest");
    return savedScore ? JSON.parse(savedScore) : null;
  } catch (error) {
    return null;
  }
}

function displayBestScore() {
  const best = getBestScore();

  if (best && Number.isFinite(best.moves)) {
    bestScoreElement.textContent =
      `${best.moves} moves · ${formatTime(best.seconds)}`;
  } else {
    bestScoreElement.textContent = "Not set";
  }
}

function saveBestScore() {
  const best = getBestScore();

  // A lower move count is the better score.
  if (!best || moves < best.moves) {
    try {
      localStorage.setItem(
        "memoryMatchBest",
        JSON.stringify({ moves, seconds })
      );
    } catch (error) {
      // The game still works if browser storage is unavailable.
    }
  }

  displayBestScore();
}

/* ---------- Timer ---------- */

function formatTime(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const secondsRemaining = totalSeconds % 60;

  return (
    String(minutes).padStart(2, "0") +
    ":" +
    String(secondsRemaining).padStart(2, "0")
  );
}

function startTimer() {
  if (gameStarted) return;

  gameStarted = true;

  timerInterval = setInterval(() => {
    seconds++;
    timerElement.textContent = formatTime(seconds);
  }, 1000);
}

function stopTimer() {
  clearInterval(timerInterval);
  timerInterval = null;
}

/* ---------- Shuffle cards ---------- */

function shuffleCards(cards) {
  // Fisher-Yates shuffle algorithm.
  for (let i = cards.length - 1; i > 0; i--) {
    const randomIndex = Math.floor(Math.random() * (i + 1));

    [cards[i], cards[randomIndex]] =
      [cards[randomIndex], cards[i]];
  }

  return cards;
}

/* ---------- Create the game board ---------- */

function createBoard() {
  cardGrid.innerHTML = "";

  const cardSymbols = shuffleCards([...symbols, ...symbols]);

  cardSymbols.forEach((symbol, index) => {
    const card = document.createElement("button");

    card.type = "button";
    card.className = "card";
    card.dataset.symbol = symbol;
    card.setAttribute("aria-label", `Card ${index + 1}, hidden`);

    card.innerHTML = `
      <span class="card-face card-front" aria-hidden="true">?</span>
      <span class="card-face card-back" aria-hidden="true">${symbol}</span>
    `;

    card.addEventListener("click", () => flipCard(card));

    cardGrid.appendChild(card);
  });
}

/* ---------- Flip a card ---------- */

function flipCard(card) {
  // Ignore clicks while checking a pair.
  if (lockBoard) return;

  // Ignore cards that are already open or matched.
  if (
    card === firstCard ||
    card.classList.contains("flipped") ||
    card.classList.contains("matched")
  ) {
    return;
  }

  startTimer();

  card.classList.add("flipped");
  card.setAttribute(
    "aria-label",
    `Revealed ${card.dataset.symbol}`
  );

  if (!firstCard) {
    firstCard = card;
    messageElement.textContent = "Choose another card!";
    return;
  }

  secondCard = card;
  moves++;

  movesElement.textContent = moves;

  checkForMatch();
}

/* ---------- Check matching cards ---------- */

function checkForMatch() {
  const isMatch =
    firstCard.dataset.symbol === secondCard.dataset.symbol;

  if (isMatch) {
    handleMatch();
  } else {
    handleMismatch();
  }
}

/* ---------- Handle a match ---------- */

function handleMatch() {
  firstCard.classList.add("matched");
  secondCard.classList.add("matched");

  firstCard.disabled = true;
  secondCard.disabled = true;

  firstCard.setAttribute(
    "aria-label",
    `Matched ${firstCard.dataset.symbol}`
  );

  secondCard.setAttribute(
    "aria-label",
    `Matched ${secondCard.dataset.symbol}`
  );

  matchedPairs++;

  matchedElement.textContent = `${matchedPairs} / ${totalPairs}`;

  messageElement.textContent = "Great job! You found a pair.";

  resetTurn();

  if (matchedPairs === totalPairs) {
    finishGame();
  }
}

/* ---------- Handle a mismatch ---------- */

function handleMismatch() {
  lockBoard = true;

  messageElement.textContent = "Not a match. Try again!";

  mismatchTimeout = setTimeout(() => {
    if (firstCard && secondCard) {
      firstCard.classList.remove("flipped");
      secondCard.classList.remove("flipped");

      firstCard.setAttribute("aria-label", "Hidden card");
      secondCard.setAttribute("aria-label", "Hidden card");
    }

    resetTurn();
    messageElement.textContent = "Keep going! Find another pair.";
    mismatchTimeout = null;
  }, 900);
}

/* ---------- Reset the current turn ---------- */

function resetTurn() {
  firstCard = null;
  secondCard = null;
  lockBoard = false;
}

/* ---------- Finish the game ---------- */

function finishGame() {
  stopTimer();
  saveBestScore();

  messageElement.textContent =
    `🎉 You won in ${moves} moves and ${formatTime(seconds)}!`;

  messageElement.classList.add("success");

  // Prevent further interaction after winning.
  cardGrid.querySelectorAll(".card").forEach((card) => {
    card.disabled = true;
  });
}

/* ---------- Restart the game ---------- */

function restartGame() {
  stopTimer();

  if (mismatchTimeout !== null) {
    clearTimeout(mismatchTimeout);
    mismatchTimeout = null;
  }

  firstCard = null;
  secondCard = null;
  lockBoard = false;

  moves = 0;
  matchedPairs = 0;
  seconds = 0;
  gameStarted = false;

  movesElement.textContent = "0";
  timerElement.textContent = "00:00";
  matchedElement.textContent = `0 / ${totalPairs}`;

  messageElement.textContent = "Tap a card to reveal it!";
  messageElement.classList.remove("success");

  createBoard();
  displayBestScore();
}

/* ---------- Start the game ---------- */

restartButton.addEventListener("click", restartGame);

restartGame();
