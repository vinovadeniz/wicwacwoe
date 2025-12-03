<script setup>
import { ref } from 'vue';
import { io } from 'socket.io-client';

// socket stuff
var socket = null;

// what screen are we on
var gameMode = ref('menu');
var onlineMode = ref('');

// player names
var playerX = ref('');
var playerO = ref('');
var myName = ref('');
var mySymbol = ref('');
var roomCode = ref('');
var roomCodeInput = ref('');
var errorMessage = ref('');

// the game board
var board = ref(['', '', '', '', '', '', '', '', '']);
var currentPlayer = ref('🪄');
var winner = ref('');
var showPopup = ref(false);
var popupMessage = ref('');

// helper functions
function getCurrentPlayerName() {
  if (currentPlayer.value === '🪄') {
    return playerX.value || 'Player 🪄';
  } else {
    return playerO.value || 'Player 🧙';
  }
}

function getWinnerName() {
  if (winner.value === 'draw') {
    return "It's a draw!";
  }
  if (winner.value === '🪄') {
    return playerX.value || 'Player 🪄';
  } else {
    return playerO.value || 'Player 🧙';
  }
}

// reset the board
function resetBoard() {
  board.value = ['', '', '', '', '', '', '', '', ''];
  currentPlayer.value = '🪄';
  winner.value = '';
  showPopup.value = false;
  
  if (gameMode.value === 'online' && socket) {
    socket.emit('resetBoard', roomCode.value);
  }
}

// reset everything
function resetAll() {
  playerX.value = '';
  playerO.value = '';
  resetBoard();
  
  if (gameMode.value === 'online' && socket) {
    socket.disconnect();
    socket = null;
    gameMode.value = 'menu';
    onlineMode.value = '';
    roomCode.value = '';
  }
}

// check if someone won
function checkWinner(boardToCheck) {
  var winningLines = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8],
    [0, 3, 6], [1, 4, 7], [2, 5, 8],
    [0, 4, 8], [2, 4, 6]
  ];
  
  for (var i = 0; i < winningLines.length; i++) {
    var line = winningLines[i];
    var a = line[0];
    var b = line[1];
    var c = line[2];
    
    if (boardToCheck[a] !== '' && 
        boardToCheck[a] === boardToCheck[b] && 
        boardToCheck[a] === boardToCheck[c]) {
      return boardToCheck[a];
    }
  }
  return null;
}

// check if board is full
function isBoardFull(boardToCheck) {
  for (var i = 0; i < boardToCheck.length; i++) {
    if (boardToCheck[i] === '') {
      return false;
    }
  }
  return true;
}

// when someone clicks a square
function makeMove(index) {
  if (gameMode.value === 'local') {
    // local game
    if (winner.value || board.value[index] !== '') {
      return;
    }
    
    board.value[index] = currentPlayer.value;
    
    // check if someone won
    var winnerSymbol = checkWinner(board.value);
    if (winnerSymbol) {
      winner.value = winnerSymbol;
      var winnerName = '';
      if (winnerSymbol === '🪄') {
        winnerName = playerX.value || 'Player 🪄';
      } else {
        winnerName = playerO.value || 'Player 🧙';
      }
      popupMessage.value = winnerName + ' wins!';
      showPopup.value = true;
    } else if (isBoardFull(board.value)) {
      winner.value = 'draw';
      popupMessage.value = "It's a draw!";
      showPopup.value = true;
    } else {
      // switch players
      if (currentPlayer.value === '🪄') {
        currentPlayer.value = '🧙';
      } else {
        currentPlayer.value = '🪄';
      }
    }
  } else if (gameMode.value === 'online') {
    // online game
    if (mySymbol.value !== currentPlayer.value) {
      errorMessage.value = 'Not your turn!';
      setTimeout(function() {
        errorMessage.value = '';
      }, 2000);
      return;
    }
    
    if (winner.value || board.value[index] !== '') {
      return;
    }
    
    socket.emit('makeMove', {
      roomCode: roomCode.value,
      index: index,
      symbol: mySymbol.value
    });
  }
}

// start a local game
function startLocalGame() {
  if (!playerX.value || !playerO.value) {
    errorMessage.value = 'Please enter both player names';
    setTimeout(function() {
      errorMessage.value = '';
    }, 2000);
    return;
  }
  gameMode.value = 'local';
  resetBoard();
}

// setup socket connection
function initializeSocket() {
  var socketUrl = window.location.origin;
  socket = io(socketUrl);
  
  socket.on('roomCreated', function(data) {
    roomCode.value = data.roomCode;
    mySymbol.value = data.symbol;
    onlineMode.value = 'playing';
    playerX.value = myName.value;
    playerO.value = 'Waiting for opponent...';
  });
  
  socket.on('roomJoined', function(data) {
    mySymbol.value = data.symbol;
    onlineMode.value = 'playing';
  });
  
  socket.on('gameStart', function(data) {
    playerX.value = data.playerX;
    playerO.value = data.playerO;
    currentPlayer.value = data.currentPlayer;
    resetBoard();
  });
  
  socket.on('moveMade', function(data) {
    board.value = data.board;
    currentPlayer.value = data.currentPlayer;
  });
  
  socket.on('gameOver', function(data) {
    board.value = data.board;
    winner.value = data.winner;
    
    // show popup
    if (data.winner === 'draw') {
      popupMessage.value = "It's a draw!";
    } else {
      // check if i won or lost
      if (data.winner === mySymbol.value) {
        popupMessage.value = myName.value + ' wins!';
      } else {
        popupMessage.value = myName.value + ' loses!';
      }
    }
    showPopup.value = true;
  });
  
  socket.on('boardReset', function(data) {
    board.value = data.board;
    currentPlayer.value = data.currentPlayer;
    winner.value = '';
    showPopup.value = false;
  });
  
  socket.on('playerDisconnected', function(playerName) {
    errorMessage.value = playerName + ' disconnected';
    setTimeout(function() {
      resetAll();
    }, 2000);
  });
  
  socket.on('error', function(message) {
    errorMessage.value = message;
    setTimeout(function() {
      errorMessage.value = '';
    }, 2000);
  });
}

// create a new room
function createRoom() {
  if (!myName.value) {
    errorMessage.value = 'Please enter your name';
    setTimeout(function() {
      errorMessage.value = '';
    }, 2000);
    return;
  }
  
  gameMode.value = 'online';
  onlineMode.value = 'create';
  initializeSocket();
  socket.emit('createRoom', myName.value);
}

// join an existing room
function joinRoom() {
  if (!myName.value || !roomCodeInput.value) {
    errorMessage.value = 'Please enter your name and room code';
    setTimeout(function() {
      errorMessage.value = '';
    }, 2000);
    return;
  }
  
  gameMode.value = 'online';
  onlineMode.value = 'join';
  initializeSocket();
  socket.emit('joinRoom', {
    roomCode: roomCodeInput.value.toUpperCase(),
    playerName: myName.value
  });
  roomCode.value = roomCodeInput.value.toUpperCase();
}

// go back to main menu
function backToMenu() {
  resetAll();
  gameMode.value = 'menu';
}

// close the popup
function closePopup() {
  showPopup.value = false;
}

</script>

<template>
  <main class="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 p-4">
    
    <!-- Win/Loss Popup -->
    <div v-if="showPopup" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div class="bg-white rounded-2xl p-8 shadow-2xl max-w-md w-full mx-4 text-center">
        <h2 class="text-4xl font-bold mb-4 text-gray-800">🎉 game over! 🎉</h2>
        <p class="text-2xl mb-6 text-gray-700">{{ popupMessage }}</p>
        <button @click="closePopup" class="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-8 rounded-lg text-lg transition">
          ok
        </button>
      </div>
    </div>

    <!-- Error Message -->
    <div v-if="errorMessage" class="fixed top-4 right-4 bg-red-500 text-white px-6 py-3 rounded-lg shadow-lg z-50">
      {{ errorMessage }}
    </div>

    <!-- Menu Screen -->
    <div v-if="gameMode === 'menu'" class="max-w-2xl mx-auto mt-20 space-y-8">
      <h1 class="text-5xl font-bold text-center text-gray-800">🧙 wiz-wac-woe 🪄</h1>
      <p class="text-center text-gray-600">choose your game mode</p>
      
      <div class="space-y-4">
        <!-- Local Multiplayer -->
        <div class="bg-white rounded-xl p-6 shadow-lg space-y-4">
          <h2 class="text-2xl font-semibold text-gray-800">🏠 local multiplayer</h2>
          <p class="text-gray-600">play with a friend on the same device</p>
          <div class="space-y-3">
            <div>
              <label for="localPlayerX" class="block text-sm font-medium text-gray-700">🪄 wand player</label>
              <input id="localPlayerX" v-model="playerX" type="text" placeholder="enter name" class="w-full mt-1 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
            </div>
            <div>
              <label for="localPlayerO" class="block text-sm font-medium text-gray-700">🧙 wizard player</label>
              <input id="localPlayerO" v-model="playerO" type="text" placeholder="enter name" class="w-full mt-1 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent" />
            </div>
            <button @click="startLocalGame" class="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg transition">
              start local game
            </button>
          </div>
        </div>

        <!-- Online Multiplayer -->
        <div class="bg-white rounded-xl p-6 shadow-lg space-y-4">
          <h2 class="text-2xl font-semibold text-gray-800">🌐 online multiplayer</h2>
          <p class="text-gray-600">play with someone online</p>
          
          <div class="space-y-3">
            <div>
              <label for="onlineName" class="block text-sm font-medium text-gray-700">your name</label>
              <input id="onlineName" v-model="myName" type="text" placeholder="enter your name" class="w-full mt-1 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent" />
            </div>
            
            <div class="grid grid-cols-2 gap-3">
              <button @click="createRoom" class="bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 rounded-lg transition">
                create room
              </button>
              <button @click="onlineMode = 'join-input'" class="bg-green-600 hover:bg-green-700 text-white font-semibold py-3 rounded-lg transition">
                join room
              </button>
            </div>
            
            <!-- Join Room Input -->
            <div v-if="onlineMode === 'join-input'" class="space-y-3 pt-2">
              <div>
                <label for="roomCodeInput" class="block text-sm font-medium text-gray-700">room code</label>
                <input id="roomCodeInput" v-model="roomCodeInput" type="text" placeholder="enter 4-letter code" maxlength="4" class="w-full mt-1 p-3 border border-gray-300 rounded-lg uppercase focus:ring-2 focus:ring-green-500 focus:border-transparent" />
              </div>
              <button @click="joinRoom" class="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 rounded-lg transition">
                join game
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Game Screen -->
    <div v-if="gameMode !== 'menu'" class="max-w-6xl mx-auto mt-8">
      <div class="flex flex-col lg:flex-row gap-8">
        
        <!-- Game Board Section -->
        <section class="flex-1 space-y-6">
          <!-- Header -->
          <div class="bg-white rounded-xl p-6 shadow-lg text-center">
            <h1 class="text-3xl font-bold text-gray-800 mb-2">🧙 wiz-wac-woe 🪄</h1>
            
            <!-- Room Code Display -->
            <div v-if="gameMode === 'online' && roomCode" class="mb-4">
              <p class="text-sm text-gray-600">room code:</p>
              <p class="text-3xl font-mono font-bold text-purple-600">{{ roomCode }}</p>
              <p class="text-xs text-gray-500 mt-1">share this code with your friend</p>
            </div>
            
            <div v-if="!winner" class="flex items-center justify-center gap-2">
              <span class="text-lg">it's</span>
              <strong class="text-xl animate-bounce">{{ getCurrentPlayerName() }}</strong>
              <span class="text-lg">'s turn!</span>
            </div>
            <div v-if="winner" class="animate-pulse">
              <strong class="text-2xl text-green-600">{{ getWinnerName() }}</strong>
            </div>
            
            <!-- Turn Indicator for Online -->
            <div v-if="gameMode === 'online' && mySymbol" class="mt-2 text-sm text-gray-600">
              you are {{ mySymbol === '🪄' ? '🪄 wand' : '🧙 wizard' }}
            </div>
          </div>
          
          <!-- Game Board -->
          <div class="bg-white rounded-xl p-8 shadow-lg">
            <div class="grid grid-cols-3 gap-4 max-w-md mx-auto">
              <button
                v-for="index in 9"
                :key="index"
                type="button"
                class="aspect-square text-center flex items-center justify-center rounded-xl cursor-pointer text-5xl font-bold transition-all duration-200 transform hover:scale-105"
                :class="{
                  'bg-blue-500 text-white shadow-lg': board[index - 1] === '🪄',
                  'bg-purple-500 text-white shadow-lg': board[index - 1] === '🧙',
                  'bg-gray-200 hover:bg-gray-300': board[index - 1] === '',
                  'cursor-not-allowed opacity-50': winner || (gameMode === 'online' && mySymbol !== currentPlayer)
                }"
                @click="makeMove(index - 1)"
                :disabled="winner || (gameMode === 'online' && mySymbol !== currentPlayer)"
              >
                {{ board[index - 1] }}
              </button>
            </div>
          </div>
        </section>

        <!-- Sidebar -->
        <section class="lg:w-80 space-y-4">
          <!-- Players Info -->
          <div class="bg-white rounded-xl p-6 shadow-lg space-y-4">
            <h3 class="text-xl font-semibold text-gray-800">players</h3>
            <div class="space-y-3">
              <div class="p-3 rounded-lg" :class="currentPlayer === '🪄' ? 'bg-blue-100 border-2 border-blue-500' : 'bg-gray-50'">
                <p class="font-semibold text-gray-800">🪄 wand</p>
                <p class="text-sm text-gray-600">{{ playerX || 'player 🪄' }}</p>
              </div>
              <div class="p-3 rounded-lg" :class="currentPlayer === '🧙' ? 'bg-purple-100 border-2 border-purple-500' : 'bg-gray-50'">
                <p class="font-semibold text-gray-800">🧙 wizard</p>
                <p class="text-sm text-gray-600">{{ playerO || 'player 🧙' }}</p>
              </div>
            </div>
          </div>
          
          <!-- Controls -->
          <div class="bg-white rounded-xl p-6 shadow-lg space-y-3">
            <h3 class="text-xl font-semibold text-gray-800 mb-4">controls</h3>
            <button @click="resetBoard" class="w-full bg-yellow-500 hover:bg-yellow-600 text-white font-semibold py-3 rounded-lg transition">
              reset board
            </button>
            <button @click="backToMenu" class="w-full bg-gray-500 hover:bg-gray-600 text-white font-semibold py-3 rounded-lg transition">
              back to menu
            </button>
          </div>
        </section>
      </div>
    </div>

  </main>
</template>

<style scoped>

</style>