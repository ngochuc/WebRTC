const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.static(__dirname + '/public'));

let hostId = null;

io.on('connection', (socket) => {
    console.log(`New connection: ${socket.id}`);

    // Xử lý yêu cầu trở thành host
    socket.on('requestHost', () => {
        if (hostId === null) {
            hostId = socket.id;
            socket.emit('assignedHost');
            console.log(`Host assigned: ${hostId}`);
        }
    });

    // Xử lý yêu cầu bắt đầu cuộc gọi
    socket.on('startCall', () => {
        if (socket.id === hostId) {
            socket.broadcast.emit('startCallRequest');
        }
    });

    // Xử lý khi peer chấp nhận yêu cầu bắt đầu cuộc gọi từ host
    socket.on('startCallAccepted', () => {
        if (hostId !== null) {
            io.to(hostId).emit('startCall');
        }
    });

    // Xử lý khi kết nối socket bị ngắt
    socket.on('disconnect', () => {
        console.log(`Disconnected: ${socket.id}`);
        if (socket.id === hostId) {
            hostId = null;
        }
        // Thông báo cho các peer khác biết rằng peer này đã rời khỏi
        socket.broadcast.emit('peerLeft');
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
