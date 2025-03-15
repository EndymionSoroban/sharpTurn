// Renderer.js - Optimized rendering system with multiple canvases

class Renderer {
    constructor(mainCanvas) {
        this.mainCanvas = mainCanvas;
        this.mainContext = mainCanvas.getContext('2d');
        
        // Create separate layers for different elements
        this.createLayers();
        
        // Initialize last frame time
        this.lastFrameTime = 0;
        
        // Flag for whether trails need full redraw
        this.needsFullRedraw = true;
        
        // Frame counter for tracking when to update
        this.frameCount = 0;
    }
    
    // Create canvas layers for different elements
    createLayers() {
        // Layer for static trail segments (doesn't change often)
        this.trailCanvas = document.createElement('canvas');
        this.trailCanvas.width = this.mainCanvas.width;
        this.trailCanvas.height = this.mainCanvas.height;
        this.trailContext = this.trailCanvas.getContext('2d');
        
        // Layer for active trail heads (changes every frame)
        this.headCanvas = document.createElement('canvas');
        this.headCanvas.width = this.mainCanvas.width;
        this.headCanvas.height = this.mainCanvas.height;
        this.headContext = this.headCanvas.getContext('2d');
        
        // Set common styles for all contexts
        this.configureContext(this.mainContext);
        this.configureContext(this.trailContext);
        this.configureContext(this.headContext);
    }
    
    // Configure context settings
    configureContext(ctx) {
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
    }
    
    // Clear all layers
    clearAll() {
        this.trailContext.clearRect(0, 0, this.trailCanvas.width, this.trailCanvas.height);
        this.headContext.clearRect(0, 0, this.headCanvas.width, this.headCanvas.height);
        this.mainContext.clearRect(0, 0, this.mainCanvas.width, this.mainCanvas.height);
        this.needsFullRedraw = true;
    }
    
    // Draw all players - optimized to only draw what's changed
    renderPlayers(players, frameCounter) {
        // Clear the head canvas every frame - it always gets redrawn
        this.headContext.clearRect(0, 0, this.headCanvas.width, this.headCanvas.height);
        
        // Full redraw of trails occasionally or when requested
        const fullRedrawInterval = 60; // Redraw trail canvas every 60 frames
        if (this.needsFullRedraw || frameCounter % fullRedrawInterval === 0) {
            this.trailContext.clearRect(0, 0, this.trailCanvas.width, this.trailCanvas.height);
            
            // Draw all trail segments (excluding the most recent ones)
            for (const player of players) {
                this.drawPlayerTrail(player, true);
            }
            
            this.needsFullRedraw = false;
        } else {
            // Incremental update - only draw the most recent segments that were added
            for (const player of players) {
                this.drawPlayerTrail(player, false);
            }
        }
        
        // Draw heads - these always change every frame
        for (const player of players) {
            this.drawPlayerHead(player);
        }
        
        // Composite all layers to main canvas
        this.mainContext.clearRect(0, 0, this.mainCanvas.width, this.mainCanvas.height);
        this.mainContext.drawImage(this.trailCanvas, 0, 0);
        this.mainContext.drawImage(this.headCanvas, 0, 0);
        
        // Update frame count
        this.frameCount++;
    }
    
    // Draw a player's trail
    drawPlayerTrail(player, fullDraw) {
        const ctx = this.trailContext;
        
        // Ensure player has enough positions
        if (player.arrayOfPos.length < 2) return;
        
        // Set line styles
        ctx.lineWidth = player.lineWidth || 10;
        ctx.strokeStyle = player.color;
        
        let drawing = true; // Track if we're currently drawing or in a gap
        
        // Determine which segments to draw
        let startIdx = fullDraw ? 0 : Math.max(0, player.arrayOfPos.length - 5);
        let endIdx = player.arrayOfPos.length - 2; // Exclude the head segment
        
        // No segments to draw
        if (startIdx >= endIdx) return;
        
        // Start a new path
        ctx.beginPath();
        
        // Start from the first position
        ctx.moveTo(player.arrayOfPos[startIdx][0], player.arrayOfPos[startIdx][1]);
        
        for (let i = startIdx + 1; i <= endIdx; i++) {
            const currentPos = player.arrayOfPos[i-1];
            const nextPos = player.arrayOfPos[i];
            
            // Skip if position is in a gap
            const isGapPosition = player.gapArray && player.gapArray.some(gapPos => 
                Math.abs(gapPos[0] - currentPos[0]) < 1 && 
                Math.abs(gapPos[1] - currentPos[1]) < 1
            );
            
            if (isGapPosition) {
                // End current drawing path if we hit a gap
                if (drawing) {
                    ctx.stroke();
                    drawing = false;
                    
                    // Start a new path after the gap
                    if (i < endIdx) {
                        ctx.beginPath();
                    }
                }
            } else if (!drawing) {
                // Start a new path after a gap
                ctx.beginPath();
                ctx.moveTo(currentPos[0], currentPos[1]);
                drawing = true;
            }
            
            if (drawing) {
                ctx.lineTo(nextPos[0], nextPos[1]);
            }
        }
        
        // Finish drawing any remaining path
        if (drawing) {
            ctx.stroke();
        }
    }
    
    // Draw a player's head segment
    drawPlayerHead(player) {
        if (player.arrayOfPos.length < 2) return;
        
        const ctx = this.headContext;
        const lastIdx = player.arrayOfPos.length - 1;
        
        // Set line styles
        ctx.lineWidth = player.lineWidth || 10;
        ctx.strokeStyle = player.color;
        
        // Draw head segment
        ctx.beginPath();
        ctx.moveTo(
            player.arrayOfPos[lastIdx-1][0], 
            player.arrayOfPos[lastIdx-1][1]
        );
        ctx.lineTo(
            player.arrayOfPos[lastIdx][0], 
            player.arrayOfPos[lastIdx][1]
        );
        ctx.stroke();
        
        // Add a small circle at the head for better visibility (optional)
        ctx.beginPath();
        ctx.fillStyle = player.color;
        ctx.arc(
            player.arrayOfPos[lastIdx][0],
            player.arrayOfPos[lastIdx][1],
            ctx.lineWidth / 2,
            0,
            Math.PI * 2
        );
        ctx.fill();
    }
    
    // Force a full redraw on next frame
    requestFullRedraw() {
        this.needsFullRedraw = true;
    }
    
    // Draw a background grid (optional visual enhancement)
    drawGrid(spacing = 40, color = 'rgba(50, 50, 50, 0.3)') {
        const ctx = this.trailContext;
        const width = this.trailCanvas.width;
        const height = this.trailCanvas.height;
        
        ctx.save();
        ctx.strokeStyle = color;
        ctx.lineWidth = 1;
        
        // Draw vertical lines
        for (let x = spacing; x < width; x += spacing) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
            ctx.stroke();
        }
        
        // Draw horizontal lines
        for (let y = spacing; y < height; y += spacing) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();
        }
        
        ctx.restore();
    }
}