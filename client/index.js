(function(window, io, Math2, KeyboardJS, PxLoader, sessionID, domain){
  var TILE_SIZE = 32,
      PLAYER_SPEED = 5,
      V_CELLS = 25,
      H_CELLS = 15,
      DEBUG = false,
      document = window.document,
      canv = document.getElementsByTagName('canvas')[0],
      ctx = canv.getContext('2d'),
      Vector2D = Math2.Vector2D,
      loader = new PxLoader(),
      room = null,
      players = [],
      cPlayer = null,
      canvWidth = 0,
      canvHeight = 0,
      images = {};
  
  canvWidth = canv.width = TILE_SIZE * V_CELLS; // 800
  canvHeight = canv.height = TILE_SIZE * H_CELLS; // 480
  
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
    drawRoom(room);
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
  
  var updateRoomPlayers = function(newPlayers, updateCPlayer){
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
  
  var vectorsCollide = function(a, b){
    return (Math.abs(a.position.x - b.position.x) * 2 < (a.dimensions.x + b.dimensions.x)) &&
           (Math.abs(a.position.y - b.position.y) * 2 < (a.dimensions.y + b.dimensions.y));
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
      position.x = position.x + (coordinates * Math.round(canvWidth / H_CELLS));
      
    } else if (side === 1 || side === 3) {
      dimensions.x /= 2;
      if (side === 3) {
        position.x -= dimensions.x/2;
      } else {
        position.x += dimensions.x/2;
      }
      position.y = position.y + (coordinates * Math.round(canvHeight / V_CELLS));
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
          return true;
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
    
    var doorCollide = doorCollision(cPlayer);
    
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
    
    // Update position
    if (!cPlayerLastPosition) {
      cPlayerLastPosition = new Vector2D(cPlayer.position);
    }
    if (!cPlayerLastDirection) {
      cPlayerLastDirection = new Vector2D(cPlayer.direction);
    }
    if (!Vector2D.equals(cPlayer.position, cPlayerLastPosition) || !Vector2D.equals(cPlayer.direction, cPlayerLastDirection) || cPlayer.speed !== cPlayerLastSpeed) {
      socket.emit('new position', cPlayer.export());
      cPlayerLastPosition = new Vector2D(cPlayer.position);
      cPlayerLastDirection = new Vector2D(cPlayer.direction);
      cPlayerLastSpeed = cPlayer.speed;
    }
    
    // Drawing
    canv.width = canvWidth;
    
    if (DEBUG && doorCollide) {
      ctx.fillStyle = 'red';
      ctx.fillRect(0,0,10,10);
    }
    
    drawRoom(room);
    
    // Draw controlled player
    cPlayer.draw();
    
    // Draw players
    for (var i=0; i < players.length; i++) {
      players[i].draw();
    }
  });
  
  loader.addCompletionListener(function(){
    var keyBind = KeyboardJS.on('enter');
    keyBind.on('keydown', function(){
      canv.className = '';
      socket.emit('new player', sessionID);
      loop.start();
      keyBind.clear();
    });
  });
  loader.start();
  
})(this, this.io, this.Math2, this.KeyboardJS, this.PxLoader, this.sessionID, this.domain);