(function(window, io, Math2, KeyboardJS, PxLoader, sessionID, domain){
  var TILE_SIZE = 32,
      PLAYER_SPEED = 5,
      H_CELLS = 25,
      V_CELLS = 15,
      DEBUG = false,
      document = window.document,
      canv = document.querySelector('canvas'),
      ctx = canv.getContext('2d'),
      Vector2D = Math2.Vector2D,
      loader = new PxLoader(),
      room = null,
      players = [],
      cPlayer = null,
      canvWidth = 0,
      canvHeight = 0,
      images = {},
      waitRoomChange = false;
  
  canvWidth = canv.width = TILE_SIZE * H_CELLS; // 800
  canvHeight = canv.height = TILE_SIZE * V_CELLS; // 480
  
  // Images to load
  images.playerIdle = loader.addImage('/player-idle.png');
  images.playerWalk = [
    loader.addImage('/player-walk-1.png'),
    loader.addImage('/player-walk-2.png'),
    loader.addImage('/player-walk-3.png'),
    loader.addImage('/player-walk-4.png'),
    loader.addImage('/player-walk-5.png')
  ];
  
  var socket = io.connect('http://' + domain);
  
  socket.on('room', function(newRoom) {
    room = newRoom;
    console.log('room', room);
    updateRoomPlayers(room.players, true);
    waitRoomChange = false;
  });
  
  socket.on('room players', function(players) {
    if (!cPlayer) return;
    updateRoomPlayers(players);
  });
  
  // Updates a single player
  socket.on('player update', function(player) {
    for (var i=0; i < players.length; i++) {
      if (players[i].id === player.id) {
        players[i].position.x = player.position.x;
        players[i].position.y = player.position.y;
        players[i].direction.x = player.direction.x;
        players[i].direction.y = player.direction.y;
        players[i].speed = player.speed;
      }
    }
  });

  socket.on('message', function(data) {
    for (var i=0; i < players.length; i++) {
      if (players[i].id === data.player) {
        players[i].say(data.message);
      }
    }
  });
  
  var updateRoomPlayers = function(newPlayers, updateCPlayer){
    
    // Clear chat bubbles
    for (var i=0; i < players.length; i++) {
      players[i].clearSay();
    }
    if (updateCPlayer && cPlayer) {
      cPlayer.clearSay();
    }
    
    players = [];
    var player;
    for (var i=0; i < newPlayers.length; i++) {
      
      if (newPlayers[i].id === sessionID && !updateCPlayer) {
        continue;
      }
      
      player = new Player();
      player.id = newPlayers[i].id;
      player.dimensions.x = newPlayers[i].dimensions.x;
      player.dimensions.y = newPlayers[i].dimensions.y;
      player.position.x = newPlayers[i].position.x;
      player.position.y = newPlayers[i].position.y;
      player.direction.x = newPlayers[i].direction.x;
      player.direction.y = newPlayers[i].direction.y;
      player.direction.normalize();
      
      if (player.id === sessionID) {
        cPlayer = player;
      } else {
        players.push(player);
      }
    }
  };
  
  var vectorsCollide = function(a, b) {
    return (Math.abs(a.position.x - b.position.x) * 2 < (a.dimensions.x + b.dimensions.x)) &&
           (Math.abs(a.position.y - b.position.y) * 2 < (a.dimensions.y + b.dimensions.y));
  };
  
  var intersectDepthVectors = function(a, b) {
    // Calculate current and minimum-non-intersecting distances between centers.
    var distanceX = a.position.x - b.position.x;
    var distanceY = a.position.y - b.position.y;
    var minDistanceX = a.dimensions.x/2 + b.dimensions.x/2;
    var minDistanceY = a.dimensions.y/2 + b.dimensions.y/2;

    // If we are not intersecting at all, return (0, 0).
    if (Math.abs(distanceX) >= minDistanceX || Math.abs(distanceY) >= minDistanceY) {
      return new Vector2D(0,0);
    }
      
    // Calculate and return intersection depths.
    depthX = distanceX > 0 ? minDistanceX - distanceX : -minDistanceX - distanceX;
    depthY = distanceY > 0 ? minDistanceY - distanceY : -minDistanceY - distanceY;
    
    return new Vector2D(depthX, depthY);
  };
  
  var initTalk = function(){
    var keyBind = KeyboardJS.on('s');
    keyBind.on('keydown', function(){
      var msg = window.prompt('Message:');
      if (msg) {
        socket.emit('message', {
          player: cPlayer.id,
          message: msg
        });
        cPlayer.say(msg);
      }
    });
  };
  
  var Player = function(){
    this.position = new Vector2D(0, 0);
    this.direction = new Vector2D(0, 0);
    this.dimensions = new Vector2D(TILE_SIZE, TILE_SIZE);
  };
  Player.prototype.draw = function(){
    var playerImage;
    if (DEBUG) {
      ctx.strokeStyle = 'rgba(255,0,0,.5)';
      ctx.strokeRect(Math.round(this.position.x - this.dimensions.x/2) + 0.5, Math.round(this.position.y - this.dimensions.y/2) + 0.5, this.dimensions.x, this.dimensions.y);
    }
    ctx.save();
    ctx.translate(this.position.x, this.position.y);
    ctx.rotate(this.direction.getAngle());
    playerImage = this.speed? this.walkImage() : images.playerIdle;
    ctx.drawImage(playerImage, Math.round(-this.dimensions.x/2), Math.round(-this.dimensions.y/2), this.dimensions.x, this.dimensions.y);
    ctx.restore();
    this.positionSay();
  };
  Player.prototype.walkImage = function(){
    var now = Date.now(),
        switchSpeed = 100;
    if (!this.lastImgSwitch || now - this.lastImgSwitch > switchSpeed * images.playerWalk.length) {
      this.lastImgSwitch = now;
    }
    for (var i=0; i < images.playerWalk.length; i++) {
      if (now - this.lastImgSwitch < switchSpeed * (i+1)) {
        return images.playerWalk[i];
      }
    }
    return images.playerWalk[0];
  };
  Player.prototype.export = function(){
    return {
      position: this.position,
      direction: this.direction,
      speed: this.speed,
      id: this.id
    };
  };
  Player.prototype.positionSay = function(){
    if (!this.bubble || !this.bubbleRects) return;
    this.bubble.style.top = (this.bubbleRects.canv.top + this.position.y - this.bubbleRects.bubble.height - this.dimensions.y/2 - 10) + 'px';
    this.bubble.style.left = (this.bubbleRects.canv.left + this.position.x - this.bubbleRects.bubble.width/2) + 'px';
  };
  Player.prototype.clearSay = function(){
    if (this.bubble) {
      if (this.sayTimeout) {
        window.clearTimeout(this.sayTimeout);
        this.sayTimeout = null;
      }
      document.body.removeChild(this.bubble);
      this.bubble = null;
      this.bubbleRects = null;
    }
  };
  Player.prototype.say = function(msg){
    var self = this;
    this.clearSay();
    this.bubble = document.createElement('p');
    this.bubble.className = 'bubble';
    this.bubble.textContent = msg;
    document.body.appendChild(this.bubble);
    this.bubbleRects = {};
    this.bubbleRects.bubble = this.bubble.getBoundingClientRect();
    this.bubbleRects.canv = canv.getBoundingClientRect();
    this.positionSay();
    this.sayTimeout = window.setTimeout(function(){
      self.clearSay();
    }, 5000);
  };
  
  var getDoorVectors = function(side, coordinates) {
    var position = new Vector2D(TILE_SIZE/2, TILE_SIZE/2),
        dimensions = new Vector2D(TILE_SIZE, TILE_SIZE);
    
    switch (side) {
      case 1:
        position.x = canvWidth - TILE_SIZE/2;
        break;
      case 2:
        position.y = canvHeight - TILE_SIZE/2;
        break;
    }
    
    if (side === 0 || side === 2) {
      dimensions.y /= 2;
      if (side === 0) {
        position.y -= dimensions.y/2;
      } else {
        position.y += dimensions.y/2;
      }
      position.x = position.x + (coordinates * TILE_SIZE);
      
    } else if (side === 1 || side === 3) {
      dimensions.x /= 2;
      if (side === 3) {
        position.x -= dimensions.x/2;
      } else {
        position.x += dimensions.x/2;
      }
      position.y = position.y + (coordinates * TILE_SIZE);
    }
    
    return {
      position: position,
      dimensions: dimensions
    };
  };
  
  var drawDoor = function(side, coordinates) {
    var door = getDoorVectors(side, coordinates);
    ctx.fillStyle = 'rgba(0,0,0,.3)';
    ctx.fillRect(door.position.x - door.dimensions.x/2, door.position.y - door.dimensions.y/2, door.dimensions.x, door.dimensions.y);
    if (DEBUG) {
      ctx.strokeStyle = 'rgba(255,0,0,.5)';
      ctx.strokeRect(Math.round(door.position.x - door.dimensions.x/2) + 0.5, Math.round(door.position.y - door.dimensions.y/2) + 0.5, door.dimensions.x, door.dimensions.y);
    }
  };
  
  var drawRoom = function(room) {
    for (var i=0; i < room.doors.length; i++) {
      if (room.doors[i] > -1) {
        drawDoor(i, room.doors[i]);
      }
    }
  };
  
  var doorCollision = function(player){
    var door;
    for (var i=0; i < room.doors.length; i++) {
      if (room.doors[i] > -1) {
        door = getDoorVectors(i, room.doors[i]);
        if (vectorsCollide(door, player)) {
          return i;
        }
      }
    }
    return false;
  };
  
  // Keyboard
  var activeKeys = [];
  var activeKey = function(key) {
    return activeKeys.indexOf(key) !== -1;
  };
  
  var cPlayerLastPosition, cPlayerLastDirection, cPlayerLastSpeed = 0;
  
  var loop = makeLoop(30, function(now){
    if (!room || !cPlayer) return;
    
    activeKeys = KeyboardJS.activeKeys();
    cPlayer.speed = 0;
    
    // Direction
    if (activeKey('left')) {
      cPlayer.direction.x = -1;
      cPlayer.speed = PLAYER_SPEED;
      
    } else if (activeKey('right')) {
      cPlayer.direction.x = 1;
      cPlayer.speed = PLAYER_SPEED;
    }
    if (activeKey('up')) {
      cPlayer.direction.y = -1;
      cPlayer.speed = PLAYER_SPEED;
      
    } else if (activeKey('down')) {
      cPlayer.direction.y = 1;
      cPlayer.speed = PLAYER_SPEED;
    }
    
    if ((activeKey('up') || activeKey('down')) && (!activeKey('left') && !activeKey('right'))) {
      cPlayer.direction.x = 0;
    }
    if ((activeKey('left') || activeKey('right')) && (!activeKey('up') && !activeKey('down'))) {
      cPlayer.direction.y = 0;
    }
    cPlayer.direction.normalize();
    
    var doorCollided = doorCollision(cPlayer);
    if (doorCollided !== false && !waitRoomChange) {
      socket.emit('door collision', {
        doorIndex: doorCollided,
        player: cPlayer.export()
      });
      waitRoomChange = true;
    }
    
    // Caches the player position / direction
    if (!cPlayerLastPosition) {
      cPlayerLastPosition = new Vector2D(cPlayer.position);
    }
    if (!cPlayerLastDirection) {
      cPlayerLastDirection = new Vector2D(cPlayer.direction);
    }
    
    // Move
    cPlayer.position.add(Vector2D.multiply(cPlayer.direction, cPlayer.speed));
    // Limits
    if (cPlayer.position.x + cPlayer.dimensions.x/2 > canvWidth) {
      cPlayer.position.x = canvWidth - cPlayer.dimensions.x/2;
    } else if (cPlayer.position.x < cPlayer.dimensions.x/2) {
      cPlayer.position.x = cPlayer.dimensions.x/2;
    }
    if (cPlayer.position.y + cPlayer.dimensions.y/2 > canvHeight) {
      cPlayer.position.y = canvHeight - cPlayer.dimensions.y/2;
    } else if (cPlayer.position.y < cPlayer.dimensions.y/2) {
      cPlayer.position.y = cPlayer.dimensions.y/2;
    }
    for (var i=0; i < players.length; i++) {
      
      var intersectVector = intersectDepthVectors(cPlayer, players[i]);
      if (!(intersectVector.x === 0 && intersectVector.y === 0) ) {
        cPlayer.position = new Vector2D(cPlayer.position.x + intersectVector.x, cPlayer.position.y + intersectVector.y);
        break;
      }
    }
    
    // Update position
    if (!Vector2D.equals(cPlayer.position, cPlayerLastPosition) || !Vector2D.equals(cPlayer.direction, cPlayerLastDirection) || cPlayer.speed !== cPlayerLastSpeed) {
      socket.emit('new position', cPlayer.export());
      cPlayerLastPosition = new Vector2D(cPlayer.position);
      cPlayerLastDirection = new Vector2D(cPlayer.direction);
      cPlayerLastSpeed = cPlayer.speed;
    }
    
    // Drawing
    canv.width = canvWidth;
    
    if (DEBUG && doorCollided) {
      ctx.fillStyle = 'red';
      ctx.fillRect(0,0,10,10);
    }
    
    drawRoom(room);
    
    // Draw controlled player
    cPlayer.draw();
    
    // Draw players
    for (var j=0; j < players.length; j++) {
      players[j].draw();
    }
  });
  
  loader.addCompletionListener(function(){
    var keyBind = KeyboardJS.on('enter');
    keyBind.on('keydown', function(){
      canv.className = '';
      socket.emit('new player', sessionID);
      loop.start();
      
      initTalk();
      keyBind.clear();
    });
  });
  loader.start();
  
})(this, this.io, this.Math2, this.KeyboardJS, this.PxLoader, this.sessionID, this.domain);