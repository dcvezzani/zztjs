'use strict';

function ZZTTile(typeid, color)
{
   this.typeid = typeid;
   this.color = color;
   this.properties = BoardObjects[this.typeid];
}

var _ZZTBoard_BoardEmpty = new ZZTTile(0, 0);
var _ZZTBoard_BoardEdge = new ZZTTile(1, 0);

/* Construct a tile, with a special case for empties: empty tiles have no color,
   so we can reuse the same reference for all of them. */
function makeTile(typeid, color)
{
   if (typeid == 0)
      return _ZZTBoard_BoardEmpty;
   else
      return new ZZTTile(typeid, color);
}

function ZZTBoard()
{
   this.actorIndex = 0;
   this.tick = 0;
   this.savedTick = null;
}

// When rendering darkness, do not include circular region around player
// when a torch is lit
function outsideLitRegion(x, y, player)
{
  (
      (y !== player.y && ((x < player.x-6 || x > player.x+6) || (y < player.y-4 || y > player.y+4)))
      || (y === player.y && (x < player.x-7 || x > player.x+7))
      || (x === player.x-6 && (y < player.y-2 || y > player.y+2))
      || (x === player.x+6 && (y < player.y-2 || y > player.y+2))
      || ((x < player.x-4 || x > player.x+4) && (y === player.y-4 || y === player.y+4))
    )
}


ZZTBoard.prototype.withinBoard = function(x, y)
{
   if (x < 0 || x >= this.width || y < 0 || y >= this.height)
      return false;
   else
      return true;
}

ZZTBoard.prototype.get = function(x, y)
{
   if (!this.withinBoard(x, y))
      return _ZZTBoard_BoardEdge;
   else
      return this.tiles[y * this.width + x];
}

ZZTBoard.prototype.getActorIndexAt = function(x, y)
{
   for (var i = 0; i < this.statusElement.length; ++i)
   {
      if (this.statusElement[i].x == x && this.statusElement[i].y == y)
         return i;
   }
   return -1;
}

ZZTBoard.prototype.getActorAt = function(x, y)
{
   var index = this.getActorIndexAt(x, y);
   if (index >= 0)
      return this.statusElement[index];
   else
      return null;
}

ZZTBoard.prototype.set = function(x, y, tile)
{
   this.tiles[y * this.width + x] = tile;
}

ZZTBoard.prototype.updateTorchCycles = function()
{
   if (game.world.torchCycles > 0) {
     if (game.world.torchCycleOffset === null) {
       game.world.torchCycleOffset = this.tick;
     }
     else if ((Math.abs(this.tick-game.world.torchCycleOffset) % Torch.ticksPerCycle) === 0) {
       game.world.torchCycles--;

       if (game.world.torchCycles === 0) {
         Torch.die()
       }
     }
   }
}

ZZTBoard.prototype.update = function()
{
   var self = this;

   if (this.actorIndex >= this.statusElement.length)
   {
      this.tick++;
      /* According to roton the tick counter wraps at 420. */
      if (this.tick > 420) {
         this.tick = 1;
      }
      this.actorIndex = 0;
   }

   if (this.isDark && !game.world.hasGotDarknessMsg)
   {
      game.world.currentBoard.setMessage("Room is dark - you need to light a torch!");
      game.world.hasGotDarknessMsg = true;
   }

   this.updateTorchCycles()

   while (this.actorIndex < this.statusElement.length)
   {
      var actor = this.statusElement[this.actorIndex];
      var cycle = actor.cycle;
      if (cycle != 0)
      {
         if (!(this.tick % cycle))
         {
            var tile = this.get(actor.x, actor.y);
            if (tile.properties.update)
               tile.properties.update(this, this.actorIndex);
         }
      }
      this.actorIndex++;
   }
}

ZZTBoard.prototype.remove = function(x, y)
{
   this.set(x, y, _ZZTBoard_BoardEmpty);
}

ZZTBoard.load = function(boardID, x, y)
{
   const board = game.world.board[boardID];

   /* make this the new current board and move the player there */
   game.world.playerBoard = boardID;
   game.world.currentBoard = board;

   if (typeof x != "undefined" && typeof x != "undefined")
     game.world.currentBoard.moveActor(PLAYER_ACTOR_INDEX, x, y);

   game.pause()
  
   return true;
}

ZZTBoard.prototype.move = function(sx, sy, dx, dy)
{
   var actorIndex = this.getActorIndexAt(sx, sy);
   if (actorIndex < -1)
   {
      /* not an actor, just move tile */
      this.set(dx, dy, this.get(sx, sy));
      this.remove(sx, sy);
   }
   else
   {
      this.moveActor(actorIndex, dx, dy);
   }
}

ZZTBoard.prototype.moveActor = function(actorIndex, x, y)
{
   var actorData = this.statusElement[actorIndex];
   var srcTile = this.get(actorData.x, actorData.y);
   var dstTile = this.get(x, y);

   // set the underTile to where the actor was
   this.set(actorData.x, actorData.y, actorData.underTile);

   // set the new location for actor
   this.set(x, y, srcTile);

   actorData.x = x;
   actorData.y = y;

   // Only apply this to tiles that can exist under the actor
   // - e.g., passages
   // - not torches; those are picked up
   if (dstTile?.properties?.allowUndertile)
     actorData.underTile = dstTile
   else
     actorData.underTile = _ZZTBoard_BoardEmpty
}

ZZTBoard.prototype.resolvePlayerGlyphAndColor = function(renderInfo, tile)
{
   const underTile = this.statusElement[0]?.underTile
   if (underTile?.properties?.name === "passage") {
     if (game.tick % 4 < 2) {
       renderInfo.color = tile?.color
       renderInfo.glyph = tile?.properties?.glyph
     } else {
       renderInfo.color = underTile?.color
       renderInfo.glyph = underTile?.properties?.glyph
     }
   }
}

ZZTBoard.prototype.resolveDarknessGlyphAndColor = function(renderInfo, x, y, visibleElements)
{
   const player = visibleElements[0]
   const visibleElement = visibleElements.find(entry => (x === entry.x && y === entry.y))

   if (game.world.torchCycles === 0
   ) {
     if (!visibleElement) {
       renderInfo.color =  VGA.ATTR_FG_WHITE
       renderInfo.glyph = BreakableWall.glyph
      }
   }
  else if (outsideLitRegion(x, y, player) && !visibleElement) {
     renderInfo.color =  VGA.ATTR_FG_WHITE
     renderInfo.glyph = BreakableWall.glyph
   }
}

ZZTBoard.prototype.draw = function(textconsole)
{
   // To make other elements "visible" even in the dark, include "visibleInTheDark" as an object property
   // 
   // E.g.,
   //
   // var Passage =
   // {
   //    glyph: 240,
   //    name: "passage",
   //    allowUndertile: true,
   //    visibleInTheDark: true, <<<
   //    ...
   //
   const visibleElements = this.statusElement.reduce((coll, entry) => {
     const tile = this.get(entry.x, entry.y)
     if (tile?.properties?.visibleInTheDark) coll.push({name: tile?.properties?.name, x: entry.x, y: entry.y})
     return coll
   }, [])

   for (var y = 0; y < this.height; ++y)
   {
      for (var x = 0; x < this.width; ++x)
      {
         var tile = this.get(x, y);
         const isPlayer = tile?.properties?.name === 'player'
         var renderInfo = null;

         if (tile.properties.draw)
         {
            renderInfo = tile.properties.draw(this, x, y);
         }
         else
         {
            renderInfo = getTileRenderInfo(tile);
         }

         if (isPlayer) {
           this.resolvePlayerGlyphAndColor(renderInfo, tile)

         } else if (!isPlayer && this.isDark) {
           this.resolveDarknessGlyphAndColor(renderInfo, x, y, visibleElements)
         }

         const { color, glyph } =  renderInfo
         textconsole.set(x, y, glyph, color);
      }
   }

   if (this.messageTimer > 0)
   {
      /* TODO: actually work out how to make this multiline */
      textconsole.setString(
         Math.floor((this.width / 2) - (this.onScreenMessage.length / 2)),
         24,
         this.onScreenMessage,
         (this.messageTimer % 6) + VGA.ATTR_FG_BBLUE);
      --this.messageTimer;
   }
}

ZZTBoard.prototype.setMessage = function(msg)
{
   /* TODO: actually work out how to make this multiline */
   if (msg.length >= (this.width - 2))
   {
      msg = msg.substr(0, (this.width - 2))
   }
   this.onScreenMessage = " " + msg + " ";
   this.messageTimer = 24;
}

var _ZZTBoard_LineGlyphs =
[
   /* NESW */
   /* 0000 */ 249,
   /* 0001 */ 181,
   /* 0010 */ 210,
   /* 0011 */ 187,
   /* 0100 */ 198,
   /* 0101 */ 205,
   /* 0110 */ 201,
   /* 0111 */ 203,
   /* 1000 */ 208,
   /* 1001 */ 188,
   /* 1010 */ 186,
   /* 1011 */ 185,
   /* 1100 */ 200,
   /* 1101 */ 202,
   /* 1110 */ 204,
   /* 1111 */ 206
];

/* Update the glyphs of all line characters on the board.

   We only need to do this whenever one of them changes. */
ZZTBoard.prototype.updateLines = function()
{
   for (var y = 0; y < this.height; ++y)
   {
      for (var x = 0; x < this.width; ++x)
      {
         var tile = this.get(x, y);
         if (tile.name == "line")
         {
            var glyphIndex = 0;

            if ((y == 0) || (this.get(x, y-1).name == "line"))
               glyphIndex += 8;

            if ((x == this.width-1) || (this.get(x+1, y).name == "line"))
               glyphIndex += 4;

            if ((y == this.height-1) || (this.get(x, y+1).name == "line"))
               glyphIndex += 2;

            if ((x == 0) || (this.get(x-1, y).name == "line"))
               glyphIndex += 1;

            tile.glyph = _ZZTBoard_LineGlyphs[glyphIndex];
         }
      }
   }
}
