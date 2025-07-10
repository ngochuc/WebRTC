import { WebRTCVideoCall } from "./example";

const localVideo = document.getElementById('localVideo');
const remoteVideosContainer = document.getElementById('remoteVideos');
const socket = io('http://localhost:3000');

// Khởi tạo Group Video Call
const groupCall = new GroupVideoCall(socket, localVideo, remoteVideosContainer);

// Join room
document.getElementById('joinBtn').addEventListener('click', () => {
  const roomId = document.getElementById('roomInput').value;
  if (roomId) {
    groupCall.joinRoom(roomId);
  }
});

// Leave room
document.getElementById('leaveBtn').addEventListener('click', () => {
  groupCall.leaveRoom();
});

// Toggle camera
document.getElementById('cameraBtn').addEventListener('click', () => {
  const enabled = groupCall.toggleCamera();
  document.getElementById('cameraBtn').textContent = enabled ? 'Turn Off Camera' : 'Turn On Camera';
});

// Toggle microphone
document.getElementById('micBtn').addEventListener('click', () => {
  const enabled = groupCall.toggleMicrophone();
  document.getElementById('micBtn').textContent = enabled ? 'Mute' : 'Unmute';
});
