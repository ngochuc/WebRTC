const localVideo = document.getElementById('localVideo');
const remoteVideosContainer = document.getElementById('remoteVideos');

// var call_domain = 'http://localhost:3001';
var call_domain = 'https://call.baitap365.com';

const socket = io(call_domain);
const user = getCurrentUser();

const groupCall = new GroupVideoCall(socket, localVideo, user, videoGridManager);

// Join room
// document.getElementById('joinBtn').addEventListener('click', () => {
//   const roomId = document.getElementById('roomInput').value;

//   if (roomId) {
//     groupCall.joinRoom(roomId);
//   }
// });
groupCall.joinRoom(123);

// Leave room
document.getElementById('leaveBtn').addEventListener('click', () => {
  groupCall.leaveRoom();
});

// Toggle camera
document.getElementById('cameraBtn').addEventListener('click', () => {
  const enabled = groupCall.toggleCamera();
});

// Toggle microphone
document.getElementById('micBtn').addEventListener('click', () => {
  const enabled = groupCall.toggleMicrophone();
});

function getCurrentUser() {
  const token = window.localStorage.getItem("token");
  var current_user;
  if (token != null) {
    current_user = parseJwt(token);
  }

  if( !current_user || !current_user.id) {
    console.error("Current user not found or invalid token");
  }

  return current_user;
}

function parseJwt(token) {
  var base64Url = token.split(".")[1];
  var base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
  var jsonPayload = decodeURIComponent(
    window
      .atob(base64)
      .split("")
      .map(function (c) {
        return "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2);
      })
      .join("")
  );
  return JSON.parse(jsonPayload);
}

function anmsToggleFloatingVideo(visible) {
  const el = document.querySelector('.floating-local-video');
  if (!el) return;

  if (visible) {
    gsap.to(el, {
      duration: 0.4,
      autoAlpha: 1,
      scale: 1,
      x: 0,
      ease: "power2.out"
    });
  } else {
    gsap.to(el, {
      duration: 0.4,
      autoAlpha: 0,
      scale: 0.5,
      x: 100,
      ease: "power2.in"
    });
  }
}
