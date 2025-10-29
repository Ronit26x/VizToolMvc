// NodeMerger.js - Operation for merging linear node chains

import { Operation } from './Operation.js';

/**
 * NodeMerger operation merges linear node chains into a single merged node.
 * Stores original nodes and links for sequence reconstruction.
 */
export class NodeMerger extends Operation {
  constructor(graph, startNodeId) {
    super('NodeMerger', `Merge linear chain from node ${startNodeId}`);

    console.log('[NodeMerger] VERSION 2.0 - With chainEnd tracking');
    this.graph = graph;
    this.startNodeId = startNodeId;

    // Operation results
    this.mergedNode = null;
    this.originalNodeIds = [];
    this.originalNodes = [];
    this.originalEdges = [];
    this.externalEdges = [];
  }

  /**
   * Validate if operation can be executed
   */
  validate() {
    const startNode = this.graph.getNode(this.startNodeId);
    if (!startNode) {
      throw new Error(`Start node ${this.startNodeId} not found`);
    }

    return true;
  }

  /**
   * Execute the merge operation
   */
  execute() {
    this.validate();

    // Save state before execution (deep copy for plain objects)
    this.saveBeforeState({
      nodes: this.graph.getNodes().map(n => this.cloneObject(n)),
      edges: this.graph.getEdges().map(e => this.cloneObject(e))
    });

    // Find linear chain
    const startNode = this.graph.getNode(this.startNodeId);
    const chainNodes = this.findLinearChain(startNode);

    if (chainNodes.length < 2) {
      throw new Error(`Node ${this.startNodeId} is not part of a linear chain (found ${chainNodes.length} nodes)`);
    }

    this.originalNodeIds = chainNodes.map(n => n.id);
    this.originalNodes = chainNodes.map(n => this.cloneObject(n));

    // Collect internal and external edges BEFORE removing nodes
    this.collectEdges(chainNodes);

    console.log(`[NodeMerger] Found ${this.externalEdges.length} external edges to reconnect`);
    this.externalEdges.forEach(({ edge, subnodeType, externalNodeId, pathNodeId, chainEnd }) => {
      console.log(`  - ${chainEnd} of chain (${subnodeType} subnode of ${pathNodeId}) ↔ external node ${externalNodeId}`);
    });

    // Create merged node
    const pathName = `Linear Chain: ${chainNodes[0].id} → ${chainNodes[chainNodes.length - 1].id}`;
    this.mergedNode = this.createMergedNode(chainNodes, pathName);

    // Re-create external edges connected to merged node
    console.log(`[NodeMerger] Creating ${this.externalEdges.length} external edges`);
    const mergedEdges = this.createExternalEdges();

    // Use the proper MVC method for atomic merge operation
    console.log(`[NodeMerger] Executing atomic merge operation`);
    this.graph.mergeNodes(this.originalNodeIds, this.mergedNode, mergedEdges, 'operation');

    // Save state after execution (deep copy for plain objects)
    this.saveAfterState({
      nodes: this.graph.getNodes().map(n => this.cloneObject(n)),
      edges: this.graph.getEdges().map(e => this.cloneObject(e))
    });

    this.markExecuted();

    return {
      success: true,
      mergedNode: this.mergedNode,
      mergedNodeId: this.mergedNode.id,
      originalNodeIds: this.originalNodeIds,
      externalConnections: this.externalEdges.length,
      removedNodes: chainNodes.length,
      pathName
    };
  }

  /**
   * Reverse the merge operation (undo)
   */
  reverse() {
    if (!this.beforeState) {
      throw new Error('No state to restore');
    }

    // Clear graph
    this.graph.clear();

    // Restore original nodes
    this.beforeState.nodes.forEach(node => {
      this.graph.addNode(this.cloneObject(node));
    });

    // Restore original edges
    this.beforeState.edges.forEach(edge => {
      this.graph.addEdge(this.cloneObject(edge));
    });

    this.markReversed();
  }

  /**
   * Find the complete linear chain containing the start node
   */
  findLinearChain(startNode) {
    // Build connection information
    const connections = this.buildConnections();

    // Check if start node is linear
    const startConn = connections.get(startNode.id);
    if (!startConn || !this.isLinear(startNode.id, connections)) {
      return [startNode];
    }

    // Build chain in both directions
    const chainNodes = [startNode];
    const visited = new Set([startNode.id]);

    // Trace backwards
    let current = startNode;
    while (true) {
      const prev = this.getLinearPrevious(current, connections, visited);
      if (!prev) break;

      chainNodes.unshift(prev);
      visited.add(prev.id);
      current = prev;
    }

    // Trace forwards
    current = startNode;
    while (true) {
      const next = this.getLinearNext(current, connections, visited);
      if (!next) break;

      chainNodes.push(next);
      visited.add(next.id);
      current = next;
    }

    return chainNodes;
  }

  /**
   * Build connection information for all nodes
   * For GFA: Uses PHYSICAL connections (red/green subnodes based on orientations)
   * For DOT: Uses LOGICAL connections (source→target)
   */
  buildConnections() {
    const connections = new Map();

    // Initialize all nodes
    this.graph.getNodes().forEach(node => {
      connections.set(node.id, {
        incoming: [], // Red subnode (incoming) for GFA, or logical incoming
        outgoing: []  // Green subnode (outgoing) for GFA, or logical outgoing
      });
    });

    // Detect if this is GFA format by checking for orientation markers
    const edges = this.graph.getEdges();
    const isGFA = edges.length > 0 && edges.some(edge =>
      edge.srcOrientation !== undefined || edge.tgtOrientation !== undefined
    );

    // Process all edges
    edges.forEach(edge => {
      const sourceId = edge.source?.id !== undefined ? edge.source.id : edge.source;
      const targetId = edge.target?.id !== undefined ? edge.target.id : edge.target;

      if (isGFA) {
        // GFA: Use PHYSICAL connections based on orientations
        // + orientation = green (outgoing) subnode
        // - orientation = red (incoming) subnode

        const srcOrientation = edge.srcOrientation || '+';
        const tgtOrientation = edge.tgtOrientation || '+';

        // Source node connection
        if (connections.has(sourceId)) {
          if (srcOrientation === '+') {
            // Source uses green (outgoing) subnode
            connections.get(sourceId).outgoing.push({ nodeId: targetId, edge });
          } else {
            // Source uses red (incoming) subnode
            connections.get(sourceId).incoming.push({ nodeId: targetId, edge });
          }
        }

        // Target node connection
        if (connections.has(targetId)) {
          if (tgtOrientation === '+') {
            // Target uses red (incoming) subnode
            connections.get(targetId).incoming.push({ nodeId: sourceId, edge });
          } else {
            // Target uses green (outgoing) subnode
            connections.get(targetId).outgoing.push({ nodeId: sourceId, edge });
          }
        }
      } else {
        // DOT: Use LOGICAL connections (simple source→target)
        if (connections.has(sourceId)) {
          connections.get(sourceId).outgoing.push({ nodeId: targetId, edge });
        }
        if (connections.has(targetId)) {
          connections.get(targetId).incoming.push({ nodeId: sourceId, edge });
        }
      }
    });

    return connections;
  }

  /**
   * Check if node is linear (≤2 total connections)
   */
  isLinear(nodeId, connections) {
    const conn = connections.get(nodeId);
    if (!conn) return false;

    const totalConnections = conn.incoming.length + conn.outgoing.length;
    return totalConnections <= 2;
  }

  /**
   * Get previous node in linear chain
   * Can traverse backwards even from endpoint nodes (0 outgoing)
   */
  getLinearPrevious(currentNode, connections, visited) {
    const conn = connections.get(currentNode.id);

    // Can go backwards if we have incoming connections
    if (!conn || conn.incoming.length === 0) {
      return null;
    }

    // Stop if multiple paths converge here
    if (conn.incoming.length > 1) {
      return null;
    }

    const prevNodeId = conn.incoming[0].nodeId;
    if (visited.has(prevNodeId)) {
      return null; // Cycle detection
    }

    const prevConn = connections.get(prevNodeId);
    if (!prevConn) {
      return null;
    }

    // Previous node must not be branching (>2 total connections)
    const totalConnections = prevConn.incoming.length + prevConn.outgoing.length;
    if (totalConnections > 2) {
      return null;
    }

    return this.graph.getNode(prevNodeId);
  }

  /**
   * Get next node in linear chain
   * Can traverse forwards even from endpoint nodes (0 incoming)
   */
  getLinearNext(currentNode, connections, visited) {
    const conn = connections.get(currentNode.id);

    // Can go forwards if we have outgoing connections
    if (!conn || conn.outgoing.length === 0) {
      return null;
    }

    // Stop if multiple paths diverge here
    if (conn.outgoing.length > 1) {
      return null;
    }

    const nextNodeId = conn.outgoing[0].nodeId;
    if (visited.has(nextNodeId)) {
      return null; // Cycle detection
    }

    const nextConn = connections.get(nextNodeId);
    if (!nextConn) {
      return null;
    }

    // Next node must not be branching (>2 total connections)
    const totalConnections = nextConn.incoming.length + nextConn.outgoing.length;
    if (totalConnections > 2) {
      return null;
    }

    return this.graph.getNode(nextNodeId);
  }

  /**
   * Collect internal and external edges for chain
   * For GFA: Track which PHYSICAL subnode (red/green) each external edge connects to
   */
  collectEdges(chainNodes) {
    const chainNodeIds = new Set(chainNodes.map(n => n.id));

    this.originalEdges = [];
    this.externalEdges = [];

    // Detect if this is GFA format
    const edges = this.graph.getEdges();
    const isGFA = edges.length > 0 && edges.some(edge =>
      edge.srcOrientation !== undefined || edge.tgtOrientation !== undefined
    );

    edges.forEach(edge => {
      const sourceId = edge.source?.id !== undefined ? edge.source.id : edge.source;
      const targetId = edge.target?.id !== undefined ? edge.target.id : edge.target;

      const sourceInChain = chainNodeIds.has(sourceId);
      const targetInChain = chainNodeIds.has(targetId);

      if (sourceInChain && targetInChain) {
        // Internal edge (within chain)
        this.originalEdges.push(this.cloneObject(edge));
      } else if (sourceInChain || targetInChain) {
        // External edge - determine physical subnode connection
        let subnodeType; // 'red' (incoming) or 'green' (outgoing)
        let pathNodeId;
        let externalNodeId;

        if (isGFA) {
          // For GFA: Determine which subnode is used
          const srcOri = edge.srcOrientation || '+';
          const tgtOri = edge.tgtOrientation || '+';

          if (sourceInChain) {
            // Chain node is source - check which subnode it uses
            pathNodeId = sourceId;
            externalNodeId = targetId;
            subnodeType = srcOri === '+' ? 'green' : 'red';
          } else {
            // Chain node is target - check which subnode it uses
            pathNodeId = targetId;
            externalNodeId = sourceId;
            subnodeType = tgtOri === '+' ? 'red' : 'green';
          }
        } else {
          // For DOT: Use logical direction
          pathNodeId = sourceInChain ? sourceId : targetId;
          externalNodeId = sourceInChain ? targetId : sourceId;
          subnodeType = sourceInChain ? 'green' : 'red';
        }

        // Determine which END of the chain this connection is at
        const firstNodeId = chainNodes[0].id;
        const lastNodeId = chainNodes[chainNodes.length - 1].id;
        let chainEnd;

        if (pathNodeId === firstNodeId && subnodeType === 'red') {
          chainEnd = 'start'; // First node's red subnode = chain start
        } else if (pathNodeId === lastNodeId && subnodeType === 'green') {
          chainEnd = 'end'; // Last node's green subnode = chain end
        } else {
          // This shouldn't happen for a proper linear chain
          console.warn(`[NodeMerger] External edge connects to middle of chain at ${pathNodeId} (${subnodeType})`);
          chainEnd = subnodeType === 'red' ? 'start' : 'end';
        }

        this.externalEdges.push({
          edge: this.cloneObject(edge),
          subnodeType: subnodeType, // Which subnode of the chain node (red/green)
          chainEnd: chainEnd, // Which end of the merged node (start/end)
          pathNodeId: pathNodeId,
          externalNodeId: externalNodeId,
          isSource: sourceInChain // Is the chain node the source of this edge?
        });
      }
    });
  }

  /**
   * Create the merged node
   */
  createMergedNode(chainNodes, pathName) {
    const mergedNodeId = this.generateMergedId(chainNodes);

    // Calculate average position
    const avgX = chainNodes.reduce((sum, n) => sum + n.x, 0) / chainNodes.length;
    const avgY = chainNodes.reduce((sum, n) => sum + n.y, 0) / chainNodes.length;

    // Create merged node as plain object (compatible with GraphModel)
    const mergedNode = {
      id: mergedNodeId,
      gfaType: 'merged_segment',
      mergedFrom: chainNodes.map(n => n.id),
      pathName: pathName,

      // Store original data for sequence reconstruction
      originalNodes: chainNodes.map(n => this.cloneObject(n)),
      originalLinks: this.originalEdges.map(e => this.cloneObject(e)),

      // Calculate combined properties
      length: chainNodes.reduce((sum, n) => sum + (n.length || 1000), 0),
      depth: chainNodes.reduce((sum, n) => sum + (n.depth || 1.0), 0) / chainNodes.length,
      seq: '*',

      // Position
      x: avgX,
      y: avgY,
      vx: 0,
      vy: 0
    };

    return mergedNode;
  }

  /**
   * Create external edges connecting to merged node
   * Returns an array of new link objects
   *
   * For GFA: Maps chain ends to merged node orientations
   * - start of chain (red end) → '-' orientation
   * - end of chain (green end) → '+' orientation
   */
  createExternalEdges() {
    const newLinks = [];

    this.externalEdges.forEach(({ edge, chainEnd, externalNodeId, pathNodeId, isSource }, index) => {
      let newLink;

      // Determine merged node's orientation based on which END of chain was connected
      // Start of chain (incoming/red end) = '-', End of chain (outgoing/green end) = '+'
      const mergedNodeOrientation = chainEnd === 'end' ? '+' : '-';

      if (isSource) {
        // Chain node was source → Merged node is source
        newLink = {
          source: this.mergedNode.id,
          target: externalNodeId,
          srcOrientation: mergedNodeOrientation,
          tgtOrientation: edge.tgtOrientation || '+',
          overlap: edge.overlap || '*',
          gfaType: edge.gfaType || 'link',
          mergedConnection: true,
          originalPathNode: pathNodeId
        };
      } else {
        // Chain node was target → Merged node is target
        newLink = {
          source: externalNodeId,
          target: this.mergedNode.id,
          srcOrientation: edge.srcOrientation || '+',
          tgtOrientation: mergedNodeOrientation,
          overlap: edge.overlap || '*',
          gfaType: edge.gfaType || 'link',
          mergedConnection: true,
          originalPathNode: pathNodeId
        };
      }

      console.log(`[NodeMerger] Creating edge ${index + 1}: ${newLink.source}${newLink.srcOrientation} → ${newLink.target}${newLink.tgtOrientation} (${chainEnd} of merged node)`);
      newLinks.push(newLink);
    });

    return newLinks;
  }

  /**
   * Generate merged node ID
   */
  generateMergedId(chainNodes) {
    const nodeIds = chainNodes.map(n => n.id).join('_');
    const timestamp = Date.now().toString().slice(-6);
    return `MERGED_${nodeIds}_${timestamp}`;
  }

  /**
   * Get operation summary
   */
  getSummary() {
    return {
      ...super.getSummary(),
      mergedNodeId: this.mergedNode?.id,
      originalNodeIds: this.originalNodeIds,
      chainLength: this.originalNodeIds.length
    };
  }

  /**
   * Deep clone a plain object (for nodes/edges that aren't Entity instances)
   */
  cloneObject(obj) {
    if (!obj) return obj;
    return JSON.parse(JSON.stringify(obj));
  }
}
