const socket = io();
const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');
const startCallButton = document.getElementById('startCall');

let localStream;
let remoteStream;
let peerConnection;

const config = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' }
    ]
};

startCallButton.onclick = startCall;

async function startCall() {
    peerConnection = new RTCPeerConnection(config);
    peerConnection.ontrack = (event) => {
        remoteVideo.srcObject = event.streams[0];
    };
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    localVideo.srcObject = localStream;
    peerConnection.onicecandidate = ({ candidate }) => {
        if (candidate) {
            socket.emit('ice-candidate', candidate);
        }
    };


    localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);

    socket.emit('offer', offer);
}

socket.on('offer', async (offer) => {
    if (!peerConnection) {
        startCall();
    }

    await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);

    socket.emit('answer', answer);
});

socket.on('answer', async (answer) => {
    await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
});

socket.on('ice-candidate', async (candidate) => {
    try {
        await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (e) {
        console.error('Error adding received ice candidate', e);
    }
});
