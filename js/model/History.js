import { EventEmitter } from '../core/EventEmitter.js';

export class History extends EventEmitter {
  constructor(maxSize = 20) {
    super();
    this.stack = [];
    this.maxSize = maxSize;
  }

  push(state) {
    this.stack.push(state);
    if (this.stack.length > this.maxSize) {
      this.stack.shift();
    }
    this.emit('history:pushed', this.getState());
  }

  pop() {
    if (this.stack.length === 0) return null;
    const state = this.stack.pop();
    this.emit('history:popped', this.getState());
    return state;
  }

  peek() {
    if (this.stack.length === 0) return null;
    return this.stack[this.stack.length - 1];
  }

  clear() {
    this.stack = [];
    this.emit('history:cleared');
  }

  canUndo() {
    return this.stack.length > 0;
  }

  getState() {
    return {
      size: this.stack.length,
      canUndo: this.canUndo()
    };
  }
}