// Game.js - Main game logic with difficulty settings integration
const canvas = document.getElementById("gameCanvas");
const canvasContext = canvas.getContext("2d");

// Game state variables
let speed;
let angleDelta;
let lineWidth = 10;
let keyPressed = {};
let players = [];
let newPlayer;
let botPlayer;
let lastFrameTimeMs = 0;
let maxFPS = 30;
let gameStarted = false;
let aiSettings;
let aiDecisionCounter = 0;
let lastAiMove = 0;

// Initialize the game
function initGame() {
    // Clear any existing game state
    players = [];
    keyPressed = {};
    
    // Apply difficulty settings
    aiSettings = GameSettings.applySettings();
    
    // Set initial positions
    let startPos = Math.random() * 350 + 100;
    
    // Create players
    newPlayer = new Player(startPos - 100, startPos, "Green", speed, true);
    botPlayer = new Player(900 - startPos, 800 - startPos, "Red", aiSettings.aiSpeed, false);
    
    // Add players to array
    players.push(newPlayer);
    players.push(botPlayer);
    
    // Set up key event listeners
    window.onkeydown = function (e) { keyPressed[e.keyCode] = true; }
    window.onkeyup = function (e) { keyPressed[e.keyCode] = false; }
    
    // Start game loop
    requestAnimationFrame(gameLoop);
    gameStarted = true;
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
    
    // Request next frame
    requestAnimationFrame(gameLoop);
}

// Update game state each frame
function updateGame() {
    // Handle player input
    let playerAngle = 0;
    if (keyPressed[39]) {
        playerAngle = angleDelta;
    } else if (keyPressed[37]) {
        playerAngle = -angleDelta;
    }
    
    // Get AI move
    aiDecisionCounter++;
    let aiAngle = lastAiMove;
    
    // Only make AI decisions at intervals based on reaction time
    if (aiDecisionCounter >= aiSettings.aiReactionTime) {
        aiAngle = computerMove();
        lastAiMove = aiAngle;
        aiDecisionCounter = 0;
    }
    
    // Update player positions
    newPlayer.addPosition(playerAngle);
    botPlayer.addPosition(aiAngle);
    
    // Draw players
    Player.displayPlayers(players);
    
    // Check for collisions
    const collisionResult = checkCollisions();
    if (collisionResult) {
        endGame(collisionResult);
    }
}

// Check for collisions
function checkCollisions() {
    if (newPlayer.checkCollision(players) == newPlayer) {
        return "Computer Wins!";
    } else if (newPlayer.checkCollision(players) == botPlayer) {
        return "Player Wins!";
    }
    return null;
}

// End the game
function endGame(resultText) {
    gameStarted = false;
    window.showGameOver(resultText);
}

// AI logic
function computerMove() {
    // Apply randomness based on difficulty
    if (Math.random() < aiSettings.aiRandomness) {
        return Math.random() < 0.5 ? angleDelta : -angleDelta;
    }
    
    // Check for immediate wall avoidance first
    const avoidanceMove = addAvoidanceLogic();
    if (avoidanceMove !== null) {
        return avoidanceMove;
    }
    
    // Store original positions to restore after simulation
    let restorePositionBot = botPlayer.arrayOfPos.slice();
    let restorePositionPlayer = newPlayer.arrayOfPos.slice();
    
    // Define directions to test
    const directions = [-angleDelta, 0, angleDelta];
    let bestDirection = 0;
    let bestScore = -1;
    
    // Test each direction
    for (const direction of directions) {
        let score = evaluateMove(direction);
        if (score > bestScore) {
            bestScore = score;
            bestDirection = direction;
        }
        
        // Restore positions for next simulation
        botPlayer.arrayOfPos = restorePositionBot.slice();
        newPlayer.arrayOfPos = restorePositionPlayer.slice();
    }
    
    return bestDirection;
}

// Evaluate a potential move
function evaluateMove(direction) {
    let survivalFrames = 0;
    let scoreBonus = 0;
    
    // Predict player's likely movement
    let playerLikelyDirection = predictPlayerDirection();
    
    // Simulate future moves
    for (let i = 0; i < aiSettings.aiLookAhead; i++) {
        // Move bot in test direction
        botPlayer.addPosition(direction);
        
        // Move player in predicted direction
        newPlayer.addPosition(playerLikelyDirection);
        
        // Check if bot would collide
        if (newPlayer.checkCollision(players) == botPlayer) {
            break;
        }
        
        survivalFrames++;
        
        // Add bonus for moves that lead toward the player
        if (i > 10 && isMovingTowardPlayer(botPlayer, newPlayer, direction)) {
            scoreBonus += aiSettings.aiAggressiveness;
        }
        
        // Add bonus for staying near the center
        scoreBonus += calculateCenterBonus(botPlayer);
    }
    
    return survivalFrames + scoreBonus;
}

// Predict player's likely direction
function predictPlayerDirection() {
    // Simple prediction based on last few moves
    if (newPlayer.arrayOfPos.length < 3) {
        return 0;
    }
    
    // Get the last three positions
    const positions = newPlayer.arrayOfPos.slice(-3);
    
    // Calculate the change in angle between the last segments
    const angle1 = Math.atan2(
        positions[1][1] - positions[0][1],
        positions[1][0] - positions[0][0]
    );
    const angle2 = Math.atan2(
        positions[2][1] - positions[1][1],
        positions[2][0] - positions[1][0]
    );
    
    // Calculate the difference in radians
    let angleDiff = angle2 - angle1;
    
    // Convert to degrees and normalize
    angleDiff = (angleDiff * 180 / Math.PI) % 360;
    if (angleDiff > 180) angleDiff -= 360;
    if (angleDiff < -180) angleDiff += 360;
    
    // Predict continued turning based on recent movement
    if (Math.abs(angleDiff) < 1) return 0;
    return angleDiff > 0 ? angleDelta : -angleDelta;
}

// Check if bot is moving toward player
function isMovingTowardPlayer(bot, player, direction) {
    // Get current positions
    const botPos = bot.arrayOfPos[bot.arrayOfPos.length - 1];
    const playerPos = player.arrayOfPos[player.arrayOfPos.length - 1];
    
    // Calculate angle to player
    const angleToPlayer = Math.atan2(
        playerPos[1] - botPos[1],
        playerPos[0] - botPos[0]
    ) * 180 / Math.PI;
    
    // Calculate bot's current direction
    const botPos2 = bot.arrayOfPos[bot.arrayOfPos.length - 2];
    const botDirection = Math.atan2(
        botPos[1] - botPos2[1],
        botPos[0] - botPos2[0]
    ) * 180 / Math.PI;
    
    // Calculate the difference between the two angles
    let angleDiff = Math.abs(angleToPlayer - botDirection) % 360;
    if (angleDiff > 180) angleDiff = 360 - angleDiff;
    
    // If we're already pointed roughly toward the player, return true
    if (angleDiff < 45) return true;
    
    // Is the current direction helping to turn toward the player?
    const newDirection = (botDirection + direction) % 360;
    const newAngleDiff = Math.abs(angleToPlayer - newDirection) % 360;
    
    return newAngleDiff < angleDiff;
}

// Calculate bonus for staying near center
function calculateCenterBonus(player) {
    // Get current position
    const pos = player.arrayOfPos[player.arrayOfPos.length - 1];
    
    // Calculate distance from center (normalized to 0-1)
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const maxDistance = Math.sqrt(centerX * centerX + centerY * centerY);
    
    const distance = Math.sqrt(
        Math.pow(pos[0] - centerX, 2) + 
        Math.pow(pos[1] - centerY, 2)
    );
    
    // Convert to a bonus (higher when closer to center)
    return 0.5 * (1 - (distance / maxDistance));
}

// Add wall avoidance logic
function addAvoidanceLogic() {
    // Get current position of bot
    const botPos = botPlayer.arrayOfPos[botPlayer.arrayOfPos.length - 1];
    
    // Wall detection threshold (based on difficulty)
    const wallThreshold = 100 - (aiSettings.difficulty === 'hard' ? 20 : 0);
    
    // Check for nearby walls
    const nearLeftWall = botPos[0] < wallThreshold;
    const nearRightWall = botPos[0] > canvas.width - wallThreshold;
    const nearTopWall = botPos[1] < wallThreshold;
    const nearBottomWall = botPos[1] > canvas.height - wallThreshold;
    
    // If near any wall, adjust direction to move away
    if (nearLeftWall) {
        return angleDelta; // Turn right to avoid left wall
    } else if (nearRightWall) {
        return -angleDelta; // Turn left to avoid right wall
    } else if (nearTopWall || nearBottomWall) {
        return botPos[0] < canvas.width / 2 ? angleDelta : -angleDelta;
    }
    
    return null; // No immediate wall avoidance needed
}