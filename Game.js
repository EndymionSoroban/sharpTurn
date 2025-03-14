// Game.js - Main game logic with multiplayer support
const canvas = document.getElementById("gameCanvas");
const canvasContext = canvas.getContext("2d");

// Game state variables
let speed = 2;
let angleDelta = 4;
let lineWidth = 10;
let keyPressed = {};
let players = [];
let activePlayers = [];
let lastFrameTimeMs = 0;
let maxFPS = 30;
let gameStarted = false;
let aiSettings;
let aiDecisionCounters = [];
let lastAiMoves = [];
let finishOrder = [];

// Initialize the game
function initGame() {
    // Clear any existing game state
    players = [];
    activePlayers = [];
    keyPressed = {};
    finishOrder = [];
    
    // Apply difficulty settings
    aiSettings = GameSettings.applySettings();
    
    // Get enabled players from settings
    const enabledPlayers = GameSettings.getEnabledPlayers();
    const playerCount = enabledPlayers.length;
    
    // Reset AI tracking arrays
    aiDecisionCounters = Array(playerCount).fill(0);
    lastAiMoves = Array(playerCount).fill(0);
    
    // Calculate starting positions based on number of players
    createPlayers(enabledPlayers);
    
    // Set up key event listeners
    window.onkeydown = function (e) { keyPressed[e.keyCode] = true; }
    window.onkeyup = function (e) { keyPressed[e.keyCode] = false; }
    
    // Start game loop
    requestAnimationFrame(gameLoop);
    gameStarted = true;
}

// Create players based on settings
function createPlayers(enabledPlayers) {
    const playerCount = enabledPlayers.length;
    
    // Create players in a circular arrangement
    enabledPlayers.forEach((player, index) => {
        // Calculate position based on player index and count
        const angle = (index / playerCount) * Math.PI * 2;
        const radius = canvas.width * 0.35; // Position at 35% from center to edge
        
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        
        const startX = centerX + Math.cos(angle) * radius;
        const startY = centerY + Math.sin(angle) * radius;
        
        // Initial direction points toward center to get things started
        const initialDirection = 2; // Base speed
        const dirX = (centerX - startX) / 100; // Normalize
        const dirY = (centerY - startY) / 100; // Normalize
        
        // Create the player
        const isHuman = player.type === 'human';
        const speed = isHuman ? aiSettings.playerSpeed : aiSettings.aiSpeed;
        
        const newPlayer = new Player(
            startX, 
            startY, 
            player.color, 
            speed, 
            isHuman,
            index,
            player.controls
        );
        
        // Set initial direction vector
        newPlayer.initialDirection(dirX, dirY);
        
        // Add to players array
        players.push(newPlayer);
        activePlayers.push(index);
    });
}

// Main game loop
function gameLoop(timestamp) {
    if (!gameStarted) return;
    
    if (timestamp < lastFrameTimeMs + (500 / maxFPS)) {
        requestAnimationFrame(gameLoop);
        return;
    }
    lastFrameTimeMs = timestamp;
    
    // Update game state
    updateGame();
    
    // Check if game is over (0 or 1 player left)
    if (activePlayers.length <= 1) {
        endRound();
        return;
    }
    
    // Request next frame
    requestAnimationFrame(gameLoop);
}

// Update game state each frame
function updateGame() {
    // Process movements for all active players
    activePlayers.forEach(playerIdx => {
        const player = players[playerIdx];
        
        if (player.isHuman) {
            // Handle human player input
            let playerAngle = 0;
            const controls = player.controls;
            
            if (keyPressed[controls.right]) {
                playerAngle = angleDelta;
            } else if (keyPressed[controls.left]) {
                playerAngle = -angleDelta;
            }
            
            player.addPosition(playerAngle);
        } else {
            // Handle AI player
            aiDecisionCounters[playerIdx]++;
            let aiAngle = lastAiMoves[playerIdx];
            
            // Only make AI decisions at intervals based on reaction time
            if (aiDecisionCounters[playerIdx] >= aiSettings.aiReactionTime) {
                aiAngle = computerMove(playerIdx);
                lastAiMoves[playerIdx] = aiAngle;
                aiDecisionCounters[playerIdx] = 0;
            }
            
            player.addPosition(aiAngle);
        }
    });
    
    // Draw all players
    Player.displayPlayers(players);
    
    // Check for collisions
    checkCollisions();
}

// Check for collisions
function checkCollisions() {
    // Make a copy of active players to safely modify during iteration
    const currentActivePlayers = [...activePlayers];
    
    for (const playerIdx of currentActivePlayers) {
        const player = players[playerIdx];
        const collided = player.checkCollision(players);
        
        if (collided) {
            // Record player elimination
            const playerIndex = activePlayers.indexOf(playerIdx);
            if (playerIndex !== -1) {
                // Add to finish order (last to first)
                finishOrder.unshift(playerIdx);
                
                // Remove from active players
                activePlayers.splice(playerIndex, 1);
            }
        }
    }
}

// End the round and show scores
function endRound() {
    gameStarted = false;
    
    // If there's still one player remaining, add them as the winner
    if (activePlayers.length === 1) {
        finishOrder.unshift(activePlayers[0]);
    }
    
    // Show round over screen with scores
    window.showRoundOver(finishOrder);
}

// AI logic
function computerMove(playerIdx) {
    const player = players[playerIdx];
    
    // Apply randomness based on difficulty
    if (Math.random() < aiSettings.aiRandomness) {
        return Math.random() < 0.5 ? angleDelta : -angleDelta;
    }
    
    // Check for immediate wall avoidance first
    const avoidanceMove = addAvoidanceLogic(playerIdx);
    if (avoidanceMove !== null) {
        return avoidanceMove;
    }
    
    // Store original positions to restore after simulation
    const restorePositions = players.map(p => p.arrayOfPos.slice());
    
    // Define directions to test
    const directions = [-angleDelta, 0, angleDelta];
    let bestDirection = 0;
    let bestScore = -1;
    
    // Test each direction
    for (const direction of directions) {
        let score = evaluateMove(playerIdx, direction);
        if (score > bestScore) {
            bestScore = score;
            bestDirection = direction;
        }
        
        // Restore positions for next simulation
        players.forEach((p, idx) => {
            p.arrayOfPos = restorePositions[idx].slice();
        });
    }
    
    return bestDirection;
}

// Evaluate a potential move for an AI player
function evaluateMove(playerIdx, direction) {
    let survivalFrames = 0;
    let scoreBonus = 0;
    const player = players[playerIdx];
    
    // Get the current positions of all players
    const playerPositions = {};
    activePlayers.forEach(idx => {
        playerPositions[idx] = predictPlayerDirection(idx);