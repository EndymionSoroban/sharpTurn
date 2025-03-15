// GameSettings.js - Stores game configuration, player settings, and scoring

// Player controls configuration
const PLAYER_CONTROLS = [
    { left: 37, right: 39 },     // Player 1: Left/Right arrows
    { left: 65, right: 68 },     // Player 2: A/D keys
    { left: 74, right: 76 },     // Player 3: J/L keys
    { left: 100, right: 102 }    // Player 4: Numpad 4/6
];

// Player colors
const PLAYER_COLORS = [
    "#4CAF50", // Green
    "#F44336", // Red
    "#2196F3", // Blue
    "#FFEB3B"  // Yellow
];

// Game Settings object
const GameSettings = {
    // Current selected difficulty
    difficulty: 'medium',
    
    // Player configuration
    players: [
        { enabled: true, type: 'human', color: PLAYER_COLORS[0], controls: PLAYER_CONTROLS[0], score: 0 },
        { enabled: true, type: 'ai', color: PLAYER_COLORS[1], controls: PLAYER_CONTROLS[1], score: 0 },
        { enabled: false, type: 'ai', color: PLAYER_COLORS[2], controls: PLAYER_CONTROLS[2], score: 0 },
        { enabled: false, type: 'ai', color: PLAYER_COLORS[3], controls: PLAYER_CONTROLS[3], score: 0 }
    ],
    
    // Scoring system
    scoring: {
        roundScores: {},  // Stores scores for the current round
        totalScores: {},  // Stores cumulative scores
        roundNumber: 1    // Current round number
    },
    
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
            gapFrequency: [75, 120]     // Range for gap frequency [min, max] - longer intervals on easy
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
            gapFrequency: [30, 60]      // More frequent gaps on hard
        }
    },
    
    // Get enabled players
    getEnabledPlayers: function() {
        return this.players.filter(player => player.enabled);
    },
    
    // Get number of enabled players
    getPlayerCount: function() {
        return this.getEnabledPlayers().length;
    },
    
    // Apply settings for the current difficulty
    applySettings: function() {
        const settings = this.difficultySettings[this.difficulty];
        
        // Apply game parameters
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
    },
    
    // Update player settings from UI
    updatePlayerSettings: function() {
        for (let i = 0; i < 4; i++) {
            const playerNum = i + 1;
            const enabled = document.getElementById(`player${playerNum}Enabled`).checked;
            const type = document.getElementById(`player${playerNum}Type`).value;
            
            this.players[i].enabled = enabled;
            this.players[i].type = type;
        }
    },
    
    // Reset scores for a new game
    resetScores: function() {
        this.scoring.roundNumber = 1;
        this.players.forEach(player => {
            player.score = 0;
        });
        this.scoring.roundScores = {};
        this.scoring.totalScores = {};
    },
    
    // Record scores for a round based on finishing order
    recordRoundScores: function(finishOrder) {
        const enabledPlayers = this.getEnabledPlayers();
        const playerCount = enabledPlayers.length;
        
        // Reset round scores
        this.scoring.roundScores = {};
        
        // Award points based on position (e.g., with 4 players: 1st=3pts, 2nd=2pts, 3rd=1pt, 4th=0pts)
        finishOrder.forEach((playerIndex, position) => {
            // Points = playerCount - position - 1 (last place gets 0)
            const points = Math.max(0, playerCount - position - 1);
            
            // Record round score
            this.scoring.roundScores[playerIndex] = points;
            
            // Add to total score
            if (!this.scoring.totalScores[playerIndex]) {
                this.scoring.totalScores[playerIndex] = 0;
            }
            this.scoring.totalScores[playerIndex] += points;
            
            // Update player score object
            this.players[playerIndex].score = this.scoring.totalScores[playerIndex];
        });
        
        return {
            roundScores: this.scoring.roundScores,
            totalScores: this.scoring.totalScores
        };
    },
    
    // Get player with highest score
    getWinner: function() {
        let highestScore = -1;
        let winnerIndex = -1;
        
        this.players.forEach((player, index) => {
            if (player.enabled && player.score > highestScore) {
                highestScore = player.score;
                winnerIndex = index;
            }
        });
        
        return winnerIndex;
    },
    
    // Advance to next round
    nextRound: function() {
        this.scoring.roundNumber++;
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
    const nextRoundBtn = document.getElementById('nextRoundBtn');
    const resetGameBtn = document.getElementById('resetGameBtn');
    const startGameBtn = document.getElementById('startGameBtn');
    
    // Set up difficulty buttons
    easyBtn.addEventListener('click', function() {
        selectDifficulty('easy');
    });
    
    mediumBtn.addEventListener('click', function() {
        selectDifficulty('medium');
    });
    
    hardBtn.addEventListener('click', function() {
        selectDifficulty('hard');
    });
    
    // Function to highlight selected difficulty
    function selectDifficulty(difficulty) {
        GameSettings.setDifficulty(difficulty);
        
        // Update button states
        easyBtn.style.opacity = difficulty === 'easy' ? '1' : '0.7';
        mediumBtn.style.opacity = difficulty === 'medium' ? '1' : '0.7';
        hardBtn.style.opacity = difficulty === 'hard' ? '1' : '0.7';
    }
    
    // Start game button
    startGameBtn.addEventListener('click', function() {
        // Update player settings from UI
        GameSettings.updatePlayerSettings();
        
        // Make sure at least 2 players are enabled
        if (GameSettings.getPlayerCount() < 2) {
            alert("Please enable at least 2 players to start the game!");
            return;
        }
        
        // Hide selection screen, show game canvas
        selectionScreen.style.display = 'none';
        gameCanvas.style.display = 'block';
        
        // Initialize game
        initGame();
    });
    
    // Next round button
    nextRoundBtn.addEventListener('click', function() {
        gameOver.style.display = 'none';
        gameCanvas.style.display = 'block';
        
        // Advance to next round
        GameSettings.nextRound();
        
        // Start next round
        initGame();
    });
    
    // Reset game button
    resetGameBtn.addEventListener('click', function() {
        gameOver.style.display = 'none';
        selectionScreen.style.display = 'block';
        gameCanvas.style.display = 'none';
        
        // Reset scores
        GameSettings.resetScores();
    });
    
    // Default highlight medium difficulty
    selectDifficulty('medium');
    
    // Expose showRoundOver function globally
    window.showRoundOver = function(finishOrder) {
        // Record scores
        const scores = GameSettings.recordRoundScores(finishOrder);
        
        // Update score table
        updateScoreTable(scores);
        
        // Show game over screen
        gameOver.style.display = 'block';
    };
    
    // Update score table in the UI
    function updateScoreTable(scores) {
        const tableBody = document.getElementById('scoreTableBody');
        tableBody.innerHTML = '';
        
        const winner = GameSettings.getWinner();
        
        // Add rows for each enabled player
        GameSettings.players.forEach((player, index) => {
            if (player.enabled) {
                const row = document.createElement('tr');
                
                // Highlight winner
                if (index === winner) {
                    row.className = 'winner-row';
                }
                
                // Player name/color
                const nameCell = document.createElement('td');
                const colorSpan = document.createElement('span');
                colorSpan.style.display = 'inline-block';
                colorSpan.style.width = '12px';
                colorSpan.style.height = '12px';
                colorSpan.style.backgroundColor = player.color;
                colorSpan.style.borderRadius = '50%';
                colorSpan.style.marginRight = '5px';
                
                nameCell.appendChild(colorSpan);
                nameCell.appendChild(document.createTextNode(`Player ${index + 1}`));
                row.appendChild(nameCell);
                
                // Round score
                const roundCell = document.createElement('td');
                roundCell.textContent = scores.roundScores[index] || 0;
                row.appendChild(roundCell);
                
                // Total score
                const totalCell = document.createElement('td');
                totalCell.textContent = player.score;
                row.appendChild(totalCell);
                
                tableBody.appendChild(row);
            }
        });
        
        // Update round number in title
        document.getElementById('gameOverText').textContent = `Round ${GameSettings.scoring.roundNumber} Complete!`;
    }
});