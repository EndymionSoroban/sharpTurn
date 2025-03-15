// GameEngine.js - Central game engine for coordinating all systems

class GameEngine {
    constructor(canvasId) {
        // Get the canvas element
        this.canvas = document.getElementById(canvasId);
        this.canvasContext = this.canvas.getContext('2d');
        
        // Initialize systems
        this.renderer = new Renderer(this.canvas);
        this.spatialGrid = new SpatialGrid(this.canvas.width, this.canvas.height, 30);
        
        // Game state
        this.players = [];
        this.activePlayers = [];
        this.finishOrder = [];
        this.gameStarted = false;
        this.frameCounter = 0;
        
        // Worker management
        this.AiWorkers = [];
        this.pendingAICalculations = {};
        
        // Performance metrics
        this.lastFrameTime = 0;
        this.frameTimings = [];
        this.fpsDisplay = document.getElementById('fpsDisplay');
        
        // Game settings
        this.settings = {
            speed: 3,
            angleDelta: 6,
            lineWidth: 10,
            maxFPS: 60,
            showFPS: true
        };
        
        // AI settings
        this.aiSettings = null;
        this.aiDecisionCounters = [];
        this.aiPathPlans = [];
        
        // Input tracking
        this.keyPressed = {};
        
        // Bind event handlers and setup
        this.setupEventHandlers();
        
        // Make available globally for compatibility with existing code
        window.frameCounter = this.frameCounter;
        window.keyPressed = this.keyPressed;
    }
    
    // Set up input and event handlers
    setupEventHandlers() {
        // Keyboard input
        window.addEventListener('keydown', (e) => { 
            this.keyPressed[e.keyCode] = true; 
            window.keyPressed = this.keyPressed;
        });
        
        window.addEventListener('keyup', (e) => { 
            this.keyPressed[e.keyCode] = false; 
            window.keyPressed = this.keyPressed;
        });
        
        // Toggle FPS display with F key
        window.addEventListener('keydown', (e) => {
            if (e.keyCode === 70) { // F key
                this.settings.showFPS = !this.settings.showFPS;
                this.fpsDisplay.style.display = this.settings.showFPS ? 'block' : 'none';
            }
        });
    }
    
    // Initialize game state
    initGame() {
        console.log("Game initialization started with GameEngine");
        
        // Check if all required components are loaded
        if (typeof Player === 'undefined') {
            console.error("ERROR: Player class is not defined! Ensure Player.js is loaded.");
            console.log("Available classes:", Object.keys(window));
            
            // Try to load Player.js again
            const script = document.createElement('script');
            script.src = 'Player.js';
            script.onload = () => {
                console.log("Player.js loaded successfully, retrying game initialization");
                // Wait a bit for the script to initialize
                setTimeout(() => this.initGame(), 100);
            };
            script.onerror = (error) => {
                console.error("Failed to load Player.js:", error);
            };
            document.head.appendChild(script);
            return;
        }
        
        // Clear any existing game state
        this.players = [];
        this.activePlayers = [];
        this.finishOrder = [];
        this.frameCounter = 0;
        this.keyPressed = {};
        window.keyPressed = this.keyPressed;
        window.frameCounter = this.frameCounter;
        
        // Apply settings from GameSettings
        this.aiSettings = GameSettings.applySettings();
        this.settings.angleDelta = this.aiSettings.angleDelta;
        
        // Get enabled players
        const enabledPlayers = GameSettings.getEnabledPlayers();
        const playerCount = enabledPlayers.length;
        
        // Reset AI tracking arrays
        this.aiDecisionCounters = Array(playerCount).fill(0);
        this.aiPathPlans = Array(playerCount).fill(null);
        
        // Create players
        this.createPlayers(enabledPlayers);
		
		this.powerupManager = new PowerupManager(this.canvas, this.players);
		this.powerupManager.initialize();
		
		this.renderer.powerupManager = this.powerupManager;
        
        // Initialize workers for AI players if multithreading is enabled
        const useMultithreading = document.getElementById('useMultithreading').checked;
        if (useMultithreading) {
            this.initializeWorkers();
        }
        
        // Clear rendering layers
        this.renderer.clearAll();
        
        // Start game loop
        this.gameStarted = true;
        this.lastFrameTime = performance.now();
        requestAnimationFrame(this.gameLoop.bind(this));
        
        console.log("Game initialized with", playerCount, "players");
    }
    
    // Initialize Web Workers for AI
    initializeWorkers() {
    // Terminate any existing workers
    this.AiWorkers.forEach(worker => worker.terminate());
    this.AiWorkers = [];
    this.pendingAICalculations = {};
    
    // Create one worker per AI player
    const aiPlayerIndices = this.players
        .filter(player => !player.isHuman)
        .map(player => player.index);
    
    aiPlayerIndices.forEach(playerIdx => {
        try {
            const worker = new Worker('AiWorker.js');
            
            // Set up message handler
            worker.onmessage = (e) => {
                const data = e.data;
                
                // Handle normal path calculation results
                if (data.playerIdx !== undefined && data.pathPlan) {
                    // Store the path plan
                    this.aiPathPlans[data.playerIdx] = data.pathPlan;
                    
                    // Mark calculation as completed
                    delete this.pendingAICalculations[playerIdx];
                }
                // Handle debug messages with safe handling
                else if (data.type === 'debug') {
                    try {
                        handleWorkerDebugMessages(e);
                    } catch (err) {
                        console.error("Error handling worker debug message:", err);
                    }
                }
            };
            
            worker.onerror = (e) => {
                console.error(`Error in worker for player ${playerIdx}:`, e);
                delete this.pendingAICalculations[playerIdx];
            };
            
            this.AiWorkers.push(worker);
        } catch (e) {
            console.error("Error creating worker:", e);
        }
    });
    
    console.log(`Initialized ${this.AiWorkers.length} AI workers`);
}
    
    // Create players based on settings
    createPlayers(enabledPlayers) {
        const playerCount = enabledPlayers.length;
        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;
        
        console.log("Creating", playerCount, "players");
        
        // Define corner positions with padding
        const padding = 50;  // Padding from the edge of the canvas
        const cornerPositions = [
            { x: padding, y: padding },                                  // Top Left
            { x: this.canvas.width - padding, y: padding },              // Top Right
            { x: padding, y: this.canvas.height - padding },             // Bottom Left
            { x: this.canvas.width - padding, y: this.canvas.height - padding }  // Bottom Right
        ];
        
        // Create players in the corners
        enabledPlayers.forEach((playerConfig, index) => {
            // Use index to determine which corner (supports up to 4 players)
            const cornerIndex = index % 4;
            const cornerPos = cornerPositions[cornerIndex];
            
            const startX = cornerPos.x;
            const startY = cornerPos.y;
            
            // Calculate vector pointing TOWARD center
            const dirX = centerX - startX;
            const dirY = centerY - startY;
            
            // Create the player
            const isHuman = playerConfig.type === 'human';
            
            // Set player speed (human speed remains constant, AI speed gets adjusted but not as much)
            const playerSpeed = isHuman ? 
                this.aiSettings.playerSpeed : 
                this.aiSettings.aiSpeed * 0.95; // Slightly slower AI for better control
            
            try {
                console.log(`Creating player ${index}: type=${playerConfig.type}, color=${playerConfig.color}`);
                
                const newPlayer = new Player(
                    startX, 
                    startY, 
                    playerConfig.color, 
                    playerSpeed, 
                    isHuman,
                    index,
                    playerConfig.controls
                );
                
                // Set initial direction vector pointed toward center
                newPlayer.initialDirection(dirX, dirY);
                newPlayer.lineWidth = this.settings.lineWidth;
                
                // Initialize gap settings based on difficulty
                const settings = GameSettings.difficultySettings[GameSettings.difficulty];
                
                // Setup gap generation with difficulty-appropriate values
                newPlayer.minGapInterval = settings.gapFrequency[0];
                newPlayer.maxGapInterval = settings.gapFrequency[1];
                newPlayer.minGapSize = 10;
                newPlayer.maxGapSize = 30;
                
                // Initialize counters for gap generation
                newPlayer.nextGapIn = this.calculateRandomGapInterval(
                    settings.gapFrequency[0], 
                    settings.gapFrequency[1]
                );
                newPlayer.currentGapSize = this.calculateRandomGapSize(10, 30);
                newPlayer.gapCounter = 0;
                newPlayer.inGap = false;
                
                // Add to players array
                this.players.push(newPlayer);
                this.activePlayers.push(index);
                
                console.log(`Player ${index} created successfully`);
            } catch (e) {
                console.error("Error creating player:", e);
                console.log("Player config:", playerConfig);
                console.trace();
            }
        });
        
        console.log("Players created:", this.players.length);
    }
    
    // Helper function for random gap interval
    calculateRandomGapInterval(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }
    
    // Helper function for random gap size
    calculateRandomGapSize(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }
    
    // Main game loop
    gameLoop(timestamp) {
        if (!this.gameStarted) return;
        
        // Expose frameCounter globally for compatibility
        window.frameCounter = this.frameCounter;
        
        // Calculate delta time
        const deltaTime = timestamp - this.lastFrameTime;
        
        // Frame rate limiting
        if (deltaTime < 1000 / this.settings.maxFPS) {
            requestAnimationFrame(this.gameLoop.bind(this));
            return;
        }
        
        // Track frame time for performance metrics
        this.frameTimings.push(deltaTime);
        if (this.frameTimings.length > 30) {
            this.frameTimings.shift();
        }
        
        // Update FPS display every 10 frames
        if (this.frameCounter % 10 === 0 && this.settings.showFPS) {
            const avgFrameTime = this.frameTimings.reduce((a, b) => a + b, 0) / this.frameTimings.length;
            const fps = Math.round(1000 / avgFrameTime);
            this.fpsDisplay.textContent = `FPS: ${fps}`;
        }
        
        this.lastFrameTime = timestamp;
        
        // Update game state
        this.updateGame();
        this.frameCounter++;
        
        // Check if game is over (0 or 1 player left)
        if (this.activePlayers.length <= 1) {
            this.endRound();
            return;
        }
        
        // Request next frame
        requestAnimationFrame(this.gameLoop.bind(this));
    }
    
    // Update game state each frame
    updateGame() {
        // Update spatial grid for collision detection
        this.updateSpatialGrid();
        
        // Process movements for all active players
        this.activePlayers.forEach(playerIdx => {
            const player = this.players[playerIdx];
            
            if (player.isHuman) {
                // Handle human player input
                let playerAngle = 0;
                const controls = player.controls;
                
                if (this.keyPressed[controls.right]) {
                    playerAngle = this.settings.angleDelta;
                } else if (this.keyPressed[controls.left]) {
                    playerAngle = -this.settings.angleDelta;
                }
                
                player.addPosition(playerAngle);
            } else {
                // Handle AI player with reduced calculation frequency
                this.aiDecisionCounters[playerIdx]++;
                
                // Calculate AI decisions more frequently - better reaction time
                const recalcInterval = Math.floor(this.aiSettings.aiReactionTime * 8);
                
                if (this.aiDecisionCounters[playerIdx] >= recalcInterval) {
                    // Time to recalculate - check if we're not already calculating for this player
                    if (!this.pendingAICalculations[playerIdx]) {
                        // Check if multithreading is enabled
                        const useMultithreading = document.getElementById('useMultithreading')?.checked;
                        
                        if (useMultithreading && this.AiWorkers.length > 0) {
                            // Mark as calculating
                            this.pendingAICalculations[playerIdx] = true;
                            
                            // Prepare data to send to worker
                            const playerData = this.players.map(p => ({
                                arrayOfPos: p.arrayOfPos,
                                gapArray: p.gapArray,
                                speed: p.speed,
                                angleDelta: this.settings.angleDelta
                            }));
                            
                            // Find matching worker for this player
                            const aiPlayerIndices = this.players
                                .filter(p => !p.isHuman)
                                .map(p => p.index);
                                
                            const workerIndex = aiPlayerIndices.indexOf(playerIdx);
                            
                            if (workerIndex >= 0 && workerIndex < this.AiWorkers.length) {
                                // Send calculation task to worker with complete data
                                this.AiWorkers[workerIndex].postMessage({
                                    command: 'calculatePath',
                                    playerIdx: playerIdx,
                                    gameState: {
                                        playerData: playerData,
                                        canvasWidth: this.canvas.width,
                                        canvasHeight: this.canvas.height,
                                        aiSettings: this.aiSettings,
                                        lineWidth: this.settings.lineWidth,
                                        activePlayers: this.activePlayers,
                                        playerCount: this.activePlayers.length
                                    }
                                });
                            }
                        } else {
                            // Not using workers, calculate on main thread
                            this.calculateAIPath(playerIdx);
                        }
                        
                        this.aiDecisionCounters[playerIdx] = 0;
                    }
                }
                
                // Follow the pre-calculated path plan
                let aiAngle = this.followPathPlan(playerIdx);
                player.addPosition(aiAngle);
            }
        });
		
		if (this.powerupManager) {
			this.powerupManager.update(performance.now());
		}
        
        // Render all players
        const useOptimizedRendering = document.getElementById('useOptimizedRendering')?.checked;
        if (useOptimizedRendering) {
            this.renderer.renderPlayers(this.players, this.frameCounter);
        } else {
            // Fallback to simple rendering
            this.canvasContext.clearRect(0, 0, this.canvas.width, this.canvas.height);
            for (const player of this.players) {
                this.drawPlayerTrail(player);
            }
        }
        
        // Check for collisions
        this.checkCollisions();
    }
    
    // Draw player trail (simple fallback method)
    drawPlayerTrail(player) {
        if (player.arrayOfPos.length < 2) return;
        
        this.canvasContext.beginPath();
        this.canvasContext.lineWidth = player.lineWidth || this.settings.lineWidth;
        this.canvasContext.strokeStyle = player.color;
        this.canvasContext.lineCap = "round";
        
        // Track if we're currently drawing or in a gap
        let drawing = true;
        let lastDrawnIndex = 0;
        
        for (let i = 0; i < player.arrayOfPos.length; i++) {
            const pos = player.arrayOfPos[i];
            
            // Check if this position is in a gap
            const isInGap = player.gapArray && player.gapArray.some(gapPos => 
                Math.abs(gapPos[0] - pos[0]) < 1 && 
                Math.abs(gapPos[1] - pos[1]) < 1
            );
            
            if (isInGap) {
                // End the current drawing path if we hit a gap
                if (drawing && i > 0) {
                    this.canvasContext.stroke();
                    drawing = false;
                }
            } else if (!drawing) {
                // Start a new path after a gap
                this.canvasContext.beginPath();
                
                // If we have a previous point, move to it
                if (i > 0) {
                    const prevPos = player.arrayOfPos[i-1];
                    this.canvasContext.moveTo(prevPos[0], prevPos[1]);
                }
                
                drawing = true;
                lastDrawnIndex = i;
            }
            
            if (drawing && i > lastDrawnIndex) {
                this.canvasContext.lineTo(pos[0], pos[1]);
                lastDrawnIndex = i;
            }
        }
        
        // Finish drawing any remaining path
        if (drawing) {
            this.canvasContext.stroke();
        }
    }
    
    // Update spatial grid for fast collision detection
    updateSpatialGrid() {
        if (this.frameCounter % 5 !== 0) return; // Only update every 5 frames
        
        this.spatialGrid.clear();
        
        // Add visible trail segments to grid
        this.players.forEach(player => {
            // Only add points at intervals for performance
            for (let i = 0; i < player.arrayOfPos.length; i += 3) {
                const pos = player.arrayOfPos[i];
                
                // Skip if position is in a gap
                let isInGap = false;
                if (player.gapArray && player.gapArray.length > 0) {
                    for (const gapPos of player.gapArray) {
                        if (Math.abs(gapPos[0] - pos[0]) < 1 && Math.abs(gapPos[1] - pos[1]) < 1) {
                            isInGap = true;
                            break;
                        }
                    }
                }
                
                if (!isInGap) {
                    this.spatialGrid.insert({
                        playerIndex: player.index,
                        posIndex: i,
                        x: pos[0],
                        y: pos[1]
                    }, pos[0], pos[1]);
                }
            }
        });
    }
    
    // Calculate a path for AI player (fallback if workers are disabled)
    calculateAIPath(playerIdx) {
    const player = this.players[playerIdx];
    
    // Calculate direction to center
    const head = player.arrayOfPos[player.arrayOfPos.length - 1];
    const centerX = this.canvas.width / 2;
    const centerY = this.canvas.height / 2;
    
    // Create a simple path plan
    const pathPlan = {
        segments: [],
        currentSegment: 0
    };
    
    // Check if we're near a wall for emergency avoidance
    const distToLeftWall = head[0];
    const distToRightWall = this.canvas.width - head[0];
    const distToTopWall = head[1];
    const distToBottomWall = this.canvas.height - head[1];
    
    const minWallDist = Math.min(distToLeftWall, distToRightWall, distToTopWall, distToBottomWall);
    const emergencyThreshold = 80; // More sensitive emergency threshold
    
    let initialDirection = 0;
    
    // Emergency avoidance if near a wall
    if (minWallDist < emergencyThreshold) {
        // Determine which wall is closest and turn away from it
        if (distToLeftWall === minWallDist) {
            initialDirection = this.settings.angleDelta; // Turn right
        } else if (distToRightWall === minWallDist) {
            initialDirection = -this.settings.angleDelta; // Turn left
        } else if (distToTopWall === minWallDist) {
            // In top section, check if we're moving toward wall
            const currentHeading = Math.atan2(
                head[1] - player.arrayOfPos[player.arrayOfPos.length - 2][1], 
                head[0] - player.arrayOfPos[player.arrayOfPos.length - 2][0]
            );
            initialDirection = (Math.cos(currentHeading) > 0) ? -this.settings.angleDelta : this.settings.angleDelta;
        } else {
            // In bottom section, check if we're moving toward wall
            const currentHeading = Math.atan2(
                head[1] - player.arrayOfPos[player.arrayOfPos.length - 2][1], 
                head[0] - player.arrayOfPos[player.arrayOfPos.length - 2][0]
            );
            initialDirection = (Math.cos(currentHeading) > 0) ? this.settings.angleDelta : -this.settings.angleDelta;
        }
        
        // Create emergency response plan
        const escapeSegment = Array(10).fill(initialDirection); // Shortened for more frequent recalculation
        pathPlan.segments.push(escapeSegment);
        
        // Add a second segment to move toward center
        const towardCenterSegment = Array(5).fill(initialDirection * 0.5); // Shortened and softened
        pathPlan.segments.push(towardCenterSegment);
    } else {
        // Not in emergency mode, generate a path with better variety
        const angleDelta = this.settings.angleDelta;
        
        // More granular directions for smoother movement
        const directions = [
            -angleDelta,
            -angleDelta * 0.75,
            -angleDelta * 0.5, 
            -angleDelta * 0.25,
            0, 
            angleDelta * 0.25,
            angleDelta * 0.5,
            angleDelta * 0.75,
            angleDelta
        ];
        
        // Add shorter segments with varying directions for more responsive movement
        for (let i = 0; i < 3; i++) {
            // Favor directions toward center when further from center
            const distFromCenter = Math.sqrt(
                Math.pow(head[0] - centerX, 2) + 
                Math.pow(head[1] - centerY, 2)
            );
            
            // Use shorter segments for more frequent recalculation
            const segmentLength = 6; 
            let direction;
            
            if (distFromCenter > this.canvas.width * 0.3) {
                // When far from center, bias toward center
                direction = this.getDirectionTowardCenter(player, centerX, centerY);
            } else {
                // When close to center, more random movement but avoid immediate obstacles
                // Try to detect if we're heading toward another player
                const nearbyTrail = this.checkForNearbyTrails(player, 60); // Look for trails within 60px
                
                if (nearbyTrail) {
                    // If there's a trail ahead, choose a direction to avoid it
                    direction = this.calculateAvoidanceDirection(player, nearbyTrail);
                    
                    // Use a shorter segment when avoiding obstacles
                    pathPlan.segments.push(Array(4).fill(direction));
                    continue;
                } else {
                    // No immediate obstacle, choose a random direction
                    // Slightly bias toward continuing straight
                    if (Math.random() < 0.3) {
                        direction = 0; // Straight ahead
                    } else {
                        // Random direction with slight bias toward smaller turns
                        const weightedDirections = directions.flatMap((dir, idx) => {
                            // Center index (straight) has most weight
                            const centerIdx = Math.floor(directions.length / 2);
                            const distFromCenter = Math.abs(idx - centerIdx);
                            // Give more weight to smaller turns
                            return Array(directions.length - distFromCenter).fill(dir);
                        });
                        
                        direction = weightedDirections[Math.floor(Math.random() * weightedDirections.length)];
                    }
                }
            }
            
            pathPlan.segments.push(Array(segmentLength).fill(direction));
        }
    }
    
    // Store the path plan
    this.aiPathPlans[playerIdx] = pathPlan;
}

// Add this new method to check for nearby player trails
checkForNearbyTrails(player, searchDistance) {
    if (player.arrayOfPos.length < 2) return null;
    
    const head = player.arrayOfPos[player.arrayOfPos.length - 1];
    const prevHead = player.arrayOfPos[player.arrayOfPos.length - 2];
    
    // Calculate direction vector
    const dirX = head[0] - prevHead[0];
    const dirY = head[1] - prevHead[1];
    const mag = Math.sqrt(dirX * dirX + dirY * dirY);
    if (mag < 0.0001) return null; // Prevent division by zero
    
    const normDirX = dirX / mag;
    const normDirY = dirY / mag;
    
    // Project a point ahead to check for trails
    const lookAheadDist = searchDistance;
    const checkPos = [
        head[0] + normDirX * lookAheadDist,
        head[1] + normDirY * lookAheadDist
    ];
    
    // Check all players' trails
    for (const otherPlayer of this.players) {
        // Skip self or players with very short trails
        if (otherPlayer === player || otherPlayer.arrayOfPos.length < 10) continue;
        
        // Sample the trail at regular intervals for efficiency
        const samplingRate = Math.max(1, Math.floor(otherPlayer.arrayOfPos.length / 300));
        
        for (let i = 0; i < otherPlayer.arrayOfPos.length; i += samplingRate) {
            const pos = otherPlayer.arrayOfPos[i];
            
            // Skip positions in gaps
            if (otherPlayer.isPositionInGap && otherPlayer.isPositionInGap(pos)) continue;
            
            // Check distance to look-ahead point
            const dx = checkPos[0] - pos[0];
            const dy = checkPos[1] - pos[1];
            const distSquared = dx * dx + dy * dy;
            
            // Use squared distance for performance (avoid square root)
            const thresholdSquared = (player.lineWidth * 2) * (player.lineWidth * 2);
            
            if (distSquared < thresholdSquared) {
                // Found a trail ahead - return the position
                return pos;
            }
        }
    }
    
    return null; // No nearby trails found
}

// Add this new method to calculate a direction to avoid a trail
calculateAvoidanceDirection(player, trailPos) {
    const head = player.arrayOfPos[player.arrayOfPos.length - 1];
    const angleDelta = this.settings.angleDelta;
    
    // Calculate vector from head to trail
    const trailVectorX = trailPos[0] - head[0];
    const trailVectorY = trailPos[1] - head[1];
    
    // Calculate perpendicular directions (left and right of obstacle)
    // Use dot product to determine which side offers more space
    const currentDirX = head[0] - player.arrayOfPos[player.arrayOfPos.length - 2][0];
    const currentDirY = head[1] - player.arrayOfPos[player.arrayOfPos.length - 2][1];
    
    // Calculate cross product to determine which way to turn
    const crossProduct = currentDirX * trailVectorY - currentDirY * trailVectorX;
    
    return crossProduct > 0 ? -angleDelta : angleDelta;
}
    
    // Helper to determine direction that points toward center
    getDirectionTowardCenter(player, centerX, centerY) {
        const head = player.arrayOfPos[player.arrayOfPos.length - 1];
        const prevHead = player.arrayOfPos[player.arrayOfPos.length - 2];
        
        // Calculate current heading angle
        const headingAngle = Math.atan2(
            head[1] - prevHead[1],
            head[0] - prevHead[0]
        );
        
        // Calculate angle to center
        const angleToCenter = Math.atan2(
            centerY - head[1],
            centerX - head[0]
        );
        
        // Calculate difference between angles
        let angleDiff = angleToCenter - headingAngle;
        while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
        while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;
        
        // Convert to degrees
        angleDiff = angleDiff * 180 / Math.PI;
        
        // Choose direction that helps us turn toward center
        if (Math.abs(angleDiff) < 10) {
            return 0; // Already heading toward center, go straight
        } else if (angleDiff > 0) {
            return this.settings.angleDelta; // Turn right toward center
        } else {
            return -this.settings.angleDelta; // Turn left toward center
        }
    }
    
    // Follow the pre-calculated path plan for an AI
    followPathPlan(playerIdx) {
        const plan = this.aiPathPlans[playerIdx];
        
        // If no plan exists or plan is complete, go straight
        if (!plan || plan.currentSegment >= plan.segments.length) {
            return 0;
        }
        
        // Get current segment
        const currentSegment = plan.segments[plan.currentSegment];
        
        // Get the step within the segment
        const stepIndex = Math.min(
            this.aiDecisionCounters[playerIdx], 
            currentSegment.length - 1
        );
        
        // If we're at the end of the segment, move to next segment
        if (stepIndex === currentSegment.length - 1) {
            plan.currentSegment++;
        }
        
        // Return the direction for this step
        return currentSegment[stepIndex];
    }
    
    // Check for collisions
    checkCollisions() {
        // Make a copy of active players to safely modify during iteration
        const currentActivePlayers = [...this.activePlayers];
        
        for (const playerIdx of currentActivePlayers) {
            const player = this.players[playerIdx];
            
            if (player.arrayOfPos.length < 2) continue;
            
            // Check if this player has collided with anything
            const collided = player.checkCollision(this.players);
            
            if (collided) {
                // Record player elimination
                const playerIndex = this.activePlayers.indexOf(playerIdx);
                if (playerIndex !== -1) {
                    // Add to finish order (last to first)
                    this.finishOrder.unshift(playerIdx);
                    
                    // Remove from active players
                    this.activePlayers.splice(playerIndex, 1);
                }
            }
        }
    }
    
    // End the round and show scores
    endRound() {
        this.gameStarted = false;
        
        // If there's still one player remaining, add them as the winner
        if (this.activePlayers.length === 1) {
            this.finishOrder.unshift(this.activePlayers[0]);
        }
        
        // Clean up resources
        this.cleanup();
        
        // Show round over screen with scores
        window.showRoundOver(this.finishOrder);
    }
    
    // Clean up resources
    cleanup() {
        // Terminate workers
        this.AiWorkers.forEach(worker => worker.terminate());
        this.AiWorkers = [];
		this.powerupManager = null;
    }
}

// Override the global initGame function to use the GameEngine
window.gameEngine = null;

window.addEventListener('DOMContentLoaded', function() {
    window.initGame = function() {
        console.log("Initializing game with GameEngine");
        
        // Create engine if it doesn't exist
        if (!window.gameEngine) {
            window.gameEngine = new GameEngine('gameCanvas');
        }
        
        // Start the game
        window.gameEngine.initGame();
    };
});

function handleWorkerDebugMessages(e) {
  const data = e.data;
  
  // Check if this is a debug message
  if (data && data.type === 'debug') {
    const debugDisplay = document.getElementById('aiDebugDisplay');
    
    // Always log to console
    data.logs.forEach(log => {
      console.log(log);
    });
    
    if (debugDisplay) {
      // Add new logs
      data.logs.forEach(log => {
        const logElement = document.createElement('div');
        logElement.textContent = log;
        
        // Color-coding different log types
        if (log.includes('EMERGENCY')) {
          logElement.style.color = '#ff5555'; // Red for emergency
        } else if (log.includes('WALL PROXIMITY')) {
          logElement.style.color = '#ffaa00'; // Orange for wall proximity
        } else if (log.includes('PREVENTIVE')) {
          logElement.style.color = '#aaff00'; // Yellow-green for preventive
        } else if (log.includes('DECISION')) {
          logElement.style.color = '#00ffaa'; // Teal for decisions
        }
        
        debugDisplay.appendChild(logElement);
      });
      
      // Scroll to bottom
      debugDisplay.scrollTop = debugDisplay.scrollHeight;
      
      // Keep only the most recent logs in the display
      while (debugDisplay.childNodes.length > 200) {
        debugDisplay.removeChild(debugDisplay.firstChild);
      }
    }
  }
}