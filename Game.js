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
    console.log("Game initialization started");
    
    // Clear any existing game state
    players = [];
    activePlayers = [];
    keyPressed = {};
    finishOrder = [];
    
    // Apply difficulty settings
    aiSettings = GameSettings.applySettings();
    console.log("Applied game settings:", aiSettings);
    
    // Get enabled players from settings
    const enabledPlayers = GameSettings.getEnabledPlayers();
    const playerCount = enabledPlayers.length;
    console.log("Enabled players:", playerCount);
    
    // Reset AI tracking arrays
    aiDecisionCounters = Array(playerCount).fill(0);
    lastAiMoves = Array(playerCount).fill(0);
    
    // Create players
    createPlayers(enabledPlayers);
    console.log("Players created:", players.length);
    
    // Set up key event listeners
    window.onkeydown = function (e) { keyPressed[e.keyCode] = true; }
    window.onkeyup = function (e) { keyPressed[e.keyCode] = false; }
    
    // Start game loop
    gameStarted = true;
    requestAnimationFrame(gameLoop);
    console.log("Game loop started");
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
        
        // Create the player
        const isHuman = player.type === 'human';
        const playerSpeed = isHuman ? aiSettings.playerSpeed : aiSettings.aiSpeed;
        
        console.log(`Creating player ${index+1}:`, {
            x: startX,
            y: startY,
            color: player.color,
            speed: playerSpeed,
            isHuman: isHuman
        });
        
        const newPlayer = new Player(
            startX, 
            startY, 
            player.color, 
            playerSpeed, 
            isHuman,
            index,
            player.controls
        );
        
        // Add to players array
        players.push(newPlayer);
        activePlayers.push(index);
    });
}

// Main game loop
function gameLoop(timestamp) {
    if (!gameStarted) {
        console.log("Game not started, exiting game loop");
        return;
    }
    
    // Frame rate limiting
    if (timestamp < lastFrameTimeMs + (1000 / maxFPS)) {
        requestAnimationFrame(gameLoop);
        return;
    }
    lastFrameTimeMs = timestamp;
    
    // Update game state
    updateGame();
    
    // Check if game is over (0 or 1 player left)
    if (activePlayers.length <= 1) {
        console.log("Game ending - only", activePlayers.length, "players left");
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

// Simple wall avoidance logic for AI
function addAvoidanceLogic(playerIdx) {
    const player = players[playerIdx];
    const pos = player.arrayOfPos[player.arrayOfPos.length - 1];
    
    // Wall detection threshold
    const wallThreshold = 100;
    
    // Check for nearby walls
    const nearLeftWall = pos[0] < wallThreshold;
    const nearRightWall = pos[0] > canvas.width - wallThreshold;
    const nearTopWall = pos[1] < wallThreshold;
    const nearBottomWall = pos[1] > canvas.height - wallThreshold;
    
    // If near any wall, adjust direction to move away
    if (nearLeftWall) {
        return angleDelta; // Turn right to avoid left wall
    } else if (nearRightWall) {
        return -angleDelta; // Turn left to avoid right wall
    } else if (nearTopWall || nearBottomWall) {
        return pos[0] < canvas.width / 2 ? angleDelta : -angleDelta;
    }
    
    return null; // No immediate wall avoidance needed
}

// Evaluate a potential move for an AI player (simplified)
function evaluateMove(playerIdx, direction) {
    let survivalFrames = 0;
    const player = players[playerIdx];
    const MAX_FRAMES = 30;
    
    // Simulate future moves
    for (let i = 0; i < MAX_FRAMES; i++) {
        // Move player in test direction
        player.addPosition(direction);
        
        // Check if player would collide with anything
        if (player.checkCollision(players)) {
            break;
        }
        
        survivalFrames++;
    }
    
    return survivalFrames;
}

// Simple prediction of player direction
function predictPlayerDirection(playerIdx) {
    const player = players[playerIdx];
    
    if (player.arrayOfPos.length < 3) {
        return 0;
    }
    
    // For AI players, just continue in same direction most of the time
    return lastAiMoves[playerIdx];
}