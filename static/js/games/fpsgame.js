// 2D FPS Multiplayer Game Implementation with Phaser 3

class FPSGame {
    constructor(containerId, gameId) {
        this.containerId = containerId;
        this.gameId = gameId;
        this.score = 0;
        this.gameOver = false;
        this.game = null;
        this.players = {};
        this.playerId = null;
        this.bullets = null;
        this.scoreText = null;
        this.healthText = null;
        this.playerHealth = 100;
        this.respawnTime = 3000; // 3 seconds to respawn
        this.projectileSpeed = 800;
        this.playerSpeed = 200;
        this.lastFired = 0;
        this.fireRate = 200; // milliseconds between shots
    }

    init() {
        // Configuration for the Phaser game
        const config = {
            type: Phaser.AUTO,
            width: 800,
            height: 600,
            parent: this.containerId,
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

        // Generate a unique player ID
        this.playerId = 'player-' + Date.now().toString();

        // Dispatch event when game is loaded
        window.dispatchEvent(new Event('gameLoaded'));
    }

    preload() {
        // Local reference to the scene
        const scene = this.game.scene.scenes[0];

        // Load sprite images
        scene.load.image('player', 'https://labs.phaser.io/assets/sprites/phaser-dude.png');
        scene.load.image('enemy', 'https://labs.phaser.io/assets/sprites/phaser-dude.png');
        scene.load.image('bullet', 'https://labs.phaser.io/assets/sprites/bullet.png');
        scene.load.image('background', 'https://labs.phaser.io/assets/skies/space3.png');
        scene.load.image('healthpack', 'https://labs.phaser.io/assets/sprites/firstaid.png');
    }

    create() {
        // Local reference to the scene
        const scene = this.game.scene.scenes[0];

        // Add background
        scene.add.image(0, 0, 'background').setOrigin(0, 0).setScale(2);

        // Create boundary walls
        this.createBoundaries(scene);

        // Create player
        this.createPlayer(scene);

        // Create bullets group
        this.bullets = scene.physics.add.group({
            defaultKey: 'bullet',
            maxSize: 20
        });

        // Create healthpacks group
        this.healthpacks = scene.physics.add.group();

        // Add some initial health packs
        for (let i = 0; i < 3; i++) {
            this.spawnHealthpack(scene);
        }

        // Create enemy players group (simulated)
        this.enemies = scene.physics.add.group();
        
        // Add some simulated enemies
        this.spawnSimulatedEnemies(scene);

        // Set up player-bullet collision
        scene.physics.add.overlap(this.enemies, this.bullets, this.hitEnemy, null, this);
        
        // Set up player-healthpack collision
        scene.physics.add.overlap(this.player, this.healthpacks, this.collectHealthpack, null, this);

        // Set up controls
        this.cursors = scene.input.keyboard.createCursorKeys();
        this.wasd = {
            up: scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
            down: scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
            left: scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
            right: scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D)
        };

        // Set up mouse for aiming and shooting
        scene.input.on('pointerdown', (pointer) => {
            this.shoot(scene, pointer);
        });

        // Set up UI
        this.scoreText = scene.add.text(16, 16, 'Score: 0', {
            fontSize: '24px',
            fontFamily: 'Arial',
            fill: '#ffffff',
            stroke: '#000000',
            strokeThickness: 3
        });

        this.healthText = scene.add.text(16, 50, 'Health: 100', {
            fontSize: '24px',
            fontFamily: 'Arial',
            fill: '#ffffff',
            stroke: '#000000',
            strokeThickness: 3
        });

        // Game over text (initially hidden)
        this.gameOverText = scene.add.text(scene.sys.game.config.width / 2, scene.sys.game.config.height / 2, 'GAME OVER\nClick to respawn', {
            fontSize: '48px',
            fontFamily: 'Arial',
            fill: '#ffffff',
            stroke: '#000000',
            strokeThickness: 5,
            align: 'center'
        });
        this.gameOverText.setOrigin(0.5);
        this.gameOverText.visible = false;

        // Set up a timer to spawn health packs periodically
        scene.time.addEvent({
            delay: 10000, // 10 seconds
            callback: () => this.spawnHealthpack(scene),
            callbackScope: this,
            loop: true
        });

        // Set up a timer to make enemies move randomly
        scene.time.addEvent({
            delay: 2000, // 2 seconds
            callback: () => this.moveEnemiesRandomly(scene),
            callbackScope: this,
            loop: true
        });

        // Enable enemy shooting
        scene.time.addEvent({
            delay: 1500, // 1.5 seconds
            callback: () => this.enemiesShoot(scene),
            callbackScope: this,
            loop: true
        });

        // Set camera to follow player
        scene.cameras.main.startFollow(this.player);
        scene.cameras.main.setZoom(1);
    }

    createBoundaries(scene) {
        // Create boundary walls (invisible)
        this.boundaries = scene.physics.add.staticGroup();
        
        // Top boundary
        this.boundaries.add(scene.add.rectangle(0, -10, 1600, 20, 0xff0000).setOrigin(0, 0).setVisible(false));
        
        // Bottom boundary
        this.boundaries.add(scene.add.rectangle(0, 1190, 1600, 20, 0xff0000).setOrigin(0, 0).setVisible(false));
        
        // Left boundary
        this.boundaries.add(scene.add.rectangle(-10, 0, 20, 1200, 0xff0000).setOrigin(0, 0).setVisible(false));
        
        // Right boundary
        this.boundaries.add(scene.add.rectangle(1590, 0, 20, 1200, 0xff0000).setOrigin(0, 0).setVisible(false));
    }

    createPlayer(scene) {
        // Create player sprite
        this.player = scene.physics.add.sprite(
            Phaser.Math.Between(100, 1500),
            Phaser.Math.Between(100, 1100),
            'player'
        );
        this.player.setScale(1);
        this.player.setCollideWorldBounds(true);
        
        // Set up player-boundary collision
        scene.physics.add.collider(this.player, this.boundaries);
        
        // Add username above player
        this.playerName = scene.add.text(0, -20, 'You', {
            fontSize: '16px',
            fontFamily: 'Arial',
            fill: '#ffffff',
            stroke: '#000000',
            strokeThickness: 3
        });
        this.playerName.setOrigin(0.5);
        
        // Create container for player and username
        this.playerContainer = scene.add.container(
            this.player.x,
            this.player.y,
            [this.playerName]
        );
    }

    spawnSimulatedEnemies(scene) {
        // Create a few simulated enemy players
        const enemyNames = ['Player1', 'Player2', 'Player3', 'Player4'];
        
        for (let i = 0; i < 4; i++) {
            // Create enemy at random position
            const enemy = this.enemies.create(
                Phaser.Math.Between(100, 1500),
                Phaser.Math.Between(100, 1100),
                'enemy'
            );
            enemy.setScale(1);
            enemy.setTint(0xff0000); // Red tint to distinguish from player
            enemy.health = 100;
            enemy.id = 'enemy-' + i;
            
            // Add username above enemy
            const enemyName = scene.add.text(0, -20, enemyNames[i], {
                fontSize: '16px',
                fontFamily: 'Arial',
                fill: '#ff0000',
                stroke: '#000000',
                strokeThickness: 3
            });
            enemyName.setOrigin(0.5);
            
            // Create container for enemy and username
            enemy.nameContainer = scene.add.container(
                enemy.x,
                enemy.y,
                [enemyName]
            );
            
            // Set up enemy-boundary collision
            scene.physics.add.collider(enemy, this.boundaries);
        }
    }

    moveEnemiesRandomly(scene) {
        this.enemies.getChildren().forEach((enemy) => {
            // Only move enemies that are alive
            if (enemy.active) {
                // Generate random velocity
                const angle = Phaser.Math.Between(0, 360) * (Math.PI / 180);
                const speed = Phaser.Math.Between(50, 150);
                
                enemy.setVelocity(
                    Math.cos(angle) * speed,
                    Math.sin(angle) * speed
                );
                
                // Stop moving after 1 second
                scene.time.delayedCall(1000, () => {
                    if (enemy.active) {
                        enemy.setVelocity(0, 0);
                    }
                });
            }
        });
    }

    enemiesShoot(scene) {
        this.enemies.getChildren().forEach((enemy) => {
            // Only allow active enemies to shoot
            if (enemy.active) {
                // Calculate angle to player
                const dx = this.player.x - enemy.x;
                const dy = this.player.y - enemy.y;
                const angle = Math.atan2(dy, dx);
                
                // Create bullet
                const bullet = scene.physics.add.sprite(enemy.x, enemy.y, 'bullet');
                bullet.setTint(0xff0000); // Red bullets for enemies
                bullet.isEnemyBullet = true;
                
                // Set bullet velocity
                bullet.setVelocity(
                    Math.cos(angle) * this.projectileSpeed,
                    Math.sin(angle) * this.projectileSpeed
                );
                
                // Set bullet rotation to match direction
                bullet.rotation = angle;
                
                // Add collision with player
                scene.physics.add.overlap(bullet, this.player, this.playerHit, null, this);
                
                // Destroy bullet after 2 seconds
                scene.time.delayedCall(2000, () => {
                    if (bullet.active) {
                        bullet.destroy();
                    }
                });
            }
        });
    }

    spawnHealthpack(scene) {
        // Create healthpack at random position
        const healthpack = this.healthpacks.create(
            Phaser.Math.Between(100, 1500),
            Phaser.Math.Between(100, 1100),
            'healthpack'
        );
        healthpack.setScale(0.5);
        
        // Add floating animation
        scene.tweens.add({
            targets: healthpack,
            y: healthpack.y - 10,
            duration: 1000,
            ease: 'Sine.easeInOut',
            yoyo: true,
            repeat: -1
        });
        
        // Destroy healthpack after 15 seconds if not collected
        scene.time.delayedCall(15000, () => {
            if (healthpack.active) {
                healthpack.destroy();
            }
        });
    }

    collectHealthpack(player, healthpack) {
        // Remove healthpack
        healthpack.destroy();
        
        // Increase player health
        this.playerHealth = Math.min(this.playerHealth + 25, 100);
        this.updateHealthText();
    }

    updateHealthText() {
        this.healthText.setText('Health: ' + this.playerHealth);
    }

    playerHit(player, bullet) {
        // Ignore if player is already dead
        if (this.gameOver) return;
        
        // Remove bullet
        bullet.destroy();
        
        // Reduce player health
        this.playerHealth -= 10;
        this.updateHealthText();
        
        // Flash player to indicate damage
        this.game.scene.scenes[0].tweens.add({
            targets: player,
            alpha: 0.5,
            duration: 100,
            yoyo: true,
            repeat: 3
        });
        
        // Check if player is dead
        if (this.playerHealth <= 0) {
            this.playerDeath();
        }
    }

    playerDeath() {
        const scene = this.game.scene.scenes[0];
        
        // Set game over state
        this.gameOver = true;
        
        // Hide player
        this.player.setActive(false).setVisible(false);
        
        // Show game over text
        this.gameOverText.visible = true;
        
        // Allow clicking to respawn
        scene.input.once('pointerdown', () => {
            this.respawnPlayer();
        });
        
        // Respawn player automatically after delay
        scene.time.delayedCall(this.respawnTime, () => {
            this.respawnPlayer();
        });
    }

    respawnPlayer() {
        const scene = this.game.scene.scenes[0];
        
        // Reset game over state
        this.gameOver = false;
        
        // Hide game over text
        this.gameOverText.visible = false;
        
        // Reset player health
        this.playerHealth = 100;
        this.updateHealthText();
        
        // Respawn player at random position
        this.player.setPosition(
            Phaser.Math.Between(100, 1500),
            Phaser.Math.Between(100, 1100)
        );
        this.player.setActive(true).setVisible(true);
        
        // Make player invulnerable briefly
        this.player.alpha = 0.5;
        scene.time.delayedCall(2000, () => {
            this.player.alpha = 1;
        });
    }

    hitEnemy(enemy, bullet) {
        // Ignore enemy bullets
        if (bullet.isEnemyBullet) return;
        
        // Remove bullet
        bullet.destroy();
        
        // Reduce enemy health
        enemy.health -= 25;
        
        // Flash enemy to indicate damage
        this.game.scene.scenes[0].tweens.add({
            targets: enemy,
            alpha: 0.5,
            duration: 100,
            yoyo: true,
            repeat: 2
        });
        
        // Check if enemy is dead
        if (enemy.health <= 0) {
            this.killEnemy(enemy);
        }
    }

    killEnemy(enemy) {
        // Hide the nameContainer
        if (enemy.nameContainer) {
            enemy.nameContainer.visible = false;
        }
        
        // Hide enemy
        enemy.setActive(false).setVisible(false);
        
        // Increase score
        this.score += 10;
        this.scoreText.setText('Score: ' + this.score);
        
        // Respawn enemy after delay
        this.game.scene.scenes[0].time.delayedCall(3000, () => {
            this.respawnEnemy(enemy);
        });
        
        // Submit score if logged in
        if (window.submitScore && this.score % 50 === 0) {
            window.submitScore(this.gameId, this.score);
        }
    }

    respawnEnemy(enemy) {
        // Reposition enemy
        enemy.setPosition(
            Phaser.Math.Between(100, 1500),
            Phaser.Math.Between(100, 1100)
        );
        
        // Reset health
        enemy.health = 100;
        
        // Show enemy again
        enemy.setActive(true).setVisible(true);
        
        // Show the nameContainer
        if (enemy.nameContainer) {
            enemy.nameContainer.visible = true;
            enemy.nameContainer.setPosition(enemy.x, enemy.y);
        }
    }

    shoot(scene, pointer) {
        // Don't shoot if game is over
        if (this.gameOver) return;
        
        // Check fire rate
        const time = scene.time.now;
        if (time < this.lastFired + this.fireRate) {
            return;
        }
        this.lastFired = time;
        
        // Get world position of pointer
        const worldPoint = scene.cameras.main.getWorldPoint(pointer.x, pointer.y);
        
        // Calculate angle to pointer
        const dx = worldPoint.x - this.player.x;
        const dy = worldPoint.y - this.player.y;
        const angle = Math.atan2(dy, dx);
        
        // Create bullet
        const bullet = this.bullets.get(this.player.x, this.player.y);
        
        if (bullet) {
            bullet.setActive(true).setVisible(true);
            bullet.setTint(0x00ffff); // Cyan bullets for player
            bullet.isEnemyBullet = false;
            
            // Set bullet velocity
            bullet.setVelocity(
                Math.cos(angle) * this.projectileSpeed,
                Math.sin(angle) * this.projectileSpeed
            );
            
            // Set bullet rotation to match direction
            bullet.rotation = angle;
            
            // Destroy bullet after 2 seconds
            scene.time.delayedCall(2000, () => {
                if (bullet.active) {
                    bullet.setActive(false).setVisible(false);
                }
            });
        }
    }

    update() {
        // Skip update if game is not fully initialized or game over
        if (!this.player || this.gameOver) return;
        
        // Reset player velocity
        this.player.setVelocity(0);
        
        // Check for WASD or arrow keys
        const left = this.cursors.left.isDown || this.wasd.left.isDown;
        const right = this.cursors.right.isDown || this.wasd.right.isDown;
        const up = this.cursors.up.isDown || this.wasd.up.isDown;
        const down = this.cursors.down.isDown || this.wasd.down.isDown;
        
        // Apply velocity based on key input
        if (left) {
            this.player.setVelocityX(-this.playerSpeed);
        } else if (right) {
            this.player.setVelocityX(this.playerSpeed);
        }
        
        if (up) {
            this.player.setVelocityY(-this.playerSpeed);
        } else if (down) {
            this.player.setVelocityY(this.playerSpeed);
        }
        
        // Update position of player container to follow player
        this.playerContainer.setPosition(this.player.x, this.player.y);
        
        // Update positions of enemy name containers
        this.enemies.getChildren().forEach((enemy) => {
            if (enemy.nameContainer && enemy.active) {
                enemy.nameContainer.setPosition(enemy.x, enemy.y);
            }
        });
        
        // Keep score text fixed to camera
        this.scoreText.setScrollFactor(0);
        this.healthText.setScrollFactor(0);
        this.gameOverText.setScrollFactor(0);
    }
}

// Initialize FPS game when loaded
function initFPSGame(containerId, gameId) {
    const game = new FPSGame(containerId, gameId);
    game.init();
}