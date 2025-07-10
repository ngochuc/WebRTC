class GroupVideoCall {
  constructor(socket, localVideo, remoteVideosContainer) {
    this.socket = socket;
    this.localVideo = localVideo;
    this.remoteVideosContainer = remoteVideosContainer;
    this.localStream = null;
    this.peers = new Map(); // Map of userId -> RTCPeerConnection
    this.remoteVideos = new Map(); // Map of userId -> video element
    this.currentRoom = null;
    this.userId = null;

    this.setupSocketListeners();
  }

  // Cấu hình STUN/TURN servers
  createPeerConnection(remoteUserId) {
    const configuration = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    };

    const peerConnection = new RTCPeerConnection(configuration);

    // Lắng nghe ICE candidates
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        console.log(`Sending ICE candidate to ${remoteUserId}:`, event.candidate);
        this.socket.emit('ice-candidate', {
          candidate: event.candidate,
          targetUserId: remoteUserId,
          roomId: this.currentRoom
        });
      }
    };

    // Nhận remote stream
    peerConnection.ontrack = (event) => {
      console.log(`Received remote stream from ${remoteUserId}`);
      this.handleRemoteStream(remoteUserId, event.streams[0]);
    };

    // Theo dõi trạng thái kết nối
    peerConnection.onconnectionstatechange = () => {
      console.log(`Connection state with ${remoteUserId}:`, peerConnection.connectionState);
      if (peerConnection.connectionState === 'disconnected' ||
          peerConnection.connectionState === 'failed') {
        this.handlePeerDisconnected(remoteUserId);
      }
    };

    peerConnection.oniceconnectionstatechange = () => {
      console.log(`ICE connection state with ${remoteUserId}:`, peerConnection.iceConnectionState);
    };

    // Thêm local stream tracks
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        peerConnection.addTrack(track, this.localStream);
      });
    }

    return peerConnection;
  }

  // Thiết lập các socket listeners
  setupSocketListeners() {
    // Nhận thông tin user ID
    this.socket.on('user-id', (data) => {
      this.userId = data.userId;
      console.log('My user ID:', this.userId);
    });

    // Nhận danh sách users trong room
    this.socket.on('room-users', (data) => {
      console.log('Room users:', data.users);
      this._handleRoomUsers(data.users);
    });

    // Có user mới join
    this.socket.on('user-joined', (data) => {
      console.log('User joined:', data.userId);
      this.handleUserJoined(data.userId);
    });

    // User leave
    this.socket.on('user-left', (data) => {
      console.log('User left:', data.userId);
      this.handleUserLeft(data.userId);
    });

    // Nhận offer từ peer
    this.socket.on('offer', async (data) => {
      console.log('Received offer from:', data.fromUserId);
      await this.handleOffer(data.offer, data.fromUserId);
    });

    // Nhận answer từ peer
    this.socket.on('answer', async (data) => {
      console.log('Received answer from:', data.fromUserId);
      await this.handleAnswer(data.answer, data.fromUserId);
    });

    // Nhận ICE candidate từ peer
    this.socket.on('ice-candidate', async (data) => {
      console.log('Received ICE candidate from:', data.fromUserId);
      await this.handleIceCandidate(data.candidate, data.fromUserId);
    });
  }

  // Bắt đầu local stream
  async _startLocalStream() {
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480 },
        audio: true
      });

      this.localVideo.srcObject = this.localStream;
      console.log('Local stream started');
    } catch (error) {
      console.error('Error accessing media devices:', error);
    }
  }

  // Join room
  async joinRoom(roomId) {
    await this._startLocalStream();
    this.currentRoom = roomId;
    this.socket.emit('join-room', { roomId });
  }

  // Xử lý danh sách users trong room
  async _handleRoomUsers(users) {
    // Tạo kết nối với tất cả users đã có trong room
    for (const userId of users) {
      if (userId !== this.userId) {
        await this.createPeerConnectionForUser(userId);
        await this.initiateCallToUser(userId);
      }
    }
  }

  // Xử lý user mới join
  async handleUserJoined(userId) {
    if (userId !== this.userId) {
      await this.createPeerConnectionForUser(userId);
      // Không cần initiate call, user mới sẽ gọi đến chúng ta
    }
  }

  // Xử lý user left
  handleUserLeft(userId) {
    this.removePeerConnection(userId);
    this.removeRemoteVideo(userId);
  }

  // Tạo peer connection cho user cụ thể
  async createPeerConnectionForUser(userId) {
    if (!this.peers.has(userId)) {
      const peerConnection = this.createPeerConnection(userId);
      this.peers.set(userId, peerConnection);
      console.log(`Created peer connection for ${userId}`);
    }
  }

  // Khởi tạo cuộc gọi đến user cụ thể
  async initiateCallToUser(userId) {
    try {
      const peerConnection = this.peers.get(userId);
      if (!peerConnection) return;

      console.log(`Creating offer for ${userId}...`);
      const offer = await peerConnection.createOffer({
        offerToReceiveVideo: true,
        offerToReceiveAudio: true
      });

      await peerConnection.setLocalDescription(offer);

      console.log(`Sending offer to ${userId}:`, offer);
      this.socket.emit('offer', {
        offer: offer,
        targetUserId: userId,
        roomId: this.currentRoom
      });
    } catch (error) {
      console.error(`Error creating offer for ${userId}:`, error);
    }
  }

  // Xử lý offer nhận được
  async handleOffer(offer, fromUserId) {
    try {
      // Tạo peer connection nếu chưa có
      await this.createPeerConnectionForUser(fromUserId);

      const peerConnection = this.peers.get(fromUserId);
      await peerConnection.setRemoteDescription(offer);

      console.log(`Creating answer for ${fromUserId}...`);
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);

      console.log(`Sending answer to ${fromUserId}:`, answer);
      this.socket.emit('answer', {
        answer: answer,
        targetUserId: fromUserId,
        roomId: this.currentRoom
      });
    } catch (error) {
      console.error(`Error handling offer from ${fromUserId}:`, error);
    }
  }

  // Xử lý answer nhận được
  async handleAnswer(answer, fromUserId) {
    try {
      const peerConnection = this.peers.get(fromUserId);
      if (peerConnection) {
        await peerConnection.setRemoteDescription(answer);
        console.log(`Answer from ${fromUserId} set successfully`);
      }
    } catch (error) {
      console.error(`Error handling answer from ${fromUserId}:`, error);
    }
  }

  // Xử lý ICE candidate nhận được
  async handleIceCandidate(candidate, fromUserId) {
    try {
      const peerConnection = this.peers.get(fromUserId);
      if (peerConnection) {
        await peerConnection.addIceCandidate(candidate);
        console.log(`ICE candidate from ${fromUserId} added successfully`);
      }
    } catch (error) {
      console.error(`Error adding ICE candidate from ${fromUserId}:`, error);
    }
  }

  // Xử lý remote stream
  handleRemoteStream(userId, stream) {
    let videoElement = this.remoteVideos.get(userId);

    if (!videoElement) {
      // Tạo video element mới
      videoElement = document.createElement('video');
      videoElement.autoplay = true;
      videoElement.playsInline = true;
      videoElement.muted = false;
      videoElement.id = `remote-video-${userId}`;
      videoElement.className = 'remote-video';

      // Thêm label hiển thị user ID
      const container = document.createElement('div');
      container.className = 'video-container';

      const label = document.createElement('div');
      label.className = 'video-label';
      label.textContent = `User ${userId}`;

      container.appendChild(videoElement);
      container.appendChild(label);

      this.remoteVideosContainer.appendChild(container);
      this.remoteVideos.set(userId, videoElement);
    }

    videoElement.srcObject = stream;
  }

  // Xóa peer connection
  removePeerConnection(userId) {
    const peerConnection = this.peers.get(userId);
    if (peerConnection) {
      peerConnection.close();
      this.peers.delete(userId);
      console.log(`Removed peer connection for ${userId}`);
    }
  }

  // Xóa remote video
  removeRemoteVideo(userId) {
    const videoElement = this.remoteVideos.get(userId);
    if (videoElement) {
      const container = videoElement.parentElement;
      if (container) {
        container.remove();
      }
      this.remoteVideos.delete(userId);
      console.log(`Removed remote video for ${userId}`);
    }
  }

  // Xử lý peer disconnected
  handlePeerDisconnected(userId) {
    console.log(`Peer ${userId} disconnected`);
    this.removePeerConnection(userId);
    // Có thể thử reconnect hoặc thông báo cho user
  }

  // Leave room
  leaveRoom() {
    if (this.currentRoom) {
      this.socket.emit('leave-room', { roomId: this.currentRoom });

      // Cleanup tất cả peer connections
      this.peers.forEach((peerConnection, userId) => {
        peerConnection.close();
      });
      this.peers.clear();

      // Cleanup remote videos
      this.remoteVideos.forEach((videoElement, userId) => {
        const container = videoElement.parentElement;
        if (container) {
          container.remove();
        }
      });
      this.remoteVideos.clear();

      // Stop local stream
      if (this.localStream) {
        this.localStream.getTracks().forEach(track => track.stop());
        this.localStream = null;
      }

      this.localVideo.srcObject = null;
      this.currentRoom = null;

      console.log('Left room and cleaned up');
    }
  }

  // Toggle camera
  toggleCamera() {
    if (this.localStream) {
      const videoTrack = this.localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        return videoTrack.enabled;
      }
    }
    return false;
  }

  // Toggle microphone
  toggleMicrophone() {
    if (this.localStream) {
      const audioTrack = this.localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        return audioTrack.enabled;
      }
    }
    return false;
  }

  // Mute/unmute specific user
  muteUser(userId, muted = true) {
    const videoElement = this.remoteVideos.get(userId);
    if (videoElement) {
      videoElement.muted = muted;
    }
  }

  // Get connection stats
  async getConnectionStats(userId) {
    const peerConnection = this.peers.get(userId);
    if (peerConnection) {
      const stats = await peerConnection.getStats();
      return stats;
    }
    return null;
  }
}

export { GroupVideoCall };
