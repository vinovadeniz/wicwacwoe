import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// serve the built files
app.use(express.static(join(__dirname, 'dist')));

// store all game rooms here
var rooms = {};

// make a random room code
function makeRoomCode() {
  var code = '';
  var letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  for (var i = 0; i < 4; i++) {
    code = code + letters[Math.floor(Math.random() * letters.length)];
  }
  return code;
}

io.on('connection', (socket) => {
  console.log('someone connected!');

  // when someone wants to create a room
  socket.on('createRoom', (playerName) => {
    var roomCode = makeRoomCode();
    rooms[roomCode] = {
      players: [{
        id: socket.id,
        name: playerName,
        symbol: '🪄'
      }],
      board: ['', '', '', '', '', '', '', '', ''],
      currentPlayer: '🪄',
      winner: null
    };
    
    socket.join(roomCode);
    socket.emit('roomCreated', { roomCode: roomCode, symbol: '🪄', playerName: playerName });
    console.log('Room created: ' + roomCode);
  });

  // when someone wants to join a room
  socket.on('joinRoom', function(data) {
    var roomCode = data.roomCode;
    var playerName = data.playerName;
    var room = rooms[roomCode];
    
    if (!room) {
      socket.emit('error', 'Room not found');
      return;
    }
    
    if (room.players.length >= 2) {
      socket.emit('error', 'Room is full');
      return;
    }
    
    room.players.push({
      id: socket.id,
      name: playerName,
      symbol: '🧙'
    });
    
    socket.join(roomCode);
    socket.emit('roomJoined', { roomCode: roomCode, symbol: '🧙', playerName: playerName });
    
    // tell both players the game is starting
    io.to(roomCode).emit('gameStart', {
      playerX: room.players[0].name,
      playerO: room.players[1].name,
      currentPlayer: room.currentPlayer
    });
    
    console.log(playerName + ' joined room ' + roomCode);
  });

  // when someone makes a move
  socket.on('makeMove', function(data) {
    var roomCode = data.roomCode;
    var index = data.index;
    var symbol = data.symbol;
    var room = rooms[roomCode];
    
    if (!room) {
      socket.emit('error', 'Room not found');
      return;
    }
    
    // check if its their turn
    var player = null;
    for (var i = 0; i < room.players.length; i++) {
      if (room.players[i].id === socket.id) {
        player = room.players[i];
        break;
      }
    }
    
    if (!player || player.symbol !== room.currentPlayer) {
      socket.emit('error', 'Not your turn');
      return;
    }
    
    // check if the spot is empty
    if (room.board[index] !== '') {
      socket.emit('error', 'Cell already occupied');
      return;
    }
    
    // put the symbol on the board
    room.board[index] = symbol;
    
    // check if someone won
    var winner = checkWinner(room.board);
    if (winner) {
      room.winner = winner;
      var winnerName = '';
      for (var i = 0; i < room.players.length; i++) {
        if (room.players[i].symbol === winner) {
          winnerName = room.players[i].name;
        }
      }
      io.to(roomCode).emit('gameOver', { winner: winner, winnerName: winnerName, board: room.board });
    } else {
      // check if its a draw
      var isFull = true;
      for (var i = 0; i < room.board.length; i++) {
        if (room.board[i] === '') {
          isFull = false;
          break;
        }
      }
      
      if (isFull) {
        io.to(roomCode).emit('gameOver', { winner: 'draw', winnerName: 'Nobody', board: room.board });
      } else {
        // switch turns
        if (room.currentPlayer === '🪄') {
          room.currentPlayer = '🧙';
        } else {
          room.currentPlayer = '🪄';
        }
        io.to(roomCode).emit('moveMade', {
          index: index,
          symbol: symbol,
          currentPlayer: room.currentPlayer,
          board: room.board
        });
      }
    }
  });

  // reset the board
  socket.on('resetBoard', function(roomCode) {
    var room = rooms[roomCode];
    
    if (!room) {
      return;
    }
    
    room.board = ['', '', '', '', '', '', '', '', ''];
    room.currentPlayer = '🪄';
    room.winner = null;
    
    io.to(roomCode).emit('boardReset', {
      board: room.board,
      currentPlayer: room.currentPlayer
    });
  });

  // when someone disconnects
  socket.on('disconnect', function() {
    console.log('someone disconnected');
    
    // find their room and clean it up
    for (var roomCode in rooms) {
      var room = rooms[roomCode];
      for (var i = 0; i < room.players.length; i++) {
        if (room.players[i].id === socket.id) {
          io.to(roomCode).emit('playerDisconnected', room.players[i].name);
          delete rooms[roomCode];
          break;
        }
      }
    }
  });
});

// check if someone won
function checkWinner(board) {
  // all the ways to win
  var winningLines = [
    [0, 1, 2], 
    [3, 4, 5], 
    [6, 7, 8],
    [0, 3, 6], 
    [1, 4, 7], 
    [2, 5, 8],
    [0, 4, 8], 
    [2, 4, 6]
  ];
  
  for (var i = 0; i < winningLines.length; i++) {
    var line = winningLines[i];
    var a = line[0];
    var b = line[1];
    var c = line[2];
    
    if (board[a] !== '' && board[a] === board[b] && board[a] === board[c]) {
      return board[a];
    }
  }
  
  return null;
}

// Fallback to index.html for client-side routing
app.get('*', (req, res) => {
  res.sendFile(join(__dirname, 'dist', 'index.html'));
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
