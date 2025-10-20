// LayoutManager.js - Force-directed layout with dampening and cycle prevention

import { EventEmitter } from './EventEmitter.js';

/**
 * LayoutManager handles automated graph layout using D3 force simulation.
 * Includes dampening to prevent oscillation and cycle guards.
 *
 * Events emitted:
 * - layoutTick: {alpha}
 * - layoutEnd: {}
 */
export class LayoutManager extends EventEmitter {
  constructor(model) {
    super();

    this.model = model;
    this.simulation = null;
    this.isRunning = false;

    // Dampening configuration
    this.dampeningEnabled = true;
    this.dampeningThreshold = 0.5; // Minimum position change to emit update (pixels)
    this.layoutSourceTag = 'layout'; // Tag for events emitted by layout

    // Track last positions to calculate deltas
    this._lastPositions = new Map();

    // Render throttling
    this._renderPending = false;

    // Subscribe to model events that should trigger layout updates
    this._setupModelListeners();
  }

  // ===== SETUP =====

  _setupModelListeners() {
    // When graph is loaded, restart simulation
    this.model.on('graphLoaded', ({ nodes, links, source }) => {
      if (source !== this.layoutSourceTag) {
        this.start(nodes, links);
      }
    });

    // When nodes are added, restart simulation
    this.model.on('nodeAdded', () => {
      if (this.isRunning) {
        this.restart();
      }
    });

    // When nodes are removed, restart simulation
    this.model.on('nodeRemoved', () => {
      if (this.isRunning) {
        this.restart();
      }
    });

    // When a node is dragged, update simulation
    this.model.on('nodeMoved', ({ nodeId, x, y, source }) => {
      // Ignore events from layout itself to prevent cycles
      if (source === this.layoutSourceTag) {
        return;
      }

      // If user is dragging, boost simulation
      if (source === 'user' || source === 'drag') {
        this.boostSimulation();
      }
    });

    // When a node is pinned, update simulation
    this.model.on('nodePinned', ({ nodeId, pinned }) => {
      if (this.isRunning) {
        const node = this.model.getNode(nodeId);
        if (node && this.simulation) {
          if (pinned) {
            node.fx = node.x;
            node.fy = node.y;
          } else {
            node.fx = null;
            node.fy = null;
          }
          this.simulation.alpha(0.1).restart();
        }
      }
    });
  }

  // ===== SIMULATION CONTROL =====

  /**
   * Start simulation with nodes and links
   */
  start(nodes, links, canvasWidth = 800, canvasHeight = 600) {
    if (this.simulation) {
      this.stop();
    }

    this.isRunning = true;
    this._lastPositions.clear();

    // Create D3 force simulation (matching existing behavior)
    this.simulation = d3.forceSimulation(nodes)
      .force('charge', d3.forceManyBody().strength(-300))
      .force('link', d3.forceLink(links)
        .id(d => d.id)
        .distance(100))
      .force('center', d3.forceCenter(canvasWidth / 2, canvasHeight / 2))
      .on('tick', () => this._onTick())
      .on('end', () => this._onEnd());

    return this.simulation;
  }

  /**
   * Stop simulation
   */
  stop() {
    if (this.simulation) {
      this.simulation.stop();
      this.isRunning = false;
    }
  }

  /**
   * Restart simulation with current nodes
   */
  restart() {
    if (this.simulation) {
      this.simulation.alpha(1).restart();
    }
  }

  /**
   * Boost simulation (e.g., during drag)
   */
  boostSimulation(alpha = 0.3) {
    if (this.simulation) {
      this.simulation.alphaTarget(alpha).restart();
    }
  }

  /**
   * Cool down simulation (e.g., after drag ends)
   */
  coolSimulation() {
    if (this.simulation) {
      this.simulation.alphaTarget(0);
    }
  }

  /**
   * Update center force (e.g., on canvas resize)
   */
  updateCenter(width, height) {
    if (this.simulation) {
      this.simulation.force('center', d3.forceCenter(width / 2, height / 2));
    }
  }

  // ===== SIMULATION CALLBACKS =====

  _onTick() {
    // Always update all nodes directly (for smooth animation)
    this.simulation.nodes().forEach(node => {
      // Update node positions directly in the model's array (no events)
      const modelNode = this.model.getNode(node.id);
      if (modelNode) {
        modelNode.x = node.x;
        modelNode.y = node.y;
      }
    });

    // Emit batch event for view to render (throttled by requestAnimationFrame)
    if (!this._renderPending) {
      this._renderPending = true;
      requestAnimationFrame(() => {
        this._renderPending = false;
        this.model.emit('nodesMovedBatch', { source: this.layoutSourceTag });
      });
    }

    this.emit('layoutTick', { alpha: this.simulation.alpha() });
  }

  _onEnd() {
    // Final position update
    this._updateAllNodePositions();

    this.emit('layoutEnd', {});
    this.isRunning = false;
  }

  /**
   * Update all node positions in model (used for non-dampened updates)
   */
  _updateAllNodePositions() {
    if (!this.simulation) return;

    const updates = this.simulation.nodes().map(node => ({
      nodeId: node.id,
      x: node.x,
      y: node.y
    }));

    if (updates.length > 0) {
      this.model.updateNodePositions(updates, this.layoutSourceTag);
    }
  }

  // ===== CONFIGURATION =====

  /**
   * Enable/disable dampening
   */
  setDampening(enabled) {
    this.dampeningEnabled = enabled;
  }

  /**
   * Set dampening threshold
   */
  setDampeningThreshold(threshold) {
    this.dampeningThreshold = threshold;
  }

  /**
   * Update force strengths
   */
  setForceStrengths({ charge, linkDistance, linkStrength } = {}) {
    if (!this.simulation) return;

    if (charge !== undefined) {
      this.simulation.force('charge', d3.forceManyBody().strength(charge));
    }

    if (linkDistance !== undefined || linkStrength !== undefined) {
      const linkForce = this.simulation.force('link');
      if (linkDistance !== undefined) {
        linkForce.distance(linkDistance);
      }
      if (linkStrength !== undefined) {
        linkForce.strength(linkStrength);
      }
    }

    this.simulation.alpha(0.3).restart();
  }

  // ===== CLEANUP =====

  /**
   * Clean up simulation and listeners
   */
  destroy() {
    this.stop();
    this.removeAllListeners();
    this._lastPositions.clear();
  }
}
