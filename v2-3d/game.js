/* Plantgirl Super Race - V2 3D
 * Three.js version with richer visuals while preserving the playful loop.
 * No build tooling: runs directly from index.html with local script files.
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
  const hud = document.getElementById("hud");
  const hudLevel = document.getElementById("hudLevel");
  const hudScore = document.getElementById("hudScore");
  const hudStars = document.getElementById("hudStars");
  const hudMeter = document.getElementById("hudMeter");
  const hudFreeze = document.getElementById("hudFreeze");

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
    mode: "start", // start | racing | celebration | prize | end
    levelIndex: 0,
    selectedCarIndex: 0,
    score: 0,
    totalStars: 0,
    starsThisLevel: 0,
    prizeMeterTarget: 24,
    freezeTimeRemaining: 0,
    celebrationTime: 0,
    playerStickers: [],
    playerBadges: [],
    colorOverride: null
  };

  const input = {
    boost: false,
    touchStartX: null
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
    particles: [],
    timers: { star: 0, obstacle: 0, power: 0 },
    playerDistance: 0
  };

  // ---------------------------------------------------------------------------
  // Three.js scene setup
  // ---------------------------------------------------------------------------
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
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

  const camera = new THREE.PerspectiveCamera(58, 16 / 9, 0.1, 900);
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
    const width = mount.clientWidth;
    const height = mount.clientHeight;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
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
    const roadMaterial = new THREE.MeshStandardMaterial({
      color: "#2a2f3a",
      roughness: 0.82,
      metalness: 0.08
    });
    const road = new THREE.Mesh(new THREE.PlaneGeometry(12.5, 1400), roadMaterial);
    road.rotation.x = -Math.PI / 2;
    road.position.z = -640;
    road.receiveShadow = true;
    worldGroup.add(road);

    const shoulderMaterial = new THREE.MeshStandardMaterial({
      color: "#2e9758",
      roughness: 1.0,
      metalness: 0
    });
    const leftShoulder = new THREE.Mesh(new THREE.PlaneGeometry(8, 1400), shoulderMaterial);
    leftShoulder.rotation.x = -Math.PI / 2;
    leftShoulder.position.set(-10.4, -0.01, -640);
    leftShoulder.receiveShadow = true;
    worldGroup.add(leftShoulder);

    const rightShoulder = leftShoulder.clone();
    rightShoulder.position.x = 10.4;
    worldGroup.add(rightShoulder);

    const railMat = new THREE.MeshStandardMaterial({
      color: "#dce4ff",
      emissive: "#5a7ae0",
      emissiveIntensity: 0.26,
      roughness: 0.36,
      metalness: 0.65
    });
    const railGeo = new THREE.BoxGeometry(0.22, 0.32, 1400);
    const leftRail = new THREE.Mesh(railGeo, railMat);
    leftRail.position.set(-6.3, 0.18, -640);
    leftRail.castShadow = true;
    leftRail.receiveShadow = true;
    worldGroup.add(leftRail);

    const rightRail = leftRail.clone();
    rightRail.position.x = 6.3;
    worldGroup.add(rightRail);

    // Lane dashes: individual meshes moved continuously for strong speed feel.
    const dashGeo = new THREE.BoxGeometry(0.22, 0.06, 2.4);
    const dashMat = new THREE.MeshStandardMaterial({
      color: "#fff5a8",
      emissive: "#8c7a36",
      emissiveIntensity: 0.24
    });
    const laneX = [-1.6, 1.6];
    laneX.forEach((x) => {
      for (let i = 0; i < 90; i += 1) {
        const dash = new THREE.Mesh(dashGeo, dashMat);
        dash.position.set(x, 0.03, -i * 8.0);
        dash.receiveShadow = true;
        worldGroup.add(dash);
        world.laneDashMeshes.push(dash);
      }
    });

    // Side neon lights to enhance the "wow" factor.
    const bulbGeo = new THREE.SphereGeometry(0.14, 12, 12);
    for (let i = 0; i < 80; i += 1) {
      const z = -i * 16;
      const leftBulb = new THREE.Mesh(
        bulbGeo,
        new THREE.MeshStandardMaterial({
          color: "#4befff",
          emissive: "#31d7ff",
          emissiveIntensity: 1.1,
          metalness: 0.15,
          roughness: 0.28
        })
      );
      leftBulb.position.set(-6.8, 0.3, z);
      leftBulb.castShadow = true;
      worldGroup.add(leftBulb);
      world.sideLights.push(leftBulb);

      const rightBulb = leftBulb.clone();
      rightBulb.position.x = 6.8;
      worldGroup.add(rightBulb);
      world.sideLights.push(rightBulb);
    }
  }

  function makeSkyCity() {
    const cityGroup = new THREE.Group();
    worldGroup.add(cityGroup);

    const buildingGeo = new THREE.BoxGeometry(3.2, 1, 3.2);
    const colors = ["#8da7ff", "#90d8ff", "#c0d6ff", "#8df1d2"];
    for (let i = 0; i < 110; i += 1) {
      const mesh = new THREE.Mesh(
        buildingGeo,
        new THREE.MeshStandardMaterial({
          color: randomFrom(colors),
          roughness: 0.95,
          metalness: 0.08,
          emissive: "#1b2f65",
          emissiveIntensity: 0.2
        })
      );
      mesh.position.x = (Math.random() < 0.5 ? -1 : 1) * (14 + Math.random() * 16);
      mesh.position.z = -Math.random() * 1300;
      mesh.position.y = 0.45;
      mesh.scale.y = 1.2 + Math.random() * 8.6;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      cityGroup.add(mesh);
    }

    const ridgeMat = new THREE.MeshStandardMaterial({
      color: "#5976b8",
      roughness: 0.95,
      metalness: 0.02
    });
    for (let i = 0; i < 24; i += 1) {
      const ridge = new THREE.Mesh(new THREE.ConeGeometry(4 + Math.random() * 3, 4 + Math.random() * 5, 6), ridgeMat);
      ridge.position.set((Math.random() < 0.5 ? -1 : 1) * (24 + Math.random() * 10), 1.6, -30 - i * 45);
      ridge.castShadow = true;
      ridge.receiveShadow = true;
      worldGroup.add(ridge);
      world.mountainRidges.push(ridge);
    }

    const cloudMat = new THREE.MeshStandardMaterial({
      color: "#e9f4ff",
      emissive: "#b4d8ff",
      emissiveIntensity: 0.2,
      transparent: true,
      opacity: 0.88
    });
    const cloudGeo = new THREE.SphereGeometry(1.4, 12, 12);
    for (let i = 0; i < 36; i += 1) {
      const puff = new THREE.Mesh(cloudGeo, cloudMat);
      puff.scale.set(1 + Math.random() * 1.6, 0.6 + Math.random() * 0.5, 1 + Math.random() * 1.2);
      puff.position.set((Math.random() - 0.5) * 70, 12 + Math.random() * 7, -20 - Math.random() * 720);
      worldGroup.add(puff);
      world.cloudPuffs.push({
        mesh: puff,
        drift: (Math.random() - 0.5) * 0.8
      });
    }
  }

  function updateScenery(dt, speed) {
    world.cloudPuffs.forEach((entry) => {
      entry.mesh.position.z += speed * dt * 0.2;
      entry.mesh.position.x += entry.drift * dt;
      if (entry.mesh.position.z > 40) entry.mesh.position.z -= 760;
      if (entry.mesh.position.x > 36) entry.mesh.position.x = -36;
      if (entry.mesh.position.x < -36) entry.mesh.position.x = 36;
    });
    world.mountainRidges.forEach((ridge) => {
      ridge.position.z += speed * dt * 0.35;
      if (ridge.position.z > 80) ridge.position.z -= 1120;
    });
  }

  function createCarMesh(hexColor) {
    const group = new THREE.Group();
    const bodyMaterial = new THREE.MeshStandardMaterial({
      color: hexColor,
      roughness: 0.34,
      metalness: 0.52
    });
    const canopyMaterial = new THREE.MeshStandardMaterial({
      color: "#ddf4ff",
      roughness: 0.14,
      metalness: 0.2,
      transparent: true,
      opacity: 0.9
    });
    const tireMaterial = new THREE.MeshStandardMaterial({
      color: "#20222f",
      roughness: 0.92,
      metalness: 0.04
    });

    const body = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.58, 2.2), bodyMaterial);
    body.position.y = 0.48;
    body.castShadow = true;
    body.receiveShadow = true;
    group.add(body);

    const roof = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.45, 1.0), canopyMaterial);
    roof.position.set(0, 0.88, 0.08);
    roof.castShadow = true;
    group.add(roof);

    const spoiler = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.08, 0.23), bodyMaterial);
    spoiler.position.set(0, 0.74, -1.03);
    spoiler.castShadow = true;
    group.add(spoiler);

    const hoodStripe = new THREE.Mesh(
      new THREE.BoxGeometry(0.42, 0.03, 1.2),
      new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.4, metalness: 0.3 })
    );
    hoodStripe.position.set(0, 0.79, 0.36);
    hoodStripe.castShadow = true;
    group.add(hoodStripe);

    const wheelGeo = new THREE.CylinderGeometry(0.24, 0.24, 0.16, 16);
    const wheelPos = [
      [-0.58, 0.24, 0.75],
      [0.58, 0.24, 0.75],
      [-0.58, 0.24, -0.75],
      [0.58, 0.24, -0.75]
    ];
    wheelPos.forEach((pos) => {
      const wheel = new THREE.Mesh(wheelGeo, tireMaterial);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(pos[0], pos[1], pos[2]);
      wheel.castShadow = true;
      group.add(wheel);
    });

    const headlightMat = new THREE.MeshStandardMaterial({
      color: "#ffeccd",
      emissive: "#ffd584",
      emissiveIntensity: 1.2,
      roughness: 0.2
    });
    const headlightGeo = new THREE.SphereGeometry(0.1, 10, 10);
    const leftHeadlight = new THREE.Mesh(headlightGeo, headlightMat);
    leftHeadlight.position.set(-0.35, 0.55, 1.08);
    const rightHeadlight = leftHeadlight.clone();
    rightHeadlight.position.x = 0.35;
    group.add(leftHeadlight);
    group.add(rightHeadlight);

    const underGlow = new THREE.Mesh(
      new THREE.CircleGeometry(0.95, 20),
      new THREE.MeshStandardMaterial({
        color: hexColor,
        emissive: hexColor,
        emissiveIntensity: 0.45,
        transparent: true,
        opacity: 0.42
      })
    );
    underGlow.rotation.x = -Math.PI / 2;
    underGlow.position.y = 0.05;
    group.add(underGlow);

    const shadowBlob = new THREE.Mesh(
      new THREE.CircleGeometry(1.05, 20),
      new THREE.MeshBasicMaterial({
        color: "#000000",
        transparent: true,
        opacity: 0.23
      })
    );
    shadowBlob.rotation.x = -Math.PI / 2;
    shadowBlob.position.y = 0.01;
    group.add(shadowBlob);

    const vine = new THREE.Mesh(
      new THREE.TorusGeometry(0.72, 0.07, 10, 40),
      new THREE.MeshStandardMaterial({
        color: "#78ff8e",
        emissive: "#44dd66",
        emissiveIntensity: 0.8,
        roughness: 0.5
      })
    );
    vine.rotation.x = Math.PI / 2;
    vine.position.y = 0.62;
    vine.visible = false;
    group.add(vine);

    group.scale.setScalar(1.12);
    return { group, bodyMaterial, vine, underGlow };
  }

  function createStarMesh() {
    const mesh = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.36, 0),
      new THREE.MeshStandardMaterial({
        color: "#ffe971",
        emissive: "#ffbe1a",
        emissiveIntensity: 0.72,
        roughness: 0.3,
        metalness: 0.1
      })
    );
    mesh.castShadow = true;
    return mesh;
  }

  function createPowerMesh() {
    const group = new THREE.Group();
    const orb = new THREE.Mesh(
      new THREE.SphereGeometry(0.44, 16, 16),
      new THREE.MeshStandardMaterial({
        color: "#7dff92",
        emissive: "#42d868",
        emissiveIntensity: 0.84,
        roughness: 0.15,
        metalness: 0.1
      })
    );
    orb.castShadow = true;
    group.add(orb);
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.64, 0.05, 12, 48),
      new THREE.MeshStandardMaterial({
        color: "#b8ffd0",
        emissive: "#6efca0",
        emissiveIntensity: 0.7
      })
    );
    ring.rotation.x = Math.PI / 2;
    group.add(ring);
    return group;
  }

  function createObstacleMesh(type) {
    const group = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(1.18, 0.7, 1.4),
      new THREE.MeshStandardMaterial({
        color: type.color,
        roughness: 0.8,
        metalness: 0.08
      })
    );
    body.position.y = 0.36;
    body.castShadow = true;
    body.receiveShadow = true;
    group.add(body);
    return group;
  }

  // ---------------------------------------------------------------------------
  // Input controls
  // ---------------------------------------------------------------------------
  function moveLane(direction) {
    if (state.mode !== "racing" || !world.player) return;
    world.player.lane = clamp(world.player.lane + direction, 0, LANES_X.length - 1);
    world.player.targetX = LANES_X[world.player.lane];
  }

  window.addEventListener("keydown", (event) => {
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
  });

  window.addEventListener("keyup", (event) => {
    if (event.key === "ArrowUp" || event.key === "w" || event.key === "W") {
      input.boost = false;
    }
  });

  mount.addEventListener("pointerdown", (event) => {
    input.touchStartX = event.clientX;
  });

  mount.addEventListener("pointerup", (event) => {
    if (input.touchStartX == null) return;
    const dx = event.clientX - input.touchStartX;
    if (dx > 24) moveLane(1);
    else if (dx < -24) moveLane(-1);
    input.touchStartX = null;
  });

  // ---------------------------------------------------------------------------
  // Audio: CC0 music + lightweight procedural SFX
  // ---------------------------------------------------------------------------
  let audioCtx = null;
  const backgroundMusic = new Audio("./assets/music/lassolady.ogg");
  backgroundMusic.loop = true;
  backgroundMusic.volume = 0.45;
  backgroundMusic.preload = "auto";

  function ensureAudio() {
    if (!audioCtx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      audioCtx = new AudioCtx();
    }
    if (audioCtx.state === "suspended") {
      audioCtx.resume().catch(() => {});
    }
  }

  function tone(freq, duration, type, volume) {
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

  function startMusic() {
    backgroundMusic.currentTime = 0;
    backgroundMusic.play().catch(() => {
      // Browser may block autoplay if user did not interact yet.
    });
  }

  function pauseMusic() {
    backgroundMusic.pause();
  }

  function sfxStar() {
    ensureAudio();
    tone(820, 0.07, "triangle", 0.04);
    tone(1050, 0.06, "triangle", 0.03);
  }

  function sfxFreeze() {
    ensureAudio();
    tone(240, 0.14, "sawtooth", 0.035);
    tone(170, 0.16, "sine", 0.028);
  }

  function sfxBump() {
    ensureAudio();
    tone(110, 0.09, "square", 0.035);
  }

  function sfxVictory() {
    ensureAudio();
    tone(392, 0.13, "triangle", 0.04);
    setTimeout(() => tone(523, 0.13, "triangle", 0.04), 120);
    setTimeout(() => tone(659, 0.17, "triangle", 0.042), 240);
  }

  // ---------------------------------------------------------------------------
  // Spawning and object lifecycle
  // ---------------------------------------------------------------------------
  function clearObjectList(list) {
    list.forEach((item) => {
      worldGroup.remove(item.mesh);
    });
    list.length = 0;
  }

  function spawnStar() {
    const lane = randomLaneIndex();
    const mesh = createStarMesh();
    mesh.position.set(LANES_X[lane], 0.95, -180);
    worldGroup.add(mesh);
    world.stars.push({
      lane,
      z: -180,
      mesh,
      spin: Math.random() * 2.6 + 1.6
    });
  }

  function spawnObstacle() {
    const lane = randomLaneIndex();
    const type = randomFrom(OBSTACLE_TYPES);
    const mesh = createObstacleMesh(type);
    mesh.position.set(LANES_X[lane], 0, -185);
    worldGroup.add(mesh);
    world.obstacles.push({
      lane,
      z: -185,
      mesh,
      type,
      hitCooldown: 0
    });
  }

  function spawnPower() {
    const lane = randomLaneIndex();
    const mesh = createPowerMesh();
    mesh.position.set(LANES_X[lane], 0.95, -190);
    worldGroup.add(mesh);
    world.powers.push({ lane, z: -190, mesh });
  }

  // ---------------------------------------------------------------------------
  // Gameplay setup
  // ---------------------------------------------------------------------------
  function createPlayer() {
    const car = CARS[state.selectedCarIndex];
    const color = state.colorOverride || car.color;
    const playerMesh = createCarMesh(color);
    playerMesh.group.position.set(0, 0, 7.4);
    worldGroup.add(playerMesh.group);
    return {
      lane: 1,
      targetX: LANES_X[1],
      x: 0,
      z: 7.4,
      baseSpeed: car.speed,
      handling: car.handling,
      slowdownTimer: 0,
      bumpTimer: 0,
      mesh: playerMesh.group,
      bodyMaterial: playerMesh.bodyMaterial,
      underGlow: playerMesh.underGlow
    };
  }

  function createOpponents() {
    world.opponents.length = 0;
    const level = LEVELS[state.levelIndex];
    for (let i = 0; i < 3; i += 1) {
      const lane = i % LANES_X.length;
      const color = ["#ff8359", "#53beff", "#ffce53"][i];
      const carMesh = createCarMesh(color);
      carMesh.group.position.set(LANES_X[lane], 0, -25 - i * 30);
      worldGroup.add(carMesh.group);
      world.opponents.push({
        lane,
        targetLane: lane,
        z: -25 - i * 30,
        speed: world.player.baseSpeed + level.aiBonus + (Math.random() * 2.4 - 1.2),
        laneTimer: 0.8 + Math.random() * 1.5,
        frozenTimer: 0,
        mesh: carMesh.group,
        vineMesh: carMesh.vine
      });
    }
  }

  function resetLevel(levelIndex) {
    state.levelIndex = levelIndex;
    state.starsThisLevel = 0;
    state.freezeTimeRemaining = 0;
    world.playerDistance = 0;
    world.timers.star = 0.5;
    world.timers.obstacle = 1.3;
    world.timers.power = 6.0;

    clearObjectList(world.stars);
    clearObjectList(world.obstacles);
    clearObjectList(world.powers);

    world.opponents.forEach((opponent) => worldGroup.remove(opponent.mesh));
    world.opponents.length = 0;

    if (world.player && world.player.mesh) {
      worldGroup.remove(world.player.mesh);
    }
    world.player = createPlayer();
    createOpponents();
    updateHud();
  }

  // ---------------------------------------------------------------------------
  // Game flow screens
  // ---------------------------------------------------------------------------
  function hidePanels() {
    startPanel.classList.add("hidden");
    celebrationPanel.classList.add("hidden");
    prizePanel.classList.add("hidden");
    endPanel.classList.add("hidden");
  }

  function showStart() {
    state.mode = "start";
    pauseMusic();
    hud.classList.add("hidden");
    overlay.classList.remove("hidden");
    celebrationFx.classList.add("hidden");
    hidePanels();
    startPanel.classList.remove("hidden");
    renderCarChoices();
  }

  function startLevel(levelIndex) {
    state.mode = "racing";
    if (backgroundMusic.paused) {
      backgroundMusic.play().catch(() => {});
    }
    overlay.classList.add("hidden");
    hud.classList.remove("hidden");
    celebrationFx.classList.add("hidden");
    hidePanels();
    resetLevel(levelIndex);
  }

  function completeLevel() {
    state.mode = "celebration";
    state.celebrationTime = 0;
    overlay.classList.remove("hidden");
    hidePanels();
    celebrationPanel.classList.remove("hidden");
    celebrationScore.textContent = `Score: ${state.score}`;
    launchCelebrationFx();
    sfxVictory();
  }

  function showPrizeScreen() {
    state.mode = "prize";
    overlay.classList.remove("hidden");
    hidePanels();
    prizePanel.classList.remove("hidden");

    prizeChoicesEl.innerHTML = "";
    const choices = shuffleInPlace([
      { type: "sticker", value: randomFrom(STICKER_PRIZES), label: "Sticker" },
      { type: "color", value: randomFrom(COLOR_PRIZES), label: "Car Color" },
      { type: "badge", value: randomFrom(BADGE_PRIZES), label: "Badge" }
    ]);

    choices.forEach((choice) => {
      const btn = document.createElement("button");
      btn.className = "choice";
      if (choice.type === "sticker") btn.textContent = `${choice.label}: ${choice.value}`;
      if (choice.type === "color") btn.textContent = `${choice.label}: Neon Paint`;
      if (choice.type === "badge") btn.textContent = `${choice.label}: ${choice.value}`;

      btn.addEventListener("click", () => {
        if (choice.type === "sticker") {
          state.playerStickers.push(choice.value);
          state.score += 20;
        } else if (choice.type === "color") {
          state.colorOverride = choice.value;
        } else if (choice.type === "badge") {
          state.playerBadges.push(choice.value);
          state.score += 30;
        }
        if (state.levelIndex < LEVELS.length - 1) {
          startLevel(state.levelIndex + 1);
        } else {
          showEndScreen();
        }
      });
      prizeChoicesEl.appendChild(btn);
    });
  }

  function showEndScreen() {
    state.mode = "end";
    pauseMusic();
    overlay.classList.remove("hidden");
    hidePanels();
    endPanel.classList.remove("hidden");
    hud.classList.add("hidden");
    finalScoreEl.textContent = `Final Score: ${state.score}`;
    finalBadgesEl.textContent = state.playerBadges.length
      ? `Badges: ${state.playerBadges.join(", ")}`
      : "Badges: None yet (still awesome).";
  }

  function launchCelebrationFx() {
    celebrationFx.classList.remove("hidden");
    celebrationFx.innerHTML = "";
    const symbols = ["👍", "😄", "🎉", "✨", "🌟"];
    for (let i = 0; i < 90; i += 1) {
      const el = document.createElement("span");
      el.className = "drop";
      el.textContent = randomFrom(symbols);
      el.style.left = `${Math.random() * 100}%`;
      el.style.animationDuration = `${2.2 + Math.random() * 2.2}s`;
      el.style.animationDelay = `${Math.random() * 0.8}s`;
      celebrationFx.appendChild(el);
    }
  }

  // ---------------------------------------------------------------------------
  // HUD + scoring
  // ---------------------------------------------------------------------------
  function prizeMeterPercent() {
    return clamp((state.starsThisLevel / state.prizeMeterTarget) * 100, 0, 100);
  }

  function updateHud() {
    hudLevel.textContent = String(state.levelIndex + 1);
    hudScore.textContent = String(state.score);
    hudStars.textContent = String(state.totalStars);
    hudMeter.textContent = `${Math.round(prizeMeterPercent())}%`;
    hudFreeze.textContent = state.freezeTimeRemaining > 0 ? `${state.freezeTimeRemaining.toFixed(1)}s` : "Ready";
  }

  // ---------------------------------------------------------------------------
  // Collision checks
  // ---------------------------------------------------------------------------
  function collidesPlayerX(playerX, laneIndex, width) {
    return Math.abs(playerX - LANES_X[laneIndex]) < width;
  }

  // ---------------------------------------------------------------------------
  // Main race update
  // ---------------------------------------------------------------------------
  function activateFreeze() {
    state.freezeTimeRemaining = 3.2;
    const playerZ = world.player.z;
    world.opponents.forEach((opponent) => {
      if (Math.abs(opponent.z - playerZ) < 45) {
        opponent.frozenTimer = Math.max(opponent.frozenTimer, state.freezeTimeRemaining);
      }
    });
    sfxFreeze();
  }

  function updateRace(dt) {
    const level = LEVELS[state.levelIndex];
    const player = world.player;

    if (player.bumpTimer > 0) player.bumpTimer -= dt;
    if (player.slowdownTimer > 0) player.slowdownTimer -= dt;
    if (state.freezeTimeRemaining > 0) state.freezeTimeRemaining -= dt;

    let speed = player.baseSpeed;
    if (input.boost) speed *= 1.14;
    if (player.slowdownTimer > 0) speed *= 0.62;

    player.x = lerp(player.x, player.targetX, Math.min(1, dt * player.handling * 1.9));
    player.mesh.position.x = player.x;
    player.mesh.position.y = player.bumpTimer > 0 ? Math.sin(performance.now() * 0.04) * 0.05 : 0;
    player.mesh.rotation.z = lerp(player.mesh.rotation.z, (player.targetX - player.x) * -0.08, Math.min(1, dt * 6));

    world.playerDistance += speed * dt;
    updateScenery(dt, speed);

    // Move lane dashes and side lights to amplify movement sensation.
    world.laneDashMeshes.forEach((dash) => {
      dash.position.z += speed * dt * 1.8;
      if (dash.position.z > 20) dash.position.z -= 720;
    });
    world.sideLights.forEach((bulb, idx) => {
      bulb.position.z += speed * dt * 1.7;
      if (bulb.position.z > 35) bulb.position.z -= 1280;
      bulb.material.emissiveIntensity = 0.8 + Math.sin(performance.now() * 0.003 + idx * 0.3) * 0.35;
    });

    // Chase camera keeps the player always visible and centered.
    camera.position.x = lerp(camera.position.x, player.x * 0.35, Math.min(1, dt * 3.5));
    camera.position.y = lerp(camera.position.y, 6.6, Math.min(1, dt * 3.0));
    camera.position.z = lerp(camera.position.z, 15.2, Math.min(1, dt * 3.0));
    cameraLookTarget.set(player.x * 0.18, 1.2, -13.5);
    camera.lookAt(cameraLookTarget);

    // Spawn cadence
    world.timers.star -= dt;
    world.timers.obstacle -= dt;
    world.timers.power -= dt;
    if (world.timers.star <= 0) {
      spawnStar();
      world.timers.star = level.starEvery + Math.random() * 0.25;
    }
    if (world.timers.obstacle <= 0) {
      spawnObstacle();
      world.timers.obstacle = level.obstacleEvery + Math.random() * 0.55;
    }
    if (world.timers.power <= 0) {
      spawnPower();
      world.timers.power = level.powerEvery + Math.random() * 1.7;
    }

    // Stars
    for (let i = world.stars.length - 1; i >= 0; i -= 1) {
      const star = world.stars[i];
      star.z += speed * dt;
      star.mesh.position.z = star.z;
      star.mesh.rotation.y += dt * star.spin;
      star.mesh.rotation.x += dt * 0.7;
      star.mesh.position.y = 0.95 + Math.sin(performance.now() * 0.004 + i) * 0.12;
      if (star.z > 25) {
        worldGroup.remove(star.mesh);
        world.stars.splice(i, 1);
        continue;
      }
      if (Math.abs(star.z - player.z) < 2.2 && collidesPlayerX(player.x, star.lane, 1.02)) {
        worldGroup.remove(star.mesh);
        world.stars.splice(i, 1);
        state.totalStars += 1;
        state.starsThisLevel += 1;
        state.score += 10;
        sfxStar();
      }
    }

    // Powers
    for (let i = world.powers.length - 1; i >= 0; i -= 1) {
      const power = world.powers[i];
      power.z += speed * dt;
      power.mesh.position.z = power.z;
      power.mesh.rotation.y += dt * 1.8;
      power.mesh.position.y = 0.92 + Math.sin(performance.now() * 0.005 + i * 2) * 0.15;
      if (power.z > 25) {
        worldGroup.remove(power.mesh);
        world.powers.splice(i, 1);
        continue;
      }
      if (Math.abs(power.z - player.z) < 2.1 && collidesPlayerX(player.x, power.lane, 1.02)) {
        worldGroup.remove(power.mesh);
        world.powers.splice(i, 1);
        activateFreeze();
      }
    }

    // Obstacles + slowdown collisions
    for (let i = world.obstacles.length - 1; i >= 0; i -= 1) {
      const obstacle = world.obstacles[i];
      obstacle.z += speed * dt;
      obstacle.mesh.position.z = obstacle.z;
      obstacle.hitCooldown = Math.max(0, obstacle.hitCooldown - dt);
      if (obstacle.z > 26) {
        worldGroup.remove(obstacle.mesh);
        world.obstacles.splice(i, 1);
        continue;
      }
      if (
        obstacle.hitCooldown <= 0 &&
        Math.abs(obstacle.z - player.z) < 2.2 &&
        collidesPlayerX(player.x, obstacle.lane, 1.05)
      ) {
        obstacle.hitCooldown = 0.6;
        player.slowdownTimer = Math.max(player.slowdownTimer, 0.75);
        player.bumpTimer = 0.22;
        sfxBump();
      }
    }

    // Opponents: gentle overtaking behavior.
    world.opponents.forEach((opponent, index) => {
      if (opponent.frozenTimer > 0) {
        opponent.frozenTimer -= dt;
        opponent.vineMesh.visible = true;
        opponent.vineMesh.rotation.z += dt * 2.4;
        opponent.mesh.position.x += Math.sin(performance.now() * 0.02 + index) * 0.003;
      } else {
        opponent.vineMesh.visible = false;
        const relative = (opponent.speed - speed) + 5.4;
        opponent.z += relative * dt;
        opponent.laneTimer -= dt;
        if (opponent.laneTimer <= 0) {
          opponent.targetLane = clamp(opponent.targetLane + (Math.random() < 0.5 ? -1 : 1), 0, 2);
          opponent.laneTimer = 0.8 + Math.random() * 1.7;
        }
      }

      const targetX = LANES_X[opponent.targetLane];
      opponent.mesh.position.x = lerp(opponent.mesh.position.x, targetX, Math.min(1, dt * 4.8));
      opponent.mesh.position.z = opponent.z;

      if (opponent.z > 32) {
        opponent.z = -180 - Math.random() * 25;
        opponent.targetLane = randomLaneIndex();
        opponent.speed = player.baseSpeed + LEVELS[state.levelIndex].aiBonus + (Math.random() * 2.8 - 1.4);
      }
    });

    if (world.playerDistance >= level.length) {
      completeLevel();
    }

    updateHud();
  }

  // ---------------------------------------------------------------------------
  // Render car-choice UI
  // ---------------------------------------------------------------------------
  function renderCarChoices() {
    carChoicesEl.innerHTML = "";
    CARS.forEach((car, index) => {
      const button = document.createElement("button");
      button.className = "choice";
      if (index === state.selectedCarIndex) button.classList.add("selected");
      button.innerHTML = `<strong>${car.icon} ${car.name}</strong><br>Speed ${car.speed.toFixed(1)} / Handling ${car.handling.toFixed(1)}`;
      button.addEventListener("click", () => {
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
    state.celebrationTime = 0;
    state.playerStickers = [];
    state.playerBadges = [];
    state.colorOverride = null;
    input.boost = false;

    clearObjectList(world.stars);
    clearObjectList(world.obstacles);
    clearObjectList(world.powers);

    world.opponents.forEach((opponent) => worldGroup.remove(opponent.mesh));
    world.opponents.length = 0;

    if (world.player && world.player.mesh) worldGroup.remove(world.player.mesh);
    world.player = createPlayer();
    updateHud();
    showStart();
  }

  // ---------------------------------------------------------------------------
  // Main loop
  // ---------------------------------------------------------------------------
  let lastTime = performance.now();
  function loop(now) {
    const dt = Math.min(0.05, (now - lastTime) / 1000);
    lastTime = now;

    if (state.mode === "racing") {
      updateRace(dt);
    } else if (state.mode === "celebration") {
      state.celebrationTime += dt;
      // Subtle camera wobble during celebration.
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

    // Decorate player car with stickers by tinting slight emissive pulses.
    if (world.player && world.player.bodyMaterial) {
      const glowPulse = 0.07 + state.playerStickers.length * 0.02 + Math.sin(now * 0.004) * 0.02;
      world.player.bodyMaterial.emissive = new THREE.Color("#222222");
      world.player.bodyMaterial.emissiveIntensity = glowPulse;
      if (state.colorOverride) {
        world.player.bodyMaterial.color.set(state.colorOverride);
      }
      if (world.player.underGlow) {
        world.player.underGlow.material.emissiveIntensity = 0.25 + glowPulse * 1.8;
      }
    }

    renderer.render(scene, camera);
    requestAnimationFrame(loop);
  }

  // ---------------------------------------------------------------------------
  // Button handlers
  // ---------------------------------------------------------------------------
  startBtn.addEventListener("click", () => {
    ensureAudio();
    startMusic();
    state.score = 0;
    state.totalStars = 0;
    state.playerStickers = [];
    state.playerBadges = [];
    state.colorOverride = null;
    startLevel(0);
  });

  toPrizeBtn.addEventListener("click", () => {
    showPrizeScreen();
  });

  restartBtn.addEventListener("click", () => {
    resetGame();
  });

  // ---------------------------------------------------------------------------
  // Build static world and boot
  // ---------------------------------------------------------------------------
  makeRoad();
  makeSkyCity();
  resetGame();
  requestAnimationFrame(loop);
})();
