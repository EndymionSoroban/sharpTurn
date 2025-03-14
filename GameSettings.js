// GameSettings.js - Stores game configuration and difficulty settings

// Game difficulty settings
const GameSettings = {
    // Current selected difficulty
    difficulty: 'medium',
    
    // Difficulty-specific parameters
    difficultySettings: {
        easy: {
            aiLookAhead: 30,           // How many frames ahead the AI looks
            aiAggressiveness: 0.1,      // How aggressively AI tries to target player
            aiRandomness: 0.1,          // Chance of making random moves
            aiReactionTime: 5,          // Frames between AI decisions (higher = slower)
            playerSpeed: 2,             // Player movement speed
            aiSpeed: 1.8,               // AI movement speed
            angleDelta: 3,              // Turn rate (degrees)
            gapFrequency: [75, 100]     // Range for gap frequency [min, max]
        },
        medium: {
            aiLookAhead: 50,
            aiAggressiveness: 0.2,
            aiRandomness: 0.05,
            aiReactionTime: 3,
            playerSpeed: 2,
            aiSpeed: 2,
            angleDelta: 4,
            gapFrequency: [50, 80]
        },
        hard: {
            aiLookAhead: 70,
            aiAggressiveness: 0.3,
            aiRandomness: 0.02,
            aiReactionTime: 1,
            playerSpeed: 2,
            aiSpeed: 2.2,
            angleDelta: 5,
            gapFrequency: [35, 60]
        }
    },
    
    // Apply settings for the current difficulty
    applySettings: function() {
        const settings = this.difficultySettings[this.difficulty];
        
        // Apply game parameters
        speed = settings.playerSpeed;
        angleDelta = settings.angleDelta;
        
        // Return settings for AI use
        return settings;
    },
    
    // Set the difficulty
    setDifficulty: function(difficulty) {
        if (this.difficultySettings[difficulty]) {
            this.difficulty = difficulty;
        } else {
            console.error("Invalid difficulty: " + difficulty);
            this.difficulty = 'medium';
        }
    }
};

// Initialize selection screen functionality
document.addEventListener('DOMContentLoaded', function() {
    const selectionScreen = document.getElementById('selectionScreen');
    const gameCanvas = document.getElementById('gameCanvas');
    const easyBtn = document.getElementById('easyBtn');
    const mediumBtn = document.getElementById('mediumBtn');
    const hardBtn = document.getElementById('hardBtn');
    const gameOver = document.getElementById('gameOver');
    const playAgainBtn = document.getElementById('playAgainBtn');
    
    // Set up difficulty buttons
    easyBtn.addEventListener('click', function() {
        startGame('easy');
    });
    
    mediumBtn.addEventListener('click', function() {
        startGame('medium');
    });
    
    hardBtn.addEventListener('click', function() {
        startGame('hard');
    });
    
    // Play again button
    playAgainBtn.addEventListener('click', function() {
        gameOver.style.display = 'none';
        selectionScreen.style.display = 'block';
        gameCanvas.style.display = 'none';
    });
    
    // Function to start the game with selected difficulty
    function startGame(difficulty) {
        // Set difficulty
        GameSettings.setDifficulty(difficulty);
        
        // Hide selection screen, show game canvas
        selectionScreen.style.display = 'none';
        gameCanvas.style.display = 'block';
        
        // Initialize game
        initGame();
    }
    
    // Expose the show game over function globally
    window.showGameOver = function(winnerText) {
        document.getElementById('gameOverText').textContent = winnerText;
        gameOver.style.display = 'block';
    };
});