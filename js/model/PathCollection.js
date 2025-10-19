import { EventEmitter } from '../core/EventEmitter.js';

export class PathCollection extends EventEmitter {
  constructor() {
    super();
    this.paths = [];
    this.currentIndex = -1;
    this.nextId = 1;
  }

  addPath(pathData) {
    const path = {
      id: this.nextId++,
      name: pathData.name || `Path ${this.paths.length + 1}`,
      sequence: pathData.sequence,
      nodes: new Set(pathData.nodes),
      edges: new Set(pathData.edges || []),
      color: pathData.color,
      timestamp: new Date()
    };

    this.paths.push(path);
    this.emit('path:added', path);
    return path;
  }

  removePath(index) {
    if (index < 0 || index >= this.paths.length) return null;
    
    const path = this.paths[index];
    this.paths.splice(index, 1);
    
    if (this.currentIndex === index) {
      this.currentIndex = -1;
    } else if (this.currentIndex > index) {
      this.currentIndex--;
    }
    
    this.emit('path:removed', { path, index });
    return path;
  }

  getPath(index) {
    return this.paths[index] || null;
  }

  getCurrentPath() {
    return this.getPath(this.currentIndex);
  }

  setCurrentPath(index) {
    if (index < -1 || index >= this.paths.length) return false;
    
    this.currentIndex = index;
    this.emit('path:current-changed', this.getCurrentPath());
    return true;
  }

  clear() {
    this.paths = [];
    this.currentIndex = -1;
    this.nextId = 1;
    this.emit('paths:cleared');
  }

  count() {
    return this.paths.length;
  }

  getAllPaths() {
    return [...this.paths];
  }
}