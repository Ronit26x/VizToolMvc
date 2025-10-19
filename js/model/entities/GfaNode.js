// js/model/entities/GfaNode.js
// GFA-specific node with orientation, subnodes, and sequences

import { Node } from './Node.js';

export class GfaNode extends Node {
  constructor(id, data = {}) {
    super(id, data);
    
    // GFA-specific properties
    this.length = data.length || 1000;
    this.depth = data.depth || 1.0;
    this.seq = data.seq || '';
    this.gfaType = 'segment';
    
    // Orientation and rendering
    this.angle = 0;
    this.isFlipped = false;
    this.drawnLength = 0; // Will be calculated by renderer
    this.width = 0; // Will be calculated by renderer
    
    // Subnodes for GFA connections
    this.inSubnode = null;
    this.outSubnode = null;
    
    // Store GFA tags
    this.tags = {};
    if (data.DP) this.tags.DP = data.DP;
    if (data.KC) this.tags.KC = data.KC;
    if (data.RC) this.tags.RC = data.RC;
    if (data.LN) this.tags.LN = data.LN;
    
    this.createSubnodes();
  }

  /**
   * Create incoming and outgoing subnodes
   */
  createSubnodes() {
    this.inSubnode = {
      id: `${this.id}_in`,
      parentId: this.id,
      type: 'incoming',
      x: this.x,
      y: this.y,
      radius: 3
    };
    
    this.outSubnode = {
      id: `${this.id}_out`,
      parentId: this.id,
      type: 'outgoing',
      x: this.x,
      y: this.y,
      radius: 3
    };
    
    this.updateSubnodePositions();
  }

  /**
   * Update subnode positions based on node position and angle
   */
  updateSubnodePositions() {
    if (!this.drawnLength) return;
    
    const cos = Math.cos(this.angle);
    const sin = Math.sin(this.angle);
    const halfLength = this.drawnLength / 2;
    
    // Position subnodes at the ends
    this.inSubnode.x = this.x - cos * halfLength;
    this.inSubnode.y = this.y - sin * halfLength;
    
    this.outSubnode.x = this.x + cos * halfLength;
    this.outSubnode.y = this.y + sin * halfLength;
  }

  /**
   * Flip node 180 degrees
   */
  flip() {
    this.isFlipped = !this.isFlipped;
    this.angle += Math.PI;
    
    // Normalize angle to [-π, π]
    while (this.angle > Math.PI) this.angle -= 2 * Math.PI;
    while (this.angle < -Math.PI) this.angle += 2 * Math.PI;
    
    // Swap subnodes
    const temp = { ...this.inSubnode };
    this.inSubnode = { ...this.outSubnode };
    this.outSubnode = temp;
    
    // Update IDs to reflect swap
    this.inSubnode.id = `${this.id}_in`;
    this.inSubnode.type = 'incoming';
    this.outSubnode.id = `${this.id}_out`;
    this.outSubnode.type = 'outgoing';
    
    this.updateSubnodePositions();
  }

  /**
   * Set angle and update subnodes
   * @param {number} angle - New angle in radians
   */
  setAngle(angle) {
    this.angle = angle;
    this.updateSubnodePositions();
  }

  /**
   * Get subnode at position (for flip interaction)
   * @param {number} x - Point x coordinate
   * @param {number} y - Point y coordinate
   * @param {number} [threshold=10] - Distance threshold
   * @returns {string|null} 'incoming', 'outgoing', or null
   */
  getSubnodeAt(x, y, threshold = 10) {
    const inDist = Math.sqrt(
      (x - this.inSubnode.x) * (x - this.inSubnode.x) + 
      (y - this.inSubnode.y) * (y - this.inSubnode.y)
    );
    const outDist = Math.sqrt(
      (x - this.outSubnode.x) * (x - this.outSubnode.x) + 
      (y - this.outSubnode.y) * (y - this.outSubnode.y)
    );
    
    if (inDist <= threshold) return 'incoming';
    if (outDist <= threshold) return 'outgoing';
    return null;
  }

  /**
   * Get subnode for edge connection
   * @param {boolean} isOutgoing - Whether this is an outgoing connection
   * @returns {Object} Subnode object
   */
  getSubnodeForEdge(isOutgoing) {
    return isOutgoing ? this.outSubnode : this.inSubnode;
  }

  /**
   * Override contains for GFA node shape
   * @param {number} x - Point x coordinate
   * @param {number} y - Point y coordinate
   * @returns {boolean}
   */
  contains(x, y) {
    // Simple rectangular hit test based on drawn length and width
    if (!this.drawnLength || !this.width) {
      return super.contains(x, y);
    }
    
    // Transform point to node's local coordinates
    const cos = Math.cos(this.angle);
    const sin = Math.sin(this.angle);
    const dx = x - this.x;
    const dy = y - this.y;
    
    // Rotate point to align with node
    const localX = dx * cos + dy * sin;
    const localY = -dx * sin + dy * cos;
    
    // Check if inside rectangle
    const halfLength = this.drawnLength / 2;
    const halfWidth = this.width / 2;
    
    return Math.abs(localX) <= halfLength + 3 && 
           Math.abs(localY) <= halfWidth + 3;
  }

  /**
   * Override move to update subnodes
   */
  move(x, y) {
    super.move(x, y);
    this.updateSubnodePositions();
  }

  /**
   * Get node type
   * @returns {string}
   */
  getType() {
    return 'gfa';
  }

  /**
   * Format length for display
   * @param {number} length - Length in base pairs
   * @returns {string}
   */
  static formatLength(length) {
    if (length >= 1000000) {
      return (length / 1000000).toFixed(1) + 'Mb';
    } else if (length >= 1000) {
      return (length / 1000).toFixed(1) + 'kb';
    }
    return length + 'bp';
  }

  /**
   * Clone this GFA node
   * @returns {GfaNode}
   */
  clone() {
    const cloned = new GfaNode(this.id, {
      ...this._data,
      x: this.x,
      y: this.y,
      length: this.length,
      depth: this.depth,
      seq: this.seq
    });
    cloned.angle = this.angle;
    cloned.isFlipped = this.isFlipped;
    return cloned;
  }
}