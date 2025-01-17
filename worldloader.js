'use strict';

function ZZTWorld() {}

function ZZTWorldLoader()
{
}

ZZTWorldLoader.prototype.init = function(url, callback)
{
   var self = this;
   var request = new XMLHttpRequest();
   request.open("GET", url, true);
   request.responseType = 'arraybuffer';
   request.onload = function(e)
   {
      var world = null;
      if (this.status == 200)
      {
         var stream = new ZZTFileStream(this.response);
         world = self.parseWorldData(stream);
      }
      callback(world);
   }   
   request.send();
}

ZZTWorldLoader.prototype.parseWorldData = function(stream)
{
   var world = new ZZTWorld();

   world.worldType = stream.getInt16();
   world.numBoards = stream.getInt16();
   world.playerAmmo = stream.getInt16();
   world.playerGems = stream.getInt16();
   world.playerKeys = new Array(7);
   for (var i = 0; i < 7; ++i)
      world.playerKeys[i] = stream.getBoolean();
   world.playerHealth = stream.getInt16();
   world.playerBoard = stream.getInt16();

   world.playerTorches = stream.getInt16();
   world.torchCycles = stream.getInt16();
   world.torchCycleOffset = null
   world.energyCycles = stream.getInt16();
   stream.position += 2; /* unused */
   world.playerScore = stream.getInt16();

   world.worldName = stream.getFixedPascalString(20);
   world.flag = new Array(10);
   for (var i = 0; i < 10; ++i)
      world.flag[i] = stream.getFixedPascalString(20);

   world.timeLeft = stream.getInt16();
   stream.position += 2; /* playerdata pointer */
   world.locked = stream.getBoolean();
   world.board = [];

   /* board information then starts at offset 512 */
   stream.position = 512;

   for (var i = 0; i <= world.numBoards; ++i)
      world.board.push(this.parseZZTBoard(stream, i));

   return world;
}

ZZTWorldLoader.prototype.parseZZTBoard = function(stream, id)
{
   var boardOffset = stream.position;
   var boardSize = stream.getInt16();

   var board = new ZZTBoard;
   board.id = id
   board.name = stream.getFixedPascalString(50);

   board.width = 60;
   board.height = 25;
   board.player = null;

   var tiles = [];
   /* what follows now is RLE data, encoding 1500 tiles */
   while (tiles.length < (board.width * board.height))
   {
      var count = stream.getUint8();
      var typeid = stream.getUint8();
      var color = stream.getUint8();

      /* A count of zero actually means 256 tiles. The built-in editor
         never encodes like this, but some other editors do. */
      if (count == 0) count = 256;

      for (var i = 0; i < count; ++i)
      {
         tiles.push(makeTile(typeid, color));
      }
   }
   board.tiles = tiles;

   /* following the RLE data, we then have... */
   board.maxPlayerShots = stream.getUint8();
   board.isDark = stream.getUint8();
   board.exitNorth = stream.getUint8();
   board.exitSouth = stream.getUint8();
   board.exitWest = stream.getUint8();
   board.exitEast = stream.getUint8();
   board.restartOnZap = stream.getUint8();
   board.onScreenMessage = stream.getFixedPascalString(58); /* never used? */
   board.messageTimer = 0;
   board.playerEnterX = stream.getUint8();
   board.playerEnterY = stream.getUint8();
   board.timeLimit = stream.getInt16();
   stream.position += 16; /* unused */
   var statusElementCount = stream.getInt16() + 1;

   var statusElement = [];
   for (var i = 0; i < statusElementCount; ++i)
      statusElement.push(this.parseStatusElement(stream));

   /* for objects with code pointers referring to a different object, link them. */
   for (var i = 0; i < statusElementCount; ++i)
   {
      if (statusElement[i].codeLength < 0)
         statusElement[i].code = this.statusElement[-this.statusElement[i].codeLength].code;
   }

   board.statusElement = statusElement;

   /* update all the line characters */
   board.updateLines();

   /* jump to next board */
   stream.position = boardOffset + boardSize + 2;

   return board;
}

ZZTWorldLoader.prototype.parseStatusElement = function(stream)
{
   var status = {};

   /* x and y coordinates are 1-based for some reason */
   status.x = stream.getUint8() - 1;
   status.y = stream.getUint8() - 1;

   status.xStep = stream.getInt16();
   status.yStep = stream.getInt16();
   status.cycle = stream.getInt16();

   status.param1 = stream.getUint8();
   status.param2 = stream.getUint8();
   status.param3 = stream.getUint8();

   status.follower = stream.getInt16();
   status.leader = stream.getInt16();
   var underType = stream.getUint8();
   var underColor = stream.getUint8();
   status.underTile = makeTile(underType, underColor);
   stream.position += 4; /* pointer is not used when loading */
   status.currentInstruction = stream.getInt16();
   status.codeLength = stream.getInt16();

   /* for ZZT and not Super ZZT, eight bytes of padding follow */
   stream.position += 8;

   /* if status.codeLength is positive, there is that much ZZT-OOP code following */
   if (status.codeLength > 0)
   {
      status.code = stream.getFixedString(status.codeLength);
   }
   else
   {
      /* it's negative, which means that we'll need to look at a different
         object in order to use it's code instead; we'll do that later. */
      status.code = null;
   }

   return status;
}
