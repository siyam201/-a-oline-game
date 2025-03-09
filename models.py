from datetime import datetime
from app import db, login_manager
from flask_login import UserMixin
from werkzeug.security import generate_password_hash, check_password_hash

@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))

class User(UserMixin, db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(64), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(256), nullable=False)
    date_joined = db.Column(db.DateTime, default=datetime.utcnow)
    is_admin = db.Column(db.Boolean, default=False)
    
    # Relationships
    scores = db.relationship('Score', backref='user', lazy='dynamic')
    ratings = db.relationship('Rating', backref='user', lazy='dynamic')
    comments = db.relationship('Comment', backref='user', lazy='dynamic')
    uploaded_games = db.relationship('UserGame', backref='creator', lazy='dynamic')
    
    def set_password(self, password):
        self.password_hash = generate_password_hash(password)
        
    def check_password(self, password):
        return check_password_hash(self.password_hash, password)
    
    def __repr__(self):
        return f'<User {self.username}>'

class Game(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(100), nullable=False)
    description = db.Column(db.Text, nullable=False)
    instructions = db.Column(db.Text, nullable=False)
    game_type = db.Column(db.String(50), nullable=False)
    
    # Relationships
    scores = db.relationship('Score', backref='game', lazy='dynamic')
    ratings = db.relationship('Rating', backref='game', lazy='dynamic')
    comments = db.relationship('Comment', backref='game', lazy='dynamic')
    
    def average_rating(self):
        ratings = [r.rating for r in self.ratings]
        return sum(ratings) / len(ratings) if ratings else 0
    
    def __repr__(self):
        return f'<Game {self.title}>'

class Score(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    score = db.Column(db.Integer, nullable=False)
    date = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Foreign Keys
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    game_id = db.Column(db.Integer, db.ForeignKey('game.id'), nullable=False)
    
    def __repr__(self):
        return f'<Score {self.score} by {self.user.username} in {self.game.title}>'

class Rating(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    rating = db.Column(db.Integer, nullable=False)  # 1-5 rating
    date = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Foreign Keys
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    game_id = db.Column(db.Integer, db.ForeignKey('game.id'), nullable=False)
    
    def __repr__(self):
        return f'<Rating {self.rating} by {self.user.username} for {self.game.title}>'

class Comment(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    content = db.Column(db.Text, nullable=False)
    date = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Foreign Keys
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    game_id = db.Column(db.Integer, db.ForeignKey('game.id'), nullable=False)
    
    def __repr__(self):
        return f'<Comment by {self.user.username} for {self.game.title}>'

class UserGame(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(100), nullable=False)
    description = db.Column(db.Text, nullable=False)
    instructions = db.Column(db.Text, nullable=False)
    code = db.Column(db.Text, nullable=False)  # JavaScript code for the game
    thumbnail = db.Column(db.String(255), nullable=True)  # Path to thumbnail image
    date_created = db.Column(db.DateTime, default=datetime.utcnow)
    date_updated = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    is_published = db.Column(db.Boolean, default=False)  # Admin approval required
    is_featured = db.Column(db.Boolean, default=False)  # For featured games
    
    # Foreign Keys
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    category_id = db.Column(db.Integer, db.ForeignKey('game_category.id'), nullable=True)
    
    # Relationships
    ratings = db.relationship('UserGameRating', backref='game', lazy='dynamic')
    comments = db.relationship('UserGameComment', backref='game', lazy='dynamic')
    plays = db.relationship('UserGamePlay', backref='game', lazy='dynamic')
    
    def average_rating(self):
        ratings = [r.rating for r in self.ratings]
        return sum(ratings) / len(ratings) if ratings else 0
    
    def __repr__(self):
        return f'<UserGame {self.title} by {self.creator.username}>'

class GameCategory(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(50), nullable=False, unique=True)
    description = db.Column(db.Text, nullable=True)
    
    # Relationships
    games = db.relationship('UserGame', backref='category', lazy='dynamic')
    
    def __repr__(self):
        return f'<GameCategory {self.name}>'

class UserGameRating(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    rating = db.Column(db.Integer, nullable=False)  # 1-5 rating
    date = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Foreign Keys
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    game_id = db.Column(db.Integer, db.ForeignKey('user_game.id'), nullable=False)
    
    def __repr__(self):
        return f'<UserGameRating {self.rating} by {self.user.username} for {self.game.title}>'

class UserGameComment(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    content = db.Column(db.Text, nullable=False)
    date = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Foreign Keys
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    game_id = db.Column(db.Integer, db.ForeignKey('user_game.id'), nullable=False)
    
    def __repr__(self):
        return f'<UserGameComment by {self.user.username} for {self.game.title}>'

class UserGamePlay(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    played_at = db.Column(db.DateTime, default=datetime.utcnow)
    duration = db.Column(db.Integer, nullable=True)  # play duration in seconds
    
    # Foreign Keys
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    game_id = db.Column(db.Integer, db.ForeignKey('user_game.id'), nullable=False)
    
    def __repr__(self):
        return f'<UserGamePlay by {self.user.username} for {self.game.title}>'
