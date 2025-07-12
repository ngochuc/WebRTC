class DraggableElement {
  constructor(element) {
    this.element = element;
    this.isDragging = false;
    this.startX = 0;
    this.startY = 0;
    this.initialX = 0;
    this.initialY = 0;

    this.element.addEventListener('mousedown', this.dragStart.bind(this));
    this.element.addEventListener('touchstart', this.dragStart.bind(this));
    document.addEventListener('mousemove', this.drag.bind(this));
    document.addEventListener('touchmove', this.drag.bind(this));
    document.addEventListener('mouseup', this.dragEnd.bind(this));
    document.addEventListener('touchend', this.dragEnd.bind(this));
  }

  dragStart(e) {
    if (e.target.tagName !== 'VIDEO') return;

    this.isDragging = true;
    this.element.classList.add('dragging');

    if (e.type === 'mousedown') {
      this.startX = e.clientX;
      this.startY = e.clientY;
    } else {
      this.startX = e.touches[0].clientX;
      this.startY = e.touches[0].clientY;
    }

    const rect = this.element.getBoundingClientRect();
    this.initialX = rect.left;
    this.initialY = rect.top;
  }

  drag(e) {
    if (!this.isDragging) return;

    e.preventDefault();
    let clientX, clientY;

    if (e.type === 'mousemove') {
      clientX = e.clientX;
      clientY = e.clientY;
    } else {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    }

    const deltaX = clientX - this.startX;
    const deltaY = clientY - this.startY;

    let newX = this.initialX + deltaX;
    let newY = this.initialY + deltaY;

    // Constrain to viewport
    const rect = this.element.getBoundingClientRect();
    const maxX = window.innerWidth - rect.width;
    const maxY = window.innerHeight - rect.height;

    newX = Math.max(0, Math.min(newX, maxX));
    newY = Math.max(0, Math.min(newY, maxY));

    this.element.style.left = newX + 'px';
    this.element.style.top = newY + 'px';
    this.element.style.right = 'auto';
  }

  dragEnd() {
    this.isDragging = false;
    this.element.classList.remove('dragging');
  }
}
