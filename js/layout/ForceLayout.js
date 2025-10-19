// js/layout/ForceLayout.js
import { LayoutEngine } from './LayoutEngine.js';

export class ForceLayout extends LayoutEngine {
  constructor(width, height) {
    super();
    this.width = width;
    this.height = height;
    this.simulation = null;
  }
  
  // ORIGINAL LOGIC: Create simulation based on graph format
  initialize(nodes, links, format) {
    const isGfaGraph = format === 'gfa';
    
    if (isGfaGraph) {
      return this.createGfaSimulation(nodes, links);
    } else {
      return this.createDotSimulation(nodes, links);
    }
  }
  
  // ORIGINAL: DOT simulation (simple force-directed)
  createDotSimulation(nodes, links) {
    this.simulation = window.d3.forceSimulation(nodes)
      .force('link', window.d3.forceLink(links)
        .id(d => d.id)
        .distance(50))
      .force('charge', window.d3.forceManyBody()
        .strength(-100))
      .force('center', window.d3.forceCenter(this.width / 2, this.height / 2));
    
    return this.simulation;
  }
  
  // ORIGINAL: GFA simulation with adjusted forces
  createGfaSimulation(nodes, links) {
    const getLinkDistance = (link) => {
      const sourceLength = link.source._drawnLength || 50;
      const targetLength = link.target._drawnLength || 50;
      return (sourceLength + targetLength) / 2 + 10;
    };
    
    // Initialize positions for better layout
    if (nodes.some(n => n.x === undefined)) {
      const cols = Math.ceil(Math.sqrt(nodes.length));
      nodes.forEach((node, i) => {
        if (node.x === undefined) {
          node.x = (i % cols) * 100 + this.width / 4;
          node.y = Math.floor(i / cols) * 100 + this.height / 4;
        }
      });
    }
    
    this.simulation = window.d3.forceSimulation(nodes)
      .force('link', window.d3.forceLink(links)
        .id(d => d.id)
        .distance(getLinkDistance)
        .strength(1.0))
      .force('charge', window.d3.forceManyBody()
        .strength(d => {
          if (d._drawnLength) {
            return -50 - (d._drawnLength * 0.2);
          }
          return -100;
        })
        .distanceMax(300))
      .force('center', window.d3.forceCenter(this.width / 2, this.height / 2)
        .strength(0.1))
      .force('collision', window.d3.forceCollide()
        .radius(d => {
          if (d._drawnLength) {
            return Math.max(20, d._drawnLength / 3);
          }
          return 20;
        })
        .strength(0.7))
      .velocityDecay(0.4)
      .alphaDecay(0.02);
    
    return this.simulation;
  }
  
  start() {
    if (this.simulation) {
      this.simulation.restart();
    }
  }
  
  stop() {
    if (this.simulation) {
      this.simulation.stop();
    }
  }
  
  tick(callback) {
    if (this.simulation) {
      this.simulation.on('tick', callback);
    }
  }
  
  alpha(value) {
    if (this.simulation) {
      this.simulation.alpha(value);
    }
  }
  
  alphaTarget(value) {
    if (this.simulation) {
      this.simulation.alphaTarget(value);
    }
  }
  
  restart() {
    if (this.simulation) {
      this.simulation.restart();
    }
  }
  
  updateCenter(width, height) {
    this.width = width;
    this.height = height;
    
    if (this.simulation) {
      this.simulation.force('center', 
        window.d3.forceCenter(width / 2, height / 2).strength(0.1)
      );
    }
  }
}