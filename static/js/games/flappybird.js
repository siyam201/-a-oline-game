// Flappy Bird Game Implementation with Phaser 3

class FlappyBirdGame {
    constructor(containerId, gameId) {
        this.containerId = containerId;
        this.gameId = gameId;
        this.score = 0;
        this.gameOver = false;
        this.game = null;
        this.jumpKey = null;
        this.pipes = null;
        this.timer = null;
        this.bird = null;
        this.scoreText = null;
        this.gameOverText = null;
        this.restartText = null;
        this.background = null;
        this.ground = null;
        this.gap = 120; // Gap between pipes
        this.pipeSpeed = -200;
    }

    init() {
        // Configuration for the Phaser game
        const config = {
            type: Phaser.AUTO,
            width: 400,
            height: 600,
            parent: this.containerId,
            physics: {
                default: 'arcade',
                arcade: {
                    gravity: { y: 1200 },
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
        // Local references to the scene
        const scene = this.game.scene.scenes[0];

        // Load sprite images
        scene.load.image('sky', 'https://labs.phaser.io/assets/skies/sky1.png');
        scene.load.image('bird', 'https://labs.phaser.io/assets/sprites/phaser-dude.png');
        scene.load.image('pipe', 'https://labs.phaser.io/assets/sprites/pipe.png');
    }

    create() {
        // Local references to the scene
        const scene = this.game.scene.scenes[0];
        
        // Initialize game variables
        this.score = 0;
        this.gameOver = false;
        this.pipesScoredIds = new Set();
        
        // Create the background
        this.background = scene.add.image(0, 0, 'sky').setOrigin(0, 0);
        this.background.displayWidth = scene.sys.game.config.width;
        this.background.displayHeight = scene.sys.game.config.height;
        
        // Create a ground sprite (invisible hitbox)
        this.ground = scene.physics.add.staticGroup();
        const groundRect = scene.add.rectangle(
            scene.sys.game.config.width / 2, 
            scene.sys.game.config.height - 20, 
            scene.sys.game.config.width, 
            40, 
            0x654321
        ).setOrigin(0.5, 0.5);
        this.ground.add(groundRect);
        
        // Create the bird
        this.bird = scene.physics.add.sprite(100, 300, 'bird');
        this.bird.setScale(0.7);
        this.bird.setBounce(0.1);
        this.bird.setCollideWorldBounds(true);
        this.bird.body.setSize(this.bird.width * 0.8, this.bird.height * 0.8);
        
        // Create the pipes group
        this.pipes = scene.physics.add.group();
        
        // Set up collision detection
        scene.physics.add.collider(this.bird, this.ground, this.hitObstacle, null, this);
        scene.physics.add.collider(this.bird, this.pipes, this.hitObstacle, null, this);
        
        // Set up controls
        this.jumpKey = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
        scene.input.on('pointerdown', this.jump, this);
        
        // Set up timer to create pipes
        this.timer = scene.time.addEvent({
            delay: 1500,
            callback: this.addRowOfPipes,
            callbackScope: this,
            loop: true
        });
        
        // Create score text
        this.scoreText = scene.add.text(16, 16, 'Score: 0', {
            fontSize: '24px',
            fontFamily: 'Arial',
            fill: '#ffffff',
            stroke: '#000000',
            strokeThickness: 3
        });
        
        // Create game over text (hidden initially)
        this.gameOverText = scene.add.text(scene.sys.game.config.width / 2, scene.sys.game.config.height / 2 - 50, 'GAME OVER', {
            fontSize: '48px',
            fontFamily: 'Arial',
            fill: '#ffffff',
            stroke: '#000000',
            strokeThickness: 5
        });
        this.gameOverText.setOrigin(0.5);
        this.gameOverText.visible = false;
        
        // Create restart text (hidden initially)
        this.restartText = scene.add.text(scene.sys.game.config.width / 2, scene.sys.game.config.height / 2 + 50, 'Press SPACE to restart', {
            fontSize: '24px',
            fontFamily: 'Arial',
            fill: '#ffffff',
            stroke: '#000000',
            strokeThickness: 3
        });
        this.restartText.setOrigin(0.5);
        this.restartText.visible = false;
    }

    update() {
        const scene = this.game.scene.scenes[0];
        
        if (this.gameOver) {
            // Check for space key to restart
            if (Phaser.Input.Keyboard.JustDown(this.jumpKey)) {
                this.resetGame();
            }
            return;
        }
        
        // Rotate the bird based on velocity
        if (this.bird.body.velocity.y < 0) {
            // Bird is moving up - rotate upward
            this.bird.angle = Math.max(-30, this.bird.angle - 5);
        } else {
            // Bird is moving down - rotate downward
            this.bird.angle = Math.min(90, this.bird.angle + 2);
        }
        
        // Check for jump input
        if (Phaser.Input.Keyboard.JustDown(this.jumpKey)) {
            this.jump();
        }
        
        // Handle pipe scoring
        this.pipes.getChildren().forEach(pipe => {
            // If pipe has passed the bird and hasn't been scored yet
            if (pipe.x < this.bird.x && !this.pipesScoredIds.has(pipe.pipeId) && pipe.y < 0) { // Only top pipes trigger score
                this.pipesScoredIds.add(pipe.pipeId);
                this.increaseScore();
            }
        });
    }

    jump() {
        if (this.gameOver) return;
        
        // Apply velocity to make the bird jump
        this.bird.setVelocityY(-400);
        
        // Reset the rotation
        this.bird.angle = -30;
    }

    addRowOfPipes() {
        if (this.gameOver) return;
        
        const scene = this.game.scene.scenes[0];
        
        // Generate random gap position
        const hole = Math.floor(Math.random() * 5) + 2; // Position between 2-6
        const pipeHeight = 600 / 8; // Height of each pipe segment
        const uniqueId = Date.now().toString(); // Unique ID for this pair of pipes
        
        // Add pipes
        for (let i = 0; i < 8; i++) {
            if (i !== hole && i !== hole + 1) { // Create gap
                const x = scene.sys.game.config.width;
                const y = i * pipeHeight + pipeHeight / 2;
                
                const pipe = this.pipes.create(x, y, 'pipe');
                pipe.body.allowGravity = false;
                pipe.setVelocityX(this.pipeSpeed);
                pipe.setImmovable(true);
                
                // Tag the pipe with an ID and whether it's top or bottom
                pipe.pipeId = uniqueId;
                pipe.isTop = (i < hole);
                
                // Resize the pipe
                pipe.displayWidth = 50;
                pipe.displayHeight = pipeHeight;
                
                // Set up automatic cleanup
                pipe.checkWorldBounds = true;
                pipe.outOfBoundsKill = true;
            }
        }
    }

    increaseScore() {
        this.score++;
        this.scoreText.setText('Score: ' + this.score);
    }

    hitObstacle() {
        const scene = this.game.scene.scenes[0];
        
        if (this.gameOver) return;
        
        // Stop the game
        this.gameOver = true;
        
        // Stop creating new pipes
        scene.time.removeEvent(this.timer);
        
        // Stop all pipes
        this.pipes.setVelocityX(0);
        
        // Stop the bird
        this.bird.setVelocityY(0);
        this.bird.body.allowGravity = false;
        
        // Show game over text
        this.gameOverText.visible = true;
        this.restartText.visible = true;
        
        // Submit score if logged in
        if (window.submitScore) {
            window.submitScore(this.gameId, this.score);
        }
    }

    resetGame() {
        const scene = this.game.scene.scenes[0];
        
        // Reset game state
        this.gameOver = false;
        this.score = 0;
        this.pipesScoredIds = new Set();
        
        // Reset score text
        this.scoreText.setText('Score: 0');
        
        // Hide game over text
        this.gameOverText.visible = false;
        this.restartText.visible = false;
        
        // Remove all pipes
        this.pipes.clear(true, true);
        
        // Reset bird position and physics
        this.bird.setPosition(100, 300);
        this.bird.setVelocity(0, 0);
        this.bird.angle = 0;
        this.bird.body.allowGravity = true;
        
        // Restart pipe creation
        this.timer = scene.time.addEvent({
            delay: 1500,
            callback: this.addRowOfPipes,
            callbackScope: this,
            loop: true
        });
    }
}

// Initialize flappy bird game when loaded
function initFlappyBirdGame(containerId, gameId) {
    const game = new FlappyBirdGame(containerId, gameId);
    game.init();
}