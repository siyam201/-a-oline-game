from app import app
from flask_socketio import SocketIO, emit, join_room, leave_room
import logging
import json
import uuid

# Initialize Flask-SocketIO
socketio = SocketIO(app, cors_allowed_origins="*")

# Dictionary to store active game rooms
game_rooms = {}
# Dictionary to store player information
players = {}

# Socket.IO event handlers
@socketio.on('connect')
def handle_connect():
    player_id = str(uuid.uuid4())
    players[request.sid] = {
        'id': player_id,
        'username': 'Anonymous',
        'room': None
    }
    logging.debug(f"Client connected: {request.sid}")
    emit('connected', {'player_id': player_id})

@socketio.on('disconnect')
def handle_disconnect():
    player = players.get(request.sid)
    if player:
        room = player.get('room')
        if room and room in game_rooms:
            # Remove player from room
            player_list = game_rooms[room].get('players', [])
            game_rooms[room]['players'] = [p for p in player_list if p['id'] != player['id']]
            
            # If room is empty, delete it
            if not game_rooms[room]['players']:
                del game_rooms[room]
            else:
                # Notify other players about disconnection
                emit('player_left', {'player_id': player['id']}, room=room)
        
        # Remove player from players list
        del players[request.sid]
    
    logging.debug(f"Client disconnected: {request.sid}")

@socketio.on('set_username')
def handle_set_username(data):
    username = data.get('username', 'Anonymous')
    if request.sid in players:
        players[request.sid]['username'] = username
        logging.debug(f"Username set: {username} for {request.sid}")
        emit('username_set', {'success': True})

@socketio.on('create_room')
def handle_create_room(data):
    game_type = data.get('game_type')
    max_players = data.get('max_players', 4)
    
    if not game_type:
        emit('error', {'message': 'Game type is required'})
        return
    
    # Create a unique room ID
    room_id = str(uuid.uuid4())[:8]
    game_rooms[room_id] = {
        'id': room_id,
        'game_type': game_type,
        'max_players': max_players,
        'players': [],
        'game_state': {}
    }
    
    # Add player to room
    if request.sid in players:
        join_room(room_id)
        players[request.sid]['room'] = room_id
        game_rooms[room_id]['players'].append({
            'id': players[request.sid]['id'],
            'username': players[request.sid]['username']
        })
        
        logging.debug(f"Room created: {room_id} for game: {game_type}")
        emit('room_created', {'room_id': room_id, 'game_type': game_type})

@socketio.on('join_room')
def handle_join_room(data):
    room_id = data.get('room_id')
    
    if not room_id or room_id not in game_rooms:
        emit('error', {'message': 'Invalid room ID'})
        return
    
    # Check if room is full
    if len(game_rooms[room_id]['players']) >= game_rooms[room_id]['max_players']:
        emit('error', {'message': 'Room is full'})
        return
    
    # Add player to room
    if request.sid in players:
        join_room(room_id)
        players[request.sid]['room'] = room_id
        player_info = {
            'id': players[request.sid]['id'],
            'username': players[request.sid]['username']
        }
        game_rooms[room_id]['players'].append(player_info)
        
        # Notify all players in the room about new player
        emit('player_joined', player_info, room=room_id)
        
        # Send current room info to the new player
        emit('room_joined', {
            'room_id': room_id,
            'game_type': game_rooms[room_id]['game_type'],
            'players': game_rooms[room_id]['players'],
            'game_state': game_rooms[room_id]['game_state']
        })
        
        logging.debug(f"Player {player_info['username']} joined room: {room_id}")

@socketio.on('leave_room')
def handle_leave_room(data):
    room_id = data.get('room_id')
    
    if not room_id or room_id not in game_rooms:
        emit('error', {'message': 'Invalid room ID'})
        return
    
    if request.sid in players and players[request.sid]['room'] == room_id:
        player_id = players[request.sid]['id']
        leave_room(room_id)
        players[request.sid]['room'] = None
        
        # Remove player from room
        game_rooms[room_id]['players'] = [p for p in game_rooms[room_id]['players'] if p['id'] != player_id]
        
        # If room is empty, delete it
        if not game_rooms[room_id]['players']:
            del game_rooms[room_id]
        else:
            # Notify other players about player leaving
            emit('player_left', {'player_id': player_id}, room=room_id)
        
        emit('room_left', {'success': True})
        logging.debug(f"Player {player_id} left room: {room_id}")

@socketio.on('game_action')
def handle_game_action(data):
    room_id = data.get('room_id')
    action = data.get('action')
    action_data = data.get('data', {})
    
    if request.sid in players and players[request.sid]['room'] == room_id:
        player_id = players[request.sid]['id']
        
        # Broadcast action to all players in the room except sender
        emit('game_action', {
            'player_id': player_id,
            'action': action,
            'data': action_data
        }, room=room_id, include_self=False)
        
        # Update game state based on action (if needed)
        if room_id in game_rooms:
            if action == 'update_state':
                game_rooms[room_id]['game_state'] = action_data
            
            logging.debug(f"Game action: {action} from player {player_id} in room {room_id}")

@socketio.on('chat_message')
def handle_chat_message(data):
    room_id = data.get('room_id')
    message = data.get('message')
    
    if request.sid in players and players[request.sid]['room'] == room_id:
        player_id = players[request.sid]['id']
        player_username = players[request.sid]['username']
        
        # Broadcast message to all players in the room
        emit('chat_message', {
            'player_id': player_id,
            'username': player_username,
            'message': message,
            'timestamp': datetime.now().strftime('%H:%M:%S')
        }, room=room_id)
        
        logging.debug(f"Chat message from {player_username} in room {room_id}")

if __name__ == "__main__":
    socketio.run(app, host="0.0.0.0", port=5000, debug=True)
