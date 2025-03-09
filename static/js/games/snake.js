// Snake Game Implementation with Phaser 3

class SnakeGame {
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
            width: 640,
            height: 480,
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
        this.gameOver = false;
        
        // Grid size and snake speed
        this.gridSize = 16;
        this.snakeSpeed = 8; // Cells per second
        
        // Create the snake
        this.snake = {
            body: [{x: 10, y: 10}], // Start with a single segment
            direction: {x: 1, y: 0}, // Start moving right
            nextDirection: {x: 1, y: 0}
        };
        
        // Create food
        this.food = {
            x: 5,
            y: 5
        };
        this.randomizeFood();
        
        // Initialize input handling
        this.cursors = this.game.scene.scenes[0].input.keyboard.createCursorKeys();
        
        // Create score text
        this.scoreText = this.game.scene.scenes[0].add.text(16, 16, 'Score: 0', {
            fontSize: '24px',
            fill: '#ffffff'
        });
        
        // Create game over text (hidden initially)
        this.gameOverText = this.game.scene.scenes[0].add.text(320, 240, 'GAME OVER\nPress SPACEBAR to restart', {
            fontSize: '32px',
            fill: '#ffffff',
            align: 'center'
        });
        this.gameOverText.setOrigin(0.5);
        this.gameOverText.visible = false;
        
        // Set up game timer
        this.lastMoveTime = 0;
    }

    update(time) {
        // Handle input
        this.handleInput();
        
        // If game over, check for restart
        if (this.gameOver) {
            if (this.cursors.space.isDown) {
                this.resetGame();
            }
            return;
        }
        
        // Move the snake at fixed intervals
        const moveInterval = 1000 / this.snakeSpeed;
        if (time - this.lastMoveTime >= moveInterval) {
            this.moveSnake();
            this.lastMoveTime = time;
        }
        
        // Draw everything
        this.draw();
    }

    handleInput() {
        // Change direction based on arrow keys
        if (this.cursors.left.isDown && this.snake.direction.x !== 1) {
            this.snake.nextDirection = {x: -1, y: 0};
        } else if (this.cursors.right.isDown && this.snake.direction.x !== -1) {
            this.snake.nextDirection = {x: 1, y: 0};
        } else if (this.cursors.up.isDown && this.snake.direction.y !== 1) {
            this.snake.nextDirection = {x: 0, y: -1};
        } else if (this.cursors.down.isDown && this.snake.direction.y !== -1) {
            this.snake.nextDirection = {x: 0, y: 1};
        }
    }

    moveSnake() {
        // Update direction
        this.snake.direction = this.snake.nextDirection;
        
        // Calculate new head position
        const head = this.snake.body[0];
        const newHead = {
            x: head.x + this.snake.direction.x,
            y: head.y + this.snake.direction.y
        };
        
        // Check for collision with walls
        if (newHead.x < 0 || newHead.x >= this.game.config.width / this.gridSize ||
            newHead.y < 0 || newHead.y >= this.game.config.height / this.gridSize) {
            this.endGame();
            return;
        }
        
        // Check for collision with self
        for (let i = 0; i < this.snake.body.length; i++) {
            const segment = this.snake.body[i];
            if (newHead.x === segment.x && newHead.y === segment.y) {
                this.endGame();
                return;
            }
        }
        
        // Add new head to snake
        this.snake.body.unshift(newHead);
        
        // Check if snake ate food
        if (newHead.x === this.food.x && newHead.y === this.food.y) {
            // Increase score
            this.score += 10;
            this.scoreText.setText('Score: ' + this.score);
            
            // Generate new food
            this.randomizeFood();
            
            // Increase speed slightly
            this.snakeSpeed = Math.min(20, this.snakeSpeed + 0.2);
        } else {
            // Remove tail if no food was eaten
            this.snake.body.pop();
        }
    }

    randomizeFood() {
        // Generate random position for food
        let validPosition = false;
        
        while (!validPosition) {
            this.food.x = Math.floor(Math.random() * (this.game.config.width / this.gridSize));
            this.food.y = Math.floor(Math.random() * (this.game.config.height / this.gridSize));
            
            // Check that food isn't on snake
            validPosition = true;
            for (let i = 0; i < this.snake.body.length; i++) {
                const segment = this.snake.body[i];
                if (this.food.x === segment.x && this.food.y === segment.y) {
                    validPosition = false;
                    break;
                }
            }
        }
    }

    draw() {
        // Clear the canvas
        const graphics = this.game.scene.scenes[0].add.graphics();
        graphics.clear();
        
        // Draw food
        graphics.fillStyle(0xFF0000);
        graphics.fillRect(
            this.food.x * this.gridSize,
            this.food.y * this.gridSize,
            this.gridSize,
            this.gridSize
        );
        
        // Draw snake
        for (let i = 0; i < this.snake.body.length; i++) {
            const segment = this.snake.body[i];
            
            // Head is a different color
            if (i === 0) {
                graphics.fillStyle(0x00FF00);
            } else {
                graphics.fillStyle(0x00CC00);
            }
            
            graphics.fillRect(
                segment.x * this.gridSize,
                segment.y * this.gridSize,
                this.gridSize,
                this.gridSize
            );
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
        this.snakeSpeed = 8;
        this.gameOver = false;
        
        // Reset snake
        this.snake = {
            body: [{x: 10, y: 10}],
            direction: {x: 1, y: 0},
            nextDirection: {x: 1, y: 0}
        };
        
        // Reset food
        this.randomizeFood();
        
        // Update UI
        this.scoreText.setText('Score: 0');
        this.gameOverText.visible = false;
    }
}

// Initialize snake game when loaded
function initSnakeGame(containerId, gameId) {
    const game = new SnakeGame(containerId, gameId);
    game.init();
}
