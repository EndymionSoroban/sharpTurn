// Early Detection AI - Detects and reacts to dangers much earlier

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
      lineWidth
    } = gameState;
    
    // Get the game's maximum angle delta from settings
    const maxAngleDelta = aiSettings.angleDelta || 5;
    
    try {
      // Calculate turn direction using early detection approach
      const turnDirection = earlyDetectionLogic(
        playerIdx, playerData, canvasWidth, canvasHeight, lineWidth, maxAngleDelta
      );
      
      // Create a path segment to simulate holding the button down
      const steps = 8;
      const pathPlan = {
        segments: [Array(steps).fill(turnDirection)],
        currentSegment: 0
      };
      
      // Send the result back to main thread
      self.postMessage({
        playerIdx: playerIdx,
        pathPlan: pathPlan
      });
    } catch (err) {
      debugLog(`ERROR: ${err.message}`);
      // Send a default "no turn" response in case of error
      self.postMessage({
        playerIdx: playerIdx,
        pathPlan: {
          segments: [Array(1).fill(0)],
          currentSegment: 0
        }
      });
    }
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

// Early detection logic that prioritizes detecting dangers early and reacting quickly
function earlyDetectionLogic(playerIdx, playerData, canvasWidth, canvasHeight, lineWidth, maxAngleDelta) {
  const player = playerData[playerIdx];
  if (!player || !player.arrayOfPos || player.arrayOfPos.length < 2) {
    throw new Error("Invalid player data");
  }
  
  // Get the last two positions to determine direction
  const head = player.arrayOfPos[player.arrayOfPos.length - 1];
  const prev = player.arrayOfPos[player.arrayOfPos.length - 2];
  
  // Calculate and normalize direction vector
  const dirX = head[0] - prev[0];
  const dirY = head[1] - prev[1];
  const mag = Math.sqrt(dirX * dirX + dirY * dirY);
  if (mag < 0.0001) return 0;
  const normDirX = dirX / mag;
  const normDirY = dirY / mag;
  
  debugLog(`Position: [${head[0].toFixed(1)}, ${head[1].toFixed(1)}], Direction: [${normDirX.toFixed(2)}, ${normDirY.toFixed(2)}]`);
  
  // FIRST check for extremely close walls (this is critical for starting positions)
  const wallDetectionThreshold = 150; // Wall detection threshold increased
  
  // Calculate distances to walls
  const distToLeftWall = head[0];
  const distToRightWall = canvasWidth - head[0];
  const distToTopWall = head[1];
  const distToBottomWall = canvasHeight - head[1];
  
  // Simple check if we're facing a wall and are very close
  if (distToLeftWall < wallDetectionThreshold && normDirX < 0) {
    debugLog(`IMMEDIATE WALL DANGER: Left wall at ${distToLeftWall.toFixed(1)} - turning RIGHT`);
    return maxAngleDelta; // Turn RIGHT
  }
  if (distToRightWall < wallDetectionThreshold && normDirX > 0) {
    debugLog(`IMMEDIATE WALL DANGER: Right wall at ${distToRightWall.toFixed(1)} - turning LEFT`);
    return -maxAngleDelta; // Turn LEFT
  }
  if (distToTopWall < wallDetectionThreshold && normDirY < 0) {
    debugLog(`IMMEDIATE WALL DANGER: Top wall at ${distToTopWall.toFixed(1)} - turning DOWN`);
    return normDirX > 0 ? maxAngleDelta : -maxAngleDelta; // Turn DOWN
  }
  if (distToBottomWall < wallDetectionThreshold && normDirY > 0) {
    debugLog(`IMMEDIATE WALL DANGER: Bottom wall at ${distToBottomWall.toFixed(1)} - turning UP`);
    return normDirX > 0 ? -maxAngleDelta : maxAngleDelta; // Turn UP
  }
  
  // Define wider sensor angles for better coverage
  const sensorAngles = [
    // Forward cone sensors
    { name: "Forward", angle: 0, isLeft: false, length: 400 },      // Increased range
    { name: "Left5°", angle: -5, isLeft: true, length: 390 },
    { name: "Right5°", angle: 5, isLeft: false, length: 390 },
    { name: "Left15°", angle: -15, isLeft: true, length: 380 },
    { name: "Right15°", angle: 15, isLeft: false, length: 380 },
    { name: "Left30°", angle: -30, isLeft: true, length: 350 },
    { name: "Right30°", angle: 30, isLeft: false, length: 350 },
    
    // Wide angle sensors
    { name: "Left45°", angle: -45, isLeft: true, length: 300 },
    { name: "Right45°", angle: 45, isLeft: false, length: 300 },
    { name: "Left60°", angle: -60, isLeft: true, length: 250 },
    { name: "Right60°", angle: 60, isLeft: false, length: 250 },
    { name: "Left90°", angle: -90, isLeft: true, length: 200 },
    { name: "Right90°", angle: 90, isLeft: false, length: 200 }
  ];
  
  // Check each sensor for obstacles and record the distance to the closest obstacle
  const sensorResults = [];
  
  for (const sensor of sensorAngles) {
    const angleRad = sensor.angle * Math.PI / 180;
    
    // Calculate sensor direction vector
    const sensorX = normDirX * Math.cos(angleRad) - normDirY * Math.sin(angleRad);
    const sensorY = normDirX * Math.sin(angleRad) + normDirY * Math.cos(angleRad);
    
    // Get distance to the closest obstacle in this direction
    const distance = findDistanceToObstacle(
      head, sensorX, sensorY, sensor.length,
      playerData, canvasWidth, canvasHeight, lineWidth, playerIdx
    );
    
    // Store the result
    sensorResults.push({
      name: sensor.name,
      angle: sensor.angle,
      isLeft: sensor.isLeft,
      distance: distance,
      maxDistance: sensor.length
    });
  }
  
  // Sort sensors by distance (closest first)
  sensorResults.sort((a, b) => a.distance - b.distance);
  
  // Log all sensor readings for debugging
  let sensorLog = "SENSORS - ";
  for (const result of sensorResults) {
    sensorLog += `${result.name}: ${result.distance.toFixed(1)}, `;
  }
  debugLog(sensorLog.slice(0, -2)); // Remove trailing comma and space
  
  // Define danger thresholds - INCREASED for earlier reaction
  const immediateThreshold = 120;  // Very close (increased from 80)
  const dangerThreshold = 200;    // Close enough to warrant avoidance (increased from 150)
  const cautionThreshold = 300;   // Start being cautious (new threshold)
  
  // Get the closest obstacle
  const closestObstacle = sensorResults[0];
  
  // Check if there's an immediate danger (an obstacle very close)
  if (closestObstacle.distance < immediateThreshold) {
    // This is the most critical case - IMMEDIATE DANGER!
    // Make maximum turn away from the danger
    
    if (closestObstacle.isLeft) {
      // Immediate danger to the left - turn right sharply
      debugLog(`IMMEDIATE DANGER: ${closestObstacle.name} at ${closestObstacle.distance.toFixed(1)} - turning SHARP RIGHT`);
      return maxAngleDelta;
    } else {
      // Immediate danger to the right or forward - turn left sharply
      debugLog(`IMMEDIATE DANGER: ${closestObstacle.name} at ${closestObstacle.distance.toFixed(1)} - turning SHARP LEFT`);
      return -maxAngleDelta;
    }
  }
  
  // Check if there's a danger that warrants strong avoidance
  if (closestObstacle.distance < dangerThreshold) {
    // Significant danger - make a strong turn away
    if (closestObstacle.name === "Forward") {
      // Forward obstacle - check which side has more space
      const leftSensor = sensorResults.find(s => s.name === "Left30°");
      const rightSensor = sensorResults.find(s => s.name === "Right30°");
      
      if (leftSensor.distance > rightSensor.distance + 30) {
        debugLog(`DANGER AHEAD: ${closestObstacle.distance.toFixed(1)} - turning LEFT (more space)`);
        return -maxAngleDelta;
      } else {
        debugLog(`DANGER AHEAD: ${closestObstacle.distance.toFixed(1)} - turning RIGHT (more space)`);
        return maxAngleDelta;
      }
    }
    else if (closestObstacle.isLeft) {
      // Danger to the left - turn right
      debugLog(`DANGER LEFT: ${closestObstacle.name} at ${closestObstacle.distance.toFixed(1)} - turning RIGHT`);
      return maxAngleDelta;
    }
    else {
      // Danger to the right - turn left
      debugLog(`DANGER RIGHT: ${closestObstacle.name} at ${closestObstacle.distance.toFixed(1)} - turning LEFT`);
      return -maxAngleDelta;
    }
  }
  
  // Check if there's an obstacle that warrants caution
  if (closestObstacle.distance < cautionThreshold) {
    // Start turning away early but less sharply
    if (closestObstacle.name === "Forward" || closestObstacle.name === "Left5°" || closestObstacle.name === "Right5°") {
      // Forward or near-forward obstacle - check wide sensors to find the best escape route
      const left45Sensor = sensorResults.find(s => s.name === "Left45°");
      const right45Sensor = sensorResults.find(s => s.name === "Right45°");
      
      if (left45Sensor.distance > right45Sensor.distance + 50) {
        debugLog(`CAUTION: ${closestObstacle.name} at ${closestObstacle.distance.toFixed(1)} - turning LEFT (more space)`);
        return -maxAngleDelta;
      } else {
        debugLog(`CAUTION: ${closestObstacle.name} at ${closestObstacle.distance.toFixed(1)} - turning RIGHT (more space)`);
        return maxAngleDelta;
      }
    }
    else if (closestObstacle.isLeft) {
      // Obstacle to the left - turn right early
      debugLog(`CAUTION LEFT: ${closestObstacle.name} at ${closestObstacle.distance.toFixed(1)} - turning RIGHT`);
      return maxAngleDelta;
    }
    else {
      // Obstacle to the right - turn left early
      debugLog(`CAUTION RIGHT: ${closestObstacle.name} at ${closestObstacle.distance.toFixed(1)} - turning LEFT`);
      return -maxAngleDelta;
    }
  }
  
  // Check for long-range obstacles in the forward cone
  const forwardObstacles = sensorResults.filter(s => 
    (s.name === "Forward" || s.name === "Left15°" || s.name === "Right15°") && 
    s.distance < s.maxDistance);
  
  if (forwardObstacles.length > 0) {
    // There's something in the forward cone, but it's not immediately dangerous
    // Make a gentle turn toward the more open side
    const left60Sensor = sensorResults.find(s => s.name === "Left60°");
    const right60Sensor = sensorResults.find(s => s.name === "Right60°");
    
    if (left60Sensor.distance > right60Sensor.distance + 70) {
      debugLog(`LONG-RANGE: Forward obstacle at ${forwardObstacles[0].distance.toFixed(1)} - gentle LEFT turn`);
      return -maxAngleDelta / 2;
    } else if (right60Sensor.distance > left60Sensor.distance + 70) {
      debugLog(`LONG-RANGE: Forward obstacle at ${forwardObstacles[0].distance.toFixed(1)} - gentle RIGHT turn`);
      return maxAngleDelta / 2;
    }
  }
  
  // No significant obstacles detected - continue straight with occasional random turns
  if (Math.random() < 0.05) {
    const randomTurn = Math.random() < 0.5 ? maxAngleDelta/2 : -maxAngleDelta/2;
    debugLog(`RANDOM TURN: ${randomTurn}`);
    return randomTurn;
  }
  
  debugLog("ALL CLEAR - CONTINUING STRAIGHT");
  return 0; // Continue straight
}

// Improved distance detection function
function findDistanceToObstacle(head, dirX, dirY, maxLength, playerData, canvasWidth, canvasHeight, lineWidth, currentPlayerIdx) {
  const steps = 200; // More points for more precise distance finding
  const stepSize = maxLength / steps;
  
  // Check for walls and trails, returning the exact distance at first collision
  for (let i = 1; i <= steps; i++) {
    const distance = i * stepSize;
    const posX = head[0] + dirX * distance;
    const posY = head[1] + dirY * distance;
    
    // Check if this position is outside the playfield or near a wall
    // Use a larger buffer for wall detection
    const wallBuffer = lineWidth * 2;
    if (posX <= wallBuffer || posX >= canvasWidth - wallBuffer || 
        posY <= wallBuffer || posY >= canvasHeight - wallBuffer) {
      // Return the exact distance to the wall
      return distance;
    }
    
    // Check collision with all player trails
    for (let p = 0; p < playerData.length; p++) {
      const player = playerData[p];
      if (!player || !player.arrayOfPos) continue;
      
      // Skip the last positions of current player (to avoid self-collision)
      const skipSelfPositions = p === currentPlayerIdx ? 25 : 0;
      
      // Adaptive sampling based on trail length - check more points for better accuracy
      const trailSampling = Math.max(1, Math.floor(player.arrayOfPos.length / 500));
      
      for (let j = 0; j < player.arrayOfPos.length - skipSelfPositions; j += trailSampling) {
        const trailPos = player.arrayOfPos[j];
        if (!trailPos) continue;
        
        // Skip positions in gaps
        let isInGap = false;
        if (player.gapArray && player.gapArray.length > 0) {
          for (const gapPos of player.gapArray) {
            if (gapPos && Math.abs(gapPos[0] - trailPos[0]) < 1 && Math.abs(gapPos[1] - trailPos[1]) < 1) {
              isInGap = true;
              break;
            }
          }
        }
        
        if (isInGap) continue;
        
        // Check distance to this trail segment - INCREASED detection radius
        const dx = posX - trailPos[0];
        const dy = posY - trailPos[1];
        const distSquared = dx * dx + dy * dy;
        
        // Larger collision threshold for earlier detection
        if (distSquared < (lineWidth * 3) * (lineWidth * 3)) {
          return distance;
        }
      }
    }
  }
  
  // No obstacle found within range
  return maxLength;
}