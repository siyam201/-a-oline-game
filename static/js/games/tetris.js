// Tetris Game Implementation with Phaser 3

class TetrisGame {
    constructor(containerId, gameId) {
        this.containerId = containerId;
        this.gameId = gameId;
        this.score = 0;
        this.gameOver = false;
        this.game = null;
    }

    init() {
        // Configuration for the Phaser game
        const config = {
            type: Phaser.AUTO,
            width: 320,
            height: 640,
            parent: this.containerId,
            backgroundColor: '#000000',
            scene: {
                preload: this.preload.bind(this),
                create: this.create.bind(this),
                update: this.update.bind(this)
            }
        };

        // Create the Phaser game instance
        this.game = new Phaser.Game(config);

        // Dispatch event when game is loaded
        window.dispatchEvent(new Event('gameLoaded'));
    }

    preload() {
        // No assets to preload for this game
    }

    create() {
        // Initialize game variables
        this.score = 0;
        this.level = 1;
        this.linesCleared = 0;
        this.gameOver = false;
        
        // Grid size
        this.gridSize = 32;
        
        // Board dimensions (10x20 standard tetris board)
        this.boardWidth = 10;
        this.boardHeight = 20;
        
        // Create game board (2D array filled with zeros)
        this.board = Array(this.boardHeight).fill().map(() => Array(this.boardWidth).fill(0));
        
        // Set up blocks
        this.setupBlocks();
        
        // Initialize input handling
        this.cursors = this.game.scene.scenes[0].input.keyboard.createCursorKeys();
        this.spaceKey = this.game.scene.scenes[0].input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
        
        // Create text displays
        this.scoreText = this.game.scene.scenes[0].add.text(10, 10, 'Score: 0', {
            fontSize: '18px',
            fill: '#ffffff'
        });
        
        this.levelText = this.game.scene.scenes[0].add.text(10, 35, 'Level: 1', {
            fontSize: '18px',
            fill: '#ffffff'
        });
        
        this.gameOverText = this.game.scene.scenes[0].add.text(
            this.game.config.width / 2, 
            this.game.config.height / 2, 
            'GAME OVER\nPress SPACEBAR to restart', 
            {
                fontSize: '24px',
                fill: '#ffffff',
                align: 'center'
            }
        );
        this.gameOverText.setOrigin(0.5);
        this.gameOverText.visible = false;
        
        // Drop timing
        this.lastMoveTime = 0;
        this.moveInterval = 1000; // Start with 1 second interval
        
        // Start with a new piece
        this.spawnNewPiece();
    }

    setupBlocks() {
        // Define the shapes of the tetrominos (I, J, L, O, S, T, Z)
        this.tetrominos = [
            { // I
                shape: [
                    [1, 1, 1, 1]
                ],
                color: 0x00ffff // Cyan
            },
            { // J
                shape: [
                    [1, 0, 0],
                    [1, 1, 1]
                ],
                color: 0x0000ff // Blue
            },
            { // L
                shape: [
                    [0, 0, 1],
                    [1, 1, 1]
                ],
                color: 0xff7f00 // Orange
            },
            { // O
                shape: [
                    [1, 1],
                    [1, 1]
                ],
                color: 0xffff00 // Yellow
            },
            { // S
                shape: [
                    [0, 1, 1],
                    [1, 1, 0]
                ],
                color: 0x00ff00 // Green
            },
            { // T
                shape: [
                    [0, 1, 0],
                    [1, 1, 1]
                ],
                color: 0x800080 // Purple
            },
            { // Z
                shape: [
                    [1, 1, 0],
                    [0, 1, 1]
                ],
                color: 0xff0000 // Red
            }
        ];
    }

    spawnNewPiece() {
        // Choose a random piece
        this.currentPiece = Phaser.Utils.Array.GetRandom(this.tetrominos);
        
        // Set initial position (centered at the top)
        this.pieceX = Math.floor(this.boardWidth / 2) - Math.floor(this.currentPiece.shape[0].length / 2);
        this.pieceY = 0;
        
        // Check if the new piece can be placed
        if (!this.isValidMove(this.pieceX, this.pieceY, this.currentPiece.shape)) {
            this.endGame();
        }
    }

    update(time) {
        // Handle input
        this.handleInput(time);
        
        // If game over, check for restart
        if (this.gameOver) {
            if (Phaser.Input.Keyboard.JustDown(this.spaceKey)) {
                this.resetGame();
            }
            return;
        }
        
        // Drop piece at interval
        if (time - this.lastMoveTime >= this.moveInterval) {
            this.moveDown();
            this.lastMoveTime = time;
        }
        
        // Draw the board
        this.drawBoard();
    }

    handleInput(time) {
        // Only process input if not game over
        if (this.gameOver) return;
        
        // Left/Right movement
        if (Phaser.Input.Keyboard.JustDown(this.cursors.left)) {
            this.moveHorizontal(-1);
        } else if (Phaser.Input.Keyboard.JustDown(this.cursors.right)) {
            this.moveHorizontal(1);
        }
        
        // Down - accelerate drop
        if (this.cursors.down.isDown) {
            if (time - this.lastMoveTime >= this.moveInterval / 10) {
                this.moveDown();
                this.lastMoveTime = time;
                this.score += 1; // Small bonus for manually dropping
                this.updateScore();
            }
        }
        
        // Up - rotate piece
        if (Phaser.Input.Keyboard.JustDown(this.cursors.up)) {
            this.rotatePiece();
        }
        
        // Space - hard drop
        if (Phaser.Input.Keyboard.JustDown(this.spaceKey)) {
            this.hardDrop();
        }
    }

    moveHorizontal(direction) {
        const newX = this.pieceX + direction;
        
        if (this.isValidMove(newX, this.pieceY, this.currentPiece.shape)) {
            this.pieceX = newX;
        }
    }

    moveDown() {
        const newY = this.pieceY + 1;
        
        if (this.isValidMove(this.pieceX, newY, this.currentPiece.shape)) {
            this.pieceY = newY;
        } else {
            // Lock the piece in place
            this.lockPiece();
            
            // Check for completed lines
            this.checkLines();
            
            // Spawn new piece
            this.spawnNewPiece();
        }
    }

    hardDrop() {
        // Move the piece down until it can't go further
        let newY = this.pieceY;
        
        while (this.isValidMove(this.pieceX, newY + 1, this.currentPiece.shape)) {
            newY++;
            this.score += 2; // Bonus for hard drop
        }
        
        if (newY > this.pieceY) {
            this.pieceY = newY;
            this.updateScore();
            
            // Lock the piece, check lines, and spawn a new piece
            this.lockPiece();
            this.checkLines();
            this.spawnNewPiece();
        }
    }

    rotatePiece() {
        // Create a new rotated matrix
        const rotated = [];
        const shape = this.currentPiece.shape;
        
        for (let col = 0; col < shape[0].length; col++) {
            const newRow = [];
            for (let row = shape.length - 1; row >= 0; row--) {
                newRow.push(shape[row][col]);
            }
            rotated.push(newRow);
        }
        
        // Check if the rotation is valid
        if (this.isValidMove(this.pieceX, this.pieceY, rotated)) {
            this.currentPiece.shape = rotated;
        } else {
            // Try wall kicks (adjust position if rotation causes collision)
            const kicks = [-1, 1, -2, 2]; // Try these offsets
            
            for (const kick of kicks) {
                if (this.isValidMove(this.pieceX + kick, this.pieceY, rotated)) {
                    this.pieceX += kick;
                    this.currentPiece.shape = rotated;
                    break;
                }
            }
        }
    }

    isValidMove(x, y, shape) {
        // Check each cell of the piece
        for (let row = 0; row < shape.length; row++) {
            for (let col = 0; col < shape[row].length; col++) {
                // Skip empty cells
                if (shape[row][col] === 0) continue;
                
                const boardX = x + col;
                const boardY = y + row;
                
                // Check boundaries
                if (boardX < 0 || boardX >= this.boardWidth || boardY >= this.boardHeight) {
                    return false;
                }
                
                // Check if cell is already filled on the board
                if (boardY >= 0 && this.board[boardY][boardX] !== 0) {
                    return false;
                }
            }
        }
        
        return true;
    }

    lockPiece() {
        // Add the piece to the board
        for (let row = 0; row < this.currentPiece.shape.length; row++) {
            for (let col = 0; col < this.currentPiece.shape[row].length; col++) {
                if (this.currentPiece.shape[row][col] !== 0) {
                    const boardY = this.pieceY + row;
                    const boardX = this.pieceX + col;
                    
                    // Only add to board if within bounds
                    if (boardY >= 0 && boardY < this.boardHeight && boardX >= 0 && boardX < this.boardWidth) {
                        this.board[boardY][boardX] = this.currentPiece.color;
                    }
                }
            }
        }
    }

    checkLines() {
        let linesCleared = 0;
        
        // Check each row from bottom to top
        for (let row = this.boardHeight - 1; row >= 0; row--) {
            // Check if row is completely filled
            if (this.board[row].every(cell => cell !== 0)) {
                // Remove the line and add an empty line at the top
                this.board.splice(row, 1);
                this.board.unshift(Array(this.boardWidth).fill(0));
                
                linesCleared++;
                row++; // Re-check this index as rows have shifted down
            }
        }
        
        // Update score based on lines cleared
        if (linesCleared > 0) {
            // Classic Tetris scoring
            const linePoints = [0, 40, 100, 300, 1200];
            this.score += linePoints[linesCleared] * this.level;
            
            // Update total lines cleared
            this.linesCleared += linesCleared;
            
            // Update level every 10 lines
            const newLevel = Math.floor(this.linesCleared / 10) + 1;
            if (newLevel > this.level) {
                this.level = newLevel;
                // Speed up as level increases
                this.moveInterval = Math.max(100, 1000 - (this.level - 1) * 100);
                this.levelText.setText('Level: ' + this.level);
            }
            
            this.updateScore();
        }
    }

    updateScore() {
        this.scoreText.setText('Score: ' + this.score);
    }

    drawBoard() {
        const graphics = this.game.scene.scenes[0].add.graphics();
        graphics.clear();
        
        // Draw the board
        for (let row = 0; row < this.boardHeight; row++) {
            for (let col = 0; col < this.boardWidth; col++) {
                const cellValue = this.board[row][col];
                
                if (cellValue !== 0) {
                    // Draw filled cell
                    graphics.fillStyle(cellValue);
                    graphics.fillRect(
                        col * this.gridSize,
                        row * this.gridSize,
                        this.gridSize - 1,
                        this.gridSize - 1
                    );
                }
            }
        }
        
        // Draw the active piece
        if (!this.gameOver) {
            graphics.fillStyle(this.currentPiece.color);
            
            for (let row = 0; row < this.currentPiece.shape.length; row++) {
                for (let col = 0; col < this.currentPiece.shape[row].length; col++) {
                    if (this.currentPiece.shape[row][col] !== 0) {
                        graphics.fillRect(
                            (this.pieceX + col) * this.gridSize,
                            (this.pieceY + row) * this.gridSize,
                            this.gridSize - 1,
                            this.gridSize - 1
                        );
                    }
                }
            }
        }
        
        // Draw grid lines
        graphics.lineStyle(1, 0x333333);
        
        // Vertical lines
        for (let col = 0; col <= this.boardWidth; col++) {
            graphics.beginPath();
            graphics.moveTo(col * this.gridSize, 0);
            graphics.lineTo(col * this.gridSize, this.boardHeight * this.gridSize);
            graphics.strokePath();
        }
        
        // Horizontal lines
        for (let row = 0; row <= this.boardHeight; row++) {
            graphics.beginPath();
            graphics.moveTo(0, row * this.gridSize);
            graphics.lineTo(this.boardWidth * this.gridSize, row * this.gridSize);
            graphics.strokePath();
        }
    }

    endGame() {
        this.gameOver = true;
        this.gameOverText.visible = true;
        
        // Submit score if logged in
        if (window.submitScore) {
            window.submitScore(this.gameId, this.score);
        }
    }

    resetGame() {
        // Reset game state
        this.score = 0;
        this.level = 1;
        this.linesCleared = 0;
        this.gameOver = false;
        this.moveInterval = 1000;
        
        // Reset board
        this.board = Array(this.boardHeight).fill().map(() => Array(this.boardWidth).fill(0));
        
        // Reset UI
        this.scoreText.setText('Score: 0');
        this.levelText.setText('Level: 1');
        this.gameOverText.visible = false;
        
        // Start with new piece
        this.spawnNewPiece();
    }
}

// Initialize tetris game when loaded
function initTetrisGame(containerId, gameId) {
    const game = new TetrisGame(containerId, gameId);
    game.init();
}