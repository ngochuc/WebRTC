const express = require('express');
const cors = require('cors');
const app = express();
const server = require('http').createServer(app);
const io = require('socket.io')(server,{
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    allowedHeaders: ["my-custom-header"],
    credentials: true,
  },
});
app.use(cors());

const rooms = new Map(); // roomId -> Set of user
const users = new Map();

io.on('connection', (socket) => {
  // const userId = generateUserId();
  users.set(socket.id, { id: null, roomId: null, name: null, avatar: null });

  socket.on('join-room', (data) => {
    const { roomId, userInfo } = data;
    const user = users.get(socket.id);

    if (!user) return;

    // Rời room cũ nếu có
    if (user.roomId) {
      leaveRoom(socket, user.roomId);
    }
    user.id = userInfo.id;
    user.name = userInfo?.first_name + ' '+ userInfo?.last_name;
    user.avatar = userInfo?.avatar;

    // Tạo room mới nếu chưa có
    if (!rooms.has(roomId)) {
      rooms.set(roomId, new Set());
    }

    const room = rooms.get(roomId);
    const existingUsers = Array.from(room);

    // Join socket room
    socket.join(roomId);
    room.add(user);
    user.roomId = roomId;

    // Gửi danh sách users hiện tại cho user mới
    socket.emit('room-users', { users: existingUsers });

    // Thông báo cho các users khác về user mới
    socket.to(roomId).emit('user-joined', { user: user });

    console.log(`User ${user.id} joined room ${roomId}`);
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
        fromUserId: user.id
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
        fromUserId: user.id
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
        fromUserId: user.id
      });
    }
  });

  socket.on('disconnect', () => {
    const user = users.get(socket.id);
    if (user) {
      console.log(`User disconnected: ${user.id} (${socket.id})`);

      if (user.roomId) {
        leaveRoom(socket, user.roomId);
      }

      users.delete(socket.id);
    }
  });

  socket.on('camera-toggled', (data) => {
    const { enabled } = data;
    const user = users.get(socket.id);

    if (!user || !user.roomId) return;

    // Thông báo cho các users khác trong room
    socket.to(user.roomId).emit('camera-toggled', {
      userId: user.id,
      enabled
    });
  });
});

// Helper functions

function findSocketByUserId(userId) {
  for (const [socketId, user] of users) {
    if (user.id === userId) {
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
    room.delete(user);

    // Thông báo cho các users khác
    socket.to(roomId).emit('user-left', { userId: user.id });

    // Xóa room nếu rỗng
    if (room.size === 0) {
      rooms.delete(roomId);
    }
  }

  socket.leave(roomId);
  user.roomId = null;
}

server.listen(3001, () => {
  console.log('Server running on port 3001');
});
