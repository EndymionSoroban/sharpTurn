// PowerupManager.js - Manages spawning and handling of powerups

class PowerupManager {
    constructor(canvas, players) {
        this.canvas = canvas;
        this.context = canvas.getContext('2d');
        this.players = players;
        
        // Powerup configuration
        this.spawnInterval = 5000; // 5 seconds between spawns
        this.powerupRadius = 15; // Triple the typical player head radius
        this.activePowerups = [];
        this.powerupTypes = [
            {
                name: 'Eraser',
                color: '#FF5722', // Orange
                icon: '✖',
                effect: (player) => this.applyEraserEffect(player)
            },
            {
                name: 'Wings',
                color: '#2196F3', // Blue
                icon: '★',
                effect: (player) => this.applyWingsEffect(player),
                duration: 5000 // 5 seconds
            },
            {
                name: 'Shrink',
                color: '#9C27B0', // Purple
                icon: '↓',
                effect: (player) => this.applyShrinkEffect(player),
                duration: 8000 // 8 seconds
            },
            {
                name: 'Grow',
                color: '#4CAF50', // Green
                icon: '↑',
                effect: (player) => this.applyGrowEffect(player),
                duration: 8000 // 8 seconds
            }
        ];
        
        // Active player effects
        this.activeEffects = new Map();
        
        // Last spawn time
        this.lastSpawnTime = 0;
    }
    
    // Initialize the powerup system
    initialize() {
        // Clear any existing powerups
        this.activePowerups = [];
        this.activeEffects = new Map();
        
        // Set initial spawn time to start spawning immediately
        this.lastSpawnTime = performance.now() - this.spawnInterval;
    }
    
    // Update function to be called each frame
    update(timestamp) {
        // Check if it's time to spawn a new powerup
        if (timestamp - this.lastSpawnTime >= this.spawnInterval && this.activePowerups.length < 3) {
            this.spawnRandomPowerup();
            this.lastSpawnTime = timestamp;
        }
        
        // Check for powerup collisions with players
        this.checkCollisions();
        
        // Update active effects (check for expired effects)
        this.updateActiveEffects(timestamp);
    }
    
    // Spawn a random powerup at a random position
    spawnRandomPowerup() {
        // Choose a random powerup type
        const typeIndex = Math.floor(Math.random() * this.powerupTypes.length);
        const type = this.powerupTypes[typeIndex];
        
        // Find a suitable position (not too close to walls or trails)
        const position = this.findSuitablePosition();
        
        // If no suitable position found, try again next frame
        if (!position) return;
        
        // Create the powerup
        const powerup = {
            type: type,
            x: position.x,
            y: position.y,
            radius: this.powerupRadius,
            spawnTime: performance.now()
        };
        
        // Add to active powerups
        this.activePowerups.push(powerup);
    }
    
    // Find a position for a powerup that doesn't overlap with trails
    findSuitablePosition() {
        const padding = this.powerupRadius * 3; // Stay away from walls
        const maxAttempts = 50;
        
        for (let i = 0; i < maxAttempts; i++) {
            // Generate random position with padding from walls
            const x = padding + Math.random() * (this.canvas.width - padding * 2);
            const y = padding + Math.random() * (this.canvas.height - padding * 2);
            
            // Check if position is too close to any player trail
            let validPosition = true;
            
            for (const player of this.players) {
                if (!player.arrayOfPos) continue;
                
                // Check only a sample of positions for performance
                const trailSample = 10; // Check every 10th position
                for (let j = 0; j < player.arrayOfPos.length; j += trailSample) {
                    const pos = player.arrayOfPos[j];
                    if (!pos) continue;
                    
                    // Skip positions in gaps
                    let isInGap = false;
                    if (player.gapArray && player.gapArray.length > 0) {
                        for (const gapPos of player.gapArray) {
                            if (gapPos && Math.abs(gapPos[0] - pos[0]) < 1 && Math.abs(gapPos[1] - pos[1]) < 1) {
                                isInGap = true;
                                break;
                            }
                        }
                    }
                    
                    if (isInGap) continue;
                    
                    // Calculate distance to trail point
                    const dx = x - pos[0];
                    const dy = y - pos[1];
                    const distSquared = dx * dx + dy * dy;
                    
                    // Too close to a trail
                    if (distSquared < (this.powerupRadius + player.lineWidth) * (this.powerupRadius + player.lineWidth)) {
                        validPosition = false;
                        break;
                    }
                }
                
                if (!validPosition) break;
            }
            
            // Also check distance from other powerups
            for (const powerup of this.activePowerups) {
                const dx = x - powerup.x;
                const dy = y - powerup.y;
                const distSquared = dx * dx + dy * dy;
                
                // Too close to another powerup
                if (distSquared < (this.powerupRadius * 4) * (this.powerupRadius * 4)) {
                    validPosition = false;
                    break;
                }
            }
            
            if (validPosition) {
                return { x, y };
            }
        }
        
        // Couldn't find a suitable position after max attempts
        return null;
    }
    
    // Check for collisions between players and powerups
    checkCollisions() {
        for (let i = this.activePowerups.length - 1; i >= 0; i--) {
            const powerup = this.activePowerups[i];
            
            for (const player of this.players) {
                // Skip players that aren't active
                if (!player.arrayOfPos || player.arrayOfPos.length < 2) continue;
                
                // Get player head position
                const head = player.arrayOfPos[player.arrayOfPos.length - 1];
                
                // Calculate distance to powerup
                const dx = head[0] - powerup.x;
                const dy = head[1] - powerup.y;
                const distSquared = dx * dx + dy * dy;
                
                // Check collision (sum of radii)
                const lineWidthHalf = player.lineWidth / 2;
                const collisionThreshold = (lineWidthHalf + powerup.radius) * (lineWidthHalf + powerup.radius);
                
                if (distSquared <= collisionThreshold) {
                    // Player collected powerup
                    this.activePowerups.splice(i, 1);
                    
                    // Apply effect
                    powerup.type.effect(player);
                    
                    // Play sound effect (if available)
                    this.playCollectSound(powerup.type.name);
                    
                    // Break to avoid processing the same powerup with other players
                    break;
                }
            }
        }
    }
    
    // Update active effects and remove expired ones
    updateActiveEffects(timestamp) {
        for (const [playerId, effects] of this.activeEffects.entries()) {
            for (let i = effects.length - 1; i >= 0; i--) {
                const effect = effects[i];
                
                // Check if effect has expired
                if (timestamp >= effect.endTime) {
                    // Remove effect
                    effects.splice(i, 1);
                    
                    // Apply end effect action
                    effect.endEffect();
                }
            }
            
            // If no more effects for this player, remove from map
            if (effects.length === 0) {
                this.activeEffects.delete(playerId);
            }
        }
    }
    
    // Apply Eraser effect - removes all trails
    applyEraserEffect(player) {
        // Remove all trails except for the last few positions of each player
        for (const p of this.players) {
            if (!p.arrayOfPos || p.arrayOfPos.length < 10) continue;
            
            // Keep only the last 5 positions
            const lastPositions = p.arrayOfPos.slice(-5);
            p.arrayOfPos = lastPositions;
            
            // Clear gap array
            p.gapArray = [];
            
            // Reset collision grid for better performance
            if (p.collisionGrid) {
                p.collisionGrid = {};
                p.lastGridUpdateTime = 0;
            }
        }
        
        // Force full redraw of trails
        if (window.gameEngine && window.gameEngine.renderer) {
            window.gameEngine.renderer.needsFullRedraw = true;
        }
        
        // Show visual effect (flash screen)
        this.showScreenFlash('#FF5722', 300);
    }
    
    // Apply Wings effect - player becomes invulnerable and leaves no trail
    applyWingsEffect(player) {
        // Create a reference to the original checkCollision method
        if (!player._originalCheckCollision) {
            player._originalCheckCollision = player.checkCollision;
        }
        
        // Override collision detection
        player.checkCollision = () => false; // Never collide
        
        // Mark the player as being in a gap at all times during effect
        player._originalInGap = player.inGap;
        player._originalIsInGapNow = player.isInGapNow;
        
        // Override isInGapNow to always return true
        player.isInGapNow = () => true;
        
        // Force in gap state
        player.inGap = true;
        
        // Add visual indicator to player
        player.hasWings = true;
        
        // Add to active effects
        const effect = {
            type: 'Wings',
            player: player,
            startTime: performance.now(),
            endTime: performance.now() + 5000, // 5 seconds
            endEffect: () => {
                // Restore original collision detection
                player.checkCollision = player._originalCheckCollision;
                
                // Restore original gap methods
                player.isInGapNow = player._originalIsInGapNow;
                player.inGap = player._originalInGap;
                
                // Remove visual indicator
                player.hasWings = false;
            }
        };
        
        this.addEffectToPlayer(player.index, effect);
    }
    
    // Apply Shrink effect - makes trail thinner
    applyShrinkEffect(player) {
        // Store original line width
        const originalLineWidth = player.lineWidth;
        
        // Apply to new trails only - create a tracking point
        const positionAtEffect = player.arrayOfPos.length - 1;
        
        // Create a modified linewidth getter that checks position
        player._originalGetLineWidth = player.getLineWidth || (() => player.lineWidth);
        
        // Override linewidth getter
        player.getLineWidth = (posIndex) => {
            if (posIndex >= positionAtEffect) {
                return Math.max(3, originalLineWidth / 2); // Shrunk size
            } else {
                return originalLineWidth; // Original size
            }
        };
        
        // Also store the current lineWidth for the head
        player.lineWidth = Math.max(3, originalLineWidth / 2);
        
        // Add visual indicator
        player.isShrunk = true;
        
        // Add to active effects
        const effect = {
            type: 'Shrink',
            player: player,
            startTime: performance.now(),
            endTime: performance.now() + 8000, // 8 seconds
            positionAtEffect: positionAtEffect,
            originalLineWidth: originalLineWidth,
            endEffect: () => {
                // Restore original line width for new segments
                player.lineWidth = originalLineWidth;
                
                // Restore original line width getter
                player.getLineWidth = player._originalGetLineWidth;
                
                // Remove visual indicator
                player.isShrunk = false;
            }
        };
        
        this.addEffectToPlayer(player.index, effect);
    }
    
    // Apply Grow effect - makes trail thicker
    applyGrowEffect(player) {
        // Store original line width
        const originalLineWidth = player.lineWidth;
        
        // Apply to new trails only - create a tracking point
        const positionAtEffect = player.arrayOfPos.length - 1;
        
        // Create a modified linewidth getter that checks position
        player._originalGetLineWidth = player.getLineWidth || (() => player.lineWidth);
        
        // Override linewidth getter
        player.getLineWidth = (posIndex) => {
            if (posIndex >= positionAtEffect) {
                return Math.min(20, originalLineWidth * 2); // Grown size
            } else {
                return originalLineWidth; // Original size
            }
        };
        
        // Also store the current lineWidth for the head
        player.lineWidth = Math.min(20, originalLineWidth * 2);
        
        // Add visual indicator
        player.isGrown = true;
        
        // Add to active effects
        const effect = {
            type: 'Grow',
            player: player,
            startTime: performance.now(),
            endTime: performance.now() + 8000, // 8 seconds
            positionAtEffect: positionAtEffect,
            originalLineWidth: originalLineWidth,
            endEffect: () => {
                // Restore original line width for new segments
                player.lineWidth = originalLineWidth;
                
                // Restore original line width getter
                player.getLineWidth = player._originalGetLineWidth;
                
                // Remove visual indicator
                player.isGrown = false;
            }
        };
        
        this.addEffectToPlayer(player.index, effect);
    }
    
    // Add effect to player's active effects
    addEffectToPlayer(playerIndex, effect) {
        if (!this.activeEffects.has(playerIndex)) {
            this.activeEffects.set(playerIndex, []);
        }
        
        // Remove any existing effects of the same type
        const effects = this.activeEffects.get(playerIndex);
        const existingIndex = effects.findIndex(e => e.type === effect.type);
        
        if (existingIndex !== -1) {
            // Call the end effect function to clean up
            effects[existingIndex].endEffect();
            // Remove existing effect
            effects.splice(existingIndex, 1);
        }
        
        // Add new effect
        effects.push(effect);
    }
    
    // Draw all active powerups
    draw() {
        for (const powerup of this.activePowerups) {
            // Draw circle background
            this.context.beginPath();
            this.context.arc(powerup.x, powerup.y, powerup.radius, 0, Math.PI * 2);
            this.context.fillStyle = powerup.type.color;
            this.context.fill();
            
            // Draw pulsing effect
            const pulseAmount = Math.sin(performance.now() / 200) * 3;
            this.context.beginPath();
            this.context.arc(powerup.x, powerup.y, powerup.radius + pulseAmount, 0, Math.PI * 2);
            this.context.strokeStyle = 'white';
            this.context.lineWidth = 2;
            this.context.stroke();
            
            // Draw icon
            this.context.fillStyle = 'white';
            this.context.font = `bold ${powerup.radius}px Arial`;
            this.context.textAlign = 'center';
            this.context.textBaseline = 'middle';
            this.context.fillText(powerup.type.icon, powerup.x, powerup.y);
        }
        
        // Draw active effects indicators (e.g., wings, shrink effect)
        this.drawActiveEffects();
    }
    
    // Draw indicators for active effects
    drawActiveEffects() {
        for (const player of this.players) {
            if (!player.arrayOfPos || player.arrayOfPos.length < 2) continue;
            
            const head = player.arrayOfPos[player.arrayOfPos.length - 1];
            
            // Draw wing effect indicator
            if (player.hasWings) {
                const wingSize = player.lineWidth * 1.5;
                const angleOffset = Math.sin(performance.now() / 200) * 0.2;
                
                // Get player heading
                const prev = player.arrayOfPos[player.arrayOfPos.length - 2];
                const angle = Math.atan2(head[1] - prev[1], head[0] - prev[0]);
                
                // Draw wings perpendicular to movement
                this.context.save();
                this.context.translate(head[0], head[1]);
                this.context.rotate(angle);
                
                // Left wing
                this.context.beginPath();
                this.context.moveTo(0, 0);
                this.context.lineTo(-wingSize, -wingSize * 1.5);
                this.context.lineTo(0, -wingSize);
                this.context.fillStyle = 'rgba(255, 255, 255, 0.7)';
                this.context.fill();
                
                // Right wing
                this.context.beginPath();
                this.context.moveTo(0, 0);
                this.context.lineTo(wingSize, -wingSize * 1.5);
                this.context.lineTo(0, -wingSize);
                this.context.fillStyle = 'rgba(255, 255, 255, 0.7)';
                this.context.fill();
                
                this.context.restore();
            }
            
            // Draw size change indicators
            if (player.isShrunk) {
                this.drawPowerupIndicator(head, '↓', '#9C27B0');
            } else if (player.isGrown) {
                this.drawPowerupIndicator(head, '↑', '#4CAF50');
            }
        }
    }
    
    // Draw a powerup indicator above a player
    drawPowerupIndicator(position, icon, color) {
        const y = position[1] - 15; // Position above player
        
        this.context.beginPath();
        this.context.arc(position[0], y, 8, 0, Math.PI * 2);
        this.context.fillStyle = color;
        this.context.fill();
        
        this.context.fillStyle = 'white';
        this.context.font = 'bold 10px Arial';
        this.context.textAlign = 'center';
        this.context.textBaseline = 'middle';
        this.context.fillText(icon, position[0], y);
    }
    
    // Show a screen flash effect for dramatic effect
    showScreenFlash(color, duration) {
        // Create a flash overlay
        const flash = document.createElement('div');
        flash.style.position = 'fixed';
        flash.style.top = '0';
        flash.style.left = '0';
        flash.style.width = '100%';
        flash.style.height = '100%';
        flash.style.backgroundColor = color;
        flash.style.opacity = '0.3';
        flash.style.pointerEvents = 'none';
        flash.style.zIndex = '1000';
        flash.style.transition = `opacity ${duration}ms`;
        
        document.body.appendChild(flash);
        
        // Fade out and remove
        setTimeout(() => {
            flash.style.opacity = '0';
            setTimeout(() => {
                document.body.removeChild(flash);
            }, duration);
        }, 50);
    }
    
    // Play sound effect for collecting powerup
    playCollectSound(powerupType) {
        // Simple beep sound using Web Audio API
        try {
            const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioCtx.createOscillator();
            const gainNode = audioCtx.createGain();
            
            // Different sounds for different powerups
            let frequency = 440; // Default A note
            let duration = 0.1; // Short duration
            
            switch (powerupType) {
                case 'Eraser':
                    frequency = 220; // Low A
                    duration = 0.2;
                    break;
                case 'Wings':
                    frequency = 660; // Higher note
                    duration = 0.15;
                    break;
                case 'Shrink':
                    frequency = 330; // Lower note
                    duration = 0.1;
                    break;
                case 'Grow':
                    frequency = 550; // Higher note
                    duration = 0.1;
                    break;
            }
            
            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(frequency, audioCtx.currentTime);
            oscillator.connect(gainNode);
            gainNode.connect(audioCtx.destination);
            
            // Start sound and fade out
            gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);
            
            oscillator.start();
            oscillator.stop(audioCtx.currentTime + duration);
        } catch (e) {
            // Silently fail if audio is not supported
            console.log("Audio not supported");
        }
    }
}

// Make the PowerupManager available globally
window.PowerupManager = PowerupManager;