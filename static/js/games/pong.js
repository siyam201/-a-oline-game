// Pong Game Implementation with Phaser 3

class PongGame {
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
            width: 800,
            height: 400,
            parent: this.containerId,
            backgroundColor: '#000000',
            physics: {
                default: 'arcade',
                arcade: {
                    gravity: { y: 0 },
                    debug: false
                }
            },
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
        this.computerScore = 0;
        this.gameOver = false;
        this.difficulty = 0.6; // Computer paddle difficulty (0-1)
        
        // Create paddles and ball
        const scene = this.game.scene.scenes[0];
        
        // Create player paddle
        this.playerPaddle = scene.physics.add.sprite(50, 200, null);
        this.playerPaddle.setDisplaySize(15, 100);
        this.playerPaddle.setImmovable(true);
        this.playerPaddle.body.setAllowGravity(false);
        
        // Create computer paddle
        this.computerPaddle = scene.physics.add.sprite(750, 200, null);
        this.computerPaddle.setDisplaySize(15, 100);
        this.computerPaddle.setImmovable(true);
        this.computerPaddle.body.setAllowGravity(false);
        
        // Create ball
        this.ball = scene.physics.add.sprite(400, 200, null);
        this.ball.setDisplaySize(15, 15);
        this.ball.setCollideWorldBounds(true);
        this.ball.setBounce(1);
        
        // Initialize ball velocity
        this.resetBall();
        
        // Create center line
        this.centerLine = scene.add.graphics();
        this.drawCenterLine();
        
        // Set up collisions
        scene.physics.add.collider(this.ball, this.playerPaddle, this.hitPaddle, null, this);
        scene.physics.add.collider(this.ball, this.computerPaddle, this.hitPaddle, null, this);
        
        // Setup input
        this.cursors = scene.input.keyboard.createCursorKeys();
        
        // Create score text
        this.playerScoreText = scene.add.text(200, 50, '0', {
            fontSize: '64px',
            fill: '#ffffff'
        });
        
        this.computerScoreText = scene.add.text(600, 50, '0', {
            fontSize: '64px',
            fill: '#ffffff'
        });
        
        // Create game over text (hidden initially)
        this.gameOverText = scene.add.text(400, 200, 'GAME OVER\nPress SPACEBAR to restart', {
            fontSize: '32px',
            fill: '#ffffff',
            align: 'center'
        });
        this.gameOverText.setOrigin(0.5);
        this.gameOverText.visible = false;
    }

    update() {
        // Handle input and movement
        this.handleInput();
        
        // If game over, check for restart
        if (this.gameOver) {
            if (this.cursors.space.isDown) {
                this.resetGame();
            }
            return;
        }
        
        // Move computer paddle
        this.moveComputerPaddle();
        
        // Check if ball is out of bounds
        this.checkBallBounds();
        
        // Redraw center line
        this.drawCenterLine();
    }

    handleInput() {
        // Move player paddle based on arrow keys
        if (this.cursors.up.isDown) {
            this.playerPaddle.y -= 10;
        } else if (this.cursors.down.isDown) {
            this.playerPaddle.y += 10;
        }
        
        // Constrain paddle to screen
        this.playerPaddle.y = Phaser.Math.Clamp(
            this.playerPaddle.y,
            this.playerPaddle.displayHeight / 2,
            this.game.config.height - this.playerPaddle.displayHeight / 2
        );
    }

    moveComputerPaddle() {
        // Computer AI to follow the ball
        const paddleCenter = this.computerPaddle.y;
        const ballY = this.ball.y;
        
        // Only move if the ball is moving toward the computer
        if (this.ball.body.velocity.x > 0) {
            // Add some prediction and difficulty factor
            let targetY = ballY;
            
            // Add some randomness based on difficulty (lower difficulty = more mistakes)
            if (Math.random() > this.difficulty) {
                targetY += (Math.random() - 0.5) * 100;
            }
            
            // Move toward the target
            if (paddleCenter < targetY - 10) {
                this.computerPaddle.y += 6;
            } else if (paddleCenter > targetY + 10) {
                this.computerPaddle.y -= 6;
            }
            
            // Constrain paddle to screen
            this.computerPaddle.y = Phaser.Math.Clamp(
                this.computerPaddle.y,
                this.computerPaddle.displayHeight / 2,
                this.game.config.height - this.computerPaddle.displayHeight / 2
            );
        }
    }

    hitPaddle(ball, paddle) {
        // Increase ball velocity slightly on each hit
        let velocityX = this.ball.body.velocity.x;
        velocityX *= 1.05;
        
        // Cap the maximum speed
        velocityX = Phaser.Math.Clamp(velocityX, -800, 800);
        
        // Calculate new angle based on where the ball hit the paddle
        const diff = ball.y - paddle.y;
        const normalizedDiff = diff / (paddle.displayHeight / 2);
        const angle = normalizedDiff * Math.PI / 4; // 45 degrees max angle
        
        const velocityY = 400 * Math.sin(angle);
        
        // Set new velocity
        ball.body.setVelocity(velocityX, velocityY);
        
        // Add a sound effect
        // this.sound.play('hit'); // Uncomment if you add sound
    }

    checkBallBounds() {
        // Check if ball goes past paddles
        if (this.ball.x < 0) {
            // Computer scores
            this.computerScore++;
            this.computerScoreText.setText(this.computerScore.toString());
            
            if (this.computerScore >= 5) {
                this.endGame(false);
            } else {
                this.resetBall();
            }
        } else if (this.ball.x > this.game.config.width) {
            // Player scores
            this.score++;
            this.playerScoreText.setText(this.score.toString());
            
            if (this.score >= 5) {
                this.endGame(true);
            } else {
                this.resetBall();
            }
        }
    }

    resetBall() {
        // Reset ball position
        this.ball.setPosition(400, 200);
        
        // Calculate random angle between -45 and 45 degrees
        const angle = Phaser.Math.Between(-45, 45) * Math.PI / 180;
        
        // Set initial velocity (random direction left/right)
        const direction = Math.random() < 0.5 ? -1 : 1;
        const speed = 300;
        
        const velocityX = direction * speed * Math.cos(angle);
        const velocityY = speed * Math.sin(angle);
        
        this.ball.body.setVelocity(velocityX, velocityY);
    }

    drawCenterLine() {
        // Draw dotted center line
        this.centerLine.clear();
        this.centerLine.lineStyle(5, 0xFFFFFF, 0.5);
        
        for (let y = 0; y < this.game.config.height; y += 25) {
            this.centerLine.beginPath();
            this.centerLine.moveTo(this.game.config.width / 2, y);
            this.centerLine.lineTo(this.game.config.width / 2, y + 15);
            this.centerLine.strokePath();
        }
    }

    endGame(playerWon) {
        this.gameOver = true;
        
        // Set game over text based on who won
        if (playerWon) {
            this.gameOverText.setText('YOU WIN!\nPress SPACEBAR to restart');
        } else {
            this.gameOverText.setText('COMPUTER WINS!\nPress SPACEBAR to restart');
        }
        
        this.gameOverText.visible = true;
        this.ball.body.setVelocity(0, 0);
        
        // Submit score if logged in
        if (window.submitScore) {
            window.submitScore(this.gameId, this.score * 10);
        }
    }

    resetGame() {
        // Reset game state
        this.score = 0;
        this.computerScore = 0;
        this.gameOver = false;
        
        // Update UI
        this.playerScoreText.setText('0');
        this.computerScoreText.setText('0');
        this.gameOverText.visible = false;
        
        // Reset ball
        this.resetBall();
    }
}

// Initialize pong game when loaded
function initPongGame(containerId, gameId) {
    const game = new PongGame(containerId, gameId);
    game.init();
}
