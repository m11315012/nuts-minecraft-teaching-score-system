import { io } from 'socket.io-client';

let socket;

export function connectSocket(token) {
  if (socket) socket.disconnect();
  socket = io({ auth: { token }, path: '/socket.io' });
  return socket;
}
export function getSocket() { return socket; }
export function disconnectSocket() { if (socket) { socket.disconnect(); socket = null; } }
