// main.js - Main entry point for the game

// Performance options
let useMultithreading = true;
let useOptimizedRendering = true;
let showFPS = true;

// Initialize everything once DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    console.log("DOM loaded, initializing game...");
    
    // Initialize UI components
    initializeUI();
    
    // Get performance options
    const multithreadingCheckbox = document.getElementById('useMultithreading');
    const renderingCheckbox = document.getElementById('useOptimizedRendering');
    const fpsCheckbox = document.getElementById('showFPS');
    const fpsDisplay = document.getElementById('fpsDisplay');
    
    if (multithreadingCheckbox) {
        multithreadingCheckbox.addEventListener('change', function() {
            useMultithreading = this.checked;
        });
    }
    
    if (renderingCheckbox) {
        renderingCheckbox.addEventListener('change', function() {
            useOptimizedRendering = this.checked;
        });
    }
    
    if (fpsCheckbox) {
        fpsCheckbox.addEventListener('change', function() {
            showFPS = this.checked;
            if (fpsDisplay) {
                fpsDisplay.style.display = showFPS ? 'block' : 'none';
            }
        });
    }
    
    // Initialize the FPS display
    if (fpsDisplay) {
        fpsDisplay.style.display = showFPS ? 'block' : 'none';
    }
});

// UI initialization and event handlers
function initializeUI() {
    console.log("Initializing UI");
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
    if (easyBtn) {
        easyBtn.addEventListener('click', function() {
            selectDifficulty('easy');
        });
    }
    
    if (mediumBtn) {
        mediumBtn.addEventListener('click', function() {
            selectDifficulty('medium');
        });
    }
    
    if (hardBtn) {
        hardBtn.addEventListener('click', function() {
            selectDifficulty('hard');
        });
    }
    
    // Function to highlight selected difficulty
    function selectDifficulty(difficulty) {
        console.log("Selecting difficulty:", difficulty);
        GameSettings.setDifficulty(difficulty);
        
        // Update button states
        if (easyBtn) easyBtn.style.opacity = difficulty === 'easy' ? '1' : '0.7';
        if (mediumBtn) mediumBtn.style.opacity = difficulty === 'medium' ? '1' : '0.7';
        if (hardBtn) hardBtn.style.opacity = difficulty === 'hard' ? '1' : '0.7';
    }
    
    // Start game button
    if (startGameBtn) {
        startGameBtn.addEventListener('click', function() {
            console.log("Start game button clicked");
            // Update player settings from UI
            GameSettings.updatePlayerSettings();
            
            // Make sure at least 2 players are enabled
            if (GameSettings.getPlayerCount() < 2) {
                alert("Please enable at least 2 players to start the game!");
                return;
            }
            
            // Hide selection screen, show game canvas
            if (selectionScreen) selectionScreen.style.display = 'none';
            if (gameCanvas) gameCanvas.style.display = 'block';
            
            // Initialize game
            initGame();
        });
    }
    
    // Next round button
    if (nextRoundBtn) {
        nextRoundBtn.addEventListener('click', function() {
            if (gameOver) gameOver.style.display = 'none';
            if (gameCanvas) gameCanvas.style.display = 'block';
            
            // Advance to next round
            GameSettings.nextRound();
            
            // Start next round
            initGame();
        });
    }
    
    // Reset game button
    if (resetGameBtn) {
        resetGameBtn.addEventListener('click', function() {
            if (gameOver) gameOver.style.display = 'none';
            if (selectionScreen) selectionScreen.style.display = 'block';
            if (gameCanvas) gameCanvas.style.display = 'none';
            
            // Reset scores
            GameSettings.resetScores();
        });
    }
    
    // Default highlight medium difficulty
    selectDifficulty('medium');
}

// This function will be redefined by GameEngine
window.initGame = function() {
    console.log("Default initGame called - waiting for GameEngine to load");
};

// Mark available features for compatibility with older scripts
window.enabledFeatures = {
    webWorkers: 'Worker' in window,
    optimizedRendering: true,
    spatialPartitioning: true
};

// Create debug display for AI logs
function setupDebugDisplay() {
  console.log("Setting up AI debug display");
  
  // Create a debug display element
  const debugDisplay = document.createElement('div');
  debugDisplay.id = 'aiDebugDisplay';
  debugDisplay.style.position = 'fixed';
  debugDisplay.style.bottom = '10px';
  debugDisplay.style.right = '10px';
  debugDisplay.style.width = '500px';
  debugDisplay.style.height = '300px';
  debugDisplay.style.background = 'rgba(0, 0, 0, 0.7)';
  debugDisplay.style.color = '#0f0';
  debugDisplay.style.fontFamily = 'monospace';
  debugDisplay.style.fontSize = '10px';
  debugDisplay.style.padding = '10px';
  debugDisplay.style.overflowY = 'scroll';
  debugDisplay.style.zIndex = '1000';
  debugDisplay.style.display = 'none'; // Hidden by default
  
  document.body.appendChild(debugDisplay);
  
  // Create a toggle button
  const toggleButton = document.createElement('button');
  toggleButton.textContent = 'Toggle AI Debug';
  toggleButton.style.position = 'fixed';
  toggleButton.style.bottom = '10px';
  toggleButton.style.left = '10px';
  toggleButton.style.zIndex = '1000';
  
  toggleButton.addEventListener('click', function() {
    debugDisplay.style.display = debugDisplay.style.display === 'none' ? 'block' : 'none';
    // Request all logs from workers when display is shown
    if (debugDisplay.style.display === 'block' && window.gameEngine && window.gameEngine.aiWorkers) {
      window.gameEngine.aiWorkers.forEach(worker => {
        worker.postMessage({
          command: 'getDebugLogs'
        });
      });
    }
  });
  
  document.body.appendChild(toggleButton);
  
  // Create a clear logs button
  const clearButton = document.createElement('button');
  clearButton.textContent = 'Clear AI Logs';
  clearButton.style.position = 'fixed';
  clearButton.style.bottom = '10px';
  clearButton.style.left = '120px';
  clearButton.style.zIndex = '1000';
  
  clearButton.addEventListener('click', function() {
    // Clear the display
    if (debugDisplay) {
      debugDisplay.innerHTML = '';
    }
    
    // Tell workers to clear logs
    if (window.gameEngine && window.gameEngine.aiWorkers) {
      window.gameEngine.aiWorkers.forEach(worker => {
        worker.postMessage({
          command: 'clearDebugLogs'
        });
      });
    }
    
    console.clear(); // Also clear browser console
  });
  
  document.body.appendChild(clearButton);
  
  // Create a log to console button
  const consoleLogButton = document.createElement('button');
  consoleLogButton.textContent = 'Log to Console';
  consoleLogButton.style.position = 'fixed';
  consoleLogButton.style.bottom = '10px';
  consoleLogButton.style.left = '230px';
  consoleLogButton.style.zIndex = '1000';
  
  consoleLogButton.addEventListener('click', function() {
    // Log all current logs to console
    if (debugDisplay) {
      console.log("========= AI DEBUG LOGS =========");
      const children = debugDisplay.children;
      for (let i = 0; i < children.length; i++) {
        console.log(children[i].textContent);
      }
      console.log("================================");
    }
  });
  
  document.body.appendChild(consoleLogButton);
  
  return debugDisplay;
}

// Add to GameEngine.js - Function to handle debug messages from workers
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