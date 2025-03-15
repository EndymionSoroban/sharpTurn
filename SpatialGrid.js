// SpatialGrid.js - Efficient spatial partitioning for collision detection

class SpatialGrid {
    constructor(width, height, cellSize) {
        this.width = width;
        this.height = height;
        this.cellSize = cellSize;
        this.cols = Math.ceil(width / cellSize);
        this.rows = Math.ceil(height / cellSize);
        this.grid = {};
    }
    
    // Clear all cells
    clear() {
        this.grid = {};
    }
    
    // Get cell key from position
    getCellKey(x, y) {
        const col = Math.floor(x / this.cellSize);
        const row = Math.floor(y / this.cellSize);
        return `${col},${row}`;
    }
    
    // Get cell key from grid coordinates
    getCellKeyFromGrid(col, row) {
        return `${col},${row}`;
    }
    
    // Insert an item at a position
    insert(item, x, y) {
        const key = this.getCellKey(x, y);
        
        if (!this.grid[key]) {
            this.grid[key] = [];
        }
        
        this.grid[key].push(item);
        return key; // Return the key for reference
    }
    
    // Query items near a position
    query(x, y, radius) {
        const startCol = Math.max(0, Math.floor((x - radius) / this.cellSize));
        const endCol = Math.min(this.cols - 1, Math.floor((x + radius) / this.cellSize));
        const startRow = Math.max(0, Math.floor((y - radius) / this.cellSize));
        const endRow = Math.min(this.rows - 1, Math.floor((y + radius) / this.cellSize));
        
        const items = [];
        
        for (let col = startCol; col <= endCol; col++) {
            for (let row = startRow; row <= endRow; row++) {
                const key = this.getCellKeyFromGrid(col, row);
                const cell = this.grid[key];
                
                if (cell) {
                    // Fast way to append all items
                    Array.prototype.push.apply(items, cell);
                }
            }
        }
        
        return items;
    }
    
    // Get items from a specific cell
    getCell(x, y) {
        const key = this.getCellKey(x, y);
        return this.grid[key] || [];
    }
    
    // Get items from a cell and its neighbors
    getCellAndNeighbors(x, y) {
        const col = Math.floor(x / this.cellSize);
        const row = Math.floor(y / this.cellSize);
        
        const items = [];
        
        // Check 3x3 grid of cells around the target
        for (let c = col - 1; c <= col + 1; c++) {
            for (let r = row - 1; r <= row + 1; r++) {
                if (c >= 0 && c < this.cols && r >= 0 && r < this.rows) {
                    const key = this.getCellKeyFromGrid(c, r);
                    const cell = this.grid[key];
                    
                    if (cell) {
                        // Fast way to append all items
                        Array.prototype.push.apply(items, cell);
                    }
                }
            }
        }
        
        return items;
    }
}