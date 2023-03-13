'use strict';

const PLAYER_ACTOR_INDEX = 0

function getRandomInt(min, max)
{
   return Math.floor(Math.random() * (max - min + 1) + min);
}

var Direction = Object.freeze({
   NONE : 0,
   NORTH : 1,
   SOUTH : 2,
   EAST : 3,
   WEST : 4,

   _opposites : [ this.SOUTH, this.NORTH, this.WEST, this.EAST ],
   _clockwise : [ this.EAST, this.WEST, this.SOUTH, this.NORTH ],

   opposite : function(dir)
   {
      return this._opposites[dir];
   },

   clockwise : function(dir)
   {
      return _clockwise[dir];
   },

   counterClockwise : function(dir)
   {
      return this._opposites[_clockwise[dir]];
   },

   random : function()
   {
      return getRandomInt(1, 4);
   }
});

var ObjectFlags = Object.freeze({
   NONE : 0,
   TEXT : 1
});

var SpinGlyph = Object.freeze([ 124, 47, 45, 92 ]);
var SpinGunGlyph = Object.freeze([ 27, 24, 26, 25 ]);
var KeyColors = [ "black", "blue", "green", "cyan", "red", "purple", "yellow", "white" ];

var applyDirection = function(x, y, dir)
{
   if (dir == Direction.NONE)
      return {x:x, y:y};
   else if (dir == Direction.NORTH)
      return {x:x, y:y-1};
   else if (dir == Direction.SOUTH)
      return {x:x, y:y+1};
   else if (dir == Direction.WEST)
      return {x:x-1, y:y};
   else if (dir == Direction.EAST)
      return {x:x+1, y:y};
}

var genericEnemyMove = function(actorIndex, board, dir)
{
   var actorData = board.statusElement[actorIndex];
   var newPosition = applyDirection(actorData.x, actorData.y, dir);
   var dstTile = board.get(newPosition.x, newPosition.y);
   if (dstTile.properties.floor)
   {
      board.moveActor(actorIndex, newPosition.x, newPosition.y);
   }
   /* else if player or if breakable, attack */
}

var baseObjectMove = function (board, dir)
{
   if (dir == Direction.NONE)
      return;

   var oldX = this.x;
   var oldY = this.y;
   var newX = this.x;
   var newY = this.y;

   if (dir == Direction.NORTH)
      --newY;
   else if (dir == Direction.SOUTH)
      ++newY;
   else if (dir == Direction.EAST)
      ++newX;
   else if (dir == Direction.WEST)
      --newX;

   // If the player is trying to move off the edge, then we might need to switch
   // boards...
   //
   // TODO: Does this belong here in move()?
   if (this.name == "player")
   {
      var boardSwitch = false;
      var newBoardID = 0;
      if (newY < 0 && board.exitNorth > 0)
      {
         newBoardID = board.exitNorth;
         boardSwitch = true;
      }
      else if (newY >= board.height && board.exitSouth > 0)
      {
         newBoardID = board.exitSouth;
         boardSwitch = true;
      }
      else if (newX < 0 && board.exitWest > 0)
      {
         newBoardID = board.exitWest;
         boardSwitch = true;
      }
      else if (newX >= board.width && board.exitEast > 0)
      {
         newBoardID = board.exitEast;
         boardSwitch = true;
      }

      if (boardSwitch)
      {
         /* Correct newX/newY for the fact that we've crossed boards */

         var newBoard = game.world.board[newBoardID];

         if (newX < 0)
            newX = newBoard.width - 1;
         else if (newX >= board.width)
            newX = 0;

         if (newY < 0)
            newY = newBoard.height - 1;
         else if (newY >= board.height)
            newY = 0;

         /* we need to move the player into position.
            clear the old player position */
         var empty = new Empty;
         empty.x = newBoard.player.x;
         empty.y = newBoard.player.y;
         newBoard.set(newBoard.player.x, newBoard.player.y, empty);

         /* put the player at the new position */
         newBoard.player.x = newX;
         newBoard.player.y = newY;
         newBoard.set(newBoard.player.x, newBoard.player.y, newBoard.player);

         /* make this the new current board */
         game.world.playerBoard = newBoardID;
         game.world.currentBoard = newBoard;

         return true;
      }
   }

   if (newY < 0)
      newY = 0;
   else if (newY >= board.height)
      newY = board.height - 1;

   if (newX < 0)
      newX = 0;
   else if (newX >= board.width)
      newX = board.width - 1;

   var that = board.get(newX, newY);


   if (that?.properties?.name == "empty")
   {
      board.moveActor(PLAYER_ACTOR_INDEX, newX, newY)
      
      return true;
   }
   /* else if not empty then it's a little more complicated */
   else
   {
      /* if we're the player, and we're touching an item, and that item can be taken,
         then we take it. */
      if (this.name == "player" && that?.properties?.takeItem && that.properties.takeItem())
      {
         board.moveActor(PLAYER_ACTOR_INDEX, newX, newY)
      }
      
      //if we're the player, and we're touching a forrest, move anyway
      if (this.name == "player" && that?.properties?.name === "forest")
      {
         board.moveActor(PLAYER_ACTOR_INDEX, newX, newY)
      }
      
      // if we're the player hitting a collidable... (e.g., passage)
      this.name == "player" && that?.properties?.onCollision && that.properties.onCollision(this, board, newX, newY)
   }

   return false;
}

/* direction from (x1,y1) to (x2, y2) */
function toward(x1, y1, x2, y2)
{
   var dx = x1 - x2;
   var dy = y1 - y2;
   var dirx = Direction.NONE;
   var diry = Direction.NONE;

   if (dx < 0)
      dirx = Direction.EAST;
   else if (dx > 0)
      dirx = Direction.WEST;

   if (dy < 0)
      diry = Direction.SOUTH;
   else if (dy > 0)
      diry = Direction.NORTH;

   /* could stand to be a little more intelligent here... */
   if (Math.abs(dx) > Math.abs(dy))
   {
      if (dirx != Direction.NONE)
         return dirx;
      else
         return diry;
   }
   else
   {
      if (diry != Direction.NONE)
         return diry;
      else
         return dirx;
   }
}

var Empty =
{
   glyph: 32,
   name: "empty",
   floor: true
};

var Edge =
{
   glyph: 69
}

var Player =
{
   glyph: 2,
   name: "player",
   visibleInTheDark: true,
   color: VGA.ATTR_BG_BLUE|VGA.ATTR_FG_WHITE,
   update: function(board, actorIndex)
   {
      var walkDirection = Direction.NONE;
      // get player position
      var pos;
      game.world.currentBoard.tiles.forEach(function(el, ind) { 
        if (el.typeid === 4) { pos = ind; }
      });

      this.y = Math.floor(pos / 60);
      this.x = pos % 60;

      if (game.inputEvent != 0)
      {
         if (game.inputEvent == ZInputEvent.WALK_NORTH)
            walkDirection = Direction.NORTH;
         else if (game.inputEvent == ZInputEvent.WALK_SOUTH)
            walkDirection = Direction.SOUTH;
         else if (game.inputEvent == ZInputEvent.WALK_EAST)
            walkDirection = Direction.EAST;
         else if (game.inputEvent == ZInputEvent.WALK_WEST)
            walkDirection = Direction.WEST;

         else if (game.inputEvent == ZInputEvent.SHOOT_NORTH) {
           Bullet.create(board, this.x, this.y-1, Direction.NONE, Direction.NORTH, 'player')
         }
         else if (game.inputEvent == ZInputEvent.SHOOT_SOUTH) {
           Bullet.create(board, this.x, this.y+1, Direction.NONE, Direction.SOUTH, 'player')
         }
         else if (game.inputEvent == ZInputEvent.SHOOT_EAST) {
           Bullet.create(board, this.x+1, this.y, Direction.EAST, Direction.NONE, 'player')
         }
         else if (game.inputEvent == ZInputEvent.SHOOT_WEST) {
           Bullet.create(board, this.x-1, this.y, Direction.WEST, Direction.NONE, 'player')
         }

         else if (game.inputEvent == ZInputEvent.QUIT)
         {
            /* ? */
            goToTitleScreen();
         }
         else if (
           game.inputEvent == ZInputEvent.USE_TORCH 
           && game.world.currentBoard?.isDark
           && game.world.playerTorches > 0
           && game.world.torchCycles === 0
         )
         {
           // torch life :22 (22 sec) (165 ticks?)
           // :55 (55 sec) (420 ticks)
           // 1:50 (110 sec) (840 ticks)
           game.world.playerTorches--;
           game.world.torchCycles = Torch.maxCycles;
         }

         game.inputEvent = 0;
      }

      if (walkDirection != Direction.NONE)
      {
         var oldX = this.x;
         var oldY = this.y;
         var newX = this.x;
         var newY = this.y;

         if (walkDirection == Direction.NORTH)
            --newY;
         else if (walkDirection == Direction.SOUTH)
            ++newY;
         else if (walkDirection == Direction.EAST)
            ++newX;
         else if (walkDirection == Direction.WEST)
            --newX;

         // If the player is trying to move off the edge, then we might need to switch
         // boards...
         //
         // TODO: Does this belong here in move()?
        var boardSwitch = false;
        var newBoardID = 0;
        if (newY < 0 && board.exitNorth > 0)
        {
           newBoardID = board.exitNorth;
           boardSwitch = true;
        }
        else if (newY >= board.height && board.exitSouth > 0)
        {
           newBoardID = board.exitSouth;
           boardSwitch = true;
        }
        else if (newX < 0 && board.exitWest > 0)
        {
           newBoardID = board.exitWest;
           boardSwitch = true;
        }
        else if (newX >= board.width && board.exitEast > 0)
        {
           newBoardID = board.exitEast;
           boardSwitch = true;
        }

        if (boardSwitch)
        {
           /* Correct newX/newY for the fact that we've crossed boards */

           var newBoard = game.world.board[newBoardID];

           if (newX < 0)
              newX = newBoard.width - 1;
           else if (newX >= board.width)
              newX = 0;

           if (newY < 0)
              newY = newBoard.height - 1;
           else if (newY >= board.height)
              newY = 0;

           /* make this the new current board and move the player there */
           game.world.playerBoard = newBoardID;
           game.world.currentBoard = newBoard;
           game.world.currentBoard.moveActor(actorIndex, newX, newY);

           return true;
        }


        // // if we have walked off the screen...
        // if () {
        //   board.load()
        // }
        // else try to move the player
        else {
         this.baseObjectMove(board, walkDirection);
        }
      }
   },
   baseObjectMove,
}

var Ammo =
{
   glyph: 132,
   name: "ammo",
   color: VGA.ATTR_FG_CYAN,
   takeItem: function()
   {
      if (!game.world.hasGotAmmoMsg)
      {
         game.world.currentBoard.setMessage("Ammunition - 5 shots per container.");
         game.world.hasGotAmmoMsg = true;
      }

      game.world.playerAmmo += 5;
      game.audio.play("tcc#d");
      return true;
   }
}

var Torch =
{
   glyph: 157,
   name: "torch",
   ticksPerCycle: 33,
   maxCycles: 5,
   takeItem: function()
   {
      if (!game.world.hasGotTorchMsg)
      {
         game.world.currentBoard.setMessage("Torch - used for lighting in the underground.");
         game.world.hasGotTorchMsg = true;
      }

      game.world.playerTorches += 1;
      game.audio.play("tcase");
      return true;
   },
  die: function()
  {
      game.world.torchCycleOffset = null
      game.audio.play(game.audio.SFX_TORCH_DEAD);
  }
}

var Gem =
{
   glyph: 4,
   name: "gem",
   takeItem: function()
   {
      if (!game.world.hasGotGemMsg)
      {
         game.world.currentBoard.setMessage("Gems give you Health!");
         game.world.hasGotGemMsg = true;
      }

      game.world.playerGems += 1;
      game.world.playerHealth += 1;
      game.world.playerScore += 10;
      game.audio.play("t+c-gec");
      return true;
   }
}

var Key =
{
   glyph: 12,
   name: "key",
   takeItem: function()
   {
      var keyColor = (this.color & 0x07);
      var couldGiveKey = false;
      if (keyColor == 0)
      {
         /* The 'black' key is weird. Black keys are technically
            invalid, and overwrite the space in the player info
            just before the keys, which happens to give the player
            256 gems instead. */
         game.world.playerGems += 256;
         couldGiveKey = true;
      }
      else if (keyColor > 0 && keyColor <= 7)
      {
         if (!game.world.playerKeys[keyColor-1])
         {
            couldGiveKey = true;
            game.world.playerKeys[keyColor-1] = true;
         }
      }
      else
      {
         console.log("this key's an invalid color!");
         return false;
      }

      if (!couldGiveKey)
      {   
         game.world.currentBoard.setMessage("You already have a " + KeyColors[keyColor] + " key!");
         game.audio.play("sc-c");
         return false;
      }
      else
      {
         game.world.currentBoard.setMessage("You now have the " + KeyColors[keyColor] + " key");
         game.audio.play("t+cegcegceg+sc");
         return true;
      }
   }
}

var Door =
{
   glyph: 10,
   name: "door",
   takeItem: function()
   {
      /* A door isn't really an 'item' per se but works similarly--
         it needs to disappear when the player walks over it, if they
         have the key. */
      var keyColor = ((this.color & 0x70) >> 4);
      var doorUnlocked = false;
      if (keyColor == 0)
      {
         /* Black doors, like black keys, are weird. */
         if (game.world.playerGems >= 256)
         {
            game.world.playerGems -= 256;
            doorUnlocked = true;
         }
      }
      else if (keyColor > 0 && keyColor <= 7)
      {
         if (game.world.playerKeys[keyColor-1])
         {
            game.world.playerKeys[keyColor-1] = false;
            doorUnlocked = true;
         }
      }
      else
      {
         console.log("this door's an invalid color!");
         return false;
      }

      if (doorUnlocked)
      {
         game.world.currentBoard.setMessage("The " + KeyColors[keyColor] + " door is now open!");
         game.audio.play("tcgbcgb+ic");
         return true;
      }
      else
      {
         game.world.currentBoard.setMessage("The " + KeyColors[keyColor] + " door is locked.");
         game.audio.play("t--gc");
         return false;
      }
   }
}

var Scroll =
{
   glyph: 232,
   name: "scroll"
}

/* Passages use P3 for destination board */
var Passage =
{
   glyph: 240,
   name: "passage",
   allowUndertile: true,
   visibleInTheDark: true,
   onCollision: function(otherObject, board, x, y) {
      if (otherObject?.name === 'player') {
         const thisObject = board.getActorAt(x, y)

         const newBoardID = thisObject?.param3
         const newBoard = game.world.board[newBoardID];
        
         // ZZTBoard.load(newBoardID, 

         // console.log(">>> Player hit me", this, thisObject, newBoard)

         const exitPassage = newBoard.statusElement.find(obj => {
           const tile = newBoard.get(obj.x, obj.y)
           // console.log(">>>tile", tile, {x: obj.x, y: obj.y})
           if (tile?.properties?.name === 'passage') {
             const passageObject = newBoard.getActorAt(obj.x, obj.y)
             // console.log(">>> passageObject", passageObject, board.id)
             return (passageObject?.param3 === board.id)
           }
         })
         // console.log(">>> exitPassage", exitPassage)

         const newX = exitPassage.x
         const newY = exitPassage.y

         Passage.travel();
         return ZZTBoard.load(newBoardID, newX, newY);

         // Get passage object properties
         // - determine what room the passage is attached to
         // - determine what x,y position the passage exit is located at
         // - load the appropriate board
         // - move player to location of passage exit
         // - alternate player and passage with each tick
      }
   },
   travel: function()
   {
       game.audio.play(game.audio.SFX_PASSAGE_TRAVEL);
   },
}

/* xstep/ystep are relative coords for source, rate is P2 */
var Duplicator =
{
   glyph: 250,
   name: "duplicator"
}

var Bomb =
{
   glyph: 11,
   name: "bomb"
}

var Energizer =
{
   glyph: 127,
   name: "energizer"
}

var Throwstar =
{
   glyph: 47,
   name: "star"
}

/* uses SpinGlyph for iteration */
var CWConveyor =
{
   glyph: 179,
   name: "clockwise"
}

/* uses SpinGlyph for iteration, backwards */
var CCWConveyor =
{
   glyph: 92,
   name: "counter"
}

var Bullet =
{
   glyph: 248,
   name: "bullet",
   create: function(board, x, y, dx, dy, owner) {
     const statusElement = {
       x,
       y,
       xStep: dx,
       yStep: dy,
       cycle: 1,
       param1: (owner === 'player') ? 0 : 1
     }

     const bulletObjIdx = BoardObjects.findIndex(entry => entry?.name === 'bullet')
     const bulletTile = makeTile(bulletObjIdx, VGA.ATTR_FG_WHITE)
     board.set(x, y, bulletTile)
     board.statusElement.push(statusElement);
     board.moveActor(board.statusElement.length-1, x, y)

     return {tile: bulletTile, statusElement}
   },
   die: function(board, actorIndex)
     const actorData = board.statusElement[actorIndex];
     board.set(actorData.x, actorData.y, actorData.underTile)
     board.statusElement = board.statusElement.filter((_, index) => index !== actorIndex)
   },
   update: function(board, actorIndex)
   {
     const actorData = board.statusElement[actorIndex];
     
     // console.log(">>>Bullet, update; board, actorIndex", actorIndex, actorData)
     let dx = actorData.x
     let dy = actorData.y

     // Bullet travelled off the board; it "dies"
     if ((dx % 60 === 0) || (dy % 25 === 0)) {
       Bullet.die(board, actorIndex)
       return false
     }

     switch(actorData.xStep) {
       case Direction.EAST: {
         dx += 1
         break;
       }
       case Direction.WEST: {
         dx -= 1
         break;
       }
     }
     switch(actorData.yStep) {
       case Direction.SOUTH: {
         dy += 1
         break;
       }
       case Direction.NORTH: {
         dy -= 1
         break;
       }
     }

     // console.log(">>>Bullet, update; bullet pos", dx, dy, dx % 60)
     game.world.currentBoard.move(actorData.x, actorData.y, dx, dy)
     return true
   }   
}

var Water =
{
   glyph: 176,
   name: "water"
}

var Forest =
{
   glyph: 176,
   name: "forest"
}

var SolidWall =
{
   glyph: 219,
   name: "solid"
}

var NormalWall =
{
   glyph: 178,
   name: "normal"
}

var BreakableWall =
{
   glyph: 177,
   name: "breakable"
}

var Boulder =
{
   glyph: 254,
   name: "boulder"
}

var SliderNS =
{
   glyph: 18,
   name: "sliderns"
}

var SliderEW =
{
   glyph: 29,
   name: "sliderew"
}

var FakeWall =
{
   glyph: 178,
   name: "fake",
   floor: true
}

var InvisibleWall =
{
   glyph: 176,
   name: "invisible"
}

var BlinkWall =
{
   glyph: 206,
   name: "blinkwall"
}

var Transporter =
{
   glyph: 60,
   name: "transporter"
}

var Line =
{
   glyph: 250,
   name: "line"
}

var Ricochet =
{
   glyph: 42,
   name: "ricochet"
}

var HorizBlinkWallRay =
{
   glyph: 205
}

var Bear =
{
   glyph: 153,
   name: "bear"
}

var Ruffian =
{
   glyph: 5,
   name: "ruffian"   
}

/* glyph to draw comes from P1 */
var ZObject =
{
   glyph: 2,
   name: "object",
   draw: function(board, x, y)
   {
      var actor = board.getActorAt(x, y);
      var tile = board.get(x, y);
      return { glyph: actor.param1, color: tile.color }
   }
}

var Slime =
{
   glyph: 42,
   name: "slime"
}

var Shark =
{
   glyph: 94,
   name: "shark"
}

/* animation rotates through SpinGunGlyph */
var SpinningGun =
{
   glyph: 24,
   name: "spinninggun"
}

var Pusher =
{
   glyph: 31,
   name: "pusher"
}

var Lion =
{
   glyph: 234,
   name: "lion",
   update: function(board, actorIndex)
   {
      var dir = Direction.random();
      genericEnemyMove(actorIndex, board, dir);
   }
}

var Tiger =
{
   glyph: 227,
   name: "tiger",
   update: function(board, actorIndex)
   {
      var dir = Direction.random();
      genericEnemyMove(actorIndex, board, dir);
   }   
}

var VertBlinkWallRay =
{
   glyph: 186
}

var CentipedeHead =
{
   glyph: 233,
   name: "head"
}

var CentipedeBody =
{
   glyph: 79,
   name: "segment"
}

var BlueText =
{
   color: VGA.ATTR_BG_BLUE|VGA.ATTR_FG_WHITE,
   isText: true
}

var GreenText =
{
   color: VGA.ATTR_BG_GREEN|VGA.ATTR_FG_WHITE,
   isText: true
}

var CyanText =
{
   color: VGA.ATTR_BG_CYAN|VGA.ATTR_FG_WHITE,
   isText: true
}

var RedText =
{
   color: VGA.ATTR_BG_RED|VGA.ATTR_FG_WHITE,
   isText: true
}

var PurpleText =
{
   color: VGA.ATTR_BG_MAGENTA|VGA.ATTR_FG_WHITE,
   isText: true
}

var YellowText =
{
   color: VGA.ATTR_BG_BROWN|VGA.ATTR_FG_WHITE,
   isText: true
}

var WhiteText =
{
   color: VGA.ATTR_FG_WHITE,
   isText: true
}

var BoardObjects = [
   Empty,
   Edge,
   null, // 02 is unused
   null, // 03 is unused
   Player,
   Ammo,
   Torch,
   Gem,
   Key,
   Door,
   Scroll,
   Passage,
   Duplicator,
   Bomb,
   Energizer,
   Throwstar,
   CWConveyor,
   CCWConveyor,
   Bullet,
   Water,
   Forest,
   SolidWall,
   NormalWall,
   BreakableWall,
   Boulder,
   SliderNS,
   SliderEW,
   FakeWall,
   InvisibleWall,
   BlinkWall,
   Transporter,
   Line,
   Ricochet,
   HorizBlinkWallRay,
   Bear,
   Ruffian,
   ZObject,
   Slime,
   Shark,
   SpinningGun,
   Pusher,
   Lion,
   Tiger,
   VertBlinkWallRay,
   CentipedeHead,
   CentipedeBody,
   null, /* unused */
   BlueText,
   GreenText,
   CyanText,
   RedText,
   PurpleText,
   YellowText,
   WhiteText,
   null
];

function getTileRenderInfo(tile)
{
   /* specific check for zero here because town.zzt has some 'empty' cells marked w/color,
      possible editor corruption? */
   if (tile.typeid == 0 || !tile.properties)
      return { glyph: Empty.glyph, color: Empty.color }

   if (tile.properties.isText)
   {
      /* For text, the tile's 'color' is the glyph, and the element type determines the color. */
      return { glyph: tile.color, color: tile.properties.color };
   }
   else
   {
      return { glyph: tile.properties.glyph, color: tile.color }
   }
}

function getNameForType(typeid)
{
   if (typeid > BoardObjects.length)
      console.log("invalid element type");

   if (BoardObjects[typeid] == null)
      return "(unknown)";
   else if (BoardObjects[typeid].name)
      return BoardObjects[typeid].name;
   else
      return "";
}
