function GameManager(size, InputManager, Actuator, ScoreManager) {
  this.size         = size; // Size of the grid
  this.inputManager = new InputManager;
  this.scoreManager = new ScoreManager;
  this.actuator     = new Actuator;

  this.startTiles   = 1;

  this.inputManager.on("move", this.move.bind(this));
  this.inputManager.on("player_move", this.player_move.bind(this));
  this.inputManager.on("restart", this.restart.bind(this));
  this.inputManager.on("keepPlaying", this.keepPlaying.bind(this));

  this.setup();
}

// Restart the game
GameManager.prototype.restart = function () {
  this.actuator.continue();
  this.setup();
};

// Keep playing after winning
GameManager.prototype.keepPlaying = function () {
  this.keepPlaying = true;
  this.actuator.continue();
};

GameManager.prototype.isGameTerminated = function () {
  if (this.over || (this.won && !this.keepPlaying)) {
    return true;
  } else {
    return false;
  }
};

// Set up the game
GameManager.prototype.setup = function () {
  this.grid        = new Grid(this.size);

  this.score       = 0;
  this.nextTile    = this.randomTile();
  this.over        = false;
  this.won         = false;
  this.keepPlaying = false;

  // Add the initial tiles
  this.addStartTiles();

  // Update the actuator
  this.actuate();
};

// Set up the initial tiles to start the game with
GameManager.prototype.addStartTiles = function () {
  var player_tile = new Tile(this.grid.randomFirstCell(), this.nextTile);
  this.grid.player_tile.push(player_tile);
  this.grid.insertTile(player_tile);

  for (var i = 0; i < this.startTiles; i++) {
    this.addRandomTile();
  }
};

// Generates tile value
GameManager.prototype.randomTile = function () {
  var rand = Math.random();
  return rand < 0.7 ? 2 : (rand < 0.9 ? 4 : 8);
};

// Adds a tile in a random position
GameManager.prototype.addRandomTile = function () {
  if (this.grid.cellsAvailable()) {
    window.timeOut = 400;
    if(window.trySlideDown) {
      window.moveObj.move(2); clearTimeout(window.trySlideDown); window.trySlideDown = null;
    }
    if(window.moveObj) {
      clearTimeout(window.autoFall);
      window.autoFall = setTimeout(function(){window.moveObj.move(4);}, window.timeOut);
    }

    var falling_tile = new Tile(this.grid.randomAvailableCell(), this.nextTile);
    this.nextTile = this.randomTile();
    this.grid.falling = falling_tile;
    this.grid.is_merged = false;
    this.grid.insertTile(falling_tile);
  }
};

// Sends the updated grid to the actuator
GameManager.prototype.actuate = function () {
  if (this.scoreManager.get() < this.score) {
    this.scoreManager.set(this.score);
  }

  this.actuator.actuate(this.grid, {
    score:      this.score,
    tileValue:  this.nextTile,
    over:       this.over,
    won:        this.won,
    bestScore:  this.scoreManager.get(),
    terminated: this.isGameTerminated()
  });

};

// Save all tile positions and remove merger info
GameManager.prototype.prepareTiles = function () {
  this.grid.eachCell(function (x, y, tile) {
    if (tile) {
      tile.mergedFrom = null;
      tile.savePosition();
    }
  });
};

// Move a tile and its representation
GameManager.prototype.moveTile = function (tile, cell) {
  this.grid.cells[tile.x][tile.y] = null;
  this.grid.cells[cell.x][cell.y] = tile;
  tile.updatePosition(cell);
};

GameManager.prototype.player_move = function (direction) {
  var self = this;

  if (this.isGameTerminated()) return; // Don't do anything if the game's over

  var cell, tile;
  
  var vector     = this.getVector(direction);
  var traversals = this.buildTraversals(vector);
  var moved      = false;
  // Save the current tile positions and remove merger information
  this.prepareTiles();

  // Traverse the grid in the right direction and move tiles
  var temp_player_tile = {tile: [], farthest: []};
  var dont_move = traversals.x.length;
  for(var i=0; i < traversals.x.length; i++){// || traversals.y.length -> player tiles length
    cell = { x: traversals.x[i], y: traversals.y[i] };
    tile = self.grid.cellContent(cell);
    if (tile) {
        var positions = self.findFarthestPosition(cell, vector);
        var next      = self.grid.cellContent(positions.next);

        if(!this.positionsEqual(tile,positions.farthest)){
          temp_player_tile.tile.push(tile);
          temp_player_tile.farthest.push(positions.farthest);
        }
        else if (next && next.value === tile.value && !next.mergedFrom) {
          self.grid.is_merged = true;
          var merged = new Tile(positions.next, tile.value * 2);
          merged.mergedFrom = [tile, next];
          self.grid.falling = merged;
          self.grid.insertTile(merged);
          self.grid.removeTile(tile);

          // Converge the two tiles' positions
          tile.updatePosition(positions.next);
          tile.value = merged.value;
          // Update the score
          self.score += merged.value;

          // The mighty 2048 tile
          if (merged.value === 2048) self.won = true;

          temp_player_tile.tile.push(tile);
          temp_player_tile.farthest.push(positions.next);
          dont_move = i;
      }
    }
  }

  //if all player tiles can be moved, checked using temp_player_tile
  if(temp_player_tile.tile.length === this.grid.player_tile.length){
    this.grid.player_tile = [];
    for(var i=0; i < temp_player_tile.tile.length; i++){// || temp_player_tile.farthest.length
      if( i != dont_move)
        self.moveTile(temp_player_tile.tile[i],temp_player_tile.farthest[i]);
      this.grid.player_tile.push(temp_player_tile.tile[i]);
    };
    //for(var i = 0; i < this.grid.player_tile.length; i++)
    //      console.log("test 0 :" +this.grid.player_tile[i].x + " " + this.grid.player_tile[i].y + " " + this.grid.player_tile[i].value)
  }

  this.actuate();

}
// Move tiles on the grid in the specified direction
GameManager.prototype.move = function (direction) {
  // 0: up, 1: right, 2:down, 3: left, 4: one step fall
  window.moveObj = this;

  /*if(direction == 2 && window.trySlideDown) {
    clearTimeout(window.trySlideDown); window.trySlideDown = null;
  }*/

  if(direction == 4)
      window.autoFall = setTimeout(function(){window.moveObj.move(4);}, window.timeOut);

  var self = this;

  if (this.isGameTerminated()) return; // Don't do anything if the game's over

  var cell, tile;

  var vector     = this.getVector(direction);
  var traversals = this.buildTraversals(vector);
  var moved      = false;
  // Save the current tile positions and remove merger information
  this.prepareTiles();

  // Traverse the grid in the right direction and move tiles

  traversals.x.forEach(function (x) {
    traversals.y.forEach(function (y) {
      cell = { x: x, y: y };
      tile = self.grid.cellContent(cell);

      if (tile) {
        var positions = self.findFarthestPosition(cell, vector);
        var next      = self.grid.cellContent(positions.next);

        // Only one merger per row traversal?
        if (next && next.value === tile.value && !next.mergedFrom) {
          self.grid.is_merged = true;
          var merged = new Tile(positions.next, tile.value * 2);
          merged.mergedFrom = [tile, next];
          self.grid.falling = merged;
          self.grid.insertTile(merged);
          self.grid.removeTile(tile);

          // Converge the two tiles' positions
          tile.updatePosition(positions.next);
          tile.value = merged.value;
          // Update the score
          self.score += merged.value;

          // The mighty 2048 tile
          if (merged.value === 2048) self.won = true;
        } else {
          self.moveTile(tile, positions.farthest);
        }
        if (!self.positionsEqual(cell, tile)) {
          moved = true; // The tile moved from its original cell!
        }
      }
    });
  });

  //Keep on decreasing timeout after each
  //movement of falling block.
  window.timeOut = window.timeOut * window.FACTOR;
  if (moved) {
    if(self.grid.is_merged){
      var merged_position = this.grid.player_tile.length;
      for(var i = 0; i < this.grid.player_tile.length; i++){
          if(this.positionsEqual(cell, this.grid.player_tile[i])){
            merged_position = i;
            break;
          }
      } 
      
      if(merged_position ==  this.grid.player_tile.length){ //if merged on the most top tile
        this.grid.player_tile.splice(this.grid.player_tile.length - 1, 1);
        this.grid.player_tile.push(tile);
      }
      else{//if merged in the middle
        //console.log(merged_position + " " + this.grid.player_tile.length)
        for(var i = merged_position; i < this.grid.player_tile.length - 1; i++){
          this.grid.player_tile[i].value = this.grid.player_tile[i + 1].value;
          self.grid.insertTile(this.grid.player_tile[i]);
        }
        this.grid.player_tile[merged_position - 1] = tile;    
        this.grid.removeTile(this.grid.player_tile[this.grid.player_tile.length - 1]);
        this.grid.player_tile.splice(this.grid.player_tile.length - 1, 1);

        /*for(var i = merged_position; i < this.grid.player_tile.length - 1; i++){
          this.grid.player_tile[i].value = this.grid.player_tile[i + 1].value;
          self.moveTile(this.grid.player_tile[i + 1],this.grid.player_tile[i]);
        }
        this.grid.player_tile[merged_position - 1] = tile;    
        this.grid.player_tile.splice(this.grid.player_tile.length - 1, 1);*/
        //for(var i = 0; i < this.grid.player_tile.length; i++)
        //  console.log("test 1 :" +this.grid.player_tile[i].x + " " + this.grid.player_tile[i].y + " " + this.grid.player_tile[i].value)
      }
      /*if(!this.positionsEqual(cell,this.grid.player_tile[this.grid.player_tile.length - 1])){
        this.grid.player_tile.splice(this.grid.player_tile.length - 1, 1);
        this.grid.player_tile.push(tile);
      } 
      else{
        this.grid.player_tile.splice(this.grid.player_tile.length - 1, 1);
        this.grid.player_tile[this.grid.player_tile.length - 1] = tile;    
      }*/
    }
   this.actuate();
  } else {
    if((direction == 2 || direction == 4) && this.grid.falling.y == 0)
      this.over = true; // Game over!
    if(direction == 4 && this.grid.falling.y != 0){
      var merged_position = this.grid.player_tile.length - 1;
      var addNewTile = true;
      for(var i = 0; i < this.grid.player_tile.length; i++){
          if(this.positionsEqual(self.grid.falling, this.grid.player_tile[i])){
            merged_position = i;
            addNewTile = false;
          }
      } 
      if(addNewTile == true){
        if(this.grid.player_tile[this.grid.player_tile.length - 1].y - 1 == self.grid.falling.y)
          this.grid.player_tile.push(tile);
        else
          this.grid.removeTile(tile);
      } else {
        this.grid.player_tile[merged_position] = tile; 
        var recheck_merged = merged_position;//check if player_tile can be merged        
        while(recheck_merged < merged_position + 1){
          if (this.grid.player_tile[recheck_merged] && this.grid.player_tile[recheck_merged + 1]) {
            if (this.grid.player_tile[recheck_merged].value === this.grid.player_tile[recheck_merged + 1].value) {
              for(var i = recheck_merged; i < this.grid.player_tile.length - 1; i++){
                if(i == recheck_merged) //value * 2
                  this.grid.player_tile[i].value = this.grid.player_tile[i + 1].value * 2;
                else
                  this.grid.player_tile[i].value = this.grid.player_tile[i + 1].value;
                self.grid.insertTile(this.grid.player_tile[i]);
              }
              this.grid.removeTile(this.grid.player_tile[this.grid.player_tile.length - 1]);
              this.grid.player_tile.splice(this.grid.player_tile.length - 1, 1);
    
              // Update the score
              self.score += this.grid.player_tile[recheck_merged].value;

              // The mighty 2048 tile
              if (this.grid.player_tile[recheck_merged].value === 2048) self.won = true;

              if(recheck_merged > 0)
                recheck_merged--;
            } else {
              recheck_merged++;
            }
          } else {
            break;
          }
        }
        //for(var i = 0; i < this.grid.player_tile.length; i++)
        //  console.log("test 3:" + this.grid.player_tile[i].x + " " + this.grid.player_tile[i].y + " " + this.grid.player_tile[i].value)
      }
      /*if(!this.positionsEqual(this.grid.player_tile[this.grid.player_tile.length - 1], self.grid.falling)){
        if(this.grid.player_tile[this.grid.player_tile.length - 1].y - 1 == self.grid.falling.y)
          this.grid.player_tile.push(tile);
        else
          this.grid.removeTile(tile);
      }
      else{
        this.grid.player_tile.splice(this.grid.player_tile.length - 1, 1);
        this.grid.player_tile.push(tile); 
      }*/
      this.addRandomTile();
    }
    this.actuate();
  }
};

// Get the vector representing the chosen direction
GameManager.prototype.getVector = function (direction) {
  // Vectors representing tile movement
  var map = {
    0: { x: 0,  y: -1 }, // up
    1: { x: 1,  y: 0 },  // right
    2: { x: 0,  y: 1 },  // down
    3: { x: -1, y: 0 },   // left
    4: { x: 0, y: 0} //one step fall
  };

  return map[direction];
};

// Build a list of positions to traverse in the right order
GameManager.prototype.buildTraversals = function (vector) {
  var traversals = { x: [], y: [] };

  /*for (var pos = 0; pos < this.size; pos++) {
    traversals.x.push(pos);
    traversals.y.push(pos);
  }
    traversals.y.push(this.size);

  // Always traverse from the farthest cell in the chosen direction
  if (vector.x === 1) traversals.x = traversals.x.reverse();
  if (vector.y === 1) traversals.y = traversals.y.reverse();*/
  if (vector.x === 1 || vector.x === -1) {
    this.grid.player_tile.forEach(function(value){
      traversals.x.push(value.x);
      traversals.y.push(value.y);
    })
  }
      // if(vector.y == 0) traversals.y = [0]
  /*if(vector.y == 0) { // && vector.x == 0) {
      traversals.x = [];
      traversals.y = [];
      for (var i = 0; i < this.grid.falling.length; i++) {
        alert("asd")
        traversals.x.push(this.grid.falling[i].x); 
        traversals.y.push(this.grid.falling[i].y);
      }
  };*/
  // if(vector.y == 0) traversals.y = [0]
  if(vector.y == 0 && vector.x == 0)  { // && vector.x == 0) {
    traversals.x = [this.grid.falling.x]; 
    traversals.y = [this.grid.falling.y];
  }
  return traversals;
};

GameManager.prototype.findFarthestPosition = function (cell, vector) {
  var previous;
  
  if(vector.y == 0) {
        //for falling tile
        if(vector.x == 0)vector.y = 1;

        previous = cell; cell = { x: previous.x + vector.x, y: previous.y + vector.y };

        //for player tile
        if(cell.x >= this.size) cell.x = 0; 
        else if(cell.x < 0) cell.x = this.size - 1;

        /*if(vector.x == 0){
          if(cell.y >= this.size + 1) cell.y = 0;
        }*/

        if(this.grid.withinBounds(cell) && this.grid.cellAvailable(cell)) {
        previous = cell; //cell = { x: previous.x + vector.x, y: previous.y + vector.y };          
        if(vector.x == 0)vector.y = 0;
        }
  } else {
    // Progress towards the vector direction until an obstacle is found
    do {
      previous = cell;
      cell     = { x: previous.x + vector.x, y: previous.y + vector.y };
    } while (this.grid.withinBounds(cell) &&
             this.grid.cellAvailable(cell));
  }

  return {
    farthest: previous,
    next: cell // Used to check if a merge is required
  };
};

GameManager.prototype.movesAvailable = function () {
  return this.grid.cellsAvailable() || this.tileMatchesAvailable();
};

// Check for available matches between tiles (more expensive check)
GameManager.prototype.tileMatchesAvailable = function () {
  var self = this;

  var tile;

  for (var x = 0; x < this.size; x++) {
    for (var y = 0+1; y < (this.size*2)+1; y++) {
      tile = this.grid.cellContent({ x: x, y: y });

      if (tile) {
        for (var direction = 0; direction < 4; direction++) {
          var vector = self.getVector(direction);
          var cell   = { x: x + vector.x, y: y + vector.y };

          var other  = self.grid.cellContent(cell);

          if (other && other.value === tile.value) {
            return true; // These two tiles can be merged
          }
        }
      }
    }
  }

  return false;
};

GameManager.prototype.positionsEqual = function (first, second) {
  return first.x === second.x && first.y === second.y;
};
