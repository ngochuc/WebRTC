const express = require("express");
const app = express();
const http = require("http").createServer(app);
const cors = require("cors");
const io = require("socket.io")(http, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    allowedHeaders: ["my-custom-header"],
    credentials: true,
  },
});
app.use(cors());

// Route động cho mỗi nhóm
app.get("/:groupID", (req, res) => {
  res.sendFile(__dirname + "/video.html");
});
var groupCalls = {};
var sockets_online = {};
io.on("connection", async (socket) => {
  console.log("a user connected");
  console.log(`Connected: ${JSON.stringify(socket.handshake.query)}`);

  // if (socket.handshake.query.id != undefined) {
  //   try {
  //     const sql = "SELECT * FROM users WHERE id = ? LIMIT 1";
  //     const results = await new Promise((resolve, reject) => {
  //       db.query(sql, [socket.handshake.query.id], (err, results) => {
  //         if (err) return reject(err);
  //         resolve(results);
  //       });
  //     });

  //     if (results[0] != undefined) {
  //       socket.user = results[0];
  //       socket.user.ip = socket.handshake.address;
  //     } else {
  //       console.log("No user found with the provided ID.");
  //     }
  //   } catch (err) {
  //     console.error("Database error:", err);
  //   }
  // }
  var userId = socket.handshake.query.id
  var groupID = socket.handshake.query.groupID;

  // if (!socket.user) {
  //   console.log("No user data available, disconnecting...");
  //   socket.disconnect();
  //   return;
  // }

  sockets_online[userId] = socket;
  if (groupID) {
    if (!groupCalls[groupID]) {
      groupCalls[groupID] = {
        hostId: userId,
        hostSocketId: socket.id,
        users: [{
          id: socket.id,
          user_id: userId
        }],
      }
    } else {
      var existUser = groupCalls[groupID].users.find(user => user.user_id == userId);
      if (!existUser) {
        groupCalls[groupID].users.push({
          id: socket.id,
          user_id: userId,
        });
      }
    }
    socket.join(groupID);
    console.log("groupCalls", groupCalls);
    io.to(socket.id).emit("group:joined", { groupCalls: groupCalls[groupID] });
    console.log(`User ${userId} joined room: ${groupID}`);
  } else {
    console.log("No groupID provided.");
  }

  socket.broadcast.to(groupID).emit("new-user:join", {
    connSocketId: socket.id,
    displayName: socket.handshake.query.displayName || "Anonymous",
    mic: false,
    user: {
      id: socket.id,
      user_id: userId,
    }
  });

  socket.on("got-iceCandiate", (data) => {
    const { ice, to_connSocketId } = data;
    socket.to(to_connSocketId).emit("got-iceCandiate", {
      ice,
      from_connSocketId: socket.id,
    });
  });

  socket.on("new-user:intial-done", (data) => {
    console.log("new-user:intial-done", data);
    const { to_connSocketId, mic } = data;
    socket.to(to_connSocketId).emit("you:intial-done", {
      from_connSocketId: socket.id,
      displayName: socket.handshake.query.displayName || "Anonymous",
      mic,
      user: {
        id: socket.id,
        user_id: userId,
      }
    });
  });

  socket.on("save-offer:on-yoyr-remote", (data) => {
    const { to_connSocketId, offer } = data;
    socket.to(to_connSocketId).emit("save-offer:on-yoyr-remote", {
      from_connSocketId: socket.id,
      offer,
    });
  });

  socket.on("save-ans:your-remote", (data) => {
    const { to_connSocketId, ans } = data;
    socket.to(to_connSocketId).emit("save-ans:your-remote", {
      from_connSocketId: socket.id,
      ans,
    });
  });

  socket.on("video_changed", (data) => {
    const { to_connSocketId, status } = data;
    socket.to(to_connSocketId).emit("video_changed", {
      from_connSocketId: socket.id,
      status,
    });
  });

  socket.on("mic_update", (data) => {
    const { to_connSocketId, status } = data;
    socket.to(to_connSocketId).emit("mic_update", {
      from_connSocketId: socket.id,
      status,
    });
  });

  socket.on("accept-call", (data) => {
    console.log("accept-call", data);
    socket.broadcast.to(groupID).emit("accept-call", {
      from_connSocketId: socket.id,
      userId: userId,
    });
  });

  socket.on("onVoice", (data) => {
    io.to(groupID).emit("onVoice", {
      roomId: data.roomId,
      userId: userId,
      index: data.index,
      onVoice: data.onVoice,
      seat: data.seat,
    });
  });

  socket.on("ping", (data) => {
    console.log("ping", data);
    console.log("socket.id", groupID);
    console.log("socket.id", groupCalls[groupID]);
    let session_id = data.payload.session_id;
    let userDisconnect = data.payload.userDisconnect;
    if (sockets_online[userDisconnect]) {
      sockets_online[userDisconnect].emit("ping", { session_id: session_id, userDisconnect: userDisconnect });
    } else {
      io.to(groupID).emit("pong", { session_id: session_id, userDisconnect: userDisconnect });
    }
  });

  socket.on("alive", (data) => {
    console.log("alive", data);
    io.to(groupID).emit("alive", data);
  });

  // Xử lý ngắt kết nối
  socket.on("disconnect", () => {
    if (groupCalls[groupID]) {
      groupCalls[groupID].users = groupCalls[groupID].users.filter(user => user.user_id != userId);

      // Nếu người rời là chủ phòng, gán host mới (nếu còn người)
      if (socket.id === groupCalls[groupID].hostSocketId && groupCalls[groupID].users.length > 0) {
        groupCalls[groupID].hostSocketId = groupCalls[groupID].users[0].socket_id;
      }

      if (groupCalls[groupID].users.length === 0) {
        delete groupCalls[groupID];
      }
    }
    delete sockets_online[userId];
    console.log("a user disconnected");
    console.log(sockets_online);
    socket.broadcast.to(groupID).emit("user:disconnected", {
      from_connSocketId: socket.id,
      userId: userId,
      groupCalls: groupCalls[groupID] || null,
    });
  });

});

http.listen(9000, () => {
  console.log("Listening on port 9000");
});
