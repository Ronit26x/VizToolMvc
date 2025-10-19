// js/view/canvas/CanvasManager.js
import { EventEmitter } from '../../core/EventEmitter.js';

export class CanvasManager extends EventEmitter {
  constructor(canvasElement) {
    super();
    this.canvas = canvasElement;
    this.ctx = canvasElement.getContext('2d');
    
    // Dragging state
    this.dragNode = null;
    
    this.setupEventListeners();
    this.resizeCanvas();
    
    // Handle window resize
    window.addEventListener('resize', () => this.resizeCanvas());
  }
  
  resizeCanvas() {
    const vizContainer = document.getElementById('viz');
    this.canvas.width = vizContainer.clientWidth;
    this.canvas.height = vizContainer.clientHeight;
    this.emit('canvas:resized', { 
      width: this.canvas.width, 
      height: this.canvas.height 
    });
  }
  
  setupEventListeners() {
    // ORIGINAL LOGIC: Use pointerdown/move/up for dragging
    this.canvas.addEventListener('pointerdown', (e) => this.handlePointerDown(e));
    this.canvas.addEventListener('pointermove', (e) => this.handlePointerMove(e));
    this.canvas.addEventListener('pointerup', () => this.handlePointerUp());
    this.canvas.addEventListener('pointerleave', () => this.handlePointerUp());
    
    // Click for selection (only if not dragging)
    this.canvas.addEventListener('click', (e) => this.handleClick(e));
  }
  
  handlePointerDown(e) {
    const rect = this.canvas.getBoundingClientRect();
    const canvasX = e.clientX - rect.left;
    const canvasY = e.clientY - rect.top;
    
    this.emit('canvas:pointerdown', { 
      canvasX, 
      canvasY, 
      clientX: e.clientX,
      clientY: e.clientY,
      event: e 
    });
  }
  
  handlePointerMove(e) {
    if (!this.dragNode) return;
    
    const rect = this.canvas.getBoundingClientRect();
    const canvasX = e.clientX - rect.left;
    const canvasY = e.clientY - rect.top;
    
    this.emit('canvas:pointermove', { 
      canvasX, 
      canvasY,
      event: e 
    });
    
    e.preventDefault();
  }
  
  handlePointerUp() {
    if (!this.dragNode) return;
    
    this.emit('canvas:pointerup');
    this.dragNode = null;
  }
  
  handleClick(e) {
    const rect = this.canvas.getBoundingClientRect();
    const canvasX = e.clientX - rect.left;
    const canvasY = e.clientY - rect.top;
    
    this.emit('canvas:click', { 
      canvasX, 
      canvasY,
      event: e 
    });
  }
  
  // Start dragging a node
  startDrag(node) {
    this.dragNode = node;
  }
  
  // Check if currently dragging
  isDragging() {
    return this.dragNode !== null;
  }
  
  // Get the dragged node
  getDraggedNode() {
    return this.dragNode;
  }
  
  clear() {
    this.ctx.save();
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.fillStyle = '#ffffff';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.restore();
  }
  
  getContext() {
    return this.ctx;
  }
  
  getWidth() {
    return this.canvas.width;
  }
  
  getHeight() {
    return this.canvas.height;
  }
}