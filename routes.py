import logging
from flask import render_template, request, redirect, url_for, flash, jsonify, session
from flask_login import login_user, logout_user, current_user, login_required
from app import db
from models import User, Game, Score, Rating, Comment

def register_routes(app):
    # Initialize the game database if it's empty
    def initialize_games():
        if Game.query.count() == 0:
            games = [
                Game(
                    title="Snake",
                    description="Classic Snake game. Eat food to grow longer, but don't hit the walls or yourself!",
                    instructions="Use arrow keys to control the snake. Eat the red food to grow. Avoid hitting walls and yourself.",
                    game_type="snake"
                ),
                Game(
                    title="Pong",
                    description="The original arcade game. Play against the computer in this classic table tennis game.",
                    instructions="Use up and down arrow keys to move your paddle. Hit the ball past the computer's paddle to score.",
                    game_type="pong"
                ),
                Game(
                    title="Platformer",
                    description="Jump and run through a 2D platformer world, collecting coins and avoiding obstacles.",
                    instructions="Use arrow keys to move, spacebar to jump. Collect coins and reach the flag to win the level.",
                    game_type="platformer"
                ),
                Game(
                    title="Tetris",
                    description="The famous puzzle game. Arrange falling tetrominoes to create complete lines and score points.",
                    instructions="Use arrow keys to move and rotate pieces. Left/right to move, up to rotate, down to soft drop, spacebar for hard drop.",
                    game_type="tetris"
                ),
                Game(
                    title="Flappy Bird",
                    description="Navigate a bird through a series of pipes without hitting them. Simple but challenging!",
                    instructions="Press spacebar or click/tap the screen to make the bird flap its wings and fly upward. Avoid hitting pipes and the ground.",
                    game_type="flappybird"
                ),
                Game(
                    title="2D Shooter Arena",
                    description="Multiplayer online FPS shooting game. Compete against other players in a 2D arena.",
                    instructions="Use WASD to move, mouse to aim and shoot. Collect power-ups and defeat other players to score points.",
                    game_type="fpsgame"
                )
            ]
            for game in games:
                db.session.add(game)
            db.session.commit()
            logging.debug("Games initialized")
    
    # Call initialize_games function immediately
    with app.app_context():
        initialize_games()

    @app.route('/')
    def index():
        featured_games = Game.query.limit(3).all()
        return render_template('index.html', games=featured_games)

    @app.route('/register', methods=['GET', 'POST'])
    def register():
        if current_user.is_authenticated:
            return redirect(url_for('index'))
        
        if request.method == 'POST':
            username = request.form.get('username')
            email = request.form.get('email')
            password = request.form.get('password')
            confirm_password = request.form.get('confirm_password')
            
            if not all([username, email, password, confirm_password]):
                flash('All fields are required', 'danger')
                return render_template('register.html')
                
            if password != confirm_password:
                flash('Passwords do not match', 'danger')
                return render_template('register.html')
                
            if User.query.filter_by(username=username).first():
                flash('Username already exists', 'danger')
                return render_template('register.html')
                
            if User.query.filter_by(email=email).first():
                flash('Email already registered', 'danger')
                return render_template('register.html')
            
            user = User(username=username, email=email)
            user.set_password(password)
            db.session.add(user)
            db.session.commit()
            
            flash('Registration successful! You can now log in.', 'success')
            return redirect(url_for('login'))
            
        return render_template('register.html')

    @app.route('/login', methods=['GET', 'POST'])
    def login():
        if current_user.is_authenticated:
            return redirect(url_for('index'))
        
        if request.method == 'POST':
            username = request.form.get('username')
            password = request.form.get('password')
            remember = 'remember' in request.form
            
            user = User.query.filter_by(username=username).first()
            
            if not user or not user.check_password(password):
                flash('Invalid username or password', 'danger')
                return render_template('login.html')
            
            login_user(user, remember=remember)
            next_page = request.args.get('next')
            
            flash('Login successful!', 'success')
            return redirect(next_page or url_for('index'))
            
        return render_template('login.html')

    @app.route('/logout')
    @login_required
    def logout():
        logout_user()
        flash('You have been logged out.', 'info')
        return redirect(url_for('index'))

    @app.route('/profile')
    @login_required
    def profile():
        user_scores = Score.query.filter_by(user_id=current_user.id).order_by(Score.date.desc()).all()
        user_ratings = Rating.query.filter_by(user_id=current_user.id).all()
        user_comments = Comment.query.filter_by(user_id=current_user.id).order_by(Comment.date.desc()).all()
        
        # Group scores by game for better display
        games_played = {}
        for score in user_scores:
            if score.game_id not in games_played:
                games_played[score.game_id] = {
                    'game': score.game,
                    'high_score': score.score,
                    'scores': [score]
                }
            else:
                games_played[score.game_id]['scores'].append(score)
                if score.score > games_played[score.game_id]['high_score']:
                    games_played[score.game_id]['high_score'] = score.score
        
        return render_template('profile.html', 
                               user=current_user, 
                               games_played=games_played,
                               ratings=user_ratings,
                               comments=user_comments,
                               Score=Score)

    @app.route('/games')
    def games_list():
        games = Game.query.all()
        return render_template('games_list.html', games=games)

    @app.route('/game/<int:game_id>')
    def game(game_id):
        game = Game.query.get_or_404(game_id)
        comments = Comment.query.filter_by(game_id=game_id).order_by(Comment.date.desc()).all()
        
        user_rating = None
        if current_user.is_authenticated:
            user_rating = Rating.query.filter_by(user_id=current_user.id, game_id=game_id).first()
        
        # Get top scores for leaderboard
        top_scores = Score.query.filter_by(game_id=game_id).order_by(Score.score.desc()).limit(10).all()
        
        return render_template('game.html', 
                               game=game, 
                               comments=comments, 
                               user_rating=user_rating,
                               top_scores=top_scores)

    @app.route('/play/<game_type>')
    def play_game(game_type):
        game = Game.query.filter_by(game_type=game_type).first_or_404()
        return render_template('game.html', game=game, play_mode=True)

    @app.route('/submit_score', methods=['POST'])
    @login_required
    def submit_score():
        game_id = request.form.get('game_id')
        score_value = request.form.get('score')
        
        if not game_id or not score_value:
            return jsonify({'success': False, 'message': 'Missing required data'})
        
        try:
            score = Score(
                score=int(score_value),
                user_id=current_user.id,
                game_id=int(game_id)
            )
            db.session.add(score)
            db.session.commit()
            return jsonify({'success': True, 'message': 'Score submitted successfully'})
        except Exception as e:
            db.session.rollback()
            logging.error(f"Error submitting score: {str(e)}")
            return jsonify({'success': False, 'message': 'Error submitting score'})

    @app.route('/rate_game', methods=['POST'])
    @login_required
    def rate_game():
        game_id = request.form.get('game_id')
        rating_value = request.form.get('rating')
        
        if not game_id or not rating_value:
            flash('Missing required data', 'danger')
            return redirect(url_for('game', game_id=game_id))
        
        try:
            # Check if user already rated this game
            existing_rating = Rating.query.filter_by(
                user_id=current_user.id,
                game_id=int(game_id)
            ).first()
            
            if existing_rating:
                existing_rating.rating = int(rating_value)
                flash('Rating updated successfully', 'success')
            else:
                rating = Rating(
                    rating=int(rating_value),
                    user_id=current_user.id,
                    game_id=int(game_id)
                )
                db.session.add(rating)
                flash('Rating submitted successfully', 'success')
                
            db.session.commit()
        except Exception as e:
            db.session.rollback()
            logging.error(f"Error submitting rating: {str(e)}")
            flash('Error submitting rating', 'danger')
            
        return redirect(url_for('game', game_id=game_id))

    @app.route('/comment', methods=['POST'])
    @login_required
    def add_comment():
        game_id = request.form.get('game_id')
        content = request.form.get('content')
        
        if not game_id or not content:
            flash('Comment content is required', 'danger')
            return redirect(url_for('game', game_id=game_id))
        
        try:
            comment = Comment(
                content=content,
                user_id=current_user.id,
                game_id=int(game_id)
            )
            db.session.add(comment)
            db.session.commit()
            flash('Comment added successfully', 'success')
        except Exception as e:
            db.session.rollback()
            logging.error(f"Error adding comment: {str(e)}")
            flash('Error adding comment', 'danger')
            
        return redirect(url_for('game', game_id=game_id))

    @app.route('/leaderboard')
    def leaderboard():
        games = Game.query.all()
        selected_game_id = request.args.get('game_id', type=int)
        
        if selected_game_id:
            selected_game = Game.query.get_or_404(selected_game_id)
            top_scores = Score.query.filter_by(game_id=selected_game_id).order_by(Score.score.desc()).limit(20).all()
        else:
            selected_game = games[0] if games else None
            top_scores = Score.query.filter_by(game_id=selected_game.id).order_by(Score.score.desc()).limit(20).all() if selected_game else []
        
        # Get count statistics for the template
        total_users = User.query.count()
        total_scores = Score.query.count()
        
        return render_template('leaderboard.html', 
                               games=games, 
                               selected_game=selected_game,
                               top_scores=top_scores,
                               total_users=total_users,
                               total_scores=total_scores)

    @app.errorhandler(404)
    def page_not_found(e):
        return render_template('404.html'), 404

    @app.errorhandler(500)
    def internal_server_error(e):
        return render_template('500.html'), 500
