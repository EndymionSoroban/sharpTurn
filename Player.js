class Player {
    constructor(xPos, yPos, color, speed, isHuman) {
        this.speed = speed;
        this.color = color;
        this.isHuman = isHuman;
        this.canvas = canvas;
        this.arrayOfPos = [];
        this.gapArray = [];
        
        // Get gap settings from difficulty
        const settings = GameSettings.difficultySettings[GameSettings.difficulty];
        const minGap = settings.gapFrequency[0];
        const maxGap = settings.gapFrequency[1];
        
        // Gap settings
        this.gapFrequency = Math.random() * (maxGap - minGap) + minGap;
        this.gapSize = Math.random() * 10 + 10;
        this.gapFrequencyCounter = 0;
        this.gapSizeCounter = 0;
        
        // Starting position
        this.arrayOfPos.push([xPos, yPos]);
        // Need at least 2 items in array to get next position
        this.arrayOfPos.push([xPos + this.speed, yPos + this.speed]);
    }

    // Calculate next position given the angle (from parent)
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
                const minGap = settings.gapFrequency[0];
                const maxGap = settings.gapFrequency[1];
                
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
        for (const player of players) {
            for (const playerEnemy of players) {
                // Loop for every item in arrayOfPos
                for (let i = 0; i < this.arrayOfPos.length; i++) {
                    // Line head is position of the head which is last displayed position
                    let lineHead = player.arrayOfPos[this.arrayOfPos.length - 1];
                    // Line hit is going to be every item of the arrayOfPos
                    let lineHit = playerEnemy.arrayOfPos[i];

                    // Check for collision between line segments
                    if (Math.abs(lineHead[0] - lineHit[0]) < lineWidth * 0.8 && 
                        (Math.abs(lineHead[1] - lineHit[1]) < lineWidth * 0.8)) {
                        // If it is not the head that has close position as the head, then collision is registered
                        if (i < this.arrayOfPos.length - lineWidth - 1) {
                            return player;
                        // Register hits with HEAD OF ENEMY
                        } else if (player != playerEnemy) {
                            return player;
                        } 
                    }
                }
            }
        }
        
        // Check walls, if it gets outside of the canvas then collision is registered
        for (const player of players) {
            for (let i = 0; i < 2; i++) {
                let x = player.arrayOfPos[this.arrayOfPos.length - 1][i];
                if (x <= lineWidth * 0.8 || x >= canvas.width - lineWidth * 0.8) {
                    return player;
                }
            }
        }
        
        return null; // No collision
    }

    // Display the line with gaps
    display() {
        if (!this.lineState()) {
            this.arrayOfPos[this.arrayOfPos.length - 3] = this.gapStart;

            if (!(this.gapArray[this.gapArray.length - 1] == this.gapStart)) {
                this.gapArray.push(this.gapStart);
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
        for (let i = this.arrayOfPos.length - 2; i < this.arrayOfPos.length - 1; i++) {
            this.line(this.arrayOfPos[i][0], this.arrayOfPos[i][1], 
                     this.arrayOfPos[i + 1][0], this.arrayOfPos[i + 1][1]);
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