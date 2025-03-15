// Game.js - Fixed version that resolves initialization issues
const canvas = document.getElementById("gameCanvas");
const canvasContext = canvas.getContext("2d");

// Game state variables
let speed = 3; 
let angleDelta = 6;
let lineWidth = 10;
let keyPressed = {};
let players = [];
let activePlayers = [];
let lastFrameTimeMs = 0;
let maxFPS = 60;
let gameStarted = false;
let aiSettings;
let aiDecisionCounters = [];
let aiPathPlans = [];
let finishOrder = [];
let frameCounter = 0;

// Initialize the game
function initGame() {
    console.log("Game initialization started");
    
    // Clear any existing game state
    players = [];
    activePlayers = [];
    keyPressed = {};
    finishOrder = [];
    frameCounter = 0;
    aiPathPlans = [];
    
    // Apply difficulty settings
    aiSettings = GameSettings.applySettings();
    
    // Get enabled players from settings
    const enabledPlayers = GameSettings.getEnabledPlayers();
    const playerCount = enabledPlayers.length;
    
    // Reset AI tracking arrays
    aiDecisionCounters = Array(playerCount).fill(0);
    aiPathPlans = Array(playerCount).fill(null);
    
    // Create players
    createPlayers(enabledPlayers);
    
    // Set up key event listeners
    window.onkeydown = function (e) { keyPressed[e.keyCode] = true; }
    window.onkeyup = function (e) { keyPressed[e.keyCode] = false; }
    
    // Start game loop
    gameStarted = true;
    lastFrameTimeMs = performance.now();
    requestAnimationFrame(gameLoop);
    
    console.log("Game initialized with", playerCount, "players");
}

// Create players based on settings
function createPlayers(enabledPlayers) {
    const playerCount = enabledPlayers.length;
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    
    console.log("Creating", playerCount, "players");
    
    // Create players in a circular arrangement
    enabledPlayers.forEach((player, index) => {
        // Calculate position based on player index and count
        const angle = (index / playerCount) * Math.PI * 2;
        const radius = canvas.width * 0.35; // Position at 35% from center to edge
        
        const startX = centerX + Math.cos(angle) * radius;
        const startY = centerY + Math.sin(angle) * radius;
        
        // Calculate vector pointing TOWARD center
        const dirX = centerX - startX;
        const dirY = centerY - startY;
        
        // Create the player
        const isHuman = player.type === 'human';
        const playerSpeed = isHuman ? aiSettings.playerSpeed : aiSettings.aiSpeed;
        
        const newPlayer = new Player(
            startX, 
            startY, 
            player.color, 
            playerSpeed, 
            isHuman,
            index,
            player.controls
        );
        
        // Set initial direction vector pointed toward center
        newPlayer.initialDirection(dirX, dirY);
        
        // Add to players array
        players.push(newPlayer);
        activePlayers.push(index);
    });
}

// Main game loop
function gameLoop(timestamp) {
    if (!gameStarted) return;
    
    // Calculate delta time
    const elapsed = timestamp - lastFrameTimeMs;
    
    // Frame rate limiting
    if (elapsed < 1000 / maxFPS) {
        requestAnimationFrame(gameLoop);
        return;
    }
    
    lastFrameTimeMs = timestamp;
    
    // Update game state
    updateGame();
    frameCounter++;
    
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
            // Handle AI player with reduced calculation frequency
            aiDecisionCounters[playerIdx]++;
            
            // Only recalculate AI decisions at specified intervals based on difficulty
            const recalcInterval = aiSettings.aiReactionTime * 10;
            
            if (aiDecisionCounters[playerIdx] >= recalcInterval) {
                // Time to recalculate - create new long-term path plan
                const pathPlan = calculateAIPathPlan(playerIdx);
                aiPathPlans[playerIdx] = pathPlan;
                aiDecisionCounters[playerIdx] = 0;
            }
            
            // Follow the pre-calculated path plan
            let aiAngle = followPathPlan(playerIdx);
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

// Follow the pre-calculated path plan for an AI
function followPathPlan(playerIdx) {
    const player = players[playerIdx];
    const plan = aiPathPlans[playerIdx];
    
    // If no plan exists or plan is complete, return 0 (straight)
    if (!plan || plan.currentSegment >= plan.segments.length) {
        return 0;
    }
    
    // Get current segment
    const currentSegment = plan.segments[plan.currentSegment];
    
    // Get the step within the segment (based on reaction time)
    const stepIndex = aiDecisionCounters[playerIdx] % currentSegment.length;
    
    // If we're at the end of the segment, move to next segment
    if (stepIndex === currentSegment.length - 1) {
        plan.currentSegment++;
    }
    
    // Return the direction for this step
    return currentSegment[stepIndex];
}

// Calculate a long-term path plan for an AI player
function calculateAIPathPlan(playerIdx) {
    const player = players[playerIdx];
    
    // First, check for immediate dangers that need quick response
    const emergencyDirection = checkForEmergencies(player);
    if (emergencyDirection !== null) {
        // If there's an emergency, just return a simple plan to handle it
        return {
            segments: [[emergencyDirection]],
            currentSegment: 0
        };
    }
    
    // Create a long-term path plan with segments
    const pathPlan = {
        segments: [],
        currentSegment: 0
    };
    
    // Split the long-term planning into segments
    const segmentLength = Math.floor(60 / 8);
    
    // Store original state to restore later
    const originalPositions = players.map(p => p.arrayOfPos.slice());
    const originalGapArrays = players.map(p => p.gapArray.slice());
    
    // Current best directions for each segment
    let bestDirections = [];
    
    // Evaluate and build the path plan
    for (let segment = 0; segment < 8; segment++) {
        // Directions to consider for this segment
        const directions = segment === 0 ? 
            [-angleDelta, -angleDelta/2, 0, angleDelta/2, angleDelta] : // More options for first segment
            [0, -angleDelta/2, angleDelta/2]; // Fewer options for later segments
        
        let bestDirection = 0;
        let bestScore = -1;
        
        // Evaluate each direction for this segment
        for (const direction of directions) {
            // Apply all previous segment directions first
            for (let i = 0; i < bestDirections.length; i++) {
                simulateMovement(player, bestDirections[i], segmentLength);
            }
            
            // Now simulate this segment
            const score = simulateSegment(player, direction, segmentLength);
            
            // Restore to position after previous segments
            players.forEach((p, i) => {
                p.arrayOfPos = originalPositions[i].slice();
                p.gapArray = originalGapArrays[i].slice();
            });
            
            // Apply all previous segment directions again
            for (let i = 0; i < bestDirections.length; i++) {
                simulateMovement(player, bestDirections[i], segmentLength);
            }
            
            if (score > bestScore) {
                bestScore = score;
                bestDirection = direction;
            }
        }
        
        // Add the best direction for this segment
        bestDirections.push(bestDirection);
        
        // Update the plan
        pathPlan.segments.push(Array(segmentLength).fill(bestDirection));
        
        // Move player forward to prepare for next segment evaluation
        simulateMovement(player, bestDirection, segmentLength);
    }
    
    // Restore original positions
    players.forEach((p, i) => {
        p.arrayOfPos = originalPositions[i].slice();
        p.gapArray = originalGapArrays[i].slice();
    });
    
    return pathPlan;
}

// Check for emergency situations that need immediate response
function checkForEmergencies(player) {
    const head = player.arrayOfPos[player.arrayOfPos.length - 1];
    
    // Get direction vector
    const len = player.arrayOfPos.length;
    if (len < 2) return null;
    
    const prev = player.arrayOfPos[len - 2];
    const dirX = head[0] - prev[0];
    const dirY = head[1] - prev[1];
    
    // Wall distances
    const distLeft = head[0];
    const distRight = canvas.width - head[0];
    const distTop = head[1];
    const distBottom = canvas.height - head[1];
    
    // Emergency threshold - if very close to a wall
    const emergencyThreshold = 50;
    
    // If we're heading toward a wall that's too close, emergency turn
    if (distLeft < emergencyThreshold && dirX < 0) {
        return angleDelta; // Turn right
    } else if (distRight < emergencyThreshold && dirX > 0) {
        return -angleDelta; // Turn left
    } else if (distTop < emergencyThreshold && dirY < 0) {
        return (dirX > 0) ? -angleDelta : angleDelta; // Turn away from top
    } else if (distBottom < emergencyThreshold && dirY > 0) {
        return (dirX > 0) ? angleDelta : -angleDelta; // Turn away from bottom
    }
    
    // Check for very close trails (emergency avoidance)
    const headingAngle = getHeadingAngle(player);
    const veryCloseDistance = 30;
    
    // Check directly ahead
    const aheadX = head[0] + Math.cos(headingAngle) * veryCloseDistance;
    const aheadY = head[1] + Math.sin(headingAngle) * veryCloseDistance;
    
    for (const otherPlayer of players) {
        // Get only recently added trail segments for speed
        const recentSegments = otherPlayer.arrayOfPos.slice(-200);
        
        for (const pos of recentSegments) {
            // Skip if position is in a gap
            const isInGap = otherPlayer.gapArray.some(gapPos => 
                Math.abs(gapPos[0] - pos[0]) < 1 && 
                Math.abs(gapPos[1] - pos[1]) < 1
            );
            
            if (isInGap) continue;
            
            // Check distance to upcoming position
            const dist = Math.sqrt(
                Math.pow(aheadX - pos[0], 2) + 
                Math.pow(aheadY - pos[1], 2)
            );
            
            if (dist < lineWidth * 2) {
                // Emergency! Turn in the direction with more space
                return findEmergencyEscapeDirection(player);
            }
        }
    }
    
    return null; // No emergency
}

// Find the best direction to escape in an emergency
function findEmergencyEscapeDirection(player) {
    const head = player.arrayOfPos[player.arrayOfPos.length - 1];
    const headingAngle = getHeadingAngle(player);
    
    // Check left and right
    const leftAngle = normalizeAngle(headingAngle - Math.PI/2);
    const rightAngle = normalizeAngle(headingAngle + Math.PI/2);
    
    let leftSpace = 0;
    let rightSpace = 0;
    
    // Check distance in each direction
    for (let dist = 10; dist <= 100; dist += 10) {
        // Left check
        const leftX = head[0] + Math.cos(leftAngle) * dist;
        const leftY = head[1] + Math.sin(leftAngle) * dist;
        
        // Right check
        const rightX = head[0] + Math.cos(rightAngle) * dist;
        const rightY = head[1] + Math.sin(rightAngle) * dist;
        
        // Check if positions are clear
        let leftClear = true;
        let rightClear = true;
        
        // Wall check
        if (leftX <= lineWidth || leftX >= canvas.width - lineWidth ||
            leftY <= lineWidth || leftY >= canvas.height - lineWidth) {
            leftClear = false;
        }
        
        if (rightX <= lineWidth || rightX >= canvas.width - lineWidth ||
            rightY <= lineWidth || rightY >= canvas.height - lineWidth) {
            rightClear = false;
        }
        
        // If both directions are blocked, break
        if (!leftClear && !rightClear) break;
        
        // Update space measurements
        if (leftClear) leftSpace = dist;
        if (rightClear) rightSpace = dist;
    }
    
    // Choose direction with more space
    return leftSpace > rightSpace ? -angleDelta : angleDelta;
}

// Simulate moving in a segment
function simulateSegment(player, direction, steps) {
    let score = 0;
    
    // Simulate movement
    simulateMovement(player, direction, steps);
    
    // Score based on final position
    const head = player.arrayOfPos[player.arrayOfPos.length - 1];
    
    // Check if there was a collision
    if (player.checkCollision(players)) {
        return -100; // Very bad score for collision
    }
    
    // Calculate space around the player
    const spaceScore = calculateSpaceAround(player);
    score += spaceScore;
    
    // Bonus for staying away from walls
    const wallBonus = calculateWallDistanceBonus(player);
    score += wallBonus;
    
    // Bonus for being near the center
    const centerBonus = calculateCenterBonus(player);
    score += centerBonus;
    
    return score;
}

// Simulate movement for a number of steps
function simulateMovement(player, direction, steps) {
    const angle = direction * Math.PI / 180;
    
    for (let i = 0; i < steps; i++) {
        // Get last two positions
        const lastIdx = player.arrayOfPos.length - 1;
        const lastPos = player.arrayOfPos[lastIdx];
        const prevPos = player.arrayOfPos[lastIdx - 1];
        
        // Direction vector
        const xPosDelta = (lastPos[0] - prevPos[0]);
        const yPosDelta = (lastPos[1] - prevPos[1]);
        
        // Rotation calculation
        const xPos = xPosDelta * Math.cos(angle) - yPosDelta * Math.sin(angle);
        const yPos = xPosDelta * Math.sin(angle) + yPosDelta * Math.cos(angle);
        
        // Add new position
        const newPos = [
            lastPos[0] + xPos,
            lastPos[1] + yPos
        ];
        player.arrayOfPos.push(newPos);
    }
}

// Get heading angle helper function
function getHeadingAngle(player) {
    const len = player.arrayOfPos.length;
    if (len < 2) return 0;
    
    const head = player.arrayOfPos[len - 1];
    const prev = player.arrayOfPos[len - 2];
    
    return Math.atan2(head[1] - prev[1], head[0] - prev[0]);
}

// Calculate space around the player (simplified for performance)
function calculateSpaceAround(player) {
    const head = player.arrayOfPos[player.arrayOfPos.length - 1];
    const headingAngle = getHeadingAngle(player);
    
    // Check in 4 directions (ahead, right, back, left)
    const angles = [
        headingAngle,
        normalizeAngle(headingAngle + Math.PI/2),
        normalizeAngle(headingAngle + Math.PI),
        normalizeAngle(headingAngle - Math.PI/2)
    ];
    
    let totalSpace = 0;
    
    // Check distance in each direction
    for (const angle of angles) {
        let maxDistance = 0;
        
        // Check at increasing distances
        for (let dist = 20; dist <= 120; dist += 20) {
            const checkX = head[0] + Math.cos(angle) * dist;
            const checkY = head[1] + Math.sin(angle) * dist;
            
            // Check for walls
            if (checkX <= lineWidth || checkX >= canvas.width - lineWidth ||
                checkY <= lineWidth || checkY >= canvas.height - lineWidth) {
                maxDistance = dist;
                break;
            }
            
            // Very simple collision check for efficiency
            let collision = false;
            
            // Check with other players using spatial sampling
            for (const otherPlayer of players) {
                // Sample trail at increasing intervals
                const samplingRate = Math.max(1, Math.floor(otherPlayer.arrayOfPos.length / 100));
                
                for (let i = 0; i < otherPlayer.arrayOfPos.length; i += samplingRate) {
                    const pos = otherPlayer.arrayOfPos[i];
                    
                    // Skip if position is in a gap
                    const isInGap = otherPlayer.gapArray.some(gapPos => 
                        Math.abs(gapPos[0] - pos[0]) < 1 && 
                        Math.abs(gapPos[1] - pos[1]) < 1
                    );
                    
                    if (isInGap) continue;
                    
                    // Fast distance check
                    const dx = checkX - pos[0];
                    const dy = checkY - pos[1];
                    const distSquared = dx * dx + dy * dy;
                    
                    if (distSquared < lineWidth * lineWidth * 1.5) {
                        collision = true;
                        break;
                    }
                }
                
                if (collision) break;
            }
            
            if (collision) {
                maxDistance = dist;
                break;
            }
            
            // If we reach maximum distance without collision
            if (dist === 120) {
                maxDistance = 120;
            }
        }
        
        totalSpace += maxDistance;
    }
    
    // Weight ahead direction more heavily
    return totalSpace / 3;
}

// Calculate bonus for staying away from walls
function calculateWallDistanceBonus(player) {
    const head = player.arrayOfPos[player.arrayOfPos.length - 1];
    
    // Wall distances
    const distLeft = head[0];
    const distRight = canvas.width - head[0];
    const distTop = head[1];
    const distBottom = canvas.height - head[1];
    
    // Find minimum distance to any wall
    const minWallDist = Math.min(distLeft, distRight, distTop, distBottom);
    
    // Calculate bonus (higher when further from walls)
    return Math.min(30, minWallDist / 5);
}

// Calculate bonus for staying near center
function calculateCenterBonus(player) {
    const head = player.arrayOfPos[player.arrayOfPos.length - 1];
    
    // Distance from center
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const distFromCenter = Math.sqrt(
        Math.pow(head[0] - centerX, 2) + 
        Math.pow(head[1] - centerY, 2)
    );
    
    // Maximum distance from center (corner to center)
    const maxDist = Math.sqrt(
        Math.pow(canvas.width/2, 2) + 
        Math.pow(canvas.height/2, 2)
    );
    
    // Calculate bonus (higher when closer to center)
    return 25 * (1 - distFromCenter / maxDist);
}

// Normalize angle to be between -PI and PI
function normalizeAngle(angle) {
    while (angle > Math.PI) angle -= 2 * Math.PI;
    while (angle < -Math.PI) angle += 2 * Math.PI;
    return angle;
}