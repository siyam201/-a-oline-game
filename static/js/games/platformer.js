// Platformer Game Implementation with Phaser 3

class PlatformerGame {
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
            height: 500,
            parent: this.containerId,
            backgroundColor: '#87CEEB', // Sky blue
            physics: {
                default: 'arcade',
                arcade: {
                    gravity: { y: 900 },
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
        // Initialize game assets with vector shapes
        this.createAssets();
    }

    createAssets() {
        // Create a player texture (blue square)
        const playerGraphics = this.game.scene.scenes[0].make.graphics();
        playerGraphics.fillStyle(0x3498db); // Blue
        playerGraphics.fillRect(0, 0, 32, 32);
        playerGraphics.generateTexture('player', 32, 32);
        
        // Create a platform texture (green rectangle)
        const platformGraphics = this.game.scene.scenes[0].make.graphics();
        platformGraphics.fillStyle(0x2ecc71); // Green
        platformGraphics.fillRect(0, 0, 100, 20);
        platformGraphics.generateTexture('platform', 100, 20);
        
        // Create a coin texture (yellow circle)
        const coinGraphics = this.game.scene.scenes[0].make.graphics();
        coinGraphics.fillStyle(0xf1c40f); // Yellow
        coinGraphics.fillCircle(10, 10, 10);
        coinGraphics.generateTexture('coin', 20, 20);
        
        // Create an enemy texture (red triangle)
        const enemyGraphics = this.game.scene.scenes[0].make.graphics();
        enemyGraphics.fillStyle(0xe74c3c); // Red
        enemyGraphics.beginPath();
        enemyGraphics.moveTo(0, 20);
        enemyGraphics.lineTo(20, 0);
        enemyGraphics.lineTo(40, 20);
        enemyGraphics.closePath();
        enemyGraphics.fill();
        enemyGraphics.generateTexture('enemy', 40, 20);
        
        // Create a flag texture (checkered flag)
        const flagGraphics = this.game.scene.scenes[0].make.graphics();
        flagGraphics.fillStyle(0x000000);
        flagGraphics.fillRect(0, 0, 10, 50);
        
        // Create checkered pattern
        flagGraphics.fillStyle(0xffffff);
        for (let y = 0; y < 5; y++) {
            for (let x = 0; x < 4; x++) {
                if ((x + y) % 2 === 0) {
                    flagGraphics.fillRect(10 + x * 10, y * 10, 10, 10);
                }
            }
        }
        
        flagGraphics.fillStyle(0x000000);
        for (let y = 0; y < 5; y++) {
            for (let x = 0; x < 4; x++) {
                if ((x + y) % 2 === 1) {
                    flagGraphics.fillRect(10 + x * 10, y * 10, 10, 10);
                }
            }
        }
        
        flagGraphics.generateTexture('flag', 50, 50);
    }

    create() {
        // Initialize game variables
        this.score = 0;
        this.gameOver = false;
        this.coins = 0;
        this.totalCoins = 0;
        this.gameWon = false;
        
        const scene = this.game.scene.scenes[0];
        
        // Create platforms
        this.platforms = scene.physics.add.staticGroup();
        
        // Create ground
        for (let x = 0; x < this.game.config.width; x += 100) {
            this.platforms.create(x, this.game.config.height - 20, 'platform');
        }
        
        // Create platforms
        this.platforms.create(300, 400, 'platform');
        this.platforms.create(500, 350, 'platform');
        this.platforms.create(200, 300, 'platform');
        this.platforms.create(400, 250, 'platform');
        this.platforms.create(600, 200, 'platform');
        this.platforms.create(100, 150, 'platform');
        this.platforms.create(700, 150, 'platform');
        
        // Create player
        this.player = scene.physics.add.sprite(100, 300, 'player');
        this.player.setBounce(0.2);
        this.player.setCollideWorldBounds(true);
        
        // Create coins
        this.coinsGroup = scene.physics.add.group();
        
        this.createCoins(300, 370, 3);
        this.createCoins(500, 320, 3);
        this.createCoins(200, 270, 3);
        this.createCoins(400, 220, 3);
        this.createCoins(600, 170, 3);
        this.createCoins(100, 120, 3);
        
        // Create enemies
        this.enemies = scene.physics.add.group();
        
        this.createEnemy(350, 400 - 20 - 10, 200, 100);
        this.createEnemy(300, 300 - 20 - 10, 150, 100);
        this.createEnemy(450, 250 - 20 - 10, 150, 100);
        
        // Create finish flag
        this.flag = scene.physics.add.sprite(700, 100, 'flag');
        this.flag.setImmovable(true);
        this.flag.body.setAllowGravity(false);
        
        // Setup collisions
        scene.physics.add.collider(this.player, this.platforms);
        scene.physics.add.collider(this.coinsGroup, this.platforms);
        scene.physics.add.collider(this.enemies, this.platforms);
        scene.physics.add.collider(this.flag, this.platforms);
        
        // Set up coin collection
        scene.physics.add.overlap(this.player, this.coinsGroup, this.collectCoin, null, this);
        
        // Set up enemy collision
        scene.physics.add.overlap(this.player, this.enemies, this.hitEnemy, null, this);
        
        // Set up flag collision
        scene.physics.add.overlap(this.player, this.flag, this.reachFlag, null, this);
        
        // Set up input
        this.cursors = scene.input.keyboard.createCursorKeys();
        
        // Create score text
        this.scoreText = scene.add.text(16, 16, 'Score: 0', {
            fontSize: '24px',
            fill: '#000000'
        });
        
        // Create coins text
        this.coinsText = scene.add.text(16, 50, 'Coins: 0/' + this.totalCoins, {
            fontSize: '24px',
            fill: '#000000'
        });
        
        // Create game over text
        this.gameOverText = scene.add.text(400, 250, '', {
            fontSize: '32px',
            fill: '#000000',
            align: 'center'
        });
        this.gameOverText.setOrigin(0.5);
        this.gameOverText.visible = false;
    }

    createCoins(x, y, count) {
        for (let i = 0; i < count; i++) {
            const coin = this.coinsGroup.create(x + i * 30, y, 'coin');
            coin.setBounce(0.2);
            coin.body.setAllowGravity(false);
            this.totalCoins++;
        }
    }

    createEnemy(x, y, distance, speed) {
        const enemy = this.enemies.create(x, y, 'enemy');
        
        // Set up enemy properties
        enemy.setImmovable(true);
        enemy.setVelocityX(speed);
        enemy.setCollideWorldBounds(true);
        
        // Store initial position and movement parameters
        enemy.startX = x;
        enemy.endX = x + distance;
        enemy.speed = speed;
        enemy.movingRight = true;
    }

    update() {
        // Update enemy movements
        this.updateEnemies();
        
        // If game is over, check for restart
        if (this.gameOver) {
            if (this.cursors.space.isDown) {
                this.resetGame();
            }
            return;
        }
        
        // Handle player movement
        this.handlePlayerMovement();
    }

    updateEnemies() {
        this.enemies.children.iterate((enemy) => {
            if (enemy.movingRight && enemy.x >= enemy.endX) {
                enemy.movingRight = false;
                enemy.setVelocityX(-enemy.speed);
            } else if (!enemy.movingRight && enemy.x <= enemy.startX) {
                enemy.movingRight = true;
                enemy.setVelocityX(enemy.speed);
            }
        });
    }

    handlePlayerMovement() {
        // Handle horizontal movement
        if (this.cursors.left.isDown) {
            this.player.setVelocityX(-200);
        } else if (this.cursors.right.isDown) {
            this.player.setVelocityX(200);
        } else {
            this.player.setVelocityX(0);
        }
        
        // Handle jumping
        if (this.cursors.up.isDown && this.player.body.touching.down) {
            this.player.setVelocityY(-500);
        }
    }

    collectCoin(player, coin) {
        // Remove coin and update score
        coin.disableBody(true, true);
        
        this.score += 10;
        this.coins++;
        
        this.scoreText.setText('Score: ' + this.score);
        this.coinsText.setText('Coins: ' + this.coins + '/' + this.totalCoins);
    }

    hitEnemy(player, enemy) {
        // Check if player is jumping on top of the enemy
        if (player.body.velocity.y > 0 && player.y < enemy.y - 20) {
            enemy.disableBody(true, true);
            player.setVelocityY(-300);
            this.score += 20;
            this.scoreText.setText('Score: ' + this.score);
        } else {
            // Game over
            this.endGame(false);
        }
    }

    reachFlag(player, flag) {
        // Reaching the flag ends the level
        this.endGame(true);
    }

    endGame(won) {
        this.gameOver = true;
        this.gameWon = won;
        
        // Stop player movement
        this.player.setVelocity(0, 0);
        
        // Calculate final score (include bonus for remaining time and collected coins)
        const coinBonus = this.coins * 5;
        const finalScore = this.score + coinBonus;
        
        // Display appropriate message
        if (won) {
            this.gameOverText.setText('LEVEL COMPLETE!\nScore: ' + finalScore + '\nPress SPACEBAR to restart');
        } else {
            this.gameOverText.setText('GAME OVER\nScore: ' + finalScore + '\nPress SPACEBAR to restart');
        }
        
        this.gameOverText.visible = true;
        
        // Submit score if logged in
        if (window.submitScore) {
            window.submitScore(this.gameId, finalScore);
        }
    }

    resetGame() {
        const scene = this.game.scene.scenes[0];
        scene.scene.restart();
    }
}

// Initialize platformer game when loaded
function initPlatformerGame(containerId, gameId) {
    const game = new PlatformerGame(containerId, gameId);
    game.init();
}
