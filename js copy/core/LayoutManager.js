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
        // Use actual arrays from model, not event copies
        this.start(this.model._nodes, this.model._links);
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

    // When nodes are merged, update simulation data
    this.model.on('nodesMerged', () => {
      console.log('[LayoutManager] nodesMerged event received! isRunning:', this.isRunning);
      if (this.simulation) {
        console.log('[LayoutManager] Updating simulation data...');
        this.updateSimulationData();
      } else {
        console.warn('[LayoutManager] nodesMerged received but no simulation exists');
      }
    });

    console.log('[LayoutManager] Event listeners registered, including nodesMerged');
  }

  // ===== SIMULATION CONTROL =====

  /**
   * Start simulation with nodes and links
   */
  start(nodes, links, canvasWidth = 800, canvasHeight = 600) {
    console.log(`🔧 [LayoutManager] start() called with ${nodes.length} nodes and ${links.length} links`);

    // DIAGNOSTIC: Check if we're receiving the actual arrays or copies
    console.log('[LayoutManager] Are we using actual model arrays?',
      nodes === this.model._nodes ? '✅ YES (nodes)' : '❌ NO (nodes)',
      links === this.model._links ? '✅ YES (links)' : '❌ NO (links)');

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

    console.log('[LayoutManager] ✅ Simulation started');
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
   * Update simulation data (nodes and links) without recreating simulation
   * This is used when the graph structure changes (e.g., nodes merged)
   */
  updateSimulationData() {
    if (!this.simulation) {
      console.warn('[LayoutManager] Cannot update simulation data - no simulation exists');
      return;
    }

    console.log('🔧 [LayoutManager] CRITICAL FIX ACTIVE - Using _nodes and _links directly (not getters)');

    // CRITICAL: Must use the ACTUAL arrays, not copies, so D3 can mutate them
    const nodes = this.model._nodes;
    const links = this.model._links;

    console.log(`[LayoutManager] Updating simulation with ${nodes.length} nodes and ${links.length} links`);

    // DIAGNOSTIC: Log link objects BEFORE D3 processes them
    console.log('[LayoutManager] Links BEFORE D3 initialization:');
    links.forEach((link, i) => {
      const srcType = typeof link.source;
      const tgtType = typeof link.target;
      const srcVal = link.source?.id || link.source;
      const tgtVal = link.target?.id || link.target;
      console.log(`  Link ${i}: ${srcVal} (${srcType}) → ${tgtVal} (${tgtType})`);
    });

    // Update nodes
    this.simulation.nodes(nodes);

    // IMPORTANT: Create new link force and let D3 initialize it properly
    // D3 will mutate the link objects, replacing string IDs with node object references
    const newLinkForce = d3.forceLink(links)
      .id(d => d.id)
      .distance(100);

    // Replace the link force
    this.simulation.force('link', newLinkForce);

    // DIAGNOSTIC: Log link objects AFTER D3 processes them
    console.log('[LayoutManager] Links AFTER D3 initialization:');
    links.forEach((link, i) => {
      const srcType = typeof link.source;
      const tgtType = typeof link.target;
      const srcVal = link.source?.id || link.source;
      const tgtVal = link.target?.id || link.target;
      console.log(`  Link ${i}: ${srcVal} (${srcType}) → ${tgtVal} (${tgtType})`);
    });

    // DIAGNOSTIC: Verify the link force was properly created
    const linkForce = this.simulation.force('link');
    if (linkForce) {
      console.log(`[LayoutManager] Link force created successfully with ${linkForce.links().length} links`);
    } else {
      console.error('[LayoutManager] CRITICAL: Link force is NULL!');
    }

    // Mark as running and restart simulation with LOW energy (gentle repositioning)
    this.isRunning = true;
    this.simulation.alpha(0.1).restart();

    console.log('[LayoutManager] ✅ Simulation restarted with updated data');
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
