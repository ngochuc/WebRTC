const express = require('express');
const app = express();
const server = require('http').createServer(app);
const io = require('socket.io')(server);

const rooms = new Map(); // roomId -> Set of user IDs
const users = new Map(); // socketId -> { userId, roomId }

io.on('connection', (socket) => {
  const userId = generateUserId();
  users.set(socket.id, { userId, roomId: null });

  // Gửi user ID cho client
  socket.emit('user-id', { userId });

  console.log(`User connected: ${userId} (${socket.id})`);

  socket.on('join-room', (data) => {
    const { roomId } = data;
    const user = users.get(socket.id);

    if (!user) return;

    // Rời room cũ nếu có
    if (user.roomId) {
      leaveRoom(socket, user.roomId);
    }

    // Tạo room mới nếu chưa có
    if (!rooms.has(roomId)) {
      rooms.set(roomId, new Set());
    }

    const room = rooms.get(roomId);
    const existingUsers = Array.from(room);

    // Join socket room
    socket.join(roomId);
    room.add(user.userId);
    user.roomId = roomId;

    // Gửi danh sách users hiện tại cho user mới
    socket.emit('room-users', { users: existingUsers });

    // Thông báo cho các users khác về user mới
    socket.to(roomId).emit('user-joined', { userId: user.userId });

    console.log(`User ${user.userId} joined room ${roomId}`);
  });

  socket.on('leave-room', (data) => {
    const user = users.get(socket.id);
    if (user && user.roomId) {
      leaveRoom(socket, user.roomId);
    }
  });

  socket.on('offer', (data) => {
    const { offer, targetUserId, roomId } = data;
    const user = users.get(socket.id);

    if (!user) return;

    // Tìm socket của target user
    const targetSocket = findSocketByUserId(targetUserId);
    if (targetSocket) {
      targetSocket.emit('offer', {
        offer,
        fromUserId: user.userId
      });
    }
  });

  socket.on('answer', (data) => {
    const { answer, targetUserId, roomId } = data;
    const user = users.get(socket.id);

    if (!user) return;

    const targetSocket = findSocketByUserId(targetUserId);
    if (targetSocket) {
      targetSocket.emit('answer', {
        answer,
        fromUserId: user.userId
      });
    }
  });

  socket.on('ice-candidate', (data) => {
    const { candidate, targetUserId, roomId } = data;
    const user = users.get(socket.id);

    if (!user) return;

    const targetSocket = findSocketByUserId(targetUserId);
    if (targetSocket) {
      targetSocket.emit('ice-candidate', {
        candidate,
        fromUserId: user.userId
      });
    }
  });

  socket.on('disconnect', () => {
    const user = users.get(socket.id);
    if (user) {
      console.log(`User disconnected: ${user.userId} (${socket.id})`);

      if (user.roomId) {
        leaveRoom(socket, user.roomId);
      }

      users.delete(socket.id);
    }
  });
});

// Helper functions
function generateUserId() {
  return 'user_' + Math.random().toString(36).substring(2, 15);
}

function findSocketByUserId(userId) {
  for (const [socketId, user] of users) {
    if (user.userId === userId) {
      return io.sockets.sockets.get(socketId);
    }
  }
  return null;
}

function leaveRoom(socket, roomId) {
  const user = users.get(socket.id);
  if (!user) return;

  const room = rooms.get(roomId);
  if (room) {
    room.delete(user.userId);

    // Thông báo cho các users khác
    socket.to(roomId).emit('user-left', { userId: user.userId });

    // Xóa room nếu rỗng
    if (room.size === 0) {
      rooms.delete(roomId);
    }
  }

  socket.leave(roomId);
  user.roomId = null;

  console.log(`User ${user.userId} left room ${roomId}`);
}

server.listen(3000, () => {
  console.log('Server running on port 3000');
});
