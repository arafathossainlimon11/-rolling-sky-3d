// --- GAME STATE MANAGER ---
let gameState = {
    unlockedLevel: parseInt(localStorage.getItem('unlockedLevel')) || 1,
    currentLevel: 1,
    coins: parseInt(localStorage.getItem('totalCoins')) || 0,
    isPlaying: false
};

// --- LEVEL CONFIGURATIONS ---
const levels = [
    { id: 1, length: 100, obstacleSpeed: 0, coins: 5 },
    { id: 2, length: 150, obstacleSpeed: 2, coins: 8 },
    { id: 3, length: 200, obstacleSpeed: 4, coins: 12 },
    { id: 4, length: 250, obstacleSpeed: 6, coins: 15 }
];

// --- SCREEN SWITCHER ---
function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(screenId).classList.add('active');

    if (screenId === 'level-select-screen') {
        renderLevelGrid();
    } else if (screenId === 'game-screen') {
        startLevel(gameState.currentLevel);
    } else {
        stopGameEngine();
    }
}

// --- RENDER LEVEL SELECTION GRID ---
function renderLevelGrid() {
    const grid = document.getElementById('levels-grid');
    grid.innerHTML = '';
    document.getElementById('total-coins').innerText = gameState.coins;

    levels.forEach(lvl => {
        const card = document.createElement('div');
        const isUnlocked = lvl.id <= gameState.unlockedLevel;
        card.className = `level-card ${isUnlocked ? 'unlocked' : 'locked'}`;
        card.innerText = isUnlocked ? lvl.id : '🔒';
        
        if (isUnlocked) {
            card.onclick = () => {
                gameState.currentLevel = lvl.id;
                showScreen('game-screen');
            };
        }
        grid.appendChild(card);
    });
}

// --- THREE.JS & CANNON.JS ENGINE SETUP ---
let scene, camera, renderer, physicsWorld, ballBody, ballMesh;
let keys = { ArrowUp: false, ArrowDown: false, ArrowLeft: false, ArrowRight: false, w: false, a: false, s: false, d: false };
let animationFrameId;

function startLevel(levelId) {
    const levelData = levels.find(l => l.id === levelId);
    document.getElementById('current-level-num').innerText = levelId;
    
    const container = document.getElementById('canvas-container');
    container.innerHTML = ''; // Clear previous canvas

    // 1. Three.js Scene Setup
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0b0f19);

    camera = new THREE.PerspectiveCamera(60, container.clientWidth / container.clientHeight, 0.1, 1000);
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(renderer.domElement);

    const light = new THREE.DirectionalLight(0xffffff, 1);
    light.position.set(10, 20, 10);
    scene.add(light);
    scene.add(new THREE.AmbientLight(0xffffff, 0.5));

    // 2. Cannon.js Physics World
    physicsWorld = new CANNON.World();
    physicsWorld.gravity.set(0, -9.82, 0);

    // Build Track & Ball
    buildTrack(levelData.length);
    createPhysicsBall();

    // Key Listeners
    window.onkeydown = (e) => keys[e.key] = true;
    window.onkeyup = (e) => keys[e.key] = false;

    gameState.isPlaying = true;
    gameLoop();
}

function buildTrack(length) {
    // Physics Ground
    const groundBody = new CANNON.Body({ mass: 0, shape: new CANNON.Box(new CANNON.Vec3(4, 0.5, length / 2)) });
    groundBody.position.set(0, -0.5, -length / 2);
    physicsWorld.addBody(groundBody);

    // Visual Mesh
    const groundGeo = new THREE.BoxGeometry(8, 1, length);
    const groundMat = new THREE.MeshStandardMaterial({ color: 0x1f2937 });
    const groundMesh = new THREE.Mesh(groundGeo, groundMat);
    groundMesh.position.copy(groundBody.position);
    scene.add(groundMesh);

    // Finish Line Target Box
    const finishGeo = new THREE.BoxGeometry(8, 0.2, 2);
    const finishMat = new THREE.MeshBasicMaterial({ color: 0x22c55e });
    const finishMesh = new THREE.Mesh(finishGeo, finishMat);
    finishMesh.position.set(0, 0.1, -length + 2);
    scene.add(finishMesh);
}

function createPhysicsBall() {
    ballBody = new CANNON.Body({
        mass: 2,
        shape: new CANNON.Sphere(1),
        linearDamping: 0.3
    });
    ballBody.position.set(0, 2, 0);
    physicsWorld.addBody(ballBody);

    const ballGeo = new THREE.SphereGeometry(1, 32, 32);
    const ballMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8 });
    ballMesh = new THREE.Mesh(ballGeo, ballMat);
    scene.add(ballMesh);
}

function gameLoop() {
    if (!gameState.isPlaying) return;

    physicsWorld.step(1 / 60);

    ballMesh.position.copy(ballBody.position);
    ballMesh.quaternion.copy(ballBody.quaternion);

    // Ball Controls
    const speed = 10;
    if (keys.ArrowUp || keys.w) ballBody.applyForce(new CANNON.Vec3(0, 0, -speed), ballBody.position);
    if (keys.ArrowDown || keys.s) ballBody.applyForce(new CANNON.Vec3(0, 0, speed), ballBody.position);
    if (keys.ArrowLeft || keys.a) ballBody.applyForce(new CANNON.Vec3(-speed, 0, 0), ballBody.position);
    if (keys.ArrowRight || keys.d) ballBody.applyForce(new CANNON.Vec3(speed, 0, 0), ballBody.position);

    // Camera Logic
    camera.position.set(ballMesh.position.x, ballMesh.position.y + 5, ballMesh.position.z + 8);
    camera.lookAt(ballMesh.position);

    // Game Over Condition (Fell off track)
    if (ballBody.position.y < -5) {
        gameState.isPlaying = false;
        document.getElementById('game-over-modal').classList.add('active');
        return;
    }

    // Win Condition (Reached Finish Line)
    const levelData = levels.find(l => l.id === gameState.currentLevel);
    if (ballBody.position.z <= -levelData.length + 2) {
        gameState.isPlaying = false;
        onLevelWin();
        return;
    }

    animationFrameId = requestAnimationFrame(gameLoop);
}

function onLevelWin() {
    if (gameState.currentLevel === gameState.unlockedLevel && gameState.unlockedLevel < levels.length) {
        gameState.unlockedLevel++;
        localStorage.setItem('unlockedLevel', gameState.unlockedLevel);
    }
    gameState.coins += 10;
    localStorage.setItem('totalCoins', gameState.coins);

    document.getElementById('level-win-modal').classList.add('active');
}

function retryLevel() {
    document.getElementById('game-over-modal').classList.remove('active');
    startLevel(gameState.currentLevel);
}

function nextLevel() {
    document.getElementById('level-win-modal').classList.remove('active');
    if (gameState.currentLevel < levels.length) {
        gameState.currentLevel++;
        startLevel(gameState.currentLevel);
    } else {
        showScreen('level-select-screen');
    }
}

function stopGameEngine() {
    gameState.isPlaying = false;
    cancelAnimationFrame(animationFrameId);
                  }
