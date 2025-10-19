// js/model/entities/Node.js
// Base Node class for graph nodes

export class Node {
  constructor(id, data = {}) {
    this.id = id;
    
    // Position
    this.x = data.x || 0;
    this.y = data.y || 0;
    
    // Velocity (for force simulation)
    this.vx = data.vx || 0;
    this.vy = data.vy || 0;
    
    // Fixed position (for pinning)
    this.fx = data.fx || null;
    this.fy = data.fy || null;
    
    // Visual properties
    this.color = data.color || data.fillcolor || '#69b3a2';
    this.label = data.label || id;
    this.style = data.style || null;
    this.penwidth = data.penwidth || 1;
    
    // Store original data
    this._data = data;
  }

  /**
   * Move node to new position
   * @param {number} x - New x coordinate
   * @param {number} y - New y coordinate
   */
  move(x, y) {
    this.x = x;
    this.y = y;
  }

  /**
   * Pin node at current position
   */
  pin() {
    this.fx = this.x;
    this.fy = this.y;
  }

  /**
   * Unpin node
   */
  unpin() {
    this.fx = null;
    this.fy = null;
  }

  /**
   * Check if node is pinned
   * @returns {boolean}
   */
  isPinned() {
    return this.fx !== null && this.fy !== null;
  }

  /**
   * Check if point is inside node (circular hit test)
   * @param {number} x - Point x coordinate
   * @param {number} y - Point y coordinate
   * @param {number} [radius=10] - Node radius
   * @returns {boolean}
   */
  contains(x, y, radius = 10) {
    const dx = this.x - x;
    const dy = this.y - y;
    const r = this.penwidth ? 4 + parseFloat(this.penwidth) : radius;
    return (dx * dx + dy * dy) < (r * r);
  }

  /**
   * Get node type (for polymorphism)
   * @returns {string}
   */
  getType() {
    return 'node';
  }

  /**
   * Clone this node
   * @returns {Node}
   */
  clone() {
    return new Node(this.id, {
      ...this._data,
      x: this.x,
      y: this.y,
      vx: this.vx,
      vy: this.vy,
      fx: this.fx,
      fy: this.fy
    });
  }

  /**
   * Serialize to JSON
   * @returns {Object}
   */
  toJSON() {
    return {
      id: this.id,
      x: this.x,
      y: this.y,
      color: this.color,
      label: this.label,
      type: this.getType()
    };
  }
}