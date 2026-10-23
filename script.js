
/* =========================================================
   MEMORY MATCH — script.js
   50 Levels | 8 Pairs | 10-Second Preview
   Designed & developed by Aurosikha Praharaj
   ========================================================= */

(() => {
  "use strict";

  // ---------------- CONFIGURATION ----------------

  const TOTAL_LEVELS = 50;
  const PAIRS_PER_LEVEL = 8;
  const PREVIEW_SECONDS = 10;
  const STARTING_COINS = 30;
  const LEVEL_REWARD = 20;
  const REVEAL_COST = 10;
  const MISMATCH_DELAY = 850;
  const REVEAL_DURATION = 1800;

  const $ = (id) => document.getElementById(id);

  // ---------------- GAME ELEMENTS ----------------

  const board = $("gameBoard") || $("memoryBoard");
  const movesDisplay = $("moves");
  const timeDisplay = $("timer") || $("time");
  const bestDisplay = $("best");
  const coinsDisplay = $("coins");
  const levelDisplay = $("levelNumber") || $("level");
  const progressDisplay = $("levelProgress");
  const previewDisplay = $("previewCountdown");

  const instructionsOverlay = $("instructionsOverlay") || $("instructionOverlay");
  const pauseOverlay = $("pauseOverlay");
  const levelCompleteOverlay = $("levelCompleteOverlay");
  const winOverlay = $("winOverlay");

  const enterButton = $("enterBtn") || $("enterButton");
  const pauseButton = $("pauseBtn") || $("pauseButton");
  const resumeButton = $("resumeBtn") || $("resumeButton");
  const revealButton = $("revealBtn") || $("revealButton");
  const restartButton = $("restartBtn") || $("restartButton");
  const startOverButton = $("startOverBtn") || $("startOverButton");
  const inviteButton = $("inviteBtn") || $("inviteButton");
  const nextLevelButton = $("nextLevelBtn") || $("nextLevelButton");
  const playAgainButton = $("playAgainBtn") || $("playAgainButton");

  const $all = (selector) => [...document.querySelectorAll(selector)];

  // ---------------- CARD SYMBOL COLLECTIONS ----------------

  const symbolSets = [
    ["🍎", "🍌", "🍇", "🍒", "🍉", "🍓", "🍍", "🥝"],
    ["🐶", "🐱", "🐼", "🦊", "🐸", "🐵", "🦁", "🐯"],
    ["⭐", "🌙", "☀️", "⚡", "🔥", "❄️", "🌈", "☄️"],
    ["🚀", "🚗", "🚲", "🚁", "🚂", "✈️", "⛵", "🚜"],
    ["💎", "👑", "💍", "🎁", "🎈", "🎯", "🎲", "🎸"],
    ["🌸", "🌻", "🌵", "🍀", "🍁", "🌹", "🌷", "🌼"],
    ["⚽", "🏀", "🏈", "⚾", "🎾", "🏐", "🏓", "🏸"],
    ["😀", "😎", "🤩", "🥳", "😺", "🤖", "👻", "👽"],
    ["♠", "♥", "♦", "♣", "★", "☆", "☯", "♛"],
    ["α", "β", "γ", "δ", "π", "Ω", "λ", "Σ"],
    ["0", "1", "2", "3", "4", "5", "6", "7"],
    ["A", "B", "C", "D", "E", "F", "G", "H"],
    ["!", "?", "@", "#", "$", "%", "&", "*"],
    ["☂", "☀", "☁", "☃", "☕", "♫", "✈", "✿"],
    ["🪐", "🌍", "🌕", "🌟", "🌌", "🛸", "🛰️", "🌠"],
    ["🍕", "🍔", "🍟", "🌮", "🍩", "🍪", "🍰", "🍿"],
    ["🐙", "🦋", "🐢", "🦉", "🦄", "🐬", "🦖", "🦩"],
    ["⚓", "🔑", "🔒", "🧭", "🪄", "🔮", "🧲", "🪙"],
    ["♩", "♪", "♫", "♬", "♭", "♮", "♯", "𝄞"],
    ["☮", "☢", "☣", "⚙", "⚖", "⚔", "⚜", "⚛"],
    ["🟥", "🟧", "🟨", "🟩", "🟦", "🟪", "⬛", "⬜"],
    ["🐝", "🐞", "🪲", "🦗", "🪳", "🦂", "🕷️", "🐜"],
    ["🌶️", "🥑", "🥕", "🌽", "🥥", "🍋", "🍑", "🫐"],
    ["🏆", "🥇", "🥈", "🥉", "🎖️", "🏅", "🎗️", "🎟️"],
    ["∞", "∑", "∏", "√", "∫", "≈", "≠", "±"]
  ];

  // Reuse the symbol collections for all 50 levels.
  function symbolsForLevel(level) {
    return symbolSets[(level - 1) % symbolSets.length];
  }

  // ---------------- GAME STATE ----------------

  let currentLevel = 1;
  let moves = 0;
  let matches = 0;
  let coins = loadNumber("memoryCoins", STARTING_COINS);
  let bestTime = loadNumber("memoryBestTime", 0);

  let firstCard = null;
  let secondCard = null;

  let started = false;
  let paused = false;
  let locked = false;
  let previewing = false;
  let revealing = false;
  let levelFinished = false;

  let elapsedSeconds = 0;
  let timerInterval = null;
  let previewInterval = null;
  let mismatchTimeout = null;
  let revealTimeout = null;
  let runStartedAt = 0;
  let previewRemaining = PREVIEW_SECONDS;
  let audioContext = null;

  // ---------------- UTILITIES ----------------

  function loadNumber(key, fallback) {
    try {
      const value = Number(localStorage.getItem(key));
      return Number.isFinite(value) && value >= 0 ? value : fallback;
    } catch {
      return fallback;
    }
  }

  function saveNumber(key, value) {
    try {
      localStorage.setItem(key, String(value));
    } catch {
      // Game remains playable if storage is unavailable.
    }
  }

  function shuffle(array) {
    const result = [...array];

    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }

    return result;
  }

  function formatTime(seconds) {
    const safeSeconds = Math.max(0, Math.floor(seconds));
    const minutes = Math.floor(safeSeconds / 60);
    const remaining = safeSeconds % 60;

    return `${String(minutes).padStart(2, "0")}:${String(remaining).padStart(2, "0")}`;
  }

  function setText(element, value) {
    if (element) element.textContent = value;
  }

  function show(element) {
    if (element) element.classList.remove("hidden");
  }

  function hide(element) {
    if (element) element.classList.add("hidden");
  }

  function updateStats() {
    setText(movesDisplay, moves);
    setText(timeDisplay, formatTime(elapsedSeconds));
    setText(coinsDisplay, coins);
    setText(levelDisplay, currentLevel);

    if (bestDisplay) {
      setText(bestDisplay, bestTime ? formatTime(bestTime) : "--:--");
    }

    if (progressDisplay) {
      setText(progressDisplay, `${matches}/${PAIRS_PER_LEVEL}`);
    }

    if (revealButton) {
      revealButton.disabled =
        !started ||
        paused ||
        previewing ||
        locked ||
        levelFinished ||
        coins < REVEAL_COST ||
        matches === PAIRS_PER_LEVEL;
    }

    if (pauseButton) {
      pauseButton.disabled = !started || levelFinished;
      pauseButton.textContent = paused ? "▶ Resume" : "⏸ Pause";
    }
  }

  function changeCoins(amount) {
    coins = Math.max(0, coins + amount);
    saveNumber("memoryCoins", coins);
    updateStats();
  }

  // ---------------- SOUND EFFECTS ----------------

  function getAudioContext() {
    if (!audioContext) {
      const AudioContextClass =
        window.AudioContext || window.webkitAudioContext;

      if (AudioContextClass) {
        audioContext = new AudioContextClass();
      }
    }

    if (audioContext && audioContext.state === "suspended") {
      audioContext.resume().catch(() => {});
    }

    return audioContext;
  }

  function playTone(frequency = 650, duration = 0.08, type = "sine", volume = 0.045) {
    try {
      const ctx = getAudioContext();
      if (!ctx) return;

      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();

      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, ctx.currentTime);

      gain.gain.setValueAtTime(volume, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(
        0.001,
        ctx.currentTime + duration
      );

      oscillator.connect(gain);
      gain.connect(ctx.destination);

      oscillator.start();
      oscillator.stop(ctx.currentTime + duration);
    } catch {
      // Sound is optional.
    }
  }

  function playTick() {
    playTone(850, 0.035, "square", 0.018);
  }

  function playCardFlip() {
    playTone(520, 0.07, "sine", 0.04);
  }

  function playMatch() {
    playTone(660, 0.1);
    setTimeout(() => playTone(880, 0.12), 90);
  }

  function playMismatch() {
    playTone(220, 0.13, "triangle", 0.035);
  }

  function playLevelComplete() {
    [523, 659, 784, 1047].forEach((frequency, index) => {
      setTimeout(() => playTone(frequency, 0.18), index * 100);
    });
  }

  // ---------------- TIMER ----------------

  function stopTimer() {
    clearInterval(timerInterval);
    timerInterval = null;
  }

  function startTimer() {
    stopTimer();

    if (!started || paused || previewing || levelFinished) return;

    runStartedAt = Date.now();

    timerInterval = setInterval(() => {
      if (paused || previewing || levelFinished) return;

      elapsedSeconds += Math.floor((Date.now() - runStartedAt) / 1000);
      runStartedAt = Date.now();

      playTick();
      updateStats();
    }, 1000);
  }

  // ---------------- CARD CREATION ----------------

  function makeCard(symbol, index) {
    const card = document.createElement("button");

    card.type = "button";
    card.className = "memory-card";
    card.setAttribute("aria-label", "Hidden card");
    card.dataset.symbol = symbol;
    card.dataset.index = index;
    card.dataset.matched = "false";

    card.innerHTML = `
      <span class="card-inner">
        <span class="card-back" aria-hidden="true">?</span>
        <span class="card-front" aria-hidden="true"></span>
      </span>
    `;

    const front = card.querySelector(".card-front");
    front.textContent = symbol;

    card.addEventListener("click", () => handleCardClick(card));

    return card;
  }

  function buildBoard() {
    if (!board) {
      console.error(
        "Memory Match: Add an element with id='gameBoard' or id='memoryBoard' to index.html."
      );
      return;
    }

    board.replaceChildren();

    const symbols = symbolsForLevel(currentLevel);
    const deck = shuffle([...symbols, ...symbols]);

    deck.forEach((symbol, index) => {
      board.appendChild(makeCard(symbol, index));
    });
  }

  function allCards() {
    return board ? [...board.querySelectorAll(".memory-card")] : [];
  }

  function flipCard(card, faceUp) {
    if (!card) return;

    card.classList.toggle("flipped", faceUp);
    card.classList.toggle("is-flipped", faceUp);
    card.setAttribute("aria-label", faceUp ? card.dataset.symbol : "Hidden card");
  }

  function markMatched(card) {
    card.dataset.matched = "true";
    card.classList.add("matched");
    card.disabled = true;
    card.setAttribute("aria-label", `${card.dataset.symbol}, matched`);
  }

  function hideUnmatchedCards() {
    allCards().forEach((card) => {
      if (card.dataset.matched !== "true") {
        flipCard(card, false);
      }
    });
  }

  // ---------------- LEVEL PREVIEW ----------------

  function beginPreview() {
    clearInterval(previewInterval);

    previewing = true;
    previewRemaining = PREVIEW_SECONDS;
    locked = true;

    allCards().forEach((card) => flipCard(card, true));

    if (previewDisplay) {
      previewDisplay.textContent = `Memorize! ${previewRemaining}s`;
      previewDisplay.classList.remove("hidden");
    }

    updateStats();

    previewInterval = setInterval(() => {
      if (paused) return;

      previewRemaining--;

      if (previewDisplay) {
        previewDisplay.textContent = `Memorize! ${previewRemaining}s`;
      }

      playTick();

      if (previewRemaining <= 0) {
        clearInterval(previewInterval);
        previewInterval = null;

        previewing = false;
        locked = false;

        hideUnmatchedCards();

        if (previewDisplay) {
          previewDisplay.textContent = "";
          previewDisplay.classList.add("hidden");
        }

        playTone(440, 0.12);
        startTimer();
        updateStats();
      }
    }, 1000);
  }

  // ---------------- MATCHING LOGIC ----------------

  function handleCardClick(card) {
    if (
      !started ||
      paused ||
      previewing ||
      locked ||
      levelFinished ||
      !card ||
      card.dataset.matched === "true" ||
      card === firstCard ||
      card.classList.contains("flipped") ||
      card.classList.contains("is-flipped")
    ) {
      return;
    }

    flipCard(card, true);
    playCardFlip();

    if (!firstCard) {
      firstCard = card;
      return;
    }

    secondCard = card;
    moves++;
    locked = true;
    updateStats();

    if (firstCard.dataset.symbol === secondCard.dataset.symbol) {
      markMatched(firstCard);
      markMatched(secondCard);

      matches++;
      firstCard = null;
      secondCard = null;
      locked = false;

      playMatch();
      updateStats();

      if (matches === PAIRS_PER_LEVEL) {
        completeLevel();
      }
    } else {
      playMismatch();

      mismatchTimeout = setTimeout(() => {
        if (paused) return;

        flipCard(firstCard, false);
        flipCard(secondCard, false);

        firstCard = null;
        secondCard = null;
        locked = false;

        updateStats();
      }, MISMATCH_DELAY);
    }
  }

  // ---------------- PAUSE / RESUME ----------------

  function pauseGame() {
    if (!started || paused || levelFinished) return;

    paused = true;
    stopTimer();

    // Keep the current preview countdown when pausing.
    // Its interval resumes when the game resumes.
    if (mismatchTimeout) {
      clearTimeout(mismatchTimeout);
      mismatchTimeout = null;
    }

    show(pauseOverlay);
    updateStats();
  }

  function resumeGame() {
    if (!paused) return;

    paused = false;
    hide(pauseOverlay);

    if (previewing) {
      // The preview interval is still active and will continue.
    } else if (firstCard && secondCard) {
      mismatchTimeout = setTimeout(() => {
        if (paused || !firstCard || !secondCard) return;

        flipCard(firstCard, false);
        flipCard(secondCard, false);

        firstCard = null;
        secondCard = null;
        locked = false;
        updateStats();
      }, MISMATCH_DELAY);
    } else {
      startTimer();
    }

    updateStats();
  }

  // ---------------- REVEAL POWER-UP ----------------

  function revealAllCards() {
    if (
      !started ||
      paused ||
      previewing ||
      locked ||
      levelFinished ||
      coins < REVEAL_COST
    ) {
      return;
    }

    changeCoins(-REVEAL_COST);
    revealing = true;
    locked = true;

    allCards().forEach((card) => {
      if (card.dataset.matched !== "true") {
        flipCard(card, true);
      }
    });

    playTone(740, 0.15);

    clearTimeout(revealTimeout);
    revealTimeout = setTimeout(() => {
      if (paused) return;

      hideUnmatchedCards();

      revealing = false;
      locked = false;
      updateStats();
    }, REVEAL_DURATION);

    updateStats();
  }

  // ---------------- LEVEL FLOW ----------------

  function clearGameTimers() {
    stopTimer();

    clearInterval(previewInterval);
    clearTimeout(mismatchTimeout);
    clearTimeout(revealTimeout);

    previewInterval = null;
    mismatchTimeout = null;
    revealTimeout = null;
  }

  function startLevel(level) {
    clearGameTimers();

    currentLevel = Math.max(1, Math.min(TOTAL_LEVELS, level));
    moves = 0;
    matches = 0;
    elapsedSeconds = 0;

    firstCard = null;
    secondCard = null;

    paused = false;
    locked = false;
    previewing = false;
    revealing = false;
    levelFinished = false;
    previewRemaining = PREVIEW_SECONDS;

    hide(pauseOverlay);
    hide(levelCompleteOverlay);
    hide(winOverlay);

    if (progressDisplay) {
      progressDisplay.textContent = `0/${PAIRS_PER_LEVEL}`;
    }

    if (progressDisplay) {
      progressDisplay.setAttribute("aria-label", "Matched pairs");
    }

    buildBoard();
    updateStats();

    if (started) {
      beginPreview();
    }
  }

  function completeLevel() {
    if (levelFinished) return;

    levelFinished = true;
    locked = true;

    clearGameTimers();

    bestTime = bestTime === 0
      ? elapsedSeconds
      : Math.min(bestTime, elapsedSeconds);

    saveNumber("memoryBestTime", bestTime);

    changeCoins(LEVEL_REWARD);

    playLevelComplete();
    burstConfetti();

    const completedLevelDisplay = $("completedLevel");
    const rewardDisplay = $("levelReward");
    const completedTimeDisplay = $("completedTime");

    setText(completedLevelDisplay, currentLevel);
    setText(rewardDisplay, `+${LEVEL_REWARD} coins`);
    setText(completedTimeDisplay, formatTime(elapsedSeconds));

    updateStats();

    if (currentLevel >= TOTAL_LEVELS) {
      show(winOverlay);
    } else {
      show(levelCompleteOverlay);
    }
  }

  function enterGame() {
    if (started) return;

    started = true;
    hide(instructionsOverlay);
    startLevel(1);
  }

  function restartCurrentLevel() {
    if (!started) {
      enterGame();
      return;
    }

    if (!window.confirm("Restart this level? Its timer and moves will reset.")) {
      return;
    }

    startLevel(currentLevel);
  }

  function startOver() {
    if (
      started &&
      !window.confirm("Start over from Level 1? Your earned coins will remain.")
    ) {
      return;
    }

    started = true;
    currentLevel = 1;

    hide(instructionsOverlay);
    startLevel(1);
  }

  function goToNextLevel() {
    if (!levelFinished || currentLevel >= TOTAL_LEVELS) return;

    startLevel(currentLevel + 1);
  }

  function playAgain() {
    started = true;
    currentLevel = 1;
    hide(winOverlay);
    startLevel(1);
  }

  // ---------------- INVITE FRIENDS ----------------

  async function inviteFriends() {
    const inviteText =
      "Let's play Memory Match! Test your memory and beat my score!";

    const inviteUrl = window.location.href;

    try {
      if (navigator.share) {
        await navigator.share({
          title: "Memory Match",
          text: inviteText,
          url: inviteUrl
        });
      } else if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(`${inviteText}\n${inviteUrl}`);
        alert("Invitation copied! Share it with your friends.");
      } else {
        window.prompt(
          "Copy this invitation and send it to your friends:",
          `${inviteText}\n${inviteUrl}`
        );
      }
    } catch (error) {
      if (error && error.name !== "AbortError") {
        window.prompt(
          "Copy this invitation and send it to your friends:",
          `${inviteText}\n${inviteUrl}`
        );
      }
    }
  }

  // ---------------- CONFETTI ----------------

  function burstConfetti() {
    const colors = [
      "#ffd54a",
      "#a78bfa",
      "#53e0d0",
      "#ff6b9a",
      "#ffffff",
      "#8b5cf6"
    ];

    const container = document.createElement("div");
    container.className = "confetti-container";
    container.setAttribute("aria-hidden", "true");

    Object.assign(container.style, {
      position: "fixed",
      inset: "0",
      pointerEvents: "none",
      overflow: "hidden",
      zIndex: "9999"
    });

    const particleCount = 100;

    for (let i = 0; i < particleCount; i++) {
      const piece = document.createElement("span");

      piece.className = "confetti-piece";

      Object.assign(piece.style, {
        position: "absolute",
        left: `${Math.random() * 100}%`,
        top: "-14px",
        width: `${5 + Math.random() * 8}px`,
        height: `${7 + Math.random() * 10}px`,
        backgroundColor: colors[Math.floor(Math.random() * colors.length)],
        borderRadius: Math.random() > 0.5 ? "50%" : "2px",
        opacity: "1",
        transform: `rotate(${Math.random() * 360}deg)`,
        animation: `memoryConfettiFall ${2 + Math.random() * 2.2}s linear forwards`,
        animationDelay: `${Math.random() * 0.7}s`
      });

      container.appendChild(piece);
    }

    if (!document.getElementById("memoryConfettiStyle")) {
      const style = document.createElement("style");
      style.id = "memoryConfettiStyle";
      style.textContent = `
        @keyframes memoryConfettiFall {
          0% {
            transform: translate3d(0, -10px, 0) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translate3d(var(--drift, 35px), 105vh, 0) rotate(800deg);
            opacity: 0;
          }
        }
      `;
      document.head.appendChild(style);
    }

    document.body.appendChild(container);

    setTimeout(() => container.remove(), 5000);
  }

  // ---------------- BUTTON EVENTS ----------------

  if (enterButton) {
    enterButton.addEventListener("click", enterGame);
  }

  if (pauseButton) {
    pauseButton.addEventListener("click", () => {
      if (paused) {
        resumeGame();
      } else {
        pauseGame();
      }
    });
  }

  if (resumeButton) {
    resumeButton.addEventListener("click", resumeGame);
  }

  if (revealButton) {
    revealButton.addEventListener("click", revealAllCards);
  }

  if (restartButton) {
    restartButton.addEventListener("click", restartCurrentLevel);
  }

  if (startOverButton) {
    startOverButton.addEventListener("click", startOver);
  }

  if (inviteButton) {
    inviteButton.addEventListener("click", inviteFriends);
  }

  if (nextLevelButton) {
    nextLevelButton.addEventListener("click", goToNextLevel);
  }

  if (playAgainButton) {
    playAgainButton.addEventListener("click", playAgain);
  }

  // Support an additional resume button in the pause overlay.
  $all("[data-action='resume']").forEach((button) => {
    button.addEventListener("click", resumeGame);
  });

  // Escape key toggles pause while playing.
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && started && !levelFinished) {
      if (paused) {
        resumeGame();
      } else {
        pauseGame();
      }
    }
  });

  // ---------------- INITIALIZATION ----------------

  function initializeGame() {
    if (!board) {
      console.error(
        "Memory Match couldn't find the game board. Add id='gameBoard' or id='memoryBoard' to your HTML."
      );
    }

    started = false;
    hide(pauseOverlay);
    hide(levelCompleteOverlay);
    hide(winOverlay);

    // Display the first level's cards behind the instructions.
    startLevel(1);

    // The instructions overlay should be visible when the page opens.
    if (instructionsOverlay) {
      show(instructionsOverlay);
    }

    updateStats();
  }

  initializeGame();

})();


/* Designer profile popup */
const designerLink = document.getElementById("designerLink");
const designerPopup = document.getElementById("designerPopup");
const closeDesignerPopup = document.getElementById("closeDesignerPopup");

function openDesignerPopup() {
  designerPopup.hidden = false;
  closeDesignerPopup.focus();
}

function closeDesignerProfile() {
  designerPopup.hidden = true;
  designerLink.focus();
}

designerLink.addEventListener("click", openDesignerPopup);
closeDesignerPopup.addEventListener("click", closeDesignerProfile);

// Close when clicking the dark backdrop
designerPopup.addEventListener("click", (event) => {
  if (event.target === designerPopup) {
    closeDesignerProfile();
  }
});

// Close with Escape
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !designerPopup.hidden) {
    closeDesignerProfile();
  }
});
