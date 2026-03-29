import { Buffer } from 'node:buffer';

export const imageFile = {
  name: 'tiny.png',
  mimeType: 'image/png',
  buffer: Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO7Z0qkAAAAASUVORK5CYII=',
    'base64'
  ),
};

export const videoFile = {
  name: 'tiny.mp4',
  mimeType: 'video/mp4',
  buffer: Buffer.from('tiny video payload for upload smoke test', 'utf8'),
};

export const audioFile = {
  name: 'tiny.wav',
  mimeType: 'audio/wav',
  buffer: Buffer.from('tiny audio payload for upload smoke test', 'utf8'),
};
