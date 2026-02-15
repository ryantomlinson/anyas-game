/* Plantgirl Super Race - V1
 * Canvas-only browser game based on the PRD.
 * Goals: readable code, kid-friendly feel, no fail state.
 */

(function () {
  "use strict";

  // ---------------------------------------------------------------------------
  // 1) Basic game loop and canvas setup
  // ---------------------------------------------------------------------------

  const canvas = document.getElementById("gameCanvas");
  const ctx = canvas.getContext("2d");

  const hud = document.getElementById("hud");
  const hudLevel = document.getElementById("hudLevel");
  const hudScore = document.getElementById("hudScore");
  const hudStars = document.getElementById("hudStars");
  const hudMeter = document.getElementById("hudMeter");
  const hudPower = document.getElementById("hudPower");

  const overlay = document.getElementById("overlay");
  const startPanel = document.getElementById("startPanel");
  const celebrationPanel = document.getElementById("celebrationPanel");
  const prizePanel = document.getElementById("prizePanel");
  const endPanel = document.getElementById("endPanel");

  const carChoicesEl = document.getElementById("carChoices");
  const startBtn = document.getElementById("startBtn");
  const toPrizeBtn = document.getElementById("toPrizeBtn");
  const celebrationScore = document.getElementById("celebrationScore");
  const prizeChoicesEl = document.getElementById("prizeChoices");
  const finalScoreEl = document.getElementById("finalScore");
  const finalBadgesEl = document.getElementById("finalBadges");
  const restartBtn = document.getElementById("restartBtn");

  const GAME = {
    width: canvas.width,
    height: canvas.height,
    roadX: canvas.width * 0.5,
    roadWidth: 420,
    laneCount: 3,
    laneWidth: 420 / 3,
    roadScroll: 0
  };

  const LEVELS = [
    // Duration target is around 2 minutes total per level feel, but tuned to stay lively.
    { id: 1, length: 17000, aiBonus: 0, obstacleEvery: 1.9, starEvery: 0.55, powerEvery: 10.0 },
    { id: 2, length: 18500, aiBonus: 10, obstacleEvery: 1.6, starEvery: 0.52, powerEvery: 9.5 },
    { id: 3, length: 20000, aiBonus: 18, obstacleEvery: 1.35, starEvery: 0.5, powerEvery: 9.0 }
  ];

  const CARS = [
    { id: "sun-blaze", name: "Sun Blaze", color: "#ff8a2e", speed: 245, handling: 8.2, icon: "☀️" },
    { id: "leaf-laser", name: "Leaf Laser", color: "#52d46f", speed: 236, handling: 8.8, icon: "🍃" },
    { id: "moon-bolt", name: "Moon Bolt", color: "#7ea1ff", speed: 252, handling: 7.9, icon: "🌙" },
    { id: "berry-boom", name: "Berry Boom", color: "#e95fca", speed: 241, handling: 8.4, icon: "🍓" }
  ];

  const OBSTACLE_TYPES = [
    { kind: "parked-car", label: "🚗", color: "#5f6f89" },
    { kind: "crazy-plant", label: "🌿", color: "#3ba347" },
    { kind: "beam", label: "🪵", color: "#9a6a38" }
  ];

  const STICKER_PRIZES = ["🌟", "🦋", "🌈", "⚡", "🌼", "💚", "🔥"];
  const COLOR_PRIZES = ["#ffcb2f", "#ff70b8", "#4de2e7", "#8aff5f", "#b18cff"];
  const BADGE_PRIZES = ["Star Sprinter", "Vine Hero", "Road Smile", "Plant Power", "Speed Buddy"];

  const state = {
    mode: "start", // start | racing | celebration | prize | end
    levelIndex: 0,
    selectedCarIndex: 0,

    score: 0,
    totalStars: 0,
    starsThisLevel: 0,
    prizeMeterTarget: 24,

    playerStickers: [],
    playerBadges: [],
    colorOverride: null,

    freezeTimeRemaining: 0,
    celebrationTime: 0,
    collisionFlash: 0
  };

  // Game objects are kept in arrays for very simple update/draw loops.
  const world = {
    player: null,
    opponents: [],
    stars: [],
    obstacles: [],
    powers: [],
    particles: [],
    celebrationDrops: [],
    timers: {
      star: 0,
      obstacle: 0,
      power: 0
    }
  };

  // ---------------------------------------------------------------------------
  // 2) Player movement (auto-forward + steering) and input
  // ---------------------------------------------------------------------------

  const input = {
    boost: false,
    touchStartX: null
  };

  function laneCenter(laneIndex) {
    const roadLeft = GAME.roadX - GAME.roadWidth * 0.5;
    return roadLeft + GAME.laneWidth * (laneIndex + 0.5);
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function moveLane(direction) {
    if (state.mode !== "racing") return;
    const player = world.player;
    player.lane = clamp(player.lane + direction, 0, GAME.laneCount - 1);
    player.targetX = laneCenter(player.lane);
  }

  window.addEventListener("keydown", (event) => {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      if (!event.repeat) moveLane(-1);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      if (!event.repeat) moveLane(1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      input.boost = true;
    }
  });

  window.addEventListener("keyup", (event) => {
    if (event.key === "ArrowUp") {
      input.boost = false;
    }
  });

  canvas.addEventListener("pointerdown", (event) => {
    input.touchStartX = event.clientX;
  });

  canvas.addEventListener("pointerup", (event) => {
    if (input.touchStartX == null || state.mode !== "racing") return;
    const deltaX = event.clientX - input.touchStartX;
    if (deltaX > 24) moveLane(1);
    else if (deltaX < -24) moveLane(-1);
    input.touchStartX = null;
  });

  // ---------------------------------------------------------------------------
  // 3) Lane system and entity spawning helpers
  // ---------------------------------------------------------------------------

  function randomLane() {
    return Math.floor(Math.random() * GAME.laneCount);
  }

  function spawnStar() {
    world.stars.push({
      lane: randomLane(),
      x: 0,
      y: -30,
      size: 12 + Math.random() * 4
    });
  }

  function spawnObstacle() {
    const obstacleType = OBSTACLE_TYPES[Math.floor(Math.random() * OBSTACLE_TYPES.length)];
    world.obstacles.push({
      lane: randomLane(),
      x: 0,
      y: -42,
      width: 48,
      height: 36,
      type: obstacleType,
      hitCooldown: 0
    });
  }

  function spawnPower() {
    world.powers.push({
      lane: randomLane(),
      x: 0,
      y: -36,
      size: 18
    });
  }

  // ---------------------------------------------------------------------------
  // 4) Stars and scoring
  // ---------------------------------------------------------------------------

  function collectStar(index) {
    world.stars.splice(index, 1);
    state.totalStars += 1;
    state.starsThisLevel += 1;
    state.score += 10;
    playStarSound();
    spawnSparkle(world.player.x, world.player.y - 24, "#fff59d", 12);
  }

  function prizeMeterPercent() {
    const percent = (state.starsThisLevel / state.prizeMeterTarget) * 100;
    return Math.max(0, Math.min(100, percent));
  }

  // ---------------------------------------------------------------------------
  // 5) AI opponent cars
  // ---------------------------------------------------------------------------

  function createOpponents(levelConfig, playerBaseSpeed) {
    world.opponents = [];
    for (let i = 0; i < 3; i += 1) {
      const lane = i % GAME.laneCount;
      const speedVariance = Math.random() * 22 - 10;
      world.opponents.push({
        lane,
        targetLane: lane,
        x: laneCenter(lane),
        y: 190 - i * 125,
        width: 46,
        height: 78,
        speed: playerBaseSpeed + levelConfig.aiBonus + speedVariance,
        laneTimer: 1.0 + Math.random() * 1.8,
        frozenTimer: 0,
        color: ["#ff7d5a", "#4bb7ff", "#ffc84a"][i]
      });
    }
  }

  // ---------------------------------------------------------------------------
  // 6) Obstacles and collision slowdown (no fail state)
  // ---------------------------------------------------------------------------

  function isOverlapping(a, b) {
    return (
      Math.abs(a.x - b.x) < (a.width + b.width) * 0.42 &&
      Math.abs(a.y - b.y) < (a.height + b.height) * 0.42
    );
  }

  function onObstacleCollision(obstacle) {
    if (obstacle.hitCooldown > 0) return;
    obstacle.hitCooldown = 0.7;
    world.player.slowdownTimer = Math.max(world.player.slowdownTimer, 0.85);
    world.player.bumpTimer = 0.2;
    state.collisionFlash = 0.2;
    playBumpSound();
    spawnSparkle(world.player.x, world.player.y - 14, "#ff9d9d", 14);
  }

  // ---------------------------------------------------------------------------
  // 7) Vine Freeze powerup
  // ---------------------------------------------------------------------------

  function activateVineFreeze() {
    state.freezeTimeRemaining = 3.2; // Easy Mode: a little generous.
    playFreezeSound();
    spawnSparkle(world.player.x, world.player.y - 40, "#8bff97", 20);

    const nearbyRange = 260;
    world.opponents.forEach((opponent) => {
      if (Math.abs(opponent.y - world.player.y) < nearbyRange) {
        opponent.frozenTimer = Math.max(opponent.frozenTimer, state.freezeTimeRemaining);
      }
    });
  }

  // ---------------------------------------------------------------------------
  // 8) Level progression (3 levels)
  // ---------------------------------------------------------------------------

  function createPlayerFromSelection() {
    const car = CARS[state.selectedCarIndex];
    const color = state.colorOverride || car.color;
    return {
      lane: 1,
      x: laneCenter(1),
      targetX: laneCenter(1),
      y: GAME.height - 110,
      width: 52,
      height: 90,
      baseSpeed: car.speed,
      handling: car.handling,
      color,
      bumpTimer: 0,
      slowdownTimer: 0
    };
  }

  function resetLevelState(levelIndex) {
    const levelConfig = LEVELS[levelIndex];
    state.starsThisLevel = 0;
    state.freezeTimeRemaining = 0;
    state.collisionFlash = 0;

    world.player = createPlayerFromSelection();
    world.playerDistance = 0;
    world.stars.length = 0;
    world.obstacles.length = 0;
    world.powers.length = 0;
    world.particles.length = 0;
    world.celebrationDrops.length = 0;
    world.timers.star = 0.4;
    world.timers.obstacle = 1.4;
    world.timers.power = 6.0;

    createOpponents(levelConfig, world.player.baseSpeed);
  }

  function startLevel(levelIndex) {
    state.levelIndex = levelIndex;
    state.mode = "racing";
    hideAllPanels();
    overlay.classList.add("hidden");
    hud.classList.remove("hidden");

    resetLevelState(levelIndex);
    updateHud();
  }

  function completeLevel() {
    state.mode = "celebration";
    state.celebrationTime = 0;
    celebrationScore.textContent = `Score: ${state.score}`;
    playVictorySound();
    createCelebrationDrops();

    hideAllPanels();
    overlay.classList.remove("hidden");
    celebrationPanel.classList.remove("hidden");
  }

  // ---------------------------------------------------------------------------
  // 9) Prize selection screen
  // ---------------------------------------------------------------------------

  function randomFrom(array) {
    return array[Math.floor(Math.random() * array.length)];
  }

  function makePrizeChoices() {
    const choices = [
      { type: "sticker", value: randomFrom(STICKER_PRIZES), title: "Sticker" },
      { type: "color", value: randomFrom(COLOR_PRIZES), title: "Car Color" },
      { type: "badge", value: randomFrom(BADGE_PRIZES), title: "Badge" }
    ];

    // Shuffle so choices do not always appear in the same order.
    for (let i = choices.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      const temp = choices[i];
      choices[i] = choices[j];
      choices[j] = temp;
    }
    return choices;
  }

  function showPrizeScreen() {
    state.mode = "prize";
    hideAllPanels();
    overlay.classList.remove("hidden");
    prizePanel.classList.remove("hidden");

    const choices = makePrizeChoices();
    prizeChoicesEl.innerHTML = "";

    choices.forEach((choice) => {
      const button = document.createElement("button");
      button.className = "choice-button";

      if (choice.type === "sticker") button.textContent = `${choice.title}: ${choice.value}`;
      if (choice.type === "color") button.textContent = `${choice.title}: Paint it!`;
      if (choice.type === "badge") button.textContent = `${choice.title}: ${choice.value}`;

      button.addEventListener("click", () => {
        if (choice.type === "sticker") {
          state.playerStickers.push(choice.value);
        } else if (choice.type === "color") {
          state.colorOverride = choice.value;
        } else if (choice.type === "badge") {
          state.playerBadges.push(choice.value);
          state.score += 25;
        }

        if (state.levelIndex < LEVELS.length - 1) {
          startLevel(state.levelIndex + 1);
        } else {
          showFinalScreen();
        }
      });

      prizeChoicesEl.appendChild(button);
    });
  }

  // ---------------------------------------------------------------------------
  // 10) End-of-level celebration and final game completion
  // ---------------------------------------------------------------------------

  function createCelebrationDrops() {
    const emojis = ["👍", "😄", "🎉", "✨", "🌟"];
    for (let i = 0; i < 70; i += 1) {
      world.celebrationDrops.push({
        x: Math.random() * GAME.width,
        y: -Math.random() * GAME.height * 0.75,
        speed: 70 + Math.random() * 170,
        emoji: emojis[Math.floor(Math.random() * emojis.length)],
        sway: Math.random() * Math.PI * 2
      });
    }
  }

  function updateCelebration(dt) {
    state.celebrationTime += dt;
    world.celebrationDrops.forEach((drop) => {
      drop.y += drop.speed * dt;
      drop.sway += dt * 2.2;
      drop.x += Math.sin(drop.sway) * 18 * dt;
      if (drop.y > GAME.height + 30) {
        drop.y = -20;
        drop.x = Math.random() * GAME.width;
      }
    });
  }

  function showFinalScreen() {
    state.mode = "end";
    hideAllPanels();
    overlay.classList.remove("hidden");
    endPanel.classList.remove("hidden");
    hud.classList.add("hidden");

    finalScoreEl.textContent = `Final Score: ${state.score}`;
    finalBadgesEl.textContent = state.playerBadges.length
      ? `Badges: ${state.playerBadges.join(", ")}`
      : "Badges: None yet (still awesome!).";
  }

  // ---------------------------------------------------------------------------
  // 11) Basic sounds and game juice (tiny procedural audio)
  // ---------------------------------------------------------------------------

  let audioCtx = null;
  let musicIntervalId = null;
  let musicStep = 0;

  function ensureAudio() {
    if (!audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;
      audioCtx = new AudioContextClass();
    }
    if (audioCtx.state === "suspended") {
      audioCtx.resume().catch(() => {
        // If resume fails we simply keep silent.
      });
    }
  }

  function playTone(freq, duration, type, volume) {
    if (!audioCtx) return;
    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(now);
    osc.stop(now + duration);
  }

  function startMusicLoop() {
    if (musicIntervalId) return;
    const melody = [262, 330, 392, 330, 294, 349, 392, 330];
    musicIntervalId = window.setInterval(() => {
      if (state.mode !== "racing") return;
      const note = melody[musicStep % melody.length];
      musicStep += 1;
      playTone(note, 0.09, "triangle", 0.012);
    }, 280);
  }

  function playStarSound() {
    ensureAudio();
    playTone(740, 0.08, "triangle", 0.035);
    playTone(990, 0.06, "triangle", 0.025);
  }

  function playFreezeSound() {
    ensureAudio();
    playTone(220, 0.16, "sawtooth", 0.03);
    playTone(160, 0.14, "sine", 0.03);
  }

  function playBumpSound() {
    ensureAudio();
    playTone(120, 0.09, "square", 0.03);
  }

  function playVictorySound() {
    ensureAudio();
    playTone(392, 0.12, "triangle", 0.04);
    setTimeout(() => playTone(523, 0.12, "triangle", 0.04), 110);
    setTimeout(() => playTone(659, 0.16, "triangle", 0.04), 220);
  }

  function spawnSparkle(x, y, color, amount) {
    for (let i = 0; i < amount; i += 1) {
      world.particles.push({
        x,
        y,
        vx: (Math.random() - 0.5) * 180,
        vy: -Math.random() * 120,
        life: 0.45 + Math.random() * 0.3,
        color
      });
    }
  }

  // ---------------------------------------------------------------------------
  // Core race update
  // ---------------------------------------------------------------------------

  function updateHud() {
    hudLevel.textContent = String(state.levelIndex + 1);
    hudScore.textContent = String(state.score);
    hudStars.textContent = String(state.totalStars);
    hudMeter.textContent = `${Math.round(prizeMeterPercent())}%`;
    hudPower.textContent = state.freezeTimeRemaining > 0 ? `${state.freezeTimeRemaining.toFixed(1)}s` : "Ready";
  }

  function updateRacing(dt) {
    const level = LEVELS[state.levelIndex];
    const player = world.player;

    if (player.bumpTimer > 0) player.bumpTimer -= dt;
    if (player.slowdownTimer > 0) player.slowdownTimer -= dt;
    if (state.collisionFlash > 0) state.collisionFlash -= dt;
    if (state.freezeTimeRemaining > 0) state.freezeTimeRemaining -= dt;

    // Base speed with tiny boost and collision slowdown (still no fail state).
    let speed = player.baseSpeed;
    if (input.boost) speed *= 1.16;
    if (player.slowdownTimer > 0) speed *= 0.62;

    player.x += (player.targetX - player.x) * Math.min(1, dt * player.handling * 6.2);
    world.playerDistance += speed * dt;
    GAME.roadScroll += speed * dt;

    // Spawning cadence is time-based for consistent feel at any frame rate.
    world.timers.star -= dt;
    world.timers.obstacle -= dt;
    world.timers.power -= dt;

    if (world.timers.star <= 0) {
      spawnStar();
      world.timers.star = level.starEvery + Math.random() * 0.3;
    }
    if (world.timers.obstacle <= 0) {
      spawnObstacle();
      world.timers.obstacle = level.obstacleEvery + Math.random() * 0.6;
    }
    if (world.timers.power <= 0) {
      spawnPower();
      world.timers.power = level.powerEvery + Math.random() * 1.8;
    }

    const playerBox = {
      x: player.x,
      y: player.y,
      width: player.width,
      height: player.height
    };

    for (let i = world.stars.length - 1; i >= 0; i -= 1) {
      const star = world.stars[i];
      star.x = laneCenter(star.lane);
      star.y += speed * dt;
      if (star.y > GAME.height + 40) {
        world.stars.splice(i, 1);
        continue;
      }
      if (Math.abs(star.x - playerBox.x) < 32 && Math.abs(star.y - playerBox.y) < 52) {
        collectStar(i);
      }
    }

    for (let i = world.powers.length - 1; i >= 0; i -= 1) {
      const power = world.powers[i];
      power.x = laneCenter(power.lane);
      power.y += speed * dt;
      if (power.y > GAME.height + 40) {
        world.powers.splice(i, 1);
        continue;
      }
      if (Math.abs(power.x - playerBox.x) < 34 && Math.abs(power.y - playerBox.y) < 54) {
        world.powers.splice(i, 1);
        activateVineFreeze();
      }
    }

    for (let i = world.obstacles.length - 1; i >= 0; i -= 1) {
      const obstacle = world.obstacles[i];
      obstacle.x = laneCenter(obstacle.lane);
      obstacle.y += speed * dt;
      obstacle.hitCooldown = Math.max(0, obstacle.hitCooldown - dt);
      if (obstacle.y > GAME.height + 50) {
        world.obstacles.splice(i, 1);
        continue;
      }

      if (
        isOverlapping(
          playerBox,
          { x: obstacle.x, y: obstacle.y, width: obstacle.width, height: obstacle.height }
        )
      ) {
        onObstacleCollision(obstacle);
      }
    }

    // Opponent behavior is deliberately gentle and forgiving.
    world.opponents.forEach((opponent) => {
      if (opponent.frozenTimer > 0) {
        opponent.frozenTimer -= dt;
      } else {
        const relativeSpeed = (opponent.speed - speed) + 36;
        opponent.y += relativeSpeed * dt;
        opponent.laneTimer -= dt;
        if (opponent.laneTimer <= 0) {
          const laneShift = Math.random() < 0.5 ? -1 : 1;
          opponent.targetLane = clamp(opponent.targetLane + laneShift, 0, GAME.laneCount - 1);
          opponent.laneTimer = 1.1 + Math.random() * 1.9;
        }
      }

      const desiredX = laneCenter(opponent.targetLane);
      opponent.x += (desiredX - opponent.x) * Math.min(1, dt * 6.8);

      if (opponent.y > GAME.height + 120) {
        opponent.y = -120 - Math.random() * 220;
        opponent.targetLane = randomLane();
        opponent.speed = world.player.baseSpeed + LEVELS[state.levelIndex].aiBonus + (Math.random() * 25 - 12);
      }
      if (opponent.y < -200) {
        opponent.y = -80;
      }
    });

    for (let i = world.particles.length - 1; i >= 0; i -= 1) {
      const p = world.particles[i];
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 180 * dt;
      if (p.life <= 0) world.particles.splice(i, 1);
    }

    if (world.playerDistance >= level.length) {
      completeLevel();
    }

    updateHud();
  }

  // ---------------------------------------------------------------------------
  // Rendering
  // ---------------------------------------------------------------------------

  function drawBackground() {
    const sky = ctx.createLinearGradient(0, 0, 0, GAME.height);
    sky.addColorStop(0, "#3d72ff");
    sky.addColorStop(0.55, "#1f3f9a");
    sky.addColorStop(1, "#163073");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, GAME.width, GAME.height);

    // Side grass strips.
    const roadLeft = GAME.roadX - GAME.roadWidth * 0.5;
    const roadRight = GAME.roadX + GAME.roadWidth * 0.5;
    ctx.fillStyle = "#2a9f55";
    ctx.fillRect(0, 0, roadLeft, GAME.height);
    ctx.fillRect(roadRight, 0, GAME.width - roadRight, GAME.height);

    // Tiny city blocks for playful background.
    for (let i = 0; i < 7; i += 1) {
      const x = 8 + i * 34;
      const h = 40 + (i % 3) * 18;
      ctx.fillStyle = i % 2 ? "#8eb2ff" : "#d0dcff";
      ctx.fillRect(x, 120 - h, 24, h);
    }
    for (let i = 0; i < 7; i += 1) {
      const x = GAME.width - 8 - i * 34;
      const h = 42 + ((i + 1) % 3) * 18;
      ctx.fillStyle = i % 2 ? "#8eb2ff" : "#d0dcff";
      ctx.fillRect(x - 24, 120 - h, 24, h);
    }
  }

  function drawRoad() {
    const roadLeft = GAME.roadX - GAME.roadWidth * 0.5;
    const roadTop = 0;
    const roadHeight = GAME.height;
    ctx.fillStyle = "#2f3642";
    ctx.fillRect(roadLeft, roadTop, GAME.roadWidth, roadHeight);

    ctx.strokeStyle = "#f8f8ff";
    ctx.lineWidth = 4;
    ctx.strokeRect(roadLeft, roadTop, GAME.roadWidth, roadHeight);

    // Lane markers scroll to suggest speed.
    ctx.strokeStyle = "#fff7a2";
    ctx.lineWidth = 5;
    ctx.setLineDash([28, 24]);
    ctx.lineDashOffset = -(GAME.roadScroll % 52);
    for (let lane = 1; lane < GAME.laneCount; lane += 1) {
      const x = roadLeft + lane * GAME.laneWidth;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, GAME.height);
      ctx.stroke();
    }
    ctx.setLineDash([]);
  }

  function drawCar(x, y, width, height, color, stickers, frozenVines) {
    const bumpOffset = world.player && world.player.bumpTimer > 0 ? Math.sin(Date.now() * 0.05) * 3 : 0;
    const carY = y + bumpOffset;
    const r = 14;

    ctx.fillStyle = color;
    roundRect(ctx, x - width / 2, carY - height / 2, width, height, r, true, false);

    ctx.fillStyle = "rgba(255,255,255,0.28)";
    roundRect(ctx, x - width * 0.26, carY - height * 0.24, width * 0.52, height * 0.36, 7, true, false);

    ctx.fillStyle = "#1f2334";
    ctx.fillRect(x - width * 0.44, carY - 20, width * 0.15, 11);
    ctx.fillRect(x + width * 0.29, carY - 20, width * 0.15, 11);
    ctx.fillRect(x - width * 0.44, carY + 9, width * 0.15, 11);
    ctx.fillRect(x + width * 0.29, carY + 9, width * 0.15, 11);

    if (stickers && stickers.length) {
      ctx.font = "17px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const shown = stickers.slice(-2).join(" ");
      ctx.fillText(shown, x, carY + 2);
    }

    if (frozenVines) {
      ctx.strokeStyle = "#74ff80";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x - width * 0.35, carY - height * 0.35);
      ctx.quadraticCurveTo(x, carY - height * 0.15, x - width * 0.2, carY + height * 0.2);
      ctx.quadraticCurveTo(x + width * 0.12, carY + height * 0.35, x + width * 0.32, carY + height * 0.1);
      ctx.stroke();
    }
  }

  function drawStar(star) {
    ctx.save();
    ctx.translate(star.x, star.y);
    ctx.fillStyle = "#ffed70";
    ctx.strokeStyle = "#f7b500";
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < 10; i += 1) {
      const angle = (-Math.PI / 2) + (i * Math.PI) / 5;
      const radius = i % 2 === 0 ? star.size : star.size * 0.46;
      const px = Math.cos(angle) * radius;
      const py = Math.sin(angle) * radius;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  function drawObstacle(obstacle) {
    ctx.fillStyle = obstacle.type.color;
    roundRect(
      ctx,
      obstacle.x - obstacle.width * 0.5,
      obstacle.y - obstacle.height * 0.5,
      obstacle.width,
      obstacle.height,
      8,
      true,
      false
    );
    ctx.font = "20px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(obstacle.type.label, obstacle.x, obstacle.y + 1);
  }

  function drawPower(power) {
    const pulse = 0.92 + Math.sin((Date.now() + power.y * 8) * 0.01) * 0.1;
    ctx.beginPath();
    ctx.fillStyle = "#6aff78";
    ctx.arc(power.x, power.y, power.size * pulse, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#1f9441";
    ctx.font = "22px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("🌿", power.x, power.y + 1);
  }

  function drawParticles() {
    world.particles.forEach((p) => {
      ctx.globalAlpha = Math.max(0, Math.min(1, p.life * 1.4));
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x, p.y, 4, 4);
    });
    ctx.globalAlpha = 1;
  }

  function drawCelebrationDrops() {
    ctx.font = "26px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    world.celebrationDrops.forEach((drop) => {
      ctx.fillText(drop.emoji, drop.x, drop.y);
    });
  }

  function drawProgressBar() {
    if (state.mode !== "racing") return;
    const level = LEVELS[state.levelIndex];
    const progress = clamp(world.playerDistance / level.length, 0, 1);

    const x = 18;
    const y = GAME.height - 22;
    const width = 230;
    const height = 11;

    ctx.fillStyle = "rgba(0,0,0,0.35)";
    roundRect(ctx, x, y, width, height, 6, true, false);
    ctx.fillStyle = "#85ff95";
    roundRect(ctx, x, y, width * progress, height, 6, true, false);
  }

  function render() {
    drawBackground();
    drawRoad();

    world.stars.forEach(drawStar);
    world.obstacles.forEach(drawObstacle);
    world.powers.forEach(drawPower);

    world.opponents.forEach((opponent) => {
      const wobble = opponent.frozenTimer > 0 ? Math.sin(Date.now() * 0.028) * 2.5 : 0;
      drawCar(
        opponent.x + wobble,
        opponent.y,
        opponent.width,
        opponent.height,
        opponent.color,
        [],
        opponent.frozenTimer > 0
      );
    });

    if (world.player) {
      drawCar(
        world.player.x,
        world.player.y,
        world.player.width,
        world.player.height,
        state.colorOverride || CARS[state.selectedCarIndex].color,
        state.playerStickers,
        false
      );

      // Plantgirl icon badge on the car.
      ctx.font = "20px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("🦸‍♀️", world.player.x, world.player.y - 34);
    }

    drawParticles();
    drawProgressBar();

    if (state.mode === "celebration") {
      drawCelebrationDrops();
      ctx.fillStyle = "rgba(255,255,255,0.06)";
      ctx.fillRect(0, 0, GAME.width, GAME.height);
    }

    if (state.collisionFlash > 0) {
      ctx.fillStyle = `rgba(255, 130, 130, ${state.collisionFlash * 0.35})`;
      ctx.fillRect(0, 0, GAME.width, GAME.height);
    }
  }

  function roundRect(context, x, y, width, height, radius, fill, stroke) {
    context.beginPath();
    context.moveTo(x + radius, y);
    context.lineTo(x + width - radius, y);
    context.quadraticCurveTo(x + width, y, x + width, y + radius);
    context.lineTo(x + width, y + height - radius);
    context.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    context.lineTo(x + radius, y + height);
    context.quadraticCurveTo(x, y + height, x, y + height - radius);
    context.lineTo(x, y + radius);
    context.quadraticCurveTo(x, y, x + radius, y);
    context.closePath();
    if (fill) context.fill();
    if (stroke) context.stroke();
  }

  // ---------------------------------------------------------------------------
  // UI helpers
  // ---------------------------------------------------------------------------

  function hideAllPanels() {
    startPanel.classList.add("hidden");
    celebrationPanel.classList.add("hidden");
    prizePanel.classList.add("hidden");
    endPanel.classList.add("hidden");
  }

  function renderCarChoiceButtons() {
    carChoicesEl.innerHTML = "";
    CARS.forEach((car, index) => {
      const button = document.createElement("button");
      button.className = "choice-button";
      if (index === state.selectedCarIndex) button.classList.add("selected");
      button.innerHTML = `<strong>${car.icon} ${car.name}</strong><br>Speed ${Math.round(car.speed)} / Handling ${car.handling.toFixed(1)}`;
      button.addEventListener("click", () => {
        state.selectedCarIndex = index;
        renderCarChoiceButtons();
      });
      carChoicesEl.appendChild(button);
    });
  }

  function resetWholeGame() {
    state.mode = "start";
    state.levelIndex = 0;
    state.score = 0;
    state.totalStars = 0;
    state.starsThisLevel = 0;
    state.playerStickers = [];
    state.playerBadges = [];
    state.colorOverride = null;
    state.freezeTimeRemaining = 0;
    state.celebrationTime = 0;
    input.boost = false;

    world.opponents = [];
    world.stars = [];
    world.obstacles = [];
    world.powers = [];
    world.particles = [];
    world.celebrationDrops = [];
    world.player = createPlayerFromSelection();

    overlay.classList.remove("hidden");
    hud.classList.add("hidden");
    hideAllPanels();
    startPanel.classList.remove("hidden");
    renderCarChoiceButtons();
    updateHud();
  }

  startBtn.addEventListener("click", () => {
    ensureAudio();
    startMusicLoop();
    state.score = 0;
    state.totalStars = 0;
    state.playerBadges = [];
    state.playerStickers = [];
    state.colorOverride = null;
    startLevel(0);
  });

  toPrizeBtn.addEventListener("click", () => {
    showPrizeScreen();
  });

  restartBtn.addEventListener("click", () => {
    resetWholeGame();
  });

  // ---------------------------------------------------------------------------
  // Main game loop
  // ---------------------------------------------------------------------------

  let previousTime = performance.now();
  function frame(currentTime) {
    const dt = Math.min(0.05, (currentTime - previousTime) / 1000);
    previousTime = currentTime;

    if (state.mode === "racing") {
      updateRacing(dt);
    } else if (state.mode === "celebration") {
      updateCelebration(dt);
    }

    render();
    requestAnimationFrame(frame);
  }

  // Initial screen
  resetWholeGame();
  requestAnimationFrame(frame);
})();
