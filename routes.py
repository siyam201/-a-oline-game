import logging
import os
import json
from datetime import datetime
from flask import render_template, request, redirect, url_for, flash, jsonify, session, abort
from flask_login import login_user, logout_user, current_user, login_required
from flask_socketio import SocketIO
from werkzeug.utils import secure_filename
from app import db
from models import User, Game, Score, Rating, Comment, UserGame, GameCategory, UserGameRating, UserGameComment, UserGamePlay

def register_routes(app):
    # Initialize or update the game database
    def initialize_games():
        # Create a dictionary of all game entries we want in our database
        game_definitions = {
            "snake": {
                "title": "Snake",
                "description": "Classic Snake game. Eat food to grow longer, but don't hit the walls or yourself!",
                "instructions": "Use arrow keys to control the snake. Eat the red food to grow. Avoid hitting walls and yourself.",
            },
            "pong": {
                "title": "Pong",
                "description": "The original arcade game. Play against the computer in this classic table tennis game.",
                "instructions": "Use up and down arrow keys to move your paddle. Hit the ball past the computer's paddle to score.",
            },
            "platformer": {
                "title": "Platformer",
                "description": "Jump and run through a 2D platformer world, collecting coins and avoiding obstacles.",
                "instructions": "Use arrow keys to move, spacebar to jump. Collect coins and reach the flag to win the level.",
            },
            "tetris": {
                "title": "Tetris",
                "description": "The famous puzzle game. Arrange falling tetrominoes to create complete lines and score points.",
                "instructions": "Use arrow keys to move and rotate pieces. Left/right to move, up to rotate, down to soft drop, spacebar for hard drop.",
            },
            "flappybird": {
                "title": "Flappy Bird",
                "description": "Navigate a bird through a series of pipes without hitting them. Simple but challenging!",
                "instructions": "Press spacebar or click/tap the screen to make the bird flap its wings and fly upward. Avoid hitting pipes and the ground.",
            },
            "fpsgame": {
                "title": "2D Shooter Arena",
                "description": "Multiplayer online FPS shooting game. Compete against other players in a 2D arena.",
                "instructions": "Use WASD to move, mouse to aim and shoot. Collect power-ups and defeat other players to score points.",
            }
        }
        
        # Check each game type and add it if it doesn't exist
        for game_type, game_info in game_definitions.items():
            # Check if this game type already exists
            existing_game = Game.query.filter_by(game_type=game_type).first()
            
            if not existing_game:
                # If game doesn't exist, create it
                new_game = Game(
                    title=game_info["title"],
                    description=game_info["description"],
                    instructions=game_info["instructions"],
                    game_type=game_type
                )
                db.session.add(new_game)
                logging.debug(f"Added new game: {game_info['title']} ({game_type})")
        
        # Commit all changes at once
        db.session.commit()
        logging.debug("Games database updated")
    
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
        logging.debug(f"Games list query returned {len(games)} games:")
        for game in games:
            logging.debug(f"  - Game ID: {game.id}, Title: {game.title}, Type: {game.game_type}")
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
        
    # User-Generated Games Routes
    
    # Setup upload folder for game thumbnails
    UPLOAD_FOLDER = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'static/uploads')
    if not os.path.exists(UPLOAD_FOLDER):
        os.makedirs(UPLOAD_FOLDER)
    
    ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif'}
    
    def allowed_file(filename):
        return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS
        
    # Initialize game categories if they don't exist
    def initialize_categories():
        categories = [
            {'name': 'Arcade', 'description': 'Classic arcade-style games'},
            {'name': 'Puzzle', 'description': 'Brain teasers and puzzle games'},
            {'name': 'Action', 'description': 'Fast-paced action games'},
            {'name': 'Adventure', 'description': 'Exploration and adventure games'},
            {'name': 'Strategy', 'description': 'Strategic thinking games'}
        ]
        
        for category_info in categories:
            existing_category = GameCategory.query.filter_by(name=category_info['name']).first()
            if not existing_category:
                new_category = GameCategory(
                    name=category_info['name'],
                    description=category_info['description']
                )
                db.session.add(new_category)
                logging.debug(f"Added new category: {category_info['name']}")
        
        db.session.commit()
        logging.debug("Game categories initialized")
    
    # Call initialize_categories function
    with app.app_context():
        initialize_categories()
    
    @app.route('/create-game', methods=['GET', 'POST'])
    @login_required
    def create_game():
        categories = GameCategory.query.all()
        
        if request.method == 'POST':
            title = request.form.get('title')
            description = request.form.get('description')
            instructions = request.form.get('instructions')
            category_id = request.form.get('category_id')
            game_code = request.form.get('game_code')
            
            # Basic validation
            if not all([title, description, instructions, game_code]):
                flash('All fields except thumbnail are required', 'danger')
                return render_template('create_game.html', categories=categories)
            
            # Handle thumbnail upload
            thumbnail_path = None
            if 'thumbnail' in request.files:
                thumbnail = request.files['thumbnail']
                if thumbnail.filename and allowed_file(thumbnail.filename):
                    filename = secure_filename(f"{current_user.username}_{int(datetime.now().timestamp())}_{thumbnail.filename}")
                    filepath = os.path.join(UPLOAD_FOLDER, filename)
                    thumbnail.save(filepath)
                    thumbnail_path = f"uploads/{filename}"
            
            # Create new user game
            try:
                new_game = UserGame(
                    title=title,
                    description=description,
                    instructions=instructions,
                    code=game_code,
                    thumbnail=thumbnail_path,
                    user_id=current_user.id,
                    category_id=category_id if category_id else None
                )
                
                db.session.add(new_game)
                db.session.commit()
                
                flash('Your game has been submitted for review!', 'success')
                return redirect(url_for('user_games'))
                
            except Exception as e:
                db.session.rollback()
                logging.error(f"Error creating game: {str(e)}")
                flash('Error creating game', 'danger')
                
        return render_template('create_game.html', categories=categories)
    
    @app.route('/edit-game/<int:game_id>', methods=['GET', 'POST'])
    @login_required
    def edit_game(game_id):
        game = UserGame.query.get_or_404(game_id)
        
        # Check if the current user is the creator or an admin
        if game.user_id != current_user.id and not current_user.is_admin:
            flash('You do not have permission to edit this game', 'danger')
            return redirect(url_for('user_games'))
        
        categories = GameCategory.query.all()
        
        if request.method == 'POST':
            title = request.form.get('title')
            description = request.form.get('description')
            instructions = request.form.get('instructions')
            category_id = request.form.get('category_id')
            game_code = request.form.get('game_code')
            
            # Basic validation
            if not all([title, description, instructions, game_code]):
                flash('All fields except thumbnail are required', 'danger')
                return render_template('edit_game.html', game=game, categories=categories)
            
            # Handle thumbnail upload
            if 'thumbnail' in request.files:
                thumbnail = request.files['thumbnail']
                if thumbnail.filename and allowed_file(thumbnail.filename):
                    # Remove old thumbnail if it exists
                    if game.thumbnail:
                        old_filepath = os.path.join(os.path.dirname(os.path.abspath(__file__)), 
                                                 'static', game.thumbnail)
                        if os.path.exists(old_filepath):
                            os.remove(old_filepath)
                    
                    filename = secure_filename(f"{current_user.username}_{int(datetime.now().timestamp())}_{thumbnail.filename}")
                    filepath = os.path.join(UPLOAD_FOLDER, filename)
                    thumbnail.save(filepath)
                    game.thumbnail = f"uploads/{filename}"
            
            # Update game details
            try:
                game.title = title
                game.description = description
                game.instructions = instructions
                game.code = game_code
                game.category_id = category_id if category_id else None
                game.date_updated = datetime.utcnow()
                
                # If admin is editing, they can publish/unpublish
                if current_user.is_admin:
                    game.is_published = 'is_published' in request.form
                    game.is_featured = 'is_featured' in request.form
                
                db.session.commit()
                
                flash('Game updated successfully!', 'success')
                return redirect(url_for('user_game', game_id=game.id))
                
            except Exception as e:
                db.session.rollback()
                logging.error(f"Error updating game: {str(e)}")
                flash('Error updating game', 'danger')
                
        return render_template('edit_game.html', game=game, categories=categories)
    
    @app.route('/user-games')
    def user_games():
        # Get published games or all games if user is admin
        if current_user.is_authenticated and current_user.is_admin:
            games = UserGame.query.order_by(UserGame.date_created.desc()).all()
        else:
            games = UserGame.query.filter_by(is_published=True).order_by(UserGame.date_created.desc()).all()
        
        # Get featured games for the carousel
        featured_games = UserGame.query.filter_by(is_published=True, is_featured=True).limit(5).all()
        
        # Get categories for filtering
        categories = GameCategory.query.all()
        
        return render_template('user_games.html', 
                              games=games, 
                              featured_games=featured_games, 
                              categories=categories)
    
    @app.route('/user-game/<int:game_id>')
    def user_game(game_id):
        game = UserGame.query.get_or_404(game_id)
        
        # If game is not published, only creator and admins can view it
        if not game.is_published and (not current_user.is_authenticated or 
                                     (current_user.id != game.user_id and not current_user.is_admin)):
            flash('This game is not published yet', 'warning')
            return redirect(url_for('user_games'))
        
        # Get comments
        comments = UserGameComment.query.filter_by(game_id=game_id).order_by(UserGameComment.date.desc()).all()
        
        # Get user rating if logged in
        user_rating = None
        if current_user.is_authenticated:
            user_rating = UserGameRating.query.filter_by(user_id=current_user.id, game_id=game_id).first()
            
            # Record play if user is not the creator
            if current_user.id != game.user_id:
                try:
                    play = UserGamePlay(user_id=current_user.id, game_id=game_id)
                    db.session.add(play)
                    db.session.commit()
                except:
                    db.session.rollback()
        
        return render_template('user_game.html', 
                              game=game, 
                              comments=comments, 
                              user_rating=user_rating)
    
    @app.route('/play-user-game/<int:game_id>')
    def play_user_game(game_id):
        game = UserGame.query.get_or_404(game_id)
        
        # If game is not published, only creator and admins can play it
        if not game.is_published and (not current_user.is_authenticated or 
                                     (current_user.id != game.user_id and not current_user.is_admin)):
            flash('This game is not published yet', 'warning')
            return redirect(url_for('user_games'))
        
        return render_template('play_user_game.html', game=game)
    
    @app.route('/rate-user-game', methods=['POST'])
    @login_required
    def rate_user_game():
        game_id = request.form.get('game_id')
        rating_value = request.form.get('rating')
        
        if not game_id or not rating_value:
            flash('Missing required data', 'danger')
            return redirect(url_for('user_game', game_id=game_id))
        
        try:
            # Check if user already rated this game
            existing_rating = UserGameRating.query.filter_by(
                user_id=current_user.id,
                game_id=int(game_id)
            ).first()
            
            if existing_rating:
                existing_rating.rating = int(rating_value)
                flash('Rating updated successfully', 'success')
            else:
                rating = UserGameRating(
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
            
        return redirect(url_for('user_game', game_id=game_id))
    
    @app.route('/comment-user-game', methods=['POST'])
    @login_required
    def comment_user_game():
        game_id = request.form.get('game_id')
        content = request.form.get('content')
        
        if not game_id or not content:
            flash('Comment content is required', 'danger')
            return redirect(url_for('user_game', game_id=game_id))
        
        try:
            comment = UserGameComment(
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
            
        return redirect(url_for('user_game', game_id=game_id))
    
    @app.route('/admin/games', methods=['GET'])
    @login_required
    def admin_games():
        if not current_user.is_admin:
            flash('Access denied', 'danger')
            return redirect(url_for('index'))
            
        games = UserGame.query.order_by(UserGame.date_created.desc()).all()
        return render_template('admin_games.html', games=games)
    
    @app.route('/admin/review-game/<int:game_id>', methods=['GET', 'POST'])
    @login_required
    def admin_review_game(game_id):
        if not current_user.is_admin:
            flash('Access denied', 'danger')
            return redirect(url_for('index'))
            
        game = UserGame.query.get_or_404(game_id)
        
        if request.method == 'POST':
            action = request.form.get('action')
            
            if action == 'approve':
                game.is_published = True
                db.session.commit()
                flash('Game approved and published', 'success')
            elif action == 'reject':
                game.is_published = False
                db.session.commit()
                flash('Game rejected', 'warning')
            elif action == 'feature':
                game.is_featured = True
                db.session.commit()
                flash('Game set as featured', 'success')
            elif action == 'unfeature':
                game.is_featured = False
                db.session.commit()
                flash('Game removed from featured list', 'info')
            elif action == 'delete':
                db.session.delete(game)
                db.session.commit()
                flash('Game deleted', 'warning')
                return redirect(url_for('admin_games'))
                
        return render_template('admin_review_game.html', game=game)
