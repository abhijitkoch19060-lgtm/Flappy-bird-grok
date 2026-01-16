// Settings storage
let settings = {
    birdColor: '#00FF00', // Green
    eyeSize: 'medium', // small, medium, large
    gameVolume: 1,
    musicVolume: 1,
    mute: false
};

// Load settings from localStorage if available
if (localStorage.getItem('flappySettings')) {
    settings = JSON.parse(localStorage.getItem('flappySettings'));
}

// Audio elements
const menuMusic = document.getElementById('menu-music');
const gameMusic = document.getElementById('game-music');
const passSound = document.getElementById('pass-sound');
const hitSound = document.getElementById('hit-sound');
const flapSound = document.getElementById('flap-sound');

// Apply volumes
function applyAudioSettings() {
    const vol = settings.mute ? 0 : settings.gameVolume;
    passSound.volume = vol;
    hitSound.volume = vol;
    flapSound.volume = vol;
    menuMusic.volume = settings.mute ? 0 : settings.musicVolume;
    gameMusic.volume = settings.mute ? 0 : settings.musicVolume;
}

// Canvases
const bgCanvas = document.getElementById('background-canvas');
const bgCtx = bgCanvas.getContext('2d');
const gameCanvas = document.getElementById('game-canvas');
const gameCtx = gameCanvas.getContext('2d');

// Resize function
function resizeCanvas(canvas) {
    const aspect = 16 / 9;
    let width = window.innerWidth;
    let height = window.innerHeight;
    if (width / height > aspect) {
        width = height * aspect;
    } else {
        height = width / aspect;
    }
    canvas.width = width;
    canvas.height = height;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
}

// Initial resize
resizeCanvas(bgCanvas);
resizeCanvas(gameCanvas);
window.addEventListener('resize', () => {
    resizeCanvas(bgCanvas);
    resizeCanvas(gameCanvas);
});

// Game variables
let gameWidth, gameHeight;
let birdX, birdY, birdVelocity, gravity, jump, flapSpeed;
let pillars = [];
let score = 0;
let gameStarted = false;
let userControl = false;
let paused = false;
let animationFrame;
let bgAnimationFrame;

// Constants
const birdSize = 40;
const pillarWidth = 80;
const pillarGap = 250; // Wider gap
const pillarSpacing = 300;
const cloudSpeed = 0.5;
let eyeRadius = 5; // Medium

// Clouds for background
const clouds = [
    {x: 100, y: 100, size: 50},
    {x: 300, y: 150, size: 70},
    {x: 500, y: 80, size: 60},
    {x: 700, y: 120, size: 50}
];

// Wing flap animation
let wingAngle = 0;
let wingDirection = 1;

// Ancient pillar design (simple canvas drawing)
function drawPillar(ctx, x, topHeight, bottomHeight) {
    // Base rectangle
    ctx.fillStyle = '#8B4513'; // Brown stone
    ctx.fillRect(x, 0, pillarWidth, topHeight);
    ctx.fillRect(x, gameHeight - bottomHeight, pillarWidth, bottomHeight);

    // Ancient details: Capitals and bases
    ctx.fillStyle = '#A0522D'; // Darker brown
    ctx.fillRect(x - 10, topHeight - 20, pillarWidth + 20, 20); // Top capital
    ctx.fillRect(x - 10, gameHeight - bottomHeight, pillarWidth + 20, 20); // Bottom base

    // Patterns
    ctx.strokeStyle = '#CD853F';
    ctx.lineWidth = 2;
    for (let i = 10; i < topHeight - 30; i += 20) {
        ctx.beginPath();
        ctx.moveTo(x, i);
        ctx.lineTo(x + pillarWidth, i);
        ctx.stroke();
    }
    for (let i = gameHeight - bottomHeight + 20; i < gameHeight - 20; i += 20) {
        ctx.beginPath();
        ctx.moveTo(x, i);
        ctx.lineTo(x + pillarWidth, i);
        ctx.stroke();
    }
}

// Draw bird
function drawBird(ctx, x, y, velocity) {
    // Body
    ctx.fillStyle = settings.birdColor;
    ctx.beginPath();
    ctx.arc(x, y, birdSize / 2, 0, Math.PI * 2);
    ctx.fill();

    // Eyes
    switch (settings.eyeSize) {
        case 'small': eyeRadius = 3; break;
        case 'medium': eyeRadius = 5; break;
        case 'large': eyeRadius = 7; break;
    }
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(x + 10, y - 10, eyeRadius, 0, Math.PI * 2);
    ctx.fill();

    // Wings
    flapSpeed = velocity < 0 ? 0.2 : 0.05; // Faster up, slower down
    wingAngle += flapSpeed * wingDirection;
    if (wingAngle > Math.PI / 4 || wingAngle < -Math.PI / 4) wingDirection *= -1;

    ctx.strokeStyle = '#000';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x - 15, y);
    ctx.lineTo(x - 25, y + wingAngle * 20);
    ctx.moveTo(x + 15, y);
    ctx.lineTo(x + 25, y - wingAngle * 20);
    ctx.stroke();
}

// Draw clouds
function drawClouds(ctx) {
    ctx.fillStyle = '#FFF';
    clouds.forEach(cloud => {
        ctx.beginPath();
        ctx.arc(cloud.x, cloud.y, cloud.size, 0, Math.PI * 2);
        ctx.arc(cloud.x + cloud.size / 2, cloud.y - cloud.size / 3, cloud.size / 2, 0, Math.PI * 2);
        ctx.arc(cloud.x - cloud.size / 2, cloud.y - cloud.size / 3, cloud.size / 2, 0, Math.PI * 2);
        ctx.fill();

        cloud.x -= cloudSpeed;
        if (cloud.x + cloud.size < 0) cloud.x = gameWidth + cloud.size;
    });
}

// Background simulation for menu
let bgBirdY = 0;
let bgBirdVelocity = 0;
let bgPillars = [];
let bgScore = 0;

function initBg() {
    gameWidth = bgCanvas.width;
    gameHeight = bgCanvas.height;
    bgBirdY = gameHeight / 2;
    bgBirdVelocity = 0;
    bgPillars = [];
    addPillar(true);
}

function addPillar(bg = false) {
    const gapStart = Math.random() * (gameHeight - pillarGap - 200) + 100;
    (bg ? bgPillars : pillars).push({
        x: gameWidth,
        top: gapStart,
        bottom: gameHeight - (gapStart + pillarGap),
        passed: false
    });
}

function updateBg() {
    bgCtx.clearRect(0, 0, gameWidth, gameHeight);

    // Draw sky (already in canvas bg)
    drawClouds(bgCtx);

    // Auto bird (sine wave to avoid pillars)
    bgBirdY = gameHeight / 2 + Math.sin(Date.now() / 1000) * 50;
    drawBird(bgCtx, gameWidth / 4, bgBirdY, 0); // No velocity for flap

    // Pillars
    bgPillars.forEach(p => {
        p.x -= 2;
        drawPillar(bgCtx, p.x, p.top, p.bottom);
    });

    if (bgPillars[0].x < -pillarWidth) bgPillars.shift();
    if (bgPillars[bgPillars.length - 1].x < gameWidth - pillarSpacing) addPillar(true);

    bgAnimationFrame = requestAnimationFrame(updateBg);
}

initBg();
updateBg();

// Menu music
menuMusic.play();

// Event listeners for menus
document.getElementById('new-game').addEventListener('click', startGame);
document.getElementById('settings').addEventListener('click', openSettings);
document.getElementById('quit').addEventListener('click', () => window.close()); // Or alert('Quit')
document.getElementById('back-to-menu').addEventListener('click', closeSettings);
document.getElementById('bird-color').addEventListener('change', e => { settings.birdColor = e.target.value; saveSettings(); });
document.getElementById('eye-size').addEventListener('change', e => { settings.eyeSize = e.target.value; saveSettings(); });
document.getElementById('game-volume').addEventListener('change', e => { settings.gameVolume = parseFloat(e.target.value); applyAudioSettings(); saveSettings(); });
document.getElementById('music-volume').addEventListener('change', e => { settings.musicVolume = parseFloat(e.target.value); applyAudioSettings(); saveSettings(); });
document.getElementById('mute').addEventListener('change', e => { settings.mute = e.target.checked; applyAudioSettings(); saveSettings(); });

// Pause menu
document.getElementById('resume').addEventListener('click', resumeGame);
document.getElementById('restart').addEventListener('click', restartGame);
document.getElementById('pause-settings').addEventListener('click', openSettings);
document.getElementById('back-to-main-menu').addEventListener('click', backToMenu);
document.getElementById('reset').addEventListener('click', restartGame);

function saveSettings() {
    localStorage.setItem('flappySettings', JSON.stringify(settings));
}

function openSettings() {
    document.getElementById('settings-menu').classList.remove('hidden');
    document.getElementById('menu').classList.add('hidden');
}

function closeSettings() {
    document.getElementById('settings-menu').classList.add('hidden');
    document.getElementById('menu').classList.remove('hidden');
}

function startGame() {
    document.getElementById('menu-container').classList.add('hidden');
    document.getElementById('game-container').classList.remove('hidden');
    menuMusic.pause();
    gameMusic.play();
    initGame();
    countdown(3, () => {
        gameStarted = true;
        updateGame();
    });
}

function initGame() {
    gameWidth = gameCanvas.width;
    gameHeight = gameCanvas.height;
    birdX = gameWidth / 4;
    birdY = gameHeight / 2;
    birdVelocity = 0;
    gravity = 0.3; // Slow drop
    jump = -7; // Easier control
    pillars = [];
    score = 0;
    addPillar();
    userControl = false;
    paused = false;
}

function countdown(from, callback) {
    const cd = document.getElementById('countdown');
    cd.classList.remove('hidden');
    let count = from;
    const interval = setInterval(() => {
        cd.textContent = count;
        count--;
        if (count < 0) {
            clearInterval(interval);
            cd.classList.add('hidden');
            callback();
        }
    }, 1000);
}

function updateGame() {
    if (paused || !gameStarted) return;

    gameCtx.clearRect(0, 0, gameWidth, gameHeight);

    drawClouds(gameCtx);

    // Bird
    if (userControl) {
        birdVelocity += gravity;
        birdY += birdVelocity;
    } // Else straight fly
    drawBird(gameCtx, birdX, birdY, birdVelocity);

    // Pillars
    pillars.forEach(p => {
        p.x -= 2;
        drawPillar(gameCtx, p.x, p.top, p.bottom);

        // Score
        if (p.x + pillarWidth < birdX && !p.passed) {
            p.passed = true;
            score = Math.min(score + 1, 999);
            passSound.play();
        }

        // Collision
        if (birdX + birdSize / 2 > p.x && birdX - birdSize / 2 < p.x + pillarWidth) {
            if (birdY - birdSize / 2 < p.top || birdY + birdSize / 2 > gameHeight - p.bottom) {
                gameOver();
            }
        }
    });

    if (birdY + birdSize / 2 > gameHeight) gameOver(); // Ground

    if (pillars[0].x < -pillarWidth) pillars.shift();
    if (pillars[pillars.length - 1].x < gameWidth - pillarSpacing) addPillar();

    // Score display
    gameCtx.fillStyle = '#000';
    gameCtx.font = '30px Arial';
    gameCtx.fillText(`Score: ${score}`, 10, 30);

    animationFrame = requestAnimationFrame(updateGame);
}

function gameOver() {
    cancelAnimationFrame(animationFrame);
    hitSound.play();
    document.getElementById('final-score').textContent = score;
    document.getElementById('game-over').classList.remove('hidden');
    gameStarted = false;
}

function handleInput() {
    if (!userControl) {
        userControl = true;
    }
    if (gameStarted && !paused) {
        birdVelocity = jump;
        flapSound.play();
    }
}

// Inputs
window.addEventListener('keydown', e => {
    if (e.key === ' ' && gameStarted) handleInput();
    if (e.key === 'Escape' && gameStarted && !paused) pauseGame();
});
window.addEventListener('click', () => {
    if (gameStarted) handleInput();
});
window.addEventListener('touchstart', () => {
    if (gameStarted) handleInput();
});

function pauseGame() {
    paused = true;
    cancelAnimationFrame(animationFrame);
    document.getElementById('pause-menu').classList.remove('hidden');
}

function resumeGame() {
    document.getElementById('pause-menu').classList.add('hidden');
    countdown(3, () => {
        paused = false;
        updateGame();
    });
}

function restartGame() {
    document.getElementById('pause-menu').classList.add('hidden');
    document.getElementById('game-over').classList.add('hidden');
    initGame();
    countdown(3, () => {
        gameStarted = true;
        updateGame();
    });
}

function backToMenu() {
    cancelAnimationFrame(animationFrame);
    document.getElementById('game-container').classList.add('hidden');
    document.getElementById('menu-container').classList.remove('hidden');
    document.getElementById('pause-menu').classList.add('hidden');
    gameMusic.pause();
    menuMusic.play();
}

// Apply initial settings
applyAudioSettings();
document.getElementById('bird-color').value = settings.birdColor;
document.getElementById('eye-size').value = settings.eyeSize;
document.getElementById('game-volume').value = settings.gameVolume;
document.getElementById('music-volume').value = settings.musicVolume;
document.getElementById('mute').checked = settings.mute;
