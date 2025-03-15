// aiWorker.js - Ultra-sharp turning AI that mimics player holding turn button

// Debug flag
const DEBUG_AI = true;
let debugLogs = [];

// Debug logging function
function debugLog(...args) {
  if (!DEBUG_AI) return;
  const msg = `[AI DEBUG ${Date.now()}] ${args.join(' ')}`;
  debugLogs.push(msg);
  
  // Send logs to main thread
  self.postMessage({
    type: 'debug',
    logs: [msg]
  });
}

// Worker message handler
self.onmessage = function(e) {
  const { command, playerIdx, gameState } = e.data;
  
  if (command === 'calculatePath') {
    const { 
      playerData, 
      canvasWidth, 
      canvasHeight, 
      aiSettings,
      lineWidth,
      activePlayers
    } = gameState;
    
    // Get the game's maximum angle delta from settings
    const maxAngleDelta = aiSettings.angleDelta || 5;
    
    // Calculate turn direction using sensor approach
    const turnDirection = sensorBasedMove(playerIdx, playerData, canvasWidth, canvasHeight, lineWidth, maxAngleDelta);
    
    // Create a longer path segment of the same angle to simulate holding the button
    // This is the key change - create a multi-step segment with the same turn angle
    // to simulate a player continuously holding the turn button
    const steps = 5; // Simulate holding the turn button for 5 frames
    const pathPlan = {
      segments: [Array(steps).fill(turnDirection)],
      currentSegment: 0
    };
    
    // Send the result back to main thread
    self.postMessage({
      playerIdx: playerIdx,
      pathPlan: pathPlan
    });
  }
  else if (command === 'getDebugLogs') {
    self.postMessage({
      type: 'debug',
      logs: debugLogs
    });
  }
  else if (command === 'clearDebugLogs') {
    debugLogs = [];
    self.postMessage({
      type: 'debug',
      logs: []
    });
  }
};

// Use "sensors" to check for obstacles and decide turn direction
function sensorBasedMove(playerIdx, playerData, canvasWidth, canvasHeight, lineWidth, maxAngleDelta) {
    // Get player data
    const players = playerData;
    const player = players[playerIdx];
    
    // Need at least 2 positions to get direction
    if (player.arrayOfPos.length < 2) return 0;
    
    const head = player.arrayOfPos[player.arrayOfPos.length - 1];
    const prev = player.arrayOfPos[player.arrayOfPos.length - 2];
    
    // Calculate current direction
    const dirX = head[0] - prev[0];
    const dirY = head[1] - prev[1];
    
    // Normalize
    const mag = Math.sqrt(dirX * dirX + dirY * dirY);
    const normDirX = dirX / mag;
    const normDirY = dirY / mag;
    
    // Just use the 30 degree sensors to decide which way to turn
    const leftAngle = -30 * Math.PI / 180;  // 30 degrees left
    const rightAngle = 30 * Math.PI / 180;  // 30 degrees right
    
    // Calculate left sensor vector
    const leftSensorX = normDirX * Math.cos(leftAngle) - normDirY * Math.sin(leftAngle);
    const leftSensorY = normDirX * Math.sin(leftAngle) + normDirY * Math.cos(leftAngle);
    
    // Calculate right sensor vector
    const rightSensorX = normDirX * Math.cos(rightAngle) - normDirY * Math.sin(rightAngle);
    const rightSensorY = normDirX * Math.sin(rightAngle) + normDirY * Math.cos(rightAngle);
    
    // Measure distance to collision in each direction
    const leftDist = measureDistanceToCollision(head, leftSensorX, leftSensorY, players, canvasWidth, canvasHeight, lineWidth);
    const rightDist = measureDistanceToCollision(head, rightSensorX, rightSensorY, players, canvasWidth, canvasHeight, lineWidth);
    
    // Log the sensor distances
    debugLog(`SENSORS - Left: ${leftDist.toFixed(1)}px, Right: ${rightDist.toFixed(1)}px`);
    
    // Simple decision logic - turn away from the closest obstacle with maximum sharpness
    if (leftDist < rightDist) {
        debugLog(`LEFT CLOSER - Turning RIGHT with MAXIMUM angle: ${maxAngleDelta}`);
        return maxAngleDelta;  // Turn right as sharply as possible
    } else if (rightDist < leftDist) {
        debugLog(`RIGHT CLOSER - Turning LEFT with MAXIMUM angle: ${-maxAngleDelta}`);
        return -maxAngleDelta; // Turn left as sharply as possible
    } else {
        // Equal distances - make a random decision, but always turn at max angle
        const direction = Math.random() > 0.5 ? maxAngleDelta : -maxAngleDelta;
        debugLog(`EQUAL DISTANCES - Random turn with MAXIMUM angle: ${direction}`);
        return direction;
    }
}

// Measure distance to collision in a given direction
function measureDistanceToCollision(head, dirX, dirY, players, canvasWidth, canvasHeight, lineWidth) {
    // Check distance in this direction until collision or max distance
    const maxDist = 200;  // Maximum sensor range
    const stepSize = 5;   // Check every 5 pixels for performance
    
    for (let dist = stepSize; dist <= maxDist; dist += stepSize) {
        const checkX = head[0] + dirX * dist;
        const checkY = head[1] + dirY * dist;
        
        // Check wall collision
        if (checkX <= lineWidth || checkX >= canvasWidth - lineWidth ||
            checkY <= lineWidth || checkY >= canvasHeight - lineWidth) {
            return dist;  // Distance to wall
        }
        
        // Check player trail collisions - check EVERY position for accuracy
        for (const player of players) {
            for (let i = 0; i < player.arrayOfPos.length; i++) {
                const pos = player.arrayOfPos[i];
                
                // Skip positions in gaps
                if (player.gapArray && player.gapArray.some(gapPos => 
                    Math.abs(gapPos[0] - pos[0]) < 1 && 
                    Math.abs(gapPos[1] - pos[1]) < 1)) {
                    continue;
                }
                
                // Check distance 
                const dx = checkX - pos[0];
                const dy = checkY - pos[1];
                const distSquared = dx * dx + dy * dy;
                
                if (distSquared < lineWidth * lineWidth) {
                    return dist;  // Distance to trail collision
                }
            }
        }
    }
    
    return maxDist;  // No collision found within range
}