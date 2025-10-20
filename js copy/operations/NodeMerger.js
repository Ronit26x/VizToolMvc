// NodeMerger.js - Operation for merging linear node chains

import { Operation } from './Operation.js';
import { MergedNode } from '../model/entities/MergedNode.js';

/**
 * NodeMerger operation merges linear node chains into a single merged node.
 * Stores original nodes and links for sequence reconstruction.
 */
export class NodeMerger extends Operation {
  constructor(graph, startNodeId) {
    super('NodeMerger', `Merge linear chain from node ${startNodeId}`);

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

    // Save state before execution
    this.saveBeforeState({
      nodes: this.graph.getNodes().map(n => n.clone()),
      edges: this.graph.getEdges().map(e => e.clone())
    });

    // Find linear chain
    const startNode = this.graph.getNode(this.startNodeId);
    const chainNodes = this.findLinearChain(startNode);

    if (chainNodes.length < 2) {
      throw new Error(`Node ${this.startNodeId} is not part of a linear chain (found ${chainNodes.length} nodes)`);
    }

    this.originalNodeIds = chainNodes.map(n => n.id);
    this.originalNodes = chainNodes.map(n => n.clone());

    // Collect internal and external edges
    this.collectEdges(chainNodes);

    // Create merged node
    const pathName = `Linear Chain: ${chainNodes[0].id} → ${chainNodes[chainNodes.length - 1].id}`;
    this.mergedNode = this.createMergedNode(chainNodes, pathName);

    // Remove original nodes from graph
    chainNodes.forEach(node => {
      this.graph.removeNode(node.id);
    });

    // Add merged node to graph
    this.graph.addNode(this.mergedNode);

    // Re-create external edges connected to merged node
    this.reconnectExternalEdges();

    // Save state after execution
    this.saveAfterState({
      nodes: this.graph.getNodes().map(n => n.clone()),
      edges: this.graph.getEdges().map(e => e.clone())
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
      this.graph.addNode(node.clone());
    });

    // Restore original edges
    this.beforeState.edges.forEach(edge => {
      this.graph.addEdge(edge.clone());
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
   */
  buildConnections() {
    const connections = new Map();

    // Initialize all nodes
    this.graph.getNodes().forEach(node => {
      connections.set(node.id, {
        incoming: [],
        outgoing: []
      });
    });

    // Process all edges
    this.graph.getEdges().forEach(edge => {
      const sourceId = edge.getSourceId();
      const targetId = edge.getTargetId();

      if (connections.has(sourceId)) {
        connections.get(sourceId).outgoing.push({ nodeId: targetId, edge });
      }
      if (connections.has(targetId)) {
        connections.get(targetId).incoming.push({ nodeId: sourceId, edge });
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
   */
  getLinearPrevious(currentNode, connections, visited) {
    const conn = connections.get(currentNode.id);
    if (!conn || conn.incoming.length !== 1) {
      return null;
    }

    const prevNodeId = conn.incoming[0].nodeId;
    if (visited.has(prevNodeId)) {
      return null;
    }

    if (!this.isLinear(prevNodeId, connections)) {
      return null;
    }

    return this.graph.getNode(prevNodeId);
  }

  /**
   * Get next node in linear chain
   */
  getLinearNext(currentNode, connections, visited) {
    const conn = connections.get(currentNode.id);
    if (!conn || conn.outgoing.length !== 1) {
      return null;
    }

    const nextNodeId = conn.outgoing[0].nodeId;
    if (visited.has(nextNodeId)) {
      return null;
    }

    if (!this.isLinear(nextNodeId, connections)) {
      return null;
    }

    return this.graph.getNode(nextNodeId);
  }

  /**
   * Collect internal and external edges for chain
   */
  collectEdges(chainNodes) {
    const chainNodeIds = new Set(chainNodes.map(n => n.id));

    this.originalEdges = [];
    this.externalEdges = [];

    this.graph.getEdges().forEach(edge => {
      const sourceId = edge.getSourceId();
      const targetId = edge.getTargetId();

      const sourceInChain = chainNodeIds.has(sourceId);
      const targetInChain = chainNodeIds.has(targetId);

      if (sourceInChain && targetInChain) {
        // Internal edge
        this.originalEdges.push(edge.clone());
      } else if (sourceInChain || targetInChain) {
        // External edge
        this.externalEdges.push({
          edge: edge.clone(),
          type: sourceInChain ? 'outgoing' : 'incoming',
          pathNodeId: sourceInChain ? sourceId : targetId,
          externalNodeId: sourceInChain ? targetId : sourceId
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

    const mergedNode = new MergedNode(
      mergedNodeId,
      chainNodes.map(n => n.id),
      chainNodes.map(n => n.clone()),
      this.originalEdges.map(e => e.toJSON()),
      {
        pathName,
        x: avgX,
        y: avgY,
        vx: 0,
        vy: 0
      }
    );

    return mergedNode;
  }

  /**
   * Reconnect external edges to merged node
   */
  reconnectExternalEdges() {
    this.externalEdges.forEach(({ edge, type, externalNodeId }) => {
      // Clone edge properties
      const edgeData = { ...edge.data };

      if (edge.srcOrientation) edgeData.srcOrientation = edge.srcOrientation;
      if (edge.tgtOrientation) edgeData.tgtOrientation = edge.tgtOrientation;
      if (edge.overlap) edgeData.overlap = edge.overlap;
      if (edge.gfaType) edgeData.gfaType = edge.gfaType;

      edgeData.mergedConnection = true;

      // Determine edge class to use
      const EdgeClass = edge.constructor;

      let newEdge;
      if (type === 'incoming') {
        newEdge = new EdgeClass(
          externalNodeId,
          this.mergedNode.id,
          edge.srcOrientation,
          edge.tgtOrientation,
          edgeData
        );
      } else {
        newEdge = new EdgeClass(
          this.mergedNode.id,
          externalNodeId,
          edge.srcOrientation,
          edge.tgtOrientation,
          edgeData
        );
      }

      this.graph.addEdge(newEdge);
    });
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
}
