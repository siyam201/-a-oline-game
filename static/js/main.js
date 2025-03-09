// Main JavaScript file for the gaming platform

document.addEventListener('DOMContentLoaded', function() {
    // Initialize Bootstrap tooltips
    const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
    tooltipTriggerList.map(function (tooltipTriggerEl) {
        return new bootstrap.Tooltip(tooltipTriggerEl);
    });

    // Initialize Bootstrap popovers
    const popoverTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="popover"]'));
    popoverTriggerList.map(function (popoverTriggerEl) {
        return new bootstrap.Popover(popoverTriggerEl);
    });

    // Rating stars functionality
    const ratingStars = document.querySelector('.rating-stars');
    if (ratingStars) {
        const stars = ratingStars.querySelectorAll('i');
        const ratingInput = document.getElementById('rating-input');

        stars.forEach((star, index) => {
            star.addEventListener('click', () => {
                // Set the rating value (index + 1)
                const ratingValue = index + 1;
                ratingInput.value = ratingValue;
                
                // Update the star display
                stars.forEach((s, i) => {
                    if (i < ratingValue) {
                        s.classList.remove('far');
                        s.classList.add('fas');
                    } else {
                        s.classList.remove('fas');
                        s.classList.add('far');
                    }
                });
            });
        });
    }

    // Handle game loading
    const gameContainer = document.getElementById('game-container');
    if (gameContainer) {
        // Show loading spinner when game is initializing
        const loadingSpinner = document.createElement('div');
        loadingSpinner.className = 'game-loading';
        loadingSpinner.innerHTML = `
            <div class="spinner-border text-primary" role="status">
                <span class="visually-hidden">Loading...</span>
            </div>
        `;
        gameContainer.appendChild(loadingSpinner);

        // Remove loading spinner when game is ready
        window.addEventListener('gameLoaded', function() {
            loadingSpinner.remove();
        });
    }

    // Handle score submission
    window.submitScore = function(gameId, score) {
        const form = document.createElement('form');
        form.method = 'POST';
        form.action = '/submit_score';
        
        const gameIdInput = document.createElement('input');
        gameIdInput.type = 'hidden';
        gameIdInput.name = 'game_id';
        gameIdInput.value = gameId;
        
        const scoreInput = document.createElement('input');
        scoreInput.type = 'hidden';
        scoreInput.name = 'score';
        scoreInput.value = score;
        
        form.appendChild(gameIdInput);
        form.appendChild(scoreInput);
        document.body.appendChild(form);
        
        form.submit();
    };

    // Game filter functionality
    const gameFilterInput = document.getElementById('game-search');
    if (gameFilterInput) {
        gameFilterInput.addEventListener('input', function() {
            const searchValue = this.value.toLowerCase();
            const gameCards = document.querySelectorAll('.game-card-container');
            
            gameCards.forEach(card => {
                const gameTitle = card.querySelector('.card-title').textContent.toLowerCase();
                const gameDesc = card.querySelector('.card-text').textContent.toLowerCase();
                
                if (gameTitle.includes(searchValue) || gameDesc.includes(searchValue)) {
                    card.style.display = '';
                } else {
                    card.style.display = 'none';
                }
            });
        });
    }

    // Animated counters for stats
    const animateCounter = (element, target) => {
        let count = 0;
        const speed = 2000 / target; // Adjust speed based on target value
        
        const updateCount = () => {
            const increment = target / (2000 / 30); // Increment per frame
            
            if (count < target) {
                count += increment;
                if (count > target) count = target;
                element.textContent = Math.floor(count);
                requestAnimationFrame(updateCount);
            } else {
                element.textContent = target;
            }
        };
        
        updateCount();
    };

    // Initialize counters on profile page
    const counters = document.querySelectorAll('.counter-value');
    if (counters.length > 0) {
        counters.forEach(counter => {
            const target = parseInt(counter.getAttribute('data-target'));
            animateCounter(counter, target);
        });
    }

    // Add confirmation for comment deletion if implemented
    const deleteButtons = document.querySelectorAll('.delete-comment');
    if (deleteButtons.length > 0) {
        deleteButtons.forEach(button => {
            button.addEventListener('click', function(e) {
                if (!confirm('Are you sure you want to delete this comment?')) {
                    e.preventDefault();
                }
            });
        });
    }
});
