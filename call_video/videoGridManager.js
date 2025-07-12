// class VideoGridManager {
//   constructor() {
//     this.videoGrid = document.getElementById('remoteVideos');
//     this.remoteVideos = new Map();
//   }

//   addRemoteVideo(userId, stream, userName = 'Remote User') {
//     const videoContainer = document.createElement('div');
//     videoContainer.className = 'video-container';
//     // videoContainer.id = `remote-${userId}`;

//     const video = document.createElement('video');
//     video.srcObject = stream;
//     video.autoplay = true;
//     video.playsinline = true;
//     video.id = `remote-video-${userId}`;
//     video.className = `remote-video`;

//     const label = document.createElement('div');
//     label.className = 'video-label';
//     label.textContent = userName;

//     videoContainer.appendChild(video);
//     videoContainer.appendChild(label);

//     this.remoteVideos.set(userId, videoContainer);
//     this.updateGrid();
//   }

//   removeRemoteVideo(userId) {
//     const videoContainer = this.remoteVideos.get(userId);
//     if (videoContainer) {
//       videoContainer.remove();
//       this.remoteVideos.delete(userId);
//       this.updateGrid();
//     }
//   }

//   updateGrid() {
//     // Clear existing content
//     this.videoGrid.innerHTML = '';

//     const count = this.remoteVideos.size;

//     if (count === 0) {
//       this.videoGrid.innerHTML = `
//         <div class="no-participants">
//           <div>
//             <h4>No participants yet</h4>
//             <p>Enter a room ID and click Join to start</p>
//           </div>
//         </div>
//       `;
//       this.videoGrid.className = 'video-grid grid-1';
//       return;
//     }

//     // Set grid class based on participant count
//     this.videoGrid.className = `video-grid grid-${Math.min(count, 12)}`;
//     this.remoteVideos.forEach(videoContainer => {
//       this.videoGrid.appendChild(videoContainer);
//     });
//   }
// }


class VideoGridManager {
  constructor() {
    this.gridElement = document.getElementById('remoteVideos');
    this.remoteVideos = new Map();

    this.currentLayout = null;
    this.participantCount = 0;

    this.isDesktop = window.innerWidth >= 768;
    this.isTablet = window.innerWidth >= 768 && window.innerWidth <= 1024;
    this.isMobile = window.innerWidth < 768;

    // Lắng nghe sự kiện resize
    this.handleResize = this.handleResize.bind(this);
    window.addEventListener('resize', this.handleResize);

    // Cấu hình layout modes
    this.layoutModes = {
      NORMAL: 'normal',
      FOCUS: 'focus'
    };

    this.currentMode = this.layoutModes.NORMAL;
  }

  addRemoteVideo(user, stream) {
    const userId = user.id;
    const userName = user.name || `User ${userId}`;
    const userAvt = user.avatar;

    const videoContainer = document.createElement('div');
    videoContainer.className = 'video-container';

    const hasVideo = stream.getVideoTracks().length > 0;

    const video = document.createElement('video');
    video.srcObject = stream;
    video.autoplay = true;
    video.playsInline = true;
    video.id = `remote-video-${userId}`;
    video.className = 'remote-video';
    video.style.visibility = hasVideo ? 'visible' : 'hidden';
    videoContainer.appendChild(video);

    const avatarWrapper = document.createElement('div');
    avatarWrapper.className = 'avatar-wrapper';

    const blurBg = document.createElement('div');
    blurBg.className = 'blur-bg';
    blurBg.style.backgroundImage = `url('${userAvt}')`;

    const img = document.createElement('img');
    img.src = userAvt;
    img.alt = userName;
    img.className = 'avatar-image';

    avatarWrapper.appendChild(blurBg);
    avatarWrapper.appendChild(img);
    videoContainer.appendChild(avatarWrapper);

    const label = document.createElement('div');
    label.className = 'video-label';
    label.textContent = userName;

    videoContainer.appendChild(label);

    this.remoteVideos.set(userId, videoContainer);
    this.updateLayout(this.remoteVideos.size);
  }

  removeRemoteVideo(userId) {
    const videoContainer = this.remoteVideos.get(userId);
    if (videoContainer) {
      videoContainer.remove();
      this.remoteVideos.delete(userId);
      this.updateLayout(this.remoteVideos.size);
    }
  }

  clearRemoteVideos() {
    this.remoteVideos.forEach((videoElement, userId) => {
      const container = videoElement.parentElement;
      if (container) {
        container.remove();
      }
    });
    this.remoteVideos.clear();
    this.updateLayout(0);
  }

  toggleRemoteVideo(userId, enabled) {
    const videoContainer = this.remoteVideos.get(userId);
    if (videoContainer) {
      const video = videoContainer.querySelector('.remote-video');
      if (video) {
        video.style.visibility  = enabled ? 'visible' : 'hidden';
      }
    }
  }

  // Cập nhật thông tin thiết bị
  updateDeviceInfo() {
    const width = window.innerWidth;
    this.isDesktop = width >= 768;
    this.isTablet = width >= 768 && width <= 1024;
    this.isMobile = width < 768;
  }

  // Xử lý sự kiện resize
  handleResize() {
    this.updateDeviceInfo();
    this.updateLayout(this.participantCount);
  }

  // Cập nhật layout chính
  updateLayout(participantCount, mode = this.layoutModes.NORMAL) {
    if (!this.gridElement) return;

    this.gridElement.innerHTML = '';

    this.participantCount = participantCount;
    this.currentMode = mode;

    if (this.participantCount === 0) {
      this.gridElement.innerHTML = `
        <div class="no-participants">
          <div>
            <h4>No participants yet</h4>
            <p>Enter a room ID and click Join to start</p>
          </div>
        </div>
      `;
      this.gridElement.className = 'video-grid grid-1';
      return;
    }

    // Xóa tất cả class layout cũ
    this.clearGridClasses();

    // Áp dụng layout mới
    if (mode === this.layoutModes.FOCUS) {
      this.applyFocusMode();
    } else {
      this.applyNormalMode(participantCount);
    }

    this.remoteVideos.forEach(videoContainer => {
      this.gridElement.appendChild(videoContainer);
    });

    //update avt size
    document.querySelectorAll('.avatar-wrapper').forEach(wrapper => {
      const avatar = wrapper.querySelector('.avatar-image');
      if (avatar) {
        const width = wrapper.clientWidth;
        const height = wrapper.clientHeight;
        const size = Math.min(width, height);

        avatar.style.width = `${size*0.3}px`;
        avatar.style.height = `${size*0.3}px`;
        avatar.style.borderRadius = '50%';
        avatar.style.objectFit = 'contain';
      }
    });
  }

  // Xóa tất cả class grid
  clearGridClasses() {
    const classes = this.gridElement.className.split(' ');
    const gridClasses = classes.filter(cls =>
      cls.includes('grid-') ||
      cls.includes('desktop-') ||
      cls.includes('mobile-') ||
      cls.includes('tablet-')
    );

    gridClasses.forEach(cls => {
      this.gridElement.classList.remove(cls);
    });
  }

  // Áp dụng layout bình thường
  applyNormalMode(participantCount) {
    let className = '';

    if (this.isDesktop && !this.isTablet) {
      // Desktop layout
      if (participantCount <= 12) {
        className = `desktop-grid-${participantCount}`;
      } else {
        className = 'desktop-grid-13-plus';
      }
    } else if (this.isTablet) {
      // Tablet layout
      if (participantCount <= 6) {
        className = `tablet-grid-${participantCount}`;
      } else {
        className = 'tablet-grid-7-plus';
      }
    } else {
      // Mobile layout
      if (participantCount <= 9) {
        className = `mobile-grid-${participantCount}`;
      } else {
        className = 'mobile-grid-10-plus';
      }
    }

    this.gridElement.classList.add(className);
    this.currentLayout = className;
  }

  // Áp dụng focus mode (Desktop)
  applyFocusMode() {
    if (!this.isDesktop) return;

    this.gridElement.classList.add('desktop-focus-mode');
    this.currentLayout = 'desktop-focus-mode';

    // Tạo cấu trúc HTML cho focus mode
    this.createFocusStructure();
  }

  // Tạo cấu trúc HTML cho focus mode
  createFocusStructure() {
    const videoContainers = Array.from(this.gridElement.querySelectorAll('.video-container'));

    if (videoContainers.length === 0) return;

    // Xóa nội dung hiện tại
    this.gridElement.innerHTML = '';

    // Tạo video chính (video đầu tiên)
    const mainContainer = document.createElement('div');
    mainContainer.className = 'desktop-focus-main';
    mainContainer.appendChild(videoContainers[0]);

    // Tạo sidebar chứa các video khác
    const sidebar = document.createElement('div');
    sidebar.className = 'desktop-focus-sidebar';

    for (let i = 1; i < videoContainers.length; i++) {
      sidebar.appendChild(videoContainers[i]);
    }

    this.gridElement.appendChild(mainContainer);
    this.gridElement.appendChild(sidebar);
  }

  // Chuyển sang focus mode
  enableFocusMode() {
    if (this.isDesktop) {
      this.updateLayout(this.participantCount, this.layoutModes.FOCUS);
    }
  }

  // Quay về layout bình thường
  enableNormalMode() {
    this.updateLayout(this.participantCount, this.layoutModes.NORMAL);
  }

  // Lấy thông tin layout hiện tại
  getCurrentLayout() {
    return {
      layout: this.currentLayout,
      mode: this.currentMode,
      participantCount: this.participantCount,
      device: {
        isDesktop: this.isDesktop,
        isTablet: this.isTablet,
        isMobile: this.isMobile
      }
    };
  }

  // Cleanup
  destroy() {
    window.removeEventListener('resize', this.handleResize);
  }
}
