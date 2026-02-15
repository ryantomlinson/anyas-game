/* Plantgirl Super Race - V2 3D (Fullscreen + Mobile)
 * Three.js rendered directly into the browser window.
 * Spacebar activates Vine Freeze. Touch zones for mobile.
 */

(function () {
  "use strict";

  if (!window.THREE) {
    alert("Local Three.js file missing. Ensure v2-3d/three.min.js exists.");
    return;
  }

  // ---------------------------------------------------------------------------
  // DOM references
  // ---------------------------------------------------------------------------
  const mount = document.getElementById("sceneMount");
  const hudEl = document.getElementById("hud");
  const hudLevel = document.getElementById("hudLevel");
  const hudScore = document.getElementById("hudScore");
  const hudStars = document.getElementById("hudStars");
  const hudMeterFill = document.getElementById("hudMeterFill");
  const hudFreeze = document.getElementById("hudFreeze");
  const freezeBlock = document.getElementById("freezeBlock");
  const progressBar = document.getElementById("progressBar");
  const progressFill = document.getElementById("progressFill");
  const touchControls = document.getElementById("touchControls");
  const touchLeft = document.getElementById("touchLeft");
  const touchRight = document.getElementById("touchRight");
  const touchPower = document.getElementById("touchPower");

  const overlay = document.getElementById("overlay");
  const celebrationFx = document.getElementById("celebrationFx");
  const startPanel = document.getElementById("startPanel");
  const celebrationPanel = document.getElementById("celebrationPanel");
  const prizePanel = document.getElementById("prizePanel");
  const endPanel = document.getElementById("endPanel");

  const carChoicesEl = document.getElementById("carChoices");
  const prizeChoicesEl = document.getElementById("prizeChoices");
  const startBtn = document.getElementById("startBtn");
  const toPrizeBtn = document.getElementById("toPrizeBtn");
  const restartBtn = document.getElementById("restartBtn");
  const celebrationScore = document.getElementById("celebrationScore");
  const finalScoreEl = document.getElementById("finalScore");
  const finalBadgesEl = document.getElementById("finalBadges");

  const countdownOverlay = document.getElementById("countdownOverlay");
  const countdownText = document.getElementById("countdownText");
  const comboDisplay = document.getElementById("comboDisplay");
  const comboTextEl = document.getElementById("comboText");
  const screenshotBtn = document.getElementById("screenshotBtn");
  const shareBtn = document.getElementById("shareBtn");
  const loadingScreen = document.getElementById("loadingScreen");
  const garagePanel = document.getElementById("garagePanel");
  const garageCar = document.getElementById("garageCar");
  const garageStickers = document.getElementById("garageStickers");
  const garageBtn = document.getElementById("garageBtn");
  const garageBackBtn = document.getElementById("garageBackBtn");
  const trophyPanel = document.getElementById("trophyPanel");
  const trophyList = document.getElementById("trophyList");
  const trophyEmpty = document.getElementById("trophyEmpty");
  const trophyBtn = document.getElementById("trophyBtn");
  const trophyBackBtn = document.getElementById("trophyBackBtn");
  const milestoneOverlay = document.getElementById("milestoneOverlay");
  const milestoneText = document.getElementById("milestoneText");

  // Detect if device has touch capability.
  const isTouchDevice = "ontouchstart" in window || navigator.maxTouchPoints > 0;

  // ---------------------------------------------------------------------------
  // Game design constants
  // ---------------------------------------------------------------------------
  const LANES_X = [-3.2, 0, 3.2];
  const LEVELS = [
    { id: 1, length: 1700, aiBonus: 0, obstacleEvery: 2.0, starEvery: 0.55, powerEvery: 11.0 },
    { id: 2, length: 1900, aiBonus: 4, obstacleEvery: 1.6, starEvery: 0.53, powerEvery: 10.2 },
    { id: 3, length: 2100, aiBonus: 7, obstacleEvery: 1.3, starEvery: 0.5, powerEvery: 9.4 }
  ];

  const CARS = [
    { id: "sun", name: "Sun Blaze", color: "#ff8f3a", speed: 26.0, handling: 8.2, icon: "☀️" },
    { id: "leaf", name: "Leaf Laser", color: "#46d66f", speed: 25.2, handling: 9.0, icon: "🍃" },
    { id: "moon", name: "Moon Bolt", color: "#6da2ff", speed: 27.2, handling: 7.7, icon: "🌙" },
    { id: "berry", name: "Berry Boom", color: "#e663ca", speed: 26.2, handling: 8.4, icon: "🍓" }
  ];

  const STICKER_PRIZES = ["🌟", "🌈", "💚", "⚡", "🦋", "🌼", "🔥"];
  const COLOR_PRIZES = ["#ffcb2f", "#ff70b8", "#4de2e7", "#8aff5f", "#b18cff"];
  const BADGE_PRIZES = ["Vine Hero", "Star Sprinter", "Road Smile", "Plant Power", "Speed Buddy"];

  const OBSTACLE_TYPES = [
    { kind: "parked", color: "#667792" },
    { kind: "plant", color: "#3ea94d" },
    { kind: "beam", color: "#a97643" }
  ];

  // ---------------------------------------------------------------------------
  // Runtime state
  // ---------------------------------------------------------------------------
  const state = {
    mode: "start",
    levelIndex: 0,
    selectedCarIndex: 0,
    score: 0,
    totalStars: 0,
    starsThisLevel: 0,
    prizeMeterTarget: 24,
    freezeTimeRemaining: 0,
    freezeCharges: 0,
    celebrationTime: 0,
    playerStickers: [],
    playerBadges: [],
    colorOverride: null,
    // Phase 2
    shakeTimer: 0,          // 2.1 screen shake
    slowmoTimer: 0,          // 2.2 slow-motion on freeze
    comboCount: 0,           // 2.3 combo
    lastStarTime: 0,         // 2.3 time of last star pickup
    laneWobble: 0,           // 2.4 wobble impulse
    // Phase 3
    shielded: false,         // 3.1 shield active
    magnetTimer: 0,          // 3.2 magnet remaining time
    finishPosition: 1        // 3.5 finishing position
  };

  const input = {
    boost: false
  };

  const world = {
    player: null,
    opponents: [],
    stars: [],
    obstacles: [],
    powers: [],
    laneDashMeshes: [],
    sideLights: [],
    cloudPuffs: [],
    mountainRidges: [],
    shields: [],           // Phase 3.1
    magnets: [],           // Phase 3.2
    speedLines: [],        // Phase 1.1
    burstParticles: [],    // Phase 1.2
    trailParticles: [],    // Phase 1.4
    skybox: null,          // Phase 1.6
    timers: { star: 0, obstacle: 0, power: 0, shield: 0, magnet: 0, bonusPattern: 0 },
    playerDistance: 0,
    opponentDistances: [0, 0, 0] // Phase 3.5
  };

  // Phase 1.3: freeze flash DOM element
  var freezeFlashEl = document.getElementById("freezeFlash");

  // Phase 1.5: Day/night level themes
  var LEVEL_THEMES = [
    { bg: "#4a8cff", fog: "#5a94ff", fogNear: 45, fogFar: 280, hemiSky: "#d4ecff", hemiGround: "#4a8f3a", sunColor: "#fff8e6", sunIntensity: 1.3, rimColor: "#8ad4ff", exposure: 1.2 },
    { bg: "#e06830", fog: "#c45830", fogNear: 38, fogFar: 240, hemiSky: "#ffd0a8", hemiGround: "#5a3f1a", sunColor: "#ffb870", sunIntensity: 0.95, rimColor: "#ff8e50", exposure: 1.05 },
    { bg: "#0a0e28", fog: "#0e1438", fogNear: 28, fogFar: 200, hemiSky: "#2a3468", hemiGround: "#0a1820", sunColor: "#8090cc", sunIntensity: 0.5, rimColor: "#4060ff", exposure: 0.85 }
  ];

  // ---------------------------------------------------------------------------
  // Phase 4: Persistent progression via localStorage
  // ---------------------------------------------------------------------------
  var SAVE_KEY = "plantgirl_save";
  function loadSave() {
    try {
      var raw = localStorage.getItem(SAVE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) { /* ignore */ }
    return { unlockedCars: [0, 1], trophies: [], cumulativeStars: 0, highScore: 0, stickers: [] };
  }
  function writeSave(data) {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(data)); } catch (e) { /* ignore */ }
  }
  var saveData = loadSave();

  // Phase 4.2: Car unlocking — cars at index 2 and 3 are locked initially
  function isCarUnlocked(index) {
    return saveData.unlockedCars.indexOf(index) >= 0;
  }
  function unlockCar(index) {
    if (saveData.unlockedCars.indexOf(index) < 0) {
      saveData.unlockedCars.push(index);
      writeSave(saveData);
    }
  }

  // Phase 4.3: Trophy shelf
  function addTrophy(name) {
    if (saveData.trophies.indexOf(name) < 0) {
      saveData.trophies.push(name);
      writeSave(saveData);
    }
  }

  // Phase 4.4: Star milestones
  var MILESTONES = [50, 100, 200, 500];
  var lastMilestoneShown = 0;
  function checkMilestones() {
    for (var m = 0; m < MILESTONES.length; m += 1) {
      if (saveData.cumulativeStars >= MILESTONES[m] && MILESTONES[m] > lastMilestoneShown) {
        lastMilestoneShown = MILESTONES[m];
        showMilestone(MILESTONES[m]);
        break;
      }
    }
  }
  var milestoneTimeout = null;
  function showMilestone(count) {
    milestoneText.textContent = "⭐ " + count + " STARS! ⭐";
    milestoneOverlay.classList.remove("hidden");
    milestoneText.style.animation = "none";
    void milestoneText.offsetWidth;
    milestoneText.style.animation = "";
    if (milestoneTimeout) clearTimeout(milestoneTimeout);
    milestoneTimeout = setTimeout(function () { milestoneOverlay.classList.add("hidden"); }, 2200);
  }

  // Phase 4.1: Garage panel display
  function showGarage() {
    hidePanels();
    garagePanel.classList.remove("hidden");
    var carIcon = CARS[state.selectedCarIndex].icon;
    garageCar.textContent = carIcon;
    garageStickers.innerHTML = "";
    var allStickers = saveData.stickers.concat(state.playerStickers);
    if (allStickers.length === 0) {
      garageStickers.innerHTML = "<span style='font-size:14px;color:rgba(255,255,255,0.4)'>No stickers yet</span>";
    } else {
      allStickers.forEach(function (s) {
        var el = document.createElement("span");
        el.textContent = s;
        garageStickers.appendChild(el);
      });
    }
  }

  // Phase 4.3: Trophy panel display
  function showTrophyShelf() {
    hidePanels();
    trophyPanel.classList.remove("hidden");
    trophyList.innerHTML = "";
    if (saveData.trophies.length === 0) {
      trophyEmpty.style.display = "";
    } else {
      trophyEmpty.style.display = "none";
      saveData.trophies.forEach(function (t) {
        var el = document.createElement("div");
        el.className = "trophy-item";
        el.textContent = "🏆 " + t;
        trophyList.appendChild(el);
      });
    }
  }

  // ---------------------------------------------------------------------------
  // Three.js scene setup — FULLSCREEN
  // ---------------------------------------------------------------------------
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.16;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  mount.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#13245f");
  scene.fog = new THREE.Fog("#1d2f73", 35, 250);

  const camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.1, 900);
  camera.position.set(0, 6.6, 15.5);
  const cameraLookTarget = new THREE.Vector3(0, 1.4, -14);
  camera.lookAt(cameraLookTarget);

  const hemi = new THREE.HemisphereLight("#c9dcff", "#2f4f23", 1.1);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight("#fff3d8", 1.15);
  sun.position.set(-18, 25, -10);
  sun.castShadow = true;
  sun.shadow.mapSize.width = 1024;
  sun.shadow.mapSize.height = 1024;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 140;
  sun.shadow.camera.left = -20;
  sun.shadow.camera.right = 20;
  sun.shadow.camera.top = 20;
  sun.shadow.camera.bottom = -20;
  scene.add(sun);

  const rim = new THREE.PointLight("#6fc3ff", 0.8, 120);
  rim.position.set(0, 4, 20);
  scene.add(rim);

  const worldGroup = new THREE.Group();
  scene.add(worldGroup);

  function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  window.addEventListener("resize", resize);
  resize();

  // ---------------------------------------------------------------------------
  // Utility helpers
  // ---------------------------------------------------------------------------
  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function randomLaneIndex() {
    return Math.floor(Math.random() * LANES_X.length);
  }

  function randomFrom(array) {
    return array[Math.floor(Math.random() * array.length)];
  }

  function shuffleInPlace(array) {
    for (let i = array.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = array[i];
      array[i] = array[j];
      array[j] = tmp;
    }
    return array;
  }

  // ---------------------------------------------------------------------------
  // 3D building blocks
  // ---------------------------------------------------------------------------
  function makeRoad() {
    const roadMaterial = new THREE.MeshStandardMaterial({ color: "#2a2f3a", roughness: 0.82, metalness: 0.08 });
    const road = new THREE.Mesh(new THREE.PlaneGeometry(12.5, 1400), roadMaterial);
    road.rotation.x = -Math.PI / 2;
    road.position.z = -640;
    road.receiveShadow = true;
    worldGroup.add(road);

    const shoulderMat = new THREE.MeshStandardMaterial({ color: "#2e9758", roughness: 1.0, metalness: 0 });
    const left = new THREE.Mesh(new THREE.PlaneGeometry(8, 1400), shoulderMat);
    left.rotation.x = -Math.PI / 2;
    left.position.set(-10.4, -0.01, -640);
    left.receiveShadow = true;
    worldGroup.add(left);
    const right = left.clone();
    right.position.x = 10.4;
    worldGroup.add(right);

    const railMat = new THREE.MeshStandardMaterial({ color: "#dce4ff", emissive: "#5a7ae0", emissiveIntensity: 0.26, roughness: 0.36, metalness: 0.65 });
    const railGeo = new THREE.BoxGeometry(0.22, 0.32, 1400);
    const leftRail = new THREE.Mesh(railGeo, railMat);
    leftRail.position.set(-6.3, 0.18, -640);
    leftRail.castShadow = true;
    leftRail.receiveShadow = true;
    worldGroup.add(leftRail);
    const rightRail = leftRail.clone();
    rightRail.position.x = 6.3;
    worldGroup.add(rightRail);

    const dashGeo = new THREE.BoxGeometry(0.22, 0.06, 2.4);
    const dashMat = new THREE.MeshStandardMaterial({ color: "#fff5a8", emissive: "#8c7a36", emissiveIntensity: 0.24 });
    [-1.6, 1.6].forEach(function (x) {
      for (let i = 0; i < 90; i += 1) {
        const dash = new THREE.Mesh(dashGeo, dashMat);
        dash.position.set(x, 0.03, -i * 8.0);
        dash.receiveShadow = true;
        worldGroup.add(dash);
        world.laneDashMeshes.push(dash);
      }
    });

    const bulbGeo = new THREE.SphereGeometry(0.14, 12, 12);
    for (let i = 0; i < 80; i += 1) {
      const z = -i * 16;
      const bulb = new THREE.Mesh(bulbGeo, new THREE.MeshStandardMaterial({ color: "#4befff", emissive: "#31d7ff", emissiveIntensity: 1.1, metalness: 0.15, roughness: 0.28 }));
      bulb.position.set(-6.8, 0.3, z);
      bulb.castShadow = true;
      worldGroup.add(bulb);
      world.sideLights.push(bulb);
      const r = bulb.clone();
      r.position.x = 6.8;
      worldGroup.add(r);
      world.sideLights.push(r);
    }
  }

  function makeSkyCity() {
    const cityGroup = new THREE.Group();
    worldGroup.add(cityGroup);

    const buildingGeo = new THREE.BoxGeometry(3.2, 1, 3.2);
    const colors = ["#8da7ff", "#90d8ff", "#c0d6ff", "#8df1d2"];
    for (let i = 0; i < 110; i += 1) {
      const mesh = new THREE.Mesh(buildingGeo, new THREE.MeshStandardMaterial({ color: randomFrom(colors), roughness: 0.95, metalness: 0.08, emissive: "#1b2f65", emissiveIntensity: 0.2 }));
      mesh.position.x = (Math.random() < 0.5 ? -1 : 1) * (14 + Math.random() * 16);
      mesh.position.z = -Math.random() * 1300;
      mesh.position.y = 0.45;
      mesh.scale.y = 1.2 + Math.random() * 8.6;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      cityGroup.add(mesh);
    }

    const ridgeMat = new THREE.MeshStandardMaterial({ color: "#5976b8", roughness: 0.95, metalness: 0.02 });
    for (let i = 0; i < 24; i += 1) {
      const ridge = new THREE.Mesh(new THREE.ConeGeometry(4 + Math.random() * 3, 4 + Math.random() * 5, 6), ridgeMat);
      ridge.position.set((Math.random() < 0.5 ? -1 : 1) * (24 + Math.random() * 10), 1.6, -30 - i * 45);
      ridge.castShadow = true;
      ridge.receiveShadow = true;
      worldGroup.add(ridge);
      world.mountainRidges.push(ridge);
    }

    const cloudMat = new THREE.MeshStandardMaterial({ color: "#e9f4ff", emissive: "#b4d8ff", emissiveIntensity: 0.2, transparent: true, opacity: 0.88 });
    const cloudGeo = new THREE.SphereGeometry(1.4, 12, 12);
    for (let i = 0; i < 36; i += 1) {
      const puff = new THREE.Mesh(cloudGeo, cloudMat);
      puff.scale.set(1 + Math.random() * 1.6, 0.6 + Math.random() * 0.5, 1 + Math.random() * 1.2);
      puff.position.set((Math.random() - 0.5) * 70, 12 + Math.random() * 7, -20 - Math.random() * 720);
      worldGroup.add(puff);
      world.cloudPuffs.push({ mesh: puff, drift: (Math.random() - 0.5) * 0.8 });
    }
  }

  function updateScenery(dt, speed) {
    world.cloudPuffs.forEach(function (entry) {
      entry.mesh.position.z += speed * dt * 0.2;
      entry.mesh.position.x += entry.drift * dt;
      if (entry.mesh.position.z > 40) entry.mesh.position.z -= 760;
      if (entry.mesh.position.x > 36) entry.mesh.position.x = -36;
      if (entry.mesh.position.x < -36) entry.mesh.position.x = 36;
    });
    world.mountainRidges.forEach(function (ridge) {
      ridge.position.z += speed * dt * 0.35;
      if (ridge.position.z > 80) ridge.position.z -= 1120;
    });
  }

  // ---------------------------------------------------------------------------
  // Car mesh builder
  // ---------------------------------------------------------------------------
  function createCarMesh(hexColor) {
    const group = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({ color: hexColor, roughness: 0.34, metalness: 0.52 });
    const canopyMat = new THREE.MeshStandardMaterial({ color: "#ddf4ff", roughness: 0.14, metalness: 0.2, transparent: true, opacity: 0.9 });
    const tireMat = new THREE.MeshStandardMaterial({ color: "#20222f", roughness: 0.92, metalness: 0.04 });

    const body = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.58, 2.2), bodyMat);
    body.position.y = 0.48;
    body.castShadow = true;
    body.receiveShadow = true;
    group.add(body);

    const roof = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.45, 1.0), canopyMat);
    roof.position.set(0, 0.88, 0.08);
    roof.castShadow = true;
    group.add(roof);

    const spoiler = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.08, 0.23), bodyMat);
    spoiler.position.set(0, 0.74, -1.03);
    spoiler.castShadow = true;
    group.add(spoiler);

    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.03, 1.2), new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.4, metalness: 0.3 }));
    stripe.position.set(0, 0.79, 0.36);
    stripe.castShadow = true;
    group.add(stripe);

    const wheelGeo = new THREE.CylinderGeometry(0.24, 0.24, 0.16, 16);
    [[-0.58, 0.24, 0.75], [0.58, 0.24, 0.75], [-0.58, 0.24, -0.75], [0.58, 0.24, -0.75]].forEach(function (pos) {
      const wheel = new THREE.Mesh(wheelGeo, tireMat);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(pos[0], pos[1], pos[2]);
      wheel.castShadow = true;
      group.add(wheel);
    });

    const hlMat = new THREE.MeshStandardMaterial({ color: "#ffeccd", emissive: "#ffd584", emissiveIntensity: 1.2, roughness: 0.2 });
    const hlGeo = new THREE.SphereGeometry(0.1, 10, 10);
    const hl1 = new THREE.Mesh(hlGeo, hlMat);
    hl1.position.set(-0.35, 0.55, 1.08);
    group.add(hl1);
    const hl2 = hl1.clone();
    hl2.position.x = 0.35;
    group.add(hl2);

    const underGlow = new THREE.Mesh(new THREE.CircleGeometry(0.95, 20), new THREE.MeshStandardMaterial({ color: hexColor, emissive: hexColor, emissiveIntensity: 0.45, transparent: true, opacity: 0.42 }));
    underGlow.rotation.x = -Math.PI / 2;
    underGlow.position.y = 0.05;
    group.add(underGlow);

    const shadow = new THREE.Mesh(new THREE.CircleGeometry(1.05, 20), new THREE.MeshBasicMaterial({ color: "#000000", transparent: true, opacity: 0.23 }));
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.01;
    group.add(shadow);

    const vine = new THREE.Mesh(new THREE.TorusGeometry(0.72, 0.07, 10, 40), new THREE.MeshStandardMaterial({ color: "#78ff8e", emissive: "#44dd66", emissiveIntensity: 0.8, roughness: 0.5 }));
    vine.rotation.x = Math.PI / 2;
    vine.position.y = 0.62;
    vine.visible = false;
    group.add(vine);

    group.scale.setScalar(1.12);
    return { group: group, bodyMaterial: bodyMat, vine: vine, underGlow: underGlow };
  }

  function createStarMesh() {
    const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.36, 0), new THREE.MeshStandardMaterial({ color: "#ffe971", emissive: "#ffbe1a", emissiveIntensity: 0.72, roughness: 0.3, metalness: 0.1 }));
    m.castShadow = true;
    return m;
  }

  function createPowerMesh() {
    const g = new THREE.Group();
    const orb = new THREE.Mesh(new THREE.SphereGeometry(0.44, 16, 16), new THREE.MeshStandardMaterial({ color: "#7dff92", emissive: "#42d868", emissiveIntensity: 0.84, roughness: 0.15, metalness: 0.1 }));
    orb.castShadow = true;
    g.add(orb);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.64, 0.05, 12, 48), new THREE.MeshStandardMaterial({ color: "#b8ffd0", emissive: "#6efca0", emissiveIntensity: 0.7 }));
    ring.rotation.x = Math.PI / 2;
    g.add(ring);
    return g;
  }

  function createObstacleMesh(type) {
    const g = new THREE.Group();
    const b = new THREE.Mesh(new THREE.BoxGeometry(1.18, 0.7, 1.4), new THREE.MeshStandardMaterial({ color: type.color, roughness: 0.8, metalness: 0.08 }));
    b.position.y = 0.36;
    b.castShadow = true;
    b.receiveShadow = true;
    g.add(b);
    return g;
  }

  // ---------------------------------------------------------------------------
  // Phase 3.1: Shield powerup mesh (blue orb)
  // ---------------------------------------------------------------------------
  function createShieldMesh() {
    var g = new THREE.Group();
    var orb = new THREE.Mesh(new THREE.SphereGeometry(0.42, 16, 16), new THREE.MeshStandardMaterial({ color: "#4da8ff", emissive: "#2080ff", emissiveIntensity: 0.9, roughness: 0.12, metalness: 0.15, transparent: true, opacity: 0.88 }));
    orb.castShadow = true;
    g.add(orb);
    var shell = new THREE.Mesh(new THREE.SphereGeometry(0.58, 16, 16), new THREE.MeshBasicMaterial({ color: "#80c0ff", transparent: true, opacity: 0.25, wireframe: true }));
    g.add(shell);
    return g;
  }

  // Phase 3.2: Magnet powerup mesh (purple)
  function createMagnetMesh() {
    var g = new THREE.Group();
    var orb = new THREE.Mesh(new THREE.SphereGeometry(0.38, 16, 16), new THREE.MeshStandardMaterial({ color: "#c060ff", emissive: "#9030dd", emissiveIntensity: 0.85, roughness: 0.15, metalness: 0.1 }));
    orb.castShadow = true;
    g.add(orb);
    var ring = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.06, 12, 48), new THREE.MeshStandardMaterial({ color: "#e0a0ff", emissive: "#b060ff", emissiveIntensity: 0.6 }));
    ring.rotation.x = Math.PI / 2;
    g.add(ring);
    return g;
  }

  // Phase 3.1: Shield visual (transparent sphere around player car)
  var shieldVisual = null;
  function createShieldVisual() {
    shieldVisual = new THREE.Mesh(new THREE.SphereGeometry(1.6, 20, 20), new THREE.MeshBasicMaterial({ color: "#4da8ff", transparent: true, opacity: 0.18, wireframe: false }));
    shieldVisual.visible = false;
    return shieldVisual;
  }

  // Phase 3.4: Bonus star patterns
  var STAR_PATTERNS = [
    [[0, 0], [1, -4], [2, -8], [1, -12], [0, -16]],
    [[0, 0], [0, -4], [1, -8], [1, -12], [2, -16]],
    [[0, 0], [1, -3], [2, -6], [1, -9], [0, -12], [1, -15], [2, -18]],
    [[1, 0], [0, -3], [2, -3], [1, -6], [0, -9], [2, -9]]
  ];

  function spawnBonusPattern() {
    var pattern = randomFrom(STAR_PATTERNS);
    var baseZ = -185;
    pattern.forEach(function (pos) {
      var lane = pos[0];
      var zOff = pos[1];
      var mesh = createStarMesh();
      mesh.position.set(LANES_X[lane], 0.95, baseZ + zOff);
      worldGroup.add(mesh);
      world.stars.push({ lane: lane, z: baseZ + zOff, mesh: mesh, spin: Math.random() * 2.6 + 1.6 });
    });
  }

  // Phase 3.1/3.2: Spawn shield and magnet pickups
  function spawnShield() {
    var lane = randomLaneIndex();
    var mesh = createShieldMesh();
    mesh.position.set(LANES_X[lane], 0.95, -188);
    worldGroup.add(mesh);
    world.shields.push({ lane: lane, z: -188, mesh: mesh });
  }

  function spawnMagnet() {
    var lane = randomLaneIndex();
    var mesh = createMagnetMesh();
    mesh.position.set(LANES_X[lane], 0.95, -192);
    worldGroup.add(mesh);
    world.magnets.push({ lane: lane, z: -192, mesh: mesh });
  }

  // ---------------------------------------------------------------------------
  // Phase 1.1: Speed lines during boost
  // ---------------------------------------------------------------------------
  function makeSpeedLines() {
    var lineMat = new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.0 });
    var lineGeo = new THREE.PlaneGeometry(0.06, 3.5);
    for (var i = 0; i < 18; i += 1) {
      var line = new THREE.Mesh(lineGeo, lineMat.clone());
      line.position.set((Math.random() - 0.5) * 8, 0.6 + Math.random() * 3.5, 4 - Math.random() * 22);
      line.visible = false;
      scene.add(line);
      world.speedLines.push({ mesh: line, baseX: line.position.x, baseY: line.position.y, baseZ: line.position.z, offset: Math.random() * Math.PI * 2 });
    }
  }

  function updateSpeedLines(dt, boosting, speed) {
    var targetOpacity = boosting ? 0.28 : 0.0;
    world.speedLines.forEach(function (sl) {
      var mat = sl.mesh.material;
      mat.opacity = lerp(mat.opacity, targetOpacity, Math.min(1, dt * 8));
      sl.mesh.visible = mat.opacity > 0.01;
      if (sl.mesh.visible) {
        sl.mesh.position.z += speed * dt * 2.2;
        if (sl.mesh.position.z > 20) sl.mesh.position.z = -22;
        sl.mesh.position.x = sl.baseX + Math.sin(performance.now() * 0.002 + sl.offset) * 0.15;
      }
    });
  }

  // ---------------------------------------------------------------------------
  // Phase 1.2: Star collection particle burst
  // ---------------------------------------------------------------------------
  function spawnStarBurst(x, y, z) {
    var burstMat = new THREE.MeshBasicMaterial({ color: "#ffe750", transparent: true });
    var burstGeo = new THREE.SphereGeometry(0.08, 6, 6);
    for (var i = 0; i < 12; i += 1) {
      var p = new THREE.Mesh(burstGeo, burstMat.clone());
      p.position.set(x, y, z);
      var angle = (i / 12) * Math.PI * 2;
      var speed = 3 + Math.random() * 4;
      worldGroup.add(p);
      world.burstParticles.push({ mesh: p, vx: Math.cos(angle) * speed, vy: 2 + Math.random() * 3, vz: Math.sin(angle) * speed, life: 0.4 + Math.random() * 0.25 });
    }
  }

  function updateBurstParticles(dt) {
    for (var i = world.burstParticles.length - 1; i >= 0; i -= 1) {
      var p = world.burstParticles[i];
      p.life -= dt;
      if (p.life <= 0) { worldGroup.remove(p.mesh); world.burstParticles.splice(i, 1); continue; }
      p.mesh.position.x += p.vx * dt;
      p.mesh.position.y += p.vy * dt;
      p.mesh.position.z += p.vz * dt;
      p.vy -= 9.8 * dt;
      var s = Math.max(0, p.life * 2.5);
      p.mesh.scale.setScalar(s);
      p.mesh.material.opacity = Math.min(1, p.life * 3);
    }
  }

  // ---------------------------------------------------------------------------
  // Phase 1.4: Trail particles behind player car
  // ---------------------------------------------------------------------------
  var trailTimer = 0;
  function updateTrailParticles(dt, playerMesh, hexColor, speed) {
    trailTimer -= dt;
    if (trailTimer <= 0 && state.mode === "racing") {
      trailTimer = 0.03;
      var trailMat = new THREE.MeshBasicMaterial({ color: hexColor, transparent: true, opacity: 0.55 });
      var trailGeo = new THREE.SphereGeometry(0.1, 6, 6);
      var tp = new THREE.Mesh(trailGeo, trailMat);
      tp.position.set(playerMesh.position.x + (Math.random() - 0.5) * 0.4, 0.15, playerMesh.position.z - 1.3);
      worldGroup.add(tp);
      world.trailParticles.push({ mesh: tp, life: 0.5 + Math.random() * 0.2 });
    }
    for (var i = world.trailParticles.length - 1; i >= 0; i -= 1) {
      var tp2 = world.trailParticles[i];
      tp2.life -= dt;
      tp2.mesh.position.z += speed * dt * 0.3;
      if (tp2.life <= 0) { worldGroup.remove(tp2.mesh); world.trailParticles.splice(i, 1); continue; }
      var s = tp2.life * 1.6;
      tp2.mesh.scale.setScalar(s);
      tp2.mesh.material.opacity = tp2.life * 0.8;
    }
  }

  // ---------------------------------------------------------------------------
  // Phase 1.5: Apply level theme (day/sunset/night)
  // ---------------------------------------------------------------------------
  function applyLevelTheme(levelIndex) {
    var theme = LEVEL_THEMES[levelIndex] || LEVEL_THEMES[0];
    scene.background = new THREE.Color(theme.bg);
    scene.fog.color.set(theme.fog);
    scene.fog.near = theme.fogNear;
    scene.fog.far = theme.fogFar;
    hemi.color.set(theme.hemiSky);
    hemi.groundColor.set(theme.hemiGround);
    sun.color.set(theme.sunColor);
    sun.intensity = theme.sunIntensity;
    rim.color.set(theme.rimColor);
    renderer.toneMappingExposure = theme.exposure;
    if (world.skybox) {
      world.skybox.material.color.set(theme.bg);
    }
  }

  // ---------------------------------------------------------------------------
  // Phase 1.6: Animated skybox sphere
  // ---------------------------------------------------------------------------
  function makeSkybox() {
    var skyGeo = new THREE.SphereGeometry(400, 32, 32);
    var skyMat = new THREE.MeshBasicMaterial({ color: "#13245f", side: THREE.BackSide, fog: false });
    world.skybox = new THREE.Mesh(skyGeo, skyMat);
    scene.add(world.skybox);
  }

  function updateSkybox(dt) {
    if (world.skybox) {
      world.skybox.rotation.y += dt * 0.012;
      world.skybox.rotation.x += dt * 0.004;
    }
  }

  // ---------------------------------------------------------------------------
  // Phase 2.3: Combo display
  // ---------------------------------------------------------------------------
  var comboHideTimeout = null;
  function showCombo(count) {
    comboTextEl.textContent = "+" + count + " COMBO!";
    comboDisplay.classList.remove("hidden");
    comboTextEl.style.animation = "none";
    void comboTextEl.offsetWidth;
    comboTextEl.style.animation = "";
    if (comboHideTimeout) clearTimeout(comboHideTimeout);
    comboHideTimeout = setTimeout(function () { comboDisplay.classList.add("hidden"); }, 800);
  }

  // ---------------------------------------------------------------------------
  // Phase 2.5: Countdown at race start
  // ---------------------------------------------------------------------------
  function runCountdown(callback) {
    var steps = ["3", "2", "1", "GO!"];
    var index = 0;
    countdownOverlay.classList.remove("hidden");

    function nextStep() {
      if (index >= steps.length) {
        countdownOverlay.classList.add("hidden");
        callback();
        return;
      }
      countdownText.textContent = steps[index];
      countdownText.style.animation = "none";
      void countdownText.offsetWidth;
      countdownText.style.animation = "";
      index += 1;
      setTimeout(nextStep, 700);
    }
    nextStep();
  }

  // ---------------------------------------------------------------------------
  // Input controls — keyboard + mobile touch zones
  // ---------------------------------------------------------------------------
  function moveLane(direction) {
    if (state.mode !== "racing" || !world.player) return;
    var prevLane = world.player.lane;
    world.player.lane = clamp(world.player.lane + direction, 0, LANES_X.length - 1);
    if (world.player.lane !== prevLane) {
      world.player.targetX = LANES_X[world.player.lane];
      state.laneWobble = direction * 0.18; // Phase 2.4
      sfxWhoosh(); // Phase 5.4
    }
  }

  function tryActivateFreeze() {
    if (state.mode !== "racing") return;
    if (state.freezeCharges > 0 && state.freezeTimeRemaining <= 0) {
      state.freezeCharges -= 1;
      activateFreeze();
    }
  }

  window.addEventListener("keydown", function (event) {
    if (event.key === "ArrowLeft" || event.key === "a" || event.key === "A") {
      event.preventDefault();
      if (!event.repeat) moveLane(-1);
    }
    if (event.key === "ArrowRight" || event.key === "d" || event.key === "D") {
      event.preventDefault();
      if (!event.repeat) moveLane(1);
    }
    if (event.key === "ArrowUp" || event.key === "w" || event.key === "W") {
      event.preventDefault();
      input.boost = true;
    }
    if (event.key === " " || event.key === "Spacebar") {
      event.preventDefault();
      if (!event.repeat) tryActivateFreeze();
    }
  });

  window.addEventListener("keyup", function (event) {
    if (event.key === "ArrowUp" || event.key === "w" || event.key === "W") {
      input.boost = false;
    }
  });

  // Mobile: tap left/right halves of screen to steer.
  touchLeft.addEventListener("pointerdown", function (event) {
    event.preventDefault();
    moveLane(-1);
  });

  touchRight.addEventListener("pointerdown", function (event) {
    event.preventDefault();
    moveLane(1);
  });

  touchPower.addEventListener("pointerdown", function (event) {
    event.preventDefault();
    tryActivateFreeze();
  });

  // ---------------------------------------------------------------------------
  // Phase 6.1: Tilt-to-steer (DeviceOrientationEvent)
  // ---------------------------------------------------------------------------
  var tiltEnabled = false;
  var lastTiltLane = 1;
  function enableTilt() {
    if (tiltEnabled) return;
    tiltEnabled = true;
    function handleOrientation(event) {
      if (state.mode !== "racing" || !world.player) return;
      var gamma = event.gamma || 0; // left-right tilt in degrees
      var targetLane;
      if (gamma < -12) targetLane = 0;
      else if (gamma > 12) targetLane = 2;
      else targetLane = 1;
      if (targetLane !== lastTiltLane) {
        var dir = targetLane > lastTiltLane ? 1 : -1;
        moveLane(dir);
        lastTiltLane = targetLane;
      }
    }
    if (typeof DeviceOrientationEvent !== "undefined" && typeof DeviceOrientationEvent.requestPermission === "function") {
      DeviceOrientationEvent.requestPermission().then(function (permission) {
        if (permission === "granted") window.addEventListener("deviceorientation", handleOrientation);
      }).catch(function () {});
    } else {
      window.addEventListener("deviceorientation", handleOrientation);
    }
  }
  if (isTouchDevice) enableTilt();

  // ---------------------------------------------------------------------------
  // Phase 6.2: Haptic feedback
  // ---------------------------------------------------------------------------
  function haptic(duration) {
    if (navigator.vibrate) {
      try { navigator.vibrate(duration); } catch (e) { /* unsupported */ }
    }
  }

  // ---------------------------------------------------------------------------
  // Phase 6.3: Landscape lock prompt
  // ---------------------------------------------------------------------------
  var rotatePrompt = document.getElementById("rotatePrompt");
  function checkOrientation() {
    if (!isTouchDevice) { rotatePrompt.classList.add("hidden"); return; }
    if (window.innerHeight > window.innerWidth) {
      rotatePrompt.classList.remove("hidden");
    } else {
      rotatePrompt.classList.add("hidden");
    }
  }
  window.addEventListener("resize", checkOrientation);
  window.addEventListener("orientationchange", checkOrientation);
  checkOrientation();

  // ---------------------------------------------------------------------------
  // Audio
  // ---------------------------------------------------------------------------
  let audioCtx = null;
  const backgroundMusic = new Audio("./assets/music/lassolady.ogg");
  backgroundMusic.loop = true;
  backgroundMusic.volume = 0.45;
  backgroundMusic.preload = "auto";

  // Phase 5.1: Different playback rate per level to vary feel
  var MUSIC_RATES = [1.0, 1.08, 0.92];

  function ensureAudio() {
    if (!audioCtx) {
      var AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      audioCtx = new AudioCtx();
    }
    if (audioCtx.state === "suspended") audioCtx.resume().catch(function () {});
  }

  function tone(freq, duration, type, volume) {
    if (!audioCtx) return;
    var now = audioCtx.currentTime;
    var osc = audioCtx.createOscillator();
    var gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(now);
    osc.stop(now + duration);
  }

  function startMusic() {
    backgroundMusic.currentTime = 0;
    backgroundMusic.play().catch(function () {});
  }

  // Phase 5.1: Set music rate for current level
  function setMusicForLevel(levelIndex) {
    backgroundMusic.playbackRate = MUSIC_RATES[levelIndex] || 1.0;
  }

  function pauseMusic() { backgroundMusic.pause(); }

  // Phase 5.2: Procedural engine hum
  var engineOsc = null;
  var engineGain = null;
  function startEngine() {
    ensureAudio();
    if (!audioCtx || engineOsc) return;
    engineOsc = audioCtx.createOscillator();
    engineGain = audioCtx.createGain();
    engineOsc.type = "sawtooth";
    engineOsc.frequency.setValueAtTime(60, audioCtx.currentTime);
    engineGain.gain.setValueAtTime(0, audioCtx.currentTime);
    engineOsc.connect(engineGain);
    engineGain.connect(audioCtx.destination);
    engineOsc.start();
  }
  function stopEngine() {
    if (engineOsc) {
      try { engineOsc.stop(); } catch (e) { /* already stopped */ }
      engineOsc = null; engineGain = null;
    }
  }
  function updateEngineSound(speed, boosting) {
    if (!engineGain || !engineOsc) return;
    var targetFreq = 55 + speed * 1.8;
    if (boosting) targetFreq *= 1.2;
    var now = audioCtx.currentTime;
    engineOsc.frequency.setTargetAtTime(targetFreq, now, 0.08);
    engineGain.gain.setTargetAtTime(0.018, now, 0.1);
  }

  function sfxStar() { ensureAudio(); tone(820, 0.07, "triangle", 0.04); tone(1050, 0.06, "triangle", 0.03); }
  function sfxFreeze() { ensureAudio(); tone(240, 0.14, "sawtooth", 0.035); tone(170, 0.16, "sine", 0.028); }
  function sfxBump() { ensureAudio(); tone(110, 0.09, "square", 0.035); }
  function sfxVictory() {
    ensureAudio();
    tone(392, 0.13, "triangle", 0.04);
    setTimeout(function () { tone(523, 0.13, "triangle", 0.04); }, 120);
    setTimeout(function () { tone(659, 0.17, "triangle", 0.042); }, 240);
  }

  // Phase 5.3: Procedural crowd cheer
  function sfxCheer() {
    ensureAudio();
    if (!audioCtx) return;
    for (var c = 0; c < 5; c += 1) {
      var delay = c * 0.06;
      var freq = 300 + Math.random() * 400;
      setTimeout(function (f) {
        return function () { tone(f, 0.3 + Math.random() * 0.2, "triangle", 0.02); };
      }(freq), delay * 1000);
    }
    tone(220, 0.5, "sine", 0.015);
  }

  // Phase 5.4: Whoosh on lane change
  function sfxWhoosh() {
    ensureAudio();
    if (!audioCtx) return;
    var now = audioCtx.currentTime;
    var osc = audioCtx.createOscillator();
    var gain = audioCtx.createGain();
    var filter = audioCtx.createBiquadFilter();
    osc.type = "sine";
    osc.frequency.setValueAtTime(400, now);
    osc.frequency.exponentialRampToValueAtTime(150, now + 0.12);
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(800, now);
    filter.Q.setValueAtTime(2, now);
    gain.gain.setValueAtTime(0.03, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(now);
    osc.stop(now + 0.15);
  }

  // ---------------------------------------------------------------------------
  // Spawning
  // ---------------------------------------------------------------------------
  function clearObjectList(list) {
    list.forEach(function (item) { worldGroup.remove(item.mesh); });
    list.length = 0;
  }

  function spawnStar() {
    var lane = randomLaneIndex();
    var mesh = createStarMesh();
    mesh.position.set(LANES_X[lane], 0.95, -180);
    worldGroup.add(mesh);
    world.stars.push({ lane: lane, z: -180, mesh: mesh, spin: Math.random() * 2.6 + 1.6 });
  }

  function spawnObstacle() {
    var lane = randomLaneIndex();
    var type = randomFrom(OBSTACLE_TYPES);
    var mesh = createObstacleMesh(type);
    mesh.position.set(LANES_X[lane], 0, -185);
    worldGroup.add(mesh);
    world.obstacles.push({ lane: lane, z: -185, mesh: mesh, type: type, hitCooldown: 0 });
  }

  function spawnPower() {
    var lane = randomLaneIndex();
    var mesh = createPowerMesh();
    mesh.position.set(LANES_X[lane], 0.95, -190);
    worldGroup.add(mesh);
    world.powers.push({ lane: lane, z: -190, mesh: mesh });
  }

  // ---------------------------------------------------------------------------
  // Player + opponents
  // ---------------------------------------------------------------------------
  function createPlayer() {
    var car = CARS[state.selectedCarIndex];
    var color = state.colorOverride || car.color;
    var playerMesh = createCarMesh(color);
    playerMesh.group.position.set(0, 0, 7.4);
    worldGroup.add(playerMesh.group);
    return {
      lane: 1, targetX: LANES_X[1], x: 0, z: 7.4,
      baseSpeed: car.speed, handling: car.handling,
      slowdownTimer: 0, bumpTimer: 0,
      mesh: playerMesh.group, bodyMaterial: playerMesh.bodyMaterial, underGlow: playerMesh.underGlow
    };
  }

  function createOpponents() {
    world.opponents.length = 0;
    var level = LEVELS[state.levelIndex];
    for (var i = 0; i < 3; i += 1) {
      var lane = i % LANES_X.length;
      var color = ["#ff8359", "#53beff", "#ffce53"][i];
      var carMesh = createCarMesh(color);
      carMesh.group.position.set(LANES_X[lane], 0, -25 - i * 30);
      worldGroup.add(carMesh.group);
      world.opponents.push({
        lane: lane, targetLane: lane, z: -25 - i * 30,
        speed: world.player.baseSpeed + level.aiBonus + (Math.random() * 2.4 - 1.2),
        laneTimer: 0.8 + Math.random() * 1.5, frozenTimer: 0,
        distance: 0,
        mesh: carMesh.group, vineMesh: carMesh.vine
      });
    }
  }

  function resetLevel(levelIndex) {
    state.levelIndex = levelIndex;
    state.starsThisLevel = 0;
    state.freezeTimeRemaining = 0;
    state.freezeCharges = 0;
    state.shielded = false;
    state.magnetTimer = 0;
    state.comboCount = 0;
    state.lastStarTime = 0;
    state.finishPosition = 1;
    world.playerDistance = 0;
    world.timers.star = 0.5;
    world.timers.obstacle = 1.3;
    world.timers.power = 6.0;
    world.timers.shield = 12.0;
    world.timers.magnet = 15.0;
    world.timers.bonusPattern = 5.0;

    clearObjectList(world.stars);
    clearObjectList(world.obstacles);
    clearObjectList(world.powers);
    clearObjectList(world.shields);
    clearObjectList(world.magnets);
    clearObjectList(world.burstParticles);
    clearObjectList(world.trailParticles);
    world.opponents.forEach(function (o) { worldGroup.remove(o.mesh); });
    world.opponents.length = 0;

    if (world.player && world.player.mesh) worldGroup.remove(world.player.mesh);
    if (shieldVisual) { worldGroup.remove(shieldVisual); shieldVisual = null; }
    world.player = createPlayer();
    shieldVisual = createShieldVisual();
    worldGroup.add(shieldVisual);
    createOpponents();
    applyLevelTheme(levelIndex);
    updateHud();
  }

  // ---------------------------------------------------------------------------
  // Vine Freeze
  // ---------------------------------------------------------------------------
  function activateFreeze() {
    state.freezeTimeRemaining = 3.2;
    state.slowmoTimer = 0.3; // Phase 2.2
    var playerZ = world.player.z;
    world.opponents.forEach(function (opponent) {
      if (Math.abs(opponent.z - playerZ) < 45) {
        opponent.frozenTimer = Math.max(opponent.frozenTimer, state.freezeTimeRemaining);
      }
    });
    // Phase 1.3: Trigger green screen flash
    freezeFlashEl.classList.remove("active");
    void freezeFlashEl.offsetWidth;
    freezeFlashEl.classList.add("active");
    sfxFreeze();
    haptic(60); // Phase 6.2
  }

  // ---------------------------------------------------------------------------
  // Game flow
  // ---------------------------------------------------------------------------
  function hidePanels() {
    startPanel.classList.add("hidden");
    celebrationPanel.classList.add("hidden");
    prizePanel.classList.add("hidden");
    endPanel.classList.add("hidden");
    garagePanel.classList.add("hidden");
    trophyPanel.classList.add("hidden");
  }

  function showGameUI(visible) {
    if (visible) {
      hudEl.classList.remove("hidden");
      progressBar.classList.remove("hidden");
      if (isTouchDevice) touchControls.classList.remove("hidden");
    } else {
      hudEl.classList.add("hidden");
      progressBar.classList.add("hidden");
      touchControls.classList.add("hidden");
    }
  }

  function showStart() {
    state.mode = "start";
    pauseMusic();
    showGameUI(false);
    overlay.classList.remove("hidden");
    celebrationFx.classList.add("hidden");
    hidePanels();
    startPanel.classList.remove("hidden");
    renderCarChoices();
  }

  function startLevel(levelIndex) {
    state.mode = "countdown";
    if (backgroundMusic.paused) backgroundMusic.play().catch(function () {});
    setMusicForLevel(levelIndex); // Phase 5.1
    overlay.classList.add("hidden");
    celebrationFx.classList.add("hidden");
    hidePanels();
    showGameUI(true);
    resetLevel(levelIndex);
    startEngine(); // Phase 5.2
    // Phase 2.5: countdown before racing begins
    runCountdown(function () {
      state.mode = "racing";
    });
  }

  function completeLevel() {
    state.mode = "celebration";
    state.celebrationTime = 0;
    showGameUI(false);
    overlay.classList.remove("hidden");
    hidePanels();
    celebrationPanel.classList.remove("hidden");
    var posNames = ["1st", "2nd", "3rd", "4th"];
    celebrationScore.textContent = "Score: " + state.score + " — Finished " + (posNames[state.finishPosition - 1] || state.finishPosition + "th") + "!";
    launchCelebrationFx();
    sfxVictory();
    sfxCheer(); // Phase 5.3
    stopEngine();
    // Phase 4.2: unlock a car for completing levels
    if (state.levelIndex >= 1) unlockCar(2);
    if (state.levelIndex >= 2) unlockCar(3);
    // Phase 4.3: add trophies
    addTrophy("Level " + (state.levelIndex + 1) + " Complete");
    if (state.finishPosition === 1) addTrophy("Level " + (state.levelIndex + 1) + " Winner");
    // Phase 4.4: cumulative stars
    saveData.cumulativeStars += state.starsThisLevel;
    if (state.score > saveData.highScore) saveData.highScore = state.score;
    // Save stickers
    saveData.stickers = saveData.stickers.concat(state.playerStickers);
    writeSave(saveData);
    checkMilestones();
  }

  function showPrizeScreen() {
    state.mode = "prize";
    overlay.classList.remove("hidden");
    hidePanels();
    prizePanel.classList.remove("hidden");

    prizeChoicesEl.innerHTML = "";
    var choices = shuffleInPlace([
      { type: "sticker", value: randomFrom(STICKER_PRIZES), label: "Sticker" },
      { type: "color", value: randomFrom(COLOR_PRIZES), label: "Car Color" },
      { type: "badge", value: randomFrom(BADGE_PRIZES), label: "Badge" }
    ]);

    choices.forEach(function (choice) {
      var btn = document.createElement("button");
      btn.className = "choice";
      if (choice.type === "sticker") btn.textContent = choice.label + ": " + choice.value;
      if (choice.type === "color") btn.textContent = choice.label + ": Neon Paint";
      if (choice.type === "badge") btn.textContent = choice.label + ": " + choice.value;

      btn.addEventListener("click", function () {
        if (choice.type === "sticker") { state.playerStickers.push(choice.value); state.score += 20; }
        else if (choice.type === "color") { state.colorOverride = choice.value; }
        else if (choice.type === "badge") { state.playerBadges.push(choice.value); state.score += 30; }
        if (state.levelIndex < LEVELS.length - 1) { startLevel(state.levelIndex + 1); }
        else { showEndScreen(); }
      });
      prizeChoicesEl.appendChild(btn);
    });
  }

  function showEndScreen() {
    state.mode = "end";
    pauseMusic();
    showGameUI(false);
    overlay.classList.remove("hidden");
    hidePanels();
    endPanel.classList.remove("hidden");
    finalScoreEl.textContent = "Final Score: " + state.score;
    finalBadgesEl.textContent = state.playerBadges.length ? "Badges: " + state.playerBadges.join(", ") : "Badges: None yet (still awesome).";
  }

  function launchCelebrationFx() {
    celebrationFx.classList.remove("hidden");
    celebrationFx.innerHTML = "";
    var symbols = ["👍", "😄", "🎉", "✨", "🌟"];
    for (var i = 0; i < 90; i += 1) {
      var el = document.createElement("span");
      el.className = "drop";
      el.textContent = randomFrom(symbols);
      el.style.left = (Math.random() * 100) + "%";
      el.style.animationDuration = (2.2 + Math.random() * 2.2) + "s";
      el.style.animationDelay = (Math.random() * 0.8) + "s";
      celebrationFx.appendChild(el);
    }
  }

  // ---------------------------------------------------------------------------
  // HUD updates
  // ---------------------------------------------------------------------------
  function prizeMeterPercent() {
    return clamp((state.starsThisLevel / state.prizeMeterTarget) * 100, 0, 100);
  }

  function updateHud() {
    hudLevel.textContent = (state.levelIndex + 1) + "/3";
    hudScore.textContent = String(state.score);
    hudStars.textContent = String(state.totalStars);
    hudMeterFill.style.width = Math.round(prizeMeterPercent()) + "%";

    if (state.freezeCharges > 0 && state.freezeTimeRemaining <= 0) {
      hudFreeze.textContent = state.freezeCharges + " charge" + (state.freezeCharges > 1 ? "s" : "");
      freezeBlock.classList.remove("active");
      touchPower.classList.remove("cooldown");
    } else if (state.freezeTimeRemaining > 0) {
      hudFreeze.textContent = state.freezeTimeRemaining.toFixed(1) + "s";
      freezeBlock.classList.add("active");
      touchPower.classList.add("cooldown");
    } else {
      hudFreeze.textContent = "No charge";
      freezeBlock.classList.remove("active");
      touchPower.classList.add("cooldown");
    }

    var level = LEVELS[state.levelIndex];
    var progress = clamp(world.playerDistance / level.length, 0, 1);
    progressFill.style.width = (progress * 100).toFixed(1) + "%";
  }

  function collidesPlayerX(playerX, laneIndex, width) {
    return Math.abs(playerX - LANES_X[laneIndex]) < width;
  }

  // ---------------------------------------------------------------------------
  // Main race update
  // ---------------------------------------------------------------------------
  function updateRace(rawDt) {
    // Phase 2.2: slow-motion effect
    if (state.slowmoTimer > 0) { state.slowmoTimer -= rawDt; }
    var dt = state.slowmoTimer > 0 ? rawDt * 0.4 : rawDt;

    var level = LEVELS[state.levelIndex];
    var player = world.player;

    if (player.bumpTimer > 0) player.bumpTimer -= dt;
    if (player.slowdownTimer > 0) player.slowdownTimer -= dt;
    if (state.freezeTimeRemaining > 0) state.freezeTimeRemaining -= dt;
    if (state.shakeTimer > 0) state.shakeTimer -= dt;

    var speed = player.baseSpeed;
    if (input.boost) speed *= 1.14;
    if (player.slowdownTimer > 0) speed *= 0.62;

    player.x = lerp(player.x, player.targetX, Math.min(1, dt * player.handling * 1.9));
    player.mesh.position.x = player.x;
    player.mesh.position.y = player.bumpTimer > 0 ? Math.sin(performance.now() * 0.04) * 0.05 : 0;
    // Phase 2.4: apply wobble impulse, then decay
    state.laneWobble = lerp(state.laneWobble, 0, Math.min(1, dt * 10));
    player.mesh.rotation.z = lerp(player.mesh.rotation.z, (player.targetX - player.x) * -0.08 + state.laneWobble, Math.min(1, dt * 6));

    world.playerDistance += speed * dt;
    updateScenery(dt, speed);

    world.laneDashMeshes.forEach(function (dash) {
      dash.position.z += speed * dt * 1.8;
      if (dash.position.z > 20) dash.position.z -= 720;
    });
    world.sideLights.forEach(function (bulb, idx) {
      bulb.position.z += speed * dt * 1.7;
      if (bulb.position.z > 35) bulb.position.z -= 1280;
      bulb.material.emissiveIntensity = 0.8 + Math.sin(performance.now() * 0.003 + idx * 0.3) * 0.35;
    });

    camera.position.x = lerp(camera.position.x, player.x * 0.35, Math.min(1, dt * 3.5));
    camera.position.y = lerp(camera.position.y, 6.6, Math.min(1, dt * 3.0));
    camera.position.z = lerp(camera.position.z, 15.2, Math.min(1, dt * 3.0));
    // Phase 2.1: screen shake offset
    if (state.shakeTimer > 0) {
      camera.position.x += (Math.random() - 0.5) * 0.35;
      camera.position.y += (Math.random() - 0.5) * 0.18;
    }
    cameraLookTarget.set(player.x * 0.18, 1.2, -13.5);
    camera.lookAt(cameraLookTarget);

    world.timers.star -= dt;
    world.timers.obstacle -= dt;
    world.timers.power -= dt;
    world.timers.shield -= dt;
    world.timers.magnet -= dt;
    world.timers.bonusPattern -= dt;
    if (world.timers.star <= 0) { spawnStar(); world.timers.star = level.starEvery + Math.random() * 0.25; }
    if (world.timers.obstacle <= 0) { spawnObstacle(); world.timers.obstacle = level.obstacleEvery + Math.random() * 0.55; }
    if (world.timers.power <= 0) { spawnPower(); world.timers.power = level.powerEvery + Math.random() * 1.7; }
    if (world.timers.shield <= 0) { spawnShield(); world.timers.shield = 18 + Math.random() * 8; }
    if (world.timers.magnet <= 0) { spawnMagnet(); world.timers.magnet = 20 + Math.random() * 10; }
    if (world.timers.bonusPattern <= 0) { spawnBonusPattern(); world.timers.bonusPattern = 8 + Math.random() * 6; }

    // Phase 3.2: Magnet timer decay
    if (state.magnetTimer > 0) state.magnetTimer -= dt;

    // Phase 3.2: magnet collection radius
    var starCollectRadius = state.magnetTimer > 0 ? 3.2 : 1.02;
    var starCollectZRange = state.magnetTimer > 0 ? 5.0 : 2.2;

    // Stars
    for (var i = world.stars.length - 1; i >= 0; i -= 1) {
      var star = world.stars[i];
      star.z += speed * dt;
      // Phase 3.2: attract stars toward player when magnet active
      if (state.magnetTimer > 0 && Math.abs(star.z - player.z) < 8) {
        star.mesh.position.x = lerp(star.mesh.position.x, player.x, Math.min(1, dt * 4));
      }
      star.mesh.position.z = star.z;
      star.mesh.rotation.y += dt * star.spin;
      star.mesh.rotation.x += dt * 0.7;
      star.mesh.position.y = 0.95 + Math.sin(performance.now() * 0.004 + i) * 0.12;
      if (star.z > 25) { worldGroup.remove(star.mesh); world.stars.splice(i, 1); continue; }
      if (Math.abs(star.z - player.z) < starCollectZRange && Math.abs(player.x - star.mesh.position.x) < starCollectRadius) {
        spawnStarBurst(star.mesh.position.x, star.mesh.position.y, star.mesh.position.z);
        worldGroup.remove(star.mesh); world.stars.splice(i, 1);
        state.totalStars += 1; state.starsThisLevel += 1; state.score += 10;
        // Phase 2.3: combo tracking
        var now2 = performance.now() / 1000;
        if (now2 - state.lastStarTime < 0.8 && state.lastStarTime > 0) {
          state.comboCount += 1;
          state.score += state.comboCount * 5;
          showCombo(state.comboCount);
        } else {
          state.comboCount = 0;
        }
        state.lastStarTime = now2;
        sfxStar();
      }
    }

    // Powers: collecting adds a freeze charge (player activates via spacebar or button)
    for (var j = world.powers.length - 1; j >= 0; j -= 1) {
      var power = world.powers[j];
      power.z += speed * dt;
      power.mesh.position.z = power.z;
      power.mesh.rotation.y += dt * 1.8;
      power.mesh.position.y = 0.92 + Math.sin(performance.now() * 0.005 + j * 2) * 0.15;
      if (power.z > 25) { worldGroup.remove(power.mesh); world.powers.splice(j, 1); continue; }
      if (Math.abs(power.z - player.z) < 2.1 && collidesPlayerX(player.x, power.lane, 1.02)) {
        worldGroup.remove(power.mesh); world.powers.splice(j, 1);
        state.freezeCharges += 1;
        sfxStar();
      }
    }

    // Phase 3.1: Shields
    for (var si = world.shields.length - 1; si >= 0; si -= 1) {
      var sh = world.shields[si];
      sh.z += speed * dt;
      sh.mesh.position.z = sh.z;
      sh.mesh.rotation.y += dt * 2.0;
      sh.mesh.position.y = 0.95 + Math.sin(performance.now() * 0.004 + si) * 0.12;
      if (sh.z > 25) { worldGroup.remove(sh.mesh); world.shields.splice(si, 1); continue; }
      if (Math.abs(sh.z - player.z) < 2.1 && collidesPlayerX(player.x, sh.lane, 1.02)) {
        worldGroup.remove(sh.mesh); world.shields.splice(si, 1);
        state.shielded = true;
        if (shieldVisual) shieldVisual.visible = true;
        sfxStar();
      }
    }

    // Phase 3.2: Magnets
    for (var mi = world.magnets.length - 1; mi >= 0; mi -= 1) {
      var mag = world.magnets[mi];
      mag.z += speed * dt;
      mag.mesh.position.z = mag.z;
      mag.mesh.rotation.y += dt * 2.2;
      mag.mesh.position.y = 0.95 + Math.sin(performance.now() * 0.005 + mi * 2) * 0.15;
      if (mag.z > 25) { worldGroup.remove(mag.mesh); world.magnets.splice(mi, 1); continue; }
      if (Math.abs(mag.z - player.z) < 2.1 && collidesPlayerX(player.x, mag.lane, 1.02)) {
        worldGroup.remove(mag.mesh); world.magnets.splice(mi, 1);
        state.magnetTimer = 4.0;
        sfxStar();
      }
    }

    // Phase 3.1: Update shield visual position
    if (shieldVisual) {
      shieldVisual.position.copy(player.mesh.position);
      shieldVisual.position.y += 0.5;
      shieldVisual.visible = state.shielded;
      if (state.shielded) shieldVisual.rotation.y += dt * 1.5;
    }

    // Obstacles
    for (var k = world.obstacles.length - 1; k >= 0; k -= 1) {
      var obs = world.obstacles[k];
      obs.z += speed * dt;
      obs.mesh.position.z = obs.z;
      obs.hitCooldown = Math.max(0, obs.hitCooldown - dt);
      if (obs.z > 26) { worldGroup.remove(obs.mesh); world.obstacles.splice(k, 1); continue; }
      if (obs.hitCooldown <= 0 && Math.abs(obs.z - player.z) < 2.2 && collidesPlayerX(player.x, obs.lane, 1.05)) {
        obs.hitCooldown = 0.6;
        // Phase 3.1: shield absorbs hit
        if (state.shielded) {
          state.shielded = false;
          if (shieldVisual) shieldVisual.visible = false;
          state.shakeTimer = 0.1;
          sfxBump();
          haptic(40);
        } else {
          player.slowdownTimer = Math.max(player.slowdownTimer, 0.75);
          player.bumpTimer = 0.22;
          state.shakeTimer = 0.18;
          sfxBump();
          haptic(80);
        }
      }
    }

    // Opponents
    world.opponents.forEach(function (opponent, index) {
      if (opponent.frozenTimer > 0) {
        opponent.frozenTimer -= dt;
        opponent.vineMesh.visible = true;
        opponent.vineMesh.rotation.z += dt * 2.4;
        opponent.mesh.position.x += Math.sin(performance.now() * 0.02 + index) * 0.003;
      } else {
        opponent.vineMesh.visible = false;
        // Phase 3.3: rubber banding — clamp opponent speed delta so races stay close
        var maxDelta = 3.5;
        var clampedSpeed = clamp(opponent.speed, speed - maxDelta, speed + maxDelta);
        var relative = (clampedSpeed - speed) + 5.4;
        opponent.z += relative * dt;
        opponent.distance += clampedSpeed * dt; // Phase 3.5: track distance
        opponent.laneTimer -= dt;
        if (opponent.laneTimer <= 0) {
          opponent.targetLane = clamp(opponent.targetLane + (Math.random() < 0.5 ? -1 : 1), 0, 2);
          opponent.laneTimer = 0.8 + Math.random() * 1.7;
        }
      }
      var targetX = LANES_X[opponent.targetLane];
      opponent.mesh.position.x = lerp(opponent.mesh.position.x, targetX, Math.min(1, dt * 4.8));
      opponent.mesh.position.z = opponent.z;

      if (opponent.z > 32) {
        opponent.z = -180 - Math.random() * 25;
        opponent.targetLane = randomLaneIndex();
        opponent.speed = player.baseSpeed + LEVELS[state.levelIndex].aiBonus + (Math.random() * 2.8 - 1.4);
      }
    });

    // Phase 3.5: calculate finishing position
    var ahead = 0;
    world.opponents.forEach(function (opp) { if (opp.distance > world.playerDistance) ahead += 1; });
    state.finishPosition = ahead + 1;

    // Phase 5.2: update engine sound pitch
    updateEngineSound(speed, input.boost);

    // Phase 1 updates
    updateSpeedLines(dt, input.boost, speed);
    updateBurstParticles(dt);
    var trailColor = CARS[state.selectedCarIndex].color;
    if (state.colorOverride) trailColor = state.colorOverride;
    updateTrailParticles(dt, player.mesh, trailColor, speed);
    updateSkybox(dt);

    if (world.playerDistance >= level.length) completeLevel();
    updateHud();
  }

  // ---------------------------------------------------------------------------
  // Car choice UI
  // ---------------------------------------------------------------------------
  function renderCarChoices() {
    carChoicesEl.innerHTML = "";
    CARS.forEach(function (car, index) {
      var locked = !isCarUnlocked(index);
      var button = document.createElement("button");
      button.className = "choice";
      if (locked) button.classList.add("locked");
      if (index === state.selectedCarIndex && !locked) button.classList.add("selected");
      if (locked) {
        button.innerHTML = "<strong>🔒 " + car.name + "</strong><br>Complete Level " + (index === 2 ? "2" : "3") + " to unlock";
      } else {
        button.innerHTML = "<strong>" + car.icon + " " + car.name + "</strong><br>Speed " + car.speed.toFixed(1) + " / Handling " + car.handling.toFixed(1);
      }
      button.addEventListener("click", function () {
        if (locked) return;
        state.selectedCarIndex = index;
        renderCarChoices();
      });
      carChoicesEl.appendChild(button);
    });
  }

  // ---------------------------------------------------------------------------
  // Full reset
  // ---------------------------------------------------------------------------
  function resetGame() {
    state.mode = "start";
    state.levelIndex = 0;
    state.score = 0;
    state.totalStars = 0;
    state.starsThisLevel = 0;
    state.freezeTimeRemaining = 0;
    state.freezeCharges = 0;
    state.celebrationTime = 0;
    state.shakeTimer = 0;
    state.slowmoTimer = 0;
    state.comboCount = 0;
    state.lastStarTime = 0;
    state.laneWobble = 0;
    state.shielded = false;
    state.magnetTimer = 0;
    state.finishPosition = 1;
    state.playerStickers = [];
    state.playerBadges = [];
    state.colorOverride = null;
    input.boost = false;

    clearObjectList(world.stars);
    clearObjectList(world.obstacles);
    clearObjectList(world.powers);
    clearObjectList(world.shields);
    clearObjectList(world.magnets);
    clearObjectList(world.burstParticles);
    clearObjectList(world.trailParticles);
    world.opponents.forEach(function (o) { worldGroup.remove(o.mesh); });
    world.opponents.length = 0;
    if (world.player && world.player.mesh) worldGroup.remove(world.player.mesh);
    if (shieldVisual) { worldGroup.remove(shieldVisual); shieldVisual = null; }
    stopEngine();
    world.player = createPlayer();
    updateHud();
    showStart();
  }

  // ---------------------------------------------------------------------------
  // Main loop
  // ---------------------------------------------------------------------------
  var lastTime = performance.now();
  function loop(now) {
    var dt = Math.min(0.05, (now - lastTime) / 1000);
    lastTime = now;

    if (state.mode === "racing") {
      updateRace(dt);
    } else if (state.mode === "celebration") {
      state.celebrationTime += dt;
      camera.position.x = Math.sin(now * 0.0015) * 0.12;
      camera.position.y = lerp(camera.position.y, 6.4, dt * 2.5);
      camera.position.z = lerp(camera.position.z, 15.4, dt * 2.5);
      cameraLookTarget.set(0, 1.4, -12.5);
      camera.lookAt(cameraLookTarget);
    } else {
      camera.position.x = lerp(camera.position.x, 0, dt * 3.2);
      camera.position.y = lerp(camera.position.y, 6.6, dt * 3.2);
      camera.position.z = lerp(camera.position.z, 15.6, dt * 3.2);
      cameraLookTarget.set(0, 1.4, -13.5);
      camera.lookAt(cameraLookTarget);
    }

    if (world.player && world.player.bodyMaterial) {
      var glowPulse = 0.07 + state.playerStickers.length * 0.02 + Math.sin(now * 0.004) * 0.02;
      world.player.bodyMaterial.emissive = new THREE.Color("#222222");
      world.player.bodyMaterial.emissiveIntensity = glowPulse;
      if (state.colorOverride) world.player.bodyMaterial.color.set(state.colorOverride);
      if (world.player.underGlow) world.player.underGlow.material.emissiveIntensity = 0.25 + glowPulse * 1.8;
    }

    renderer.render(scene, camera);
    requestAnimationFrame(loop);
  }

  // ---------------------------------------------------------------------------
  // Button handlers
  // ---------------------------------------------------------------------------
  startBtn.addEventListener("click", function () {
    ensureAudio();
    startMusic();
    state.score = 0;
    state.totalStars = 0;
    state.playerStickers = [];
    state.playerBadges = [];
    state.colorOverride = null;
    startLevel(0);
  });

  toPrizeBtn.addEventListener("click", function () { showPrizeScreen(); });
  restartBtn.addEventListener("click", function () { resetGame(); });
  // Phase 7.1: Screenshot button
  screenshotBtn.addEventListener("click", function () {
    try {
      renderer.render(scene, camera);
      var dataURL = renderer.domElement.toDataURL("image/png");
      var link = document.createElement("a");
      link.download = "plantgirl-race-" + Date.now() + ".png";
      link.href = dataURL;
      link.click();
    } catch (e) { /* canvas tainted or not available */ }
  });

  // Phase 7.2: Share card
  shareBtn.addEventListener("click", function () {
    var shareData = {
      title: "Plantgirl Super Race",
      text: "I scored " + state.score + " points and collected " + state.totalStars + " stars in Plantgirl Super Race! Can you beat me?",
      url: window.location.href
    };
    if (navigator.share) {
      navigator.share(shareData).catch(function () {});
    } else {
      try {
        navigator.clipboard.writeText(shareData.text + " " + shareData.url);
        shareBtn.textContent = "✅ Copied!";
        setTimeout(function () { shareBtn.textContent = "📤 Share"; }, 2000);
      } catch (e) { /* clipboard not available */ }
    }
  });

  garageBtn.addEventListener("click", function () { showGarage(); });
  garageBackBtn.addEventListener("click", function () { hidePanels(); endPanel.classList.remove("hidden"); });
  trophyBtn.addEventListener("click", function () { showTrophyShelf(); });
  trophyBackBtn.addEventListener("click", function () { hidePanels(); endPanel.classList.remove("hidden"); });

  // ---------------------------------------------------------------------------
  // Boot
  // ---------------------------------------------------------------------------
  makeRoad();
  makeSkyCity();
  makeSkybox();
  makeSpeedLines();
  resetGame();

  // Phase 7.3: Dismiss loading screen
  if (loadingScreen) {
    loadingScreen.classList.add("fade-out");
    setTimeout(function () {
      loadingScreen.style.display = "none";
    }, 600);
  }

  requestAnimationFrame(loop);
})();
