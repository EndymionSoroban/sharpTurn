// Player.js - Player class with improved collision detection, rendering, and gap generation

class Player {
    constructor(xPos, yPos, color, speed, isHuman, index, controls) {
        // Basic properties
        this.speed = speed;
        this.color = color;
        this.isHuman = isHuman;
        this.index = index;
        this.controls = controls;
        this.lineWidth = 10;
        
        // Position tracking
        this.arrayOfPos = [];
        this.gapArray = [];
        
        // Get gap settings from difficulty
        const settings = GameSettings.difficultySettings[GameSettings.difficulty];
        
        // Gap settings - now with wider range and randomness
        this.minGapInterval = settings.gapFrequency ? settings.gapFrequency[0] : 50;
        this.maxGapInterval = settings.gapFrequency ? settings.gapFrequency[1] : 120;
        this.minGapSize = 10;
        this.maxGapSize = 40;
        
        // Initialize gap generation system
        this.nextGapIn = this.calculateNextGapInterval();
        this.currentGapSize = this.calculateGapSize();
        this.gapCounter = 0;
        this.inGap = false;
        
        // Performance optimization
        this.collisionGrid = {}; // Grid-based collision detection
        this.gridCellSize = this.lineWidth * 3; // Size of each grid cell
        this.lastGridUpdateTime = 0; // When the grid was last updated
        
        // Starting position - just one point initially
        this.arrayOfPos.push([xPos, yPos]);
    }
	getLineWidth(positionIndex) {
		// By default, just return the lineWidth property
		return this.lineWidth;
	}

    
    // Calculate random interval until next gap
    calculateNextGapInterval() {
        return Math.floor(Math.random() * (this.maxGapInterval - this.minGapInterval + 1)) + this.minGapInterval;
    }
    
    // Calculate random gap size
    calculateGapSize() {
        return Math.floor(Math.random() * (this.maxGapSize - this.minGapSize + 1)) + this.minGapSize;
    }
    
    // Set initial direction based on x,y vector (toward center)
    initialDirection(dirX, dirY) {
        const firstPos = this.arrayOfPos[0];
        const magnitude = Math.sqrt(dirX * dirX + dirY * dirY);
        const normalizedX = dirX / magnitude * this.speed;
        const normalizedY = dirY / magnitude * this.speed;
        
        // Add second point in direction of center
        this.arrayOfPos.push([
            firstPos[0] + normalizedX,
            firstPos[1] + normalizedY
        ]);
    }

    // Calculate next position given the angle
    addPosition(setAngle) {
        const angle = setAngle * Math.PI / 180;
        
        // Get last two positions
        const lastIdx = this.arrayOfPos.length - 1;
        const lastPos = this.arrayOfPos[lastIdx];
        const prevPos = this.arrayOfPos[lastIdx - 1];
        
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
        this.arrayOfPos.push(newPos);
        
        // Handle gap generation
        this.updateGapState(newPos);
        
        // Update collision grid occasionally for better performance
        const frameCounter = window.frameCounter || 0;
        if (frameCounter - this.lastGridUpdateTime > 10) {
            this.updateCollisionGrid();
            this.lastGridUpdateTime = frameCounter;
        }
    }
    
    // Update gap state and manage gap arrays
    updateGapState(newPos) {
        if (this.inGap) {
            // We're in a gap, add position to gap array
            this.gapArray.push(newPos);
            
            // Decrement gap counter
            this.gapCounter--;
            
            // Check if we're done with this gap
            if (this.gapCounter <= 0) {
                this.inGap = false;
                this.nextGapIn = this.calculateNextGapInterval();
            }
        } else {
            // We're not in a gap, decrement counter to next gap
            this.nextGapIn--;
            
            // Check if it's time to start a new gap
            if (this.nextGapIn <= 0) {
                this.inGap = true;
                this.gapCounter = this.calculateGapSize();
                this.gapArray.push(newPos); // Add first position of the gap
            }
        }
    }

    // Update the collision grid for faster collision detection
    updateCollisionGrid() {
        const frameCounter = window.frameCounter || 0;
        
        // Only rebuild the grid occasionally to reduce overhead
        if (frameCounter - this.lastGridUpdateTime < 10 && Object.keys(this.collisionGrid).length > 0) {
            return;
        }
        
        // Clear the existing grid
        this.collisionGrid = {};
        
        // Use spatial partitioning for faster collision detection
        const gridSize = this.gridCellSize;
        
        // Calculate number of cells in grid (based on canvas size)
        const canvas = document.getElementById('gameCanvas');
        const gridWidth = Math.ceil(canvas.width / gridSize);
        const gridHeight = Math.ceil(canvas.height / gridSize);
        
        // For loop is faster than forEach for large arrays
        for (let i = 0; i < this.arrayOfPos.length; i++) {
            // Skip positions for optimization (check every 3rd point except recent trail)
            if (i % 3 !== 0 && i < this.arrayOfPos.length - 15) continue;
            
            const pos = this.arrayOfPos[i];
            
            // Skip positions that are in gaps
            let isInGap = this.isPositionInGap(pos);
            
            if (isInGap) continue;
            
            // Calculate grid cell
            const gridX = Math.floor(pos[0] / gridSize);
            const gridY = Math.floor(pos[1] / gridSize);
            
            // Validate grid bounds
            if (gridX >= 0 && gridX < gridWidth && gridY >= 0 && gridY < gridHeight) {
                const cellKey = `${gridX},${gridY}`;
                
                if (!this.collisionGrid[cellKey]) {
                    this.collisionGrid[cellKey] = [];
                }
                
                this.collisionGrid[cellKey].push(i);
            }
        }
        
        this.lastGridUpdateTime = frameCounter;
    }
    
    // Helper to check if a position is in a gap
    isPositionInGap(pos) {
        if (!this.gapArray || this.gapArray.length === 0) return false;
        
        for (let i = 0; i < this.gapArray.length; i++) {
            const gapPos = this.gapArray[i];
            if (Math.abs(gapPos[0] - pos[0]) < 1 && Math.abs(gapPos[1] - pos[1]) < 1) {
                return true;
            }
        }
        
        return false;
    }

    // Check if the current position should be drawn or is in a gap
    isInGapNow() {
        return this.inGap;
    }

    // Check for collisions with own trail and other players - optimized
    checkCollision(players) {
        const head = this.arrayOfPos[this.arrayOfPos.length - 1];
        
        // Hard-coded values are faster than property lookups
        const lineWidthHalf = this.lineWidth * 0.8;
        
        // Get canvas dimensions
        const canvas = document.getElementById('gameCanvas');
        const canvasWidth = canvas.width;
        const canvasHeight = canvas.height;
        
        // Check wall collisions first (fastest check)
        if (head[0] <= lineWidthHalf || 
            head[0] >= canvasWidth - lineWidthHalf ||
            head[1] <= lineWidthHalf || 
            head[1] >= canvasHeight - lineWidthHalf) {
            return true;
        }
        
        // Grid-based collision detection
        const gridSize = this.gridCellSize || (this.lineWidth * 3);
        const gridX = Math.floor(head[0] / gridSize);
        const gridY = Math.floor(head[1] / gridSize);

        // Check neighboring cells - use a larger area for more thorough checking
        const cellsToCheck = [
            `${gridX},${gridY}`,         // Current cell
            `${gridX-1},${gridY}`,       // Left
            `${gridX+1},${gridY}`,       // Right
            `${gridX},${gridY-1}`,       // Top
            `${gridX},${gridY+1}`,       // Bottom
            `${gridX-1},${gridY-1}`,     // Top-left
            `${gridX+1},${gridY-1}`,     // Top-right
            `${gridX-1},${gridY+1}`,     // Bottom-left
            `${gridX+1},${gridY+1}`,     // Bottom-right
            // Extended neighborhood for more thorough checking
            `${gridX-2},${gridY}`,       // Far Left
            `${gridX+2},${gridY}`,       // Far Right
            `${gridX},${gridY-2}`,       // Far Top
            `${gridX},${gridY+2}`,       // Far Bottom
            `${gridX-2},${gridY-1}`,     // Left Top
            `${gridX-2},${gridY+1}`,     // Left Bottom
            `${gridX+2},${gridY-1}`,     // Right Top
            `${gridX+2},${gridY+1}`,     // Right Bottom
            `${gridX-1},${gridY-2}`,     // Top Left
            `${gridX+1},${gridY-2}`,     // Top Right
            `${gridX-1},${gridY+2}`,     // Bottom Left
            `${gridX+1},${gridY+2}`      // Bottom Right
        ];
        
        // Cache the head x and y for performance
        const headX = head[0];
        const headY = head[1];
        
        // Use a for loop instead of forEach for faster execution
        for (let p = 0; p < players.length; p++) {
            const player = players[p];
            
            // Skip if player has no collision grid yet and has few points
            if (!player.collisionGrid || Object.keys(player.collisionGrid).length === 0) {
                if (player.arrayOfPos.length < 10) continue;
            }
            
            // Skip the most recent positions of own trail
            const safetyBuffer = player === this ? 15 : 0;
            
            // Check each cell that might contain collisions
            for (let c = 0; c < cellsToCheck.length; c++) {
                const cellKey = cellsToCheck[c];
                const indices = player.collisionGrid ? player.collisionGrid[cellKey] : null;
                
                if (!indices) continue;
                
                // Check positions in this cell
                for (let i = 0; i < indices.length; i++) {
                    const idx = indices[i];
                    
                    // Skip recent positions of own trail
                    if (player === this && idx > player.arrayOfPos.length - safetyBuffer) {
                        continue;
                    }
                    
                    const pos = player.arrayOfPos[idx];
                    
                    // Skip if this position is in a gap
                    if (player.isPositionInGap(pos)) continue;
                    
                    // More precise collision detection - use actual line width
                    const dx = headX - pos[0];
                    const dy = headY - pos[1];
                    
                    // Use squared distance for performance (avoiding square root)
                    const distanceSquared = dx*dx + dy*dy;
                    const collisionThreshold = lineWidthHalf * lineWidthHalf;
                    
                    if (distanceSquared <= collisionThreshold) {
                        return true;
                    }
                }
            }
        }
        
        // If grid not updated yet, do a traditional check with sampling
        for (let p = 0; p < players.length; p++) {
            const player = players[p];
            
            // Skip if player has collision grid or if already checked
            if (player.collisionGrid && Object.keys(player.collisionGrid).length > 0) {
                continue;
            }
            
            // Skip the most recent positions of own trail
            const safetyBuffer = player === this ? 15 : 0;
            
            // Use sampling for performance
            const samplingRate = Math.max(1, Math.floor(player.arrayOfPos.length / 200));
            
            for (let i = 0; i < player.arrayOfPos.length - safetyBuffer; i += samplingRate) {
                const pos = player.arrayOfPos[i];
                
                // Skip if this position is in a gap
                if (player.isPositionInGap(pos)) continue;
                
                // Check collision
                const dx = head[0] - pos[0];
                const dy = head[1] - pos[1];
                
                // Use squared distance for performance
                const distanceSquared = dx*dx + dy*dy;
                const collisionThreshold = lineWidthHalf * lineWidthHalf;
                
                if (distanceSquared <= collisionThreshold) {
                    return true;
                }
            }
        }
        
        return false; // No collision
    }
    
    // Get the current heading direction in radians
    getHeadingAngle() {
        const len = this.arrayOfPos.length;
        if (len < 2) return 0;
        
        const head = this.arrayOfPos[len - 1];
        const prev = this.arrayOfPos[len - 2];
        
        return Math.atan2(head[1] - prev[1], head[0] - prev[0]);
    }
    
    // Get serializable data for web workers
    getSerializableData() {
        return {
            arrayOfPos: this.arrayOfPos,
            gapArray: this.gapArray,
            speed: this.speed,
            isHuman: this.isHuman,
            index: this.index,
            inGap: this.inGap
        };
    }
}

// Add static display method to Player class
Player.displayPlayers = function(players) {
    const canvas = document.getElementById('gameCanvas');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    
    // Clear the canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw each player
    for (const player of players) {
        if (!player || !player.arrayOfPos || player.arrayOfPos.length < 2) continue;
        
        ctx.lineWidth = player.lineWidth || 10;
        ctx.strokeStyle = player.color;
        ctx.lineCap = "round";
        
        // Draw in segments, skipping gaps
        let drawingPath = false;
        
        for (let i = 0; i < player.arrayOfPos.length - 1; i++) {
            const pos = player.arrayOfPos[i];
            const nextPos = player.arrayOfPos[i + 1];
            
            // Check if this position or next position is in a gap
            const isPosInGap = player.isPositionInGap(pos);
            const isNextPosInGap = player.isPositionInGap(nextPos);
            
            if (!isPosInGap && !isNextPosInGap) {
                // If not drawing, start a new path
                if (!drawingPath) {
                    ctx.beginPath();
                    ctx.moveTo(pos[0], pos[1]);
                    drawingPath = true;
                }
                
                // Continue the path
                ctx.lineTo(nextPos[0], nextPos[1]);
            } else {
                // If we were drawing, end the path
                if (drawingPath) {
                    ctx.stroke();
                    drawingPath = false;
                }
            }
        }
        
        // Finish any remaining path
        if (drawingPath) {
            ctx.stroke();
        }
    }
};