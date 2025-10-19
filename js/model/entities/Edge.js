// js/model/entities/Edge.js
// Base Edge class for graph edges

export class Edge {
  constructor(source, target, data = {}) {
    // Source and target can be node IDs or node objects
    this.source = source;
    this.target = target;
    
    // Visual properties
    this.color = data.color || '#999999';
    this.penwidth = data.penwidth || 1;
    this.style = data.style || null;
    this.label = data.label || null;
    
    // Store original data
    this._data = data;
  }

  /**
   * Get source node ID
   * @returns {string|number}
   */
  getSourceId() {
    return typeof this.source === 'object' ? this.source.id : this.source;
  }

  /**
   * Get target node ID
   * @returns {string|number}
   */
  getTargetId() {
    return typeof this.target === 'object' ? this.target.id : this.target;
  }

  /**
   * Check if edge connects two nodes
   * @param {string|number} nodeId1 - First node ID
   * @param {string|number} nodeId2 - Second node ID
   * @returns {boolean}
   */
  connects(nodeId1, nodeId2) {
    const sourceId = this.getSourceId();
    const targetId = this.getTargetId();
    
    return (sourceId === nodeId1 && targetId === nodeId2) ||
           (sourceId === nodeId2 && targetId === nodeId1);
  }

  /**
   * Check if edge involves a node
   * @param {string|number} nodeId - Node ID
   * @returns {boolean}
   */
  involves(nodeId) {
    return this.getSourceId() === nodeId || this.getTargetId() === nodeId;
  }

  /**
   * Get edge type (for polymorphism)
   * @returns {string}
   */
  getType() {
    return 'edge';
  }

  /**
   * Clone this edge
   * @returns {Edge}
   */
  clone() {
    return new Edge(this.source, this.target, { ...this._data });
  }

  /**
   * Serialize to JSON
   * @returns {Object}
   */
  toJSON() {
    return {
      source: this.getSourceId(),
      target: this.getTargetId(),
      color: this.color,
      type: this.getType()
    };
  }
}