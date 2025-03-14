class Player {
    constructor(xPos, yPos, color, speed, isHuman, index, controls) {
        this.speed = speed;
        this.color = color;
        this.isHuman = isHuman;
        this.index = index;
        this.controls = controls;
        this.canvas = canvas;
        this.arrayOfPos = [];
        this.gapArray = [];
        
        // Get gap settings from difficulty
        const settings = GameSettings.difficultySettings[GameSettings.difficulty];
        const minGap = settings.gapFrequency ? settings.gapFrequency[0] : 50;
        const maxGap = settings.gapFrequency ? settings.gapFrequency[1] : 80;
        
        // Gap settings
        this.gapFrequency = Math.random() * (maxGap - minGap) + minGap;
        this.gapSize = Math.random() * 10 + 10;
        this.gapFrequencyCounter = 0;
        this.gapSizeCounter = 0;
        
        // Starting position - need at least two points to establish direction
        this.arrayOfPos.push([xPos, yPos]);
        
        // Add second point in a default direction (will be updated by initialDirection)
        this.arrayOfPos.push([xPos + this.speed, yPos + this.speed]);
        
        console.log(`Player ${index+1} created at (${xPos}, ${yPos}) with color ${color}`);
    }
    
    // Set initial direction based on x,y vector
    initialDirection(dirX, dirY) {
        // Remove default second point
        this.arrayOfPos.pop();
        
        // Add proper second point based on direction
        const firstPos = this.arrayOfPos[0];
        const magnitude = Math.sqrt(dirX * dirX + dirY * dirY);
        const normalizedX = dirX / magnitude * this.speed;
        const normalizedY = dirY / magnitude * this.speed;
        
        this.arrayOfPos.push([
            firstPos[0] + normalizedX,
            firstPos[1] + normalizedY
        ]);
        
        console.log(`Player ${this.index+1} direction set to (${normalizedX}, ${normalizedY})`);
    }

    // Calculate next position given the angle
    addPosition(setAngle) {
        this.angle = setAngle * Math.PI / 180;
        // Difference between 2 last positions
        let x = this.arrayOfPos[this.arrayOfPos.length - 2];
        let y = this.arrayOfPos[this.arrayOfPos.length - 1];
        let xPosDelta = (y[0] - x[0]);
        let yPosDelta = (y[1] - x[1]);

        // Calculation of the rotation on the move
        let xPos = xPosDelta * Math.cos(this.angle) - yPosDelta * Math.sin(this.angle);
        let yPos = xPosDelta * Math.sin(this.angle) + yPosDelta * Math.cos(this.angle);

        xPos += y[0];
        yPos += y[1];

        this.arrayOfPos.push([xPos, yPos]);
    }

    // Function for drawing line
    line(x1, y1, x2, y2) {
        canvasContext.beginPath();
        canvasContext.moveTo(x1, y1);
        canvasContext.lineTo(x2, y2);
        canvasContext.lineCap = "round";
        canvasContext.lineWidth = lineWidth;
        canvasContext.strokeStyle = this.color;
        canvasContext.stroke();
    }

    // Determine if we should draw a line or leave a gap
    lineState() {
        if (this.gapFrequencyCounter > this.gapFrequency) {
            if (this.gapSizeCounter > this.gapSize) {
                const settings = GameSettings.difficultySettings[GameSettings.difficulty];
                const minGap = settings.gapFrequency ? settings.gapFrequency[0] : 50;
                const maxGap = settings.gapFrequency ? settings.gapFrequency[1] : 80;
                
                this.gapFrequency = Math.random() * (maxGap - minGap) + minGap;
                this.gapSize = Math.random() * 10 + 10;
                this.gapFrequencyCounter = 0;
                this.gapSizeCounter = 0;
            }
            this.gapSizeCounter++;
            return false;
        }
        else {
            this.gapFrequencyCounter++;
            return true;
        }
    }

    // Check for collisions with walls or other players
    checkCollision(players) {
        // Check collisions with other players
        for (const player of players) {
            // Loop for every item in the player's position array
            for (let i = 0; i < player.arrayOfPos.length; i++) {
                // Skip checking very recent positions to avoid self-collision
                if (player === this && i >= player.arrayOfPos.length - lineWidth - 1) {
                    continue;
                }
                
                // Line head is position of this player's head
                let lineHead = this.arrayOfPos[this.arrayOfPos.length - 1];
                // Line hit is the current position being checked
                let lineHit = player.arrayOfPos[i];

                // Check for collision
                if (Math.abs(lineHead[0] - lineHit[0]) < lineWidth * 0.8 && 
                    Math.abs(lineHead[1] - lineHit[1]) < lineWidth * 0.8) {
                    // Collision detected
                    return true;
                }
            }
        }
        
        // Check walls - if player gets outside of the canvas, collision is registered
        const head = this.arrayOfPos[this.arrayOfPos.length - 1];
        if (head[0] <= lineWidth * 0.8 || 
            head[0] >= canvas.width - lineWidth * 0.8 ||
            head[1] <= lineWidth * 0.8 || 
            head[1] >= canvas.height - lineWidth * 0.8) {
            return true;
        }
        
        return false; // No collision
    }

    // Display the line with gaps
    display() {
        if (!this.lineState()) {
            if (this.arrayOfPos.length > 2) {
                this.arrayOfPos[this.arrayOfPos.length - 3] = this.gapStart;

                if (!(this.gapArray[this.gapArray.length - 1] == this.gapStart)) {
                    this.gapArray.push(this.gapStart);
                }
            }
        }
        else {
            this.gapStart = [this.arrayOfPos[this.arrayOfPos.length - 1][0], 
                            this.arrayOfPos[this.arrayOfPos.length - 1][1]];
        }

        // Draw the line segments
        for (let j = 0; j < this.arrayOfPos.length - 2; j++) {
            if (!(this.gapArray.includes(this.arrayOfPos[j]))) {
                this.line(this.arrayOfPos[j][0], this.arrayOfPos[j][1], 
                         this.arrayOfPos[j + 1][0], this.arrayOfPos[j + 1][1]);
            }
        }
        
        // Draw the head
        if (this.arrayOfPos.length >= 2) {
            const lastIdx = this.arrayOfPos.length - 1;
            this.line(
                this.arrayOfPos[lastIdx-1][0], 
                this.arrayOfPos[lastIdx-1][1], 
                this.arrayOfPos[lastIdx][0], 
                this.arrayOfPos[lastIdx][1]
            );
        }
    }
    
    // Static method to display all players
    static displayPlayers(players) {
        canvasContext.clearRect(0, 0, canvas.width, canvas.height);

        for (const player of players) {
            player.display();
        }
    }
}