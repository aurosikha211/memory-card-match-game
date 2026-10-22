// Memory Match: 50 levels, coins, reveal power-up, sounds and confetti.
const EMOJI_POOL = [
  "🍎","🍌","🍇","🍉","🍓","🍒","🥝","🍍","🥑","🍋",
  "🍑","🥥","🍐","🫐","🥕","🌽","🍄","🌶️","🥦","🍪",
  "🍩","🍕","🍔","🍟","🌮","🍿","🧁","🍰","🍭","🍫"
];
const MAX_LEVEL = 50;
const STARTING_COINS = 30;
const LEVEL_REWARD = 20;
const REVEAL_COST = 10;
const REVEAL_SECONDS = 3;
const PREVIEW_SECONDS = 5;

const gameBoard = document.getElementById("game-board");
const movesDisplay = document.getElementById("moves");
const timerDisplay = document.getElementById("timer");
const bestScoreDisplay = document.getElementById("best-score");
const messageDisplay = document.getElementById("message");
const progressDisplay = document.getElementById("progress");
const progressFill = document.getElementById("progress-fill");
const restartButton = document.getElementById("restart");
const revealButton = document.getElementById("reveal");
const levelDisplay = document.getElementById("level");
const coinsDisplay = document.getElementById("coins");

let audioContext = null;
function getAudioContext() {
  if (!audioContext) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return null;
    audioContext = new AudioContextClass();
  }
  if (audioContext.state === "suspended") audioContext.resume().catch(() => {});
  return audioContext;
}
document.addEventListener("pointerdown", getAudioContext, { once: true });

function playTone(frequency, duration = 0.12, type = "sine", volume = 0.05) {
  const ctx = getAudioContext();
  if (!ctx || ctx.state !== "running") return;
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, ctx.currentTime);
  gain.gain.setValueAtTime(Math.max(volume, 0.001), ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
  oscillator.connect(gain);
  gain.connect(ctx.destination);
  oscillator.start();
  oscillator.stop(ctx.currentTime + duration);
}
function playTickSound() { playTone(1000, 0.035, "square", 0.012); }
function playShuffleSound() {
  [0,55,110,165,220].forEach(delay => setTimeout(() => playTone(300 + Math.random()*500, 0.045, "triangle", 0.025), delay));
}
function playMatchSound() {
  playTone(660, 0.12, "sine", 0.06);
  setTimeout(() => playTone(880, 0.16, "sine", 0.06), 100);
}
function playWinSound() {
  [523,659,784,1047,784,1047].forEach((frequency,index) => setTimeout(() => playTone(frequency,0.22,"sine",0.07),index*140));
}
function playCoinSound() {
  playTone(880,0.1,"sine",0.06);
  setTimeout(() => playTone(1175,0.13,"sine",0.06),90);
}
function launchConfetti() {
  const colors = ["#ff4757","#ffa502","#2ed573","#1e90ff","#e056fd","#f9ca24"];
  for (let i=0;i<120;i++) {
    const piece = document.createElement("span");
    piece.className = "confetti-piece";
    piece.style.left = Math.random()*100 + "vw";
    piece.style.backgroundColor = colors[Math.floor(Math.random()*colors.length)];
    piece.style.animationDuration = (2+Math.random()*2) + "s";
    piece.style.animationDelay = Math.random()*0.5 + "s";
    piece.style.setProperty("--drift",(Math.random()*200-100)+"px");
    document.body.appendChild(piece);
    piece.addEventListener("animationend",()=>piece.remove());
  }
}
function clearConfetti() {
  document.querySelectorAll(".confetti-piece").forEach(piece => piece.remove());
}

function loadNumber(key, fallback, min, max = Number.MAX_SAFE_INTEGER) {
  try {
    const value = Number(localStorage.getItem(key));
    return Number.isInteger(value) && value >= min && value <= max ? value : fallback;
  } catch { return fallback; }
}
let currentLevel = loadNumber("memoryCurrentLevel", 1, 1, MAX_LEVEL);
let unlockedLevel = loadNumber("memoryUnlockedLevel", 1, 1, MAX_LEVEL);
let coins = loadNumber("memoryCoins", STARTING_COINS, 0);
let bestScore = loadNumber("memoryBestScore", 0, 0);

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
function updateCoins() {
  coinsDisplay.textContent = coins;
  revealButton.disabled = coins < REVEAL_COST || !gameStarted || gameOver || gameLocked || revealActive || flippedCards.length > 0;
  revealButton.textContent = revealActive ? "Revealing..." : `Reveal · ${REVEAL_COST} 🪙`;
}
function updateLevelDisplay() {
  levelDisplay.textContent = currentLevel;
}
function pairsForLevel(level) {
  // Increase by one pair every ten levels: levels 1-10 = 8 pairs, 41-50 = 12 pairs.
  return Math.min(12, 8 + Math.floor((level - 1) / 10));
}
function emojisForLevel(level) {
  const pairCount = pairsForLevel(level);
  return shuffleCards(EMOJI_POOL).slice(0, pairCount);
}
let activeEmojis = emojisForLevel(currentLevel);
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

function shuffleCards(values) {
  const shuffled = [...values];
  for (let i=shuffled.length-1;i>0;i--) {
    const j = Math.floor(Math.random()*(i+1));
    [shuffled[i],shuffled[j]] = [shuffled[j],shuffled[i]];
  }
  return shuffled;
}
function createCards() {
  const values = shuffleCards([...activeEmojis,...activeEmojis]);
  return values.map((emoji,index)=>({id:index,emoji,revealed:true,matched:false}));
}
function renderCards() {
  gameBoard.innerHTML = "";

  // Calculate columns based on the number of pairs
  const pairs = cards.length / 2;
  const columns = pairs / 2;

  // Keep 4 rows and adjust columns for each level
  gameBoard.style.gridTemplateColumns =
    `repeat(${columns}, minmax(0, 1fr))`;
  gameBoard.style.gridTemplateRows =
    "repeat(4, minmax(0, 1fr))";

  cards.forEach(card => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "card";
    button.dataset.id = card.id;

    button.setAttribute("aria-label", `Card ${card.id + 1}`);

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
  const isVisible = card.revealed || card.matched;
  element.classList.toggle("flipped",isVisible);
  element.classList.toggle("matched",card.matched);
  element.disabled = gameLocked || card.matched || card.revealed || revealActive;
  if (card.matched) element.setAttribute("aria-label",`Matched ${card.emoji}`);
  else if (card.revealed) element.setAttribute("aria-label",card.emoji);
  else element.setAttribute("aria-label",`Hidden card ${card.id+1}`);
}
function updateProgress() {
  const totalPairs = activeEmojis.length;
  progressDisplay.textContent = `${matchedPairs} / ${totalPairs}`;
  progressFill.style.width = `${(matchedPairs/totalPairs)*100}%`;
}
function updateTimerDisplay() {
  timerDisplay.textContent = `${String(Math.floor(seconds/60)).padStart(2,"0")}:${String(seconds%60).padStart(2,"0")}`;
}
function startTimer() {
  clearInterval(timerInterval);
  timerInterval = setInterval(()=>{
    if (!gameStarted || gameOver) return;
    seconds++;
    updateTimerDisplay();
    playTickSound();
  },1000);
}
function refreshCards() {
  cards.forEach(card=>updateCardAppearance(card.id));
}
function startPreview() {
  gameStarted = false;
  gameLocked = true;
  cards.forEach(card=>{card.revealed=true;updateCardAppearance(card.id);});
  let countdown = PREVIEW_SECONDS;
  messageDisplay.textContent = `Level ${currentLevel}: memorize ${activeEmojis.length} pairs! Hiding in ${countdown}...`;
  updateCoins();
  countdownInterval = setInterval(()=>{
    countdown--;
    if (countdown>0) messageDisplay.textContent = `Memorize the cards! Hiding in ${countdown}...`;
  },1000);
  previewTimeout = setTimeout(()=>{
    clearInterval(countdownInterval);
    countdownInterval = null;
    cards.forEach(card=>{if(!card.matched) card.revealed=false;});
    gameStarted = true;
    gameLocked = false;
    refreshCards();
    messageDisplay.textContent = "Find the matching pairs!";
    updateCoins();
    startTimer();
  },PREVIEW_SECONDS*1000);
}
function handleCardClick(cardId) {
  if (gameLocked || !gameStarted || gameOver || revealActive) return;
  const card = cards[cardId];
  if (!card || card.matched || card.revealed || flippedCards.length>=2) return;
  card.revealed = true;
  flippedCards.push(card);
  updateCardAppearance(cardId);
  if (flippedCards.length!==2) return;
  moves++;
  movesDisplay.textContent = moves;
  const [firstCard,secondCard] = flippedCards;
  gameLocked = true;
  updateCoins();
  if (firstCard.emoji===secondCard.emoji) {
    firstCard.matched=true;
    secondCard.matched=true;
    matchedPairs++;
    playMatchSound();
    updateCardAppearance(firstCard.id);
    updateCardAppearance(secondCard.id);
    updateProgress();
    flippedCards=[];
    gameLocked=false;
    messageDisplay.textContent="Great match! 🎉";
    if (matchedPairs===activeEmojis.length) { endGame(); return; }
    refreshCards();
    updateCoins();
  } else {
    messageDisplay.textContent="Not a match. Try again!";
    mismatchTimeout=setTimeout(()=>{
      firstCard.revealed=false;
      secondCard.revealed=false;
      updateCardAppearance(firstCard.id);
      updateCardAppearance(secondCard.id);
      flippedCards=[];
      gameLocked=false;
      mismatchTimeout=null;
      messageDisplay.textContent="Find the matching pairs!";
      refreshCards();
      updateCoins();
    },900);
  }
}
function endGame() {
  gameOver=true;
  gameStarted=false;
  gameLocked=true;
  clearInterval(timerInterval);
  timerInterval=null;
  const isNewBest = bestScore===0 || moves<bestScore;
  if (isNewBest) bestScore=moves;
  const reward = LEVEL_REWARD + (moves <= activeEmojis.length*2 ? 10 : 0);
  coins += reward;
  playWinSound();
  playCoinSound();
  launchConfetti();
  bestScoreDisplay.textContent=bestScore;
  const formattedTime=`${String(Math.floor(seconds/60)).padStart(2,"0")}:${String(seconds%60).padStart(2,"0")}`;
  if (currentLevel < MAX_LEVEL) {
    unlockedLevel=Math.max(unlockedLevel,currentLevel+1);
    // Resume at the next unlocked level after a refresh, without changing the
    // level currently shown on the completed screen.
    try { localStorage.setItem("memoryCurrentLevel", String(unlockedLevel)); } catch (error) {}
    saveProgress();
    messageDisplay.textContent=`🎉 Level ${currentLevel} complete in ${moves} moves (${formattedTime})! +${reward} coins. Next level unlocked!`;
  } else {
    saveProgress();
    messageDisplay.textContent=`🏆 You completed all 50 levels! +${reward} coins. Amazing!`;
  }
  cards.forEach(card=>updateCardAppearance(card.id));
  restartButton.innerHTML = currentLevel < MAX_LEVEL
    ? '<span class="restart-icon" aria-hidden="true">➜</span> Next Level'
    : '<span class="restart-icon" aria-hidden="true">↻</span> Play Level 50 Again';
  updateCoins();
}
function startLevel(level) {
  currentLevel = Math.max(1,Math.min(MAX_LEVEL,level));
  activeEmojis = emojisForLevel(currentLevel);
  updateLevelDisplay();
  restartButton.innerHTML = '<span class="restart-icon" aria-hidden="true">↻</span> Restart Level';
  restartGame();
}
function restartGame() {
  clearInterval(timerInterval);
  clearInterval(countdownInterval);
  clearTimeout(previewTimeout);
  clearTimeout(mismatchTimeout);
  clearTimeout(revealTimeout);
  clearConfetti();
  timerInterval=countdownInterval=previewTimeout=mismatchTimeout=revealTimeout=null;
  revealActive=false;
  flippedCards=[];
  matchedPairs=0;
  moves=0;
  seconds=0;
  gameStarted=false;
  gameLocked=true;
  gameOver=false;
  movesDisplay.textContent="0";
  timerDisplay.textContent="00:00";
  bestScoreDisplay.textContent=bestScore>0?bestScore:"--";
  progressDisplay.textContent=`0 / ${activeEmojis.length}`;
  progressFill.style.width="0%";
  messageDisplay.textContent="Preparing your cards...";
  cards=createCards();
  renderCards();
  playShuffleSound();
  updateLevelDisplay();
  updateCoins();
  startPreview();
}
function revealCards() {
  if (!gameStarted || gameOver || gameLocked || revealActive || flippedCards.length > 0 || coins<REVEAL_COST) return;
  coins-=REVEAL_COST;
  saveProgress();
  revealActive=true;
  cards.forEach(card=>{if(!card.matched) card.revealed=true;});
  refreshCards();
  updateCoins();
  messageDisplay.textContent=`Cards revealed for ${REVEAL_SECONDS} seconds! Remember their positions.`;
  revealTimeout=setTimeout(()=>{
    cards.forEach(card=>{if(!card.matched && !flippedCards.includes(card)) card.revealed=false;});
    revealActive=false;
    refreshCards();
    updateCoins();
    messageDisplay.textContent="Find the matching pairs!";
    revealTimeout=null;
  },REVEAL_SECONDS*1000);
}
restartButton.addEventListener("click",()=>{
  if (gameOver && currentLevel<MAX_LEVEL) startLevel(currentLevel+1);
  else restartGame();
});
revealButton.addEventListener("click",revealCards);
updateLevelDisplay();
coinsDisplay.textContent=coins;
bestScoreDisplay.textContent=bestScore>0?bestScore:"--";
restartGame();
