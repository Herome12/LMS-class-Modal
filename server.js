const path = require("path");
const express = require("express");
const http = require("http");
const moment = require("moment");
const socketio = require("socket.io");
const PORT = process.env.PORT || 3000;

const app = express();
const server = http.createServer(app);
const io = socketio(server);

app.use(express.static(path.join(__dirname, "public")));

let rooms = {};
let socketroom = {};
let socketname = {};
let micSocket = {};
let videoSocket = {};
let roomBoard = {};

io.on("connect", (socket) => {
    socket.on("join room", (roomid, username) => {
        socket.join(roomid);
        socketroom[socket.id] = roomid;
        socketname[socket.id] = username;
        micSocket[socket.id] = "on";
        videoSocket[socket.id] = "on";

        if (rooms[roomid] && rooms[roomid].length > 0) {
            rooms[roomid].push(socket.id);
            socket.to(roomid).emit("message", `${username} joined the room.`, "Bot", moment().format("h:mm a"));
            io.to(socket.id).emit(
                "join room",
                rooms[roomid].filter((pid) => pid != socket.id),
                socketname,
                micSocket,
                videoSocket
            );
        } else {
            rooms[roomid] = [socket.id];
            io.to(socket.id).emit("join room", null, null, null, null);
        }

        // Emit updated attendees list to all users in the room
        io.to(roomid).emit("update-attendees", rooms[roomid].map((id) => socketname[id]));

        io.to(roomid).emit("user count", rooms[roomid].length);
    });

    socket.on("action", (msg) => {
        if (msg == "mute") micSocket[socket.id] = "off";
        else if (msg == "unmute") micSocket[socket.id] = "on";
        else if (msg == "videoon") videoSocket[socket.id] = "on";
        else if (msg == "videooff") videoSocket[socket.id] = "off";

        socket.to(socketroom[socket.id]).emit("action", msg, socket.id);
    });

    socket.on("video-offer", (offer, sid) => {
        socket.to(sid).emit("video-offer", offer, socket.id, socketname[socket.id], micSocket[socket.id], videoSocket[socket.id]);
    });

    socket.on("video-answer", (answer, sid) => {
        socket.to(sid).emit("video-answer", answer, socket.id);
    });

    socket.on("new icecandidate", (candidate, sid) => {
        socket.to(sid).emit("new icecandidate", candidate, socket.id);
    });

    socket.on("message", (msg, username, roomid) => {
        io.to(roomid).emit("message", msg, username, moment().format("h:mm a"));
    });

    socket.on("getCanvas", () => {
        if (roomBoard[socketroom[socket.id]]) socket.emit("getCanvas", roomBoard[socketroom[socket.id]]);
    });

    socket.on("draw", (newx, newy, prevx, prevy, color, size) => {
        socket.to(socketroom[socket.id]).emit("draw", newx, newy, prevx, prevy, color, size);
    });

    socket.on("clearBoard", () => {
        socket.to(socketroom[socket.id]).emit("clearBoard");
    });

    socket.on("store canvas", (url) => {
        roomBoard[socketroom[socket.id]] = url;
    });

    // Raise and Lower Hand Feature
    socket.on("raiseHand", ({ username, roomid }) => {
        socket.to(roomid).emit("handRaised", username);
    });

    socket.on("lowerHand", ({ username, roomid }) => {
        socket.to(roomid).emit("handLowered", username);
    });

    // Handle User Disconnect
    socket.on("disconnect", () => {
        if (!socketroom[socket.id]) return;

        const roomid = socketroom[socket.id];

        socket.to(roomid).emit("message", `${socketname[socket.id]} left the chat.`, "Bot", moment().format("h:mm a"));
        socket.to(roomid).emit("remove peer", socket.id);

        if (rooms[roomid]) {
            rooms[roomid] = rooms[roomid].filter((id) => id !== socket.id);
        }

        // Emit updated attendees list after user leaves
        io.to(roomid).emit("update-attendees", rooms[roomid].map((id) => socketname[id] || "Unknown User"));

        io.to(roomid).emit("user count", rooms[roomid].length);

        delete socketroom[socket.id];
        delete socketname[socket.id];
        delete micSocket[socket.id];
        delete videoSocket[socket.id];
    });
});

server.listen(PORT, () => console.log(`Server is up and running on port ${PORT}`));
