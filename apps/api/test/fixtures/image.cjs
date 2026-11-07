const { deflateSync } = require('node:zlib')
function crc32(bytes) { let crc=0xffffffff; for (const byte of bytes) {crc^=byte;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0)} return (crc^0xffffffff)>>>0 }
function chunk(type,bytes) { const tag=Buffer.from(type);const size=Buffer.alloc(4);size.writeUInt32BE(bytes.length);const crc=Buffer.alloc(4);crc.writeUInt32BE(crc32(Buffer.concat([tag,bytes])));return Buffer.concat([size,tag,bytes,crc]) }
module.exports = function image(width=160,height=110) {
  const header=Buffer.alloc(13);header.writeUInt32BE(width,0);header.writeUInt32BE(height,4);header[8]=8;header[9]=2
  const rows=Buffer.alloc(height*(1+width*3))
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){const n=y*(1+width*3)+1+x*3;const tile=(Math.floor(x/20)+Math.floor(y/20))%2;rows[n]=tile?76:42;rows[n+1]=tile?112:74;rows[n+2]=tile?85:62}
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',deflateSync(rows)),chunk('IEND',Buffer.alloc(0))])
}

// RGBA token: opaque center, transparent outer area for canvas transparency checks.
module.exports.transparentToken = function transparentToken(width=64,height=64) {
  const header=Buffer.alloc(13);header.writeUInt32BE(width,0);header.writeUInt32BE(height,4);header[8]=8;header[9]=6
  const rows=Buffer.alloc(height*(1+width*4))
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const index=y*(1+width*4)+1+x*4
    rows[index]=230;rows[index+1]=70;rows[index+2]=45
    rows[index+3]=x>=width/3&&x<width*2/3&&y>=height/3&&y<height*2/3?255:0
  }
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',deflateSync(rows)),chunk('IEND',Buffer.alloc(0))])
}
