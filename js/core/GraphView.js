import { EventEmitter } from './EventEmitter.js';
import { CanvasManager } from '../view/canvas/CanvasManager.js';
import { DotRenderer } from '../view/renderers/DotRenderer.js';
import { GfaRenderer } from '../view/renderers/GfaRenderer.js';

export class GraphView extends EventEmitter {
  constructor(canvasElement, model) {
    super();
    this.model = model;
    this.canvasManager = new CanvasManager(canvasElement);
    this.renderer = null;
    
    // Subscribe to model events
    this.setupModelListeners();
    
    // Forward canvas events
    this.setupCanvasListeners();
    
    // Setup UI listeners
    this.setupUIListeners();
  }

  setupModelListeners() {
    this.model.on('graph:loaded', ({ graph, format }) => {
      this.setRenderer(format);
      this.render();
    });

    this.model.on('node:moved', () => this.render());
    this.model.on('node:added', () => this.render());
    this.model.on('node:removed', () => this.render());
    this.model.on('node:flipped', () => this.render());
    this.model.on('selection:changed', () => this.render());
    this.model.on('path:current-changed', () => this.render());
    this.model.on('graph:restored', () => this.render());
  }

  setupCanvasListeners() {
    this.canvasManager.on('node:dragStart', ({ position, event }) => {
      const simPos = this.model.transform.screenToSimulation(position.x, position.y);
      const node = this.findNodeAt(simPos.x, simPos.y);
      
      if (node) {
        this.emit('node:dragStart', { nodeId: node.id, position, event });
      } else {
        this.emit('canvas:click', { position, event });
      }
    });

    this.canvasManager.on('node:dragging', ({ position, event }) => {
      this.emit('node:dragging', { position, event });
    });

    this.canvasManager.on('node:dragEnd', ({ event }) => {
      this.emit('node:dragEnd', { event });
    });

    this.canvasManager.on('canvas:click', ({ position, event }) => {
      const simPos = this.model.transform.screenToSimulation(position.x, position.y);
      const node = this.findNodeAt(simPos.x, simPos.y);
      
      if (node) {
        this.emit('node:click', { nodeId: node.id, position, event });
      }
    });

    this.canvasManager.on('canvas:resized', ({ width, height }) => {
      this.render();
    });
  }

  setupUIListeners() {
    // File input
    const fileInput = document.getElementById('fileInput');
    if (fileInput) {
      fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
          this.emit('file:selected', { file });
        }
      });
    }

    // Buttons
    this.setupButton('genRandom', 'button:generate');
    this.setupButton('resetView', 'button:resetView');
    this.setupButton('pinNode', 'button:pin');
    this.setupButton('flipNode', 'button:flip');
    this.setupButton('resolveVertex', 'button:resolve');
    this.setupButton('resolvePhysical', 'button:resolvePhysical');
    this.setupButton('mergeNodes', 'button:merge');
    this.setupButton('redraw', 'button:redraw');
    this.setupButton('removeNodes', 'button:remove');
    this.setupButton('undo', 'button:undo');

    // Path management
    const pathInput = document.getElementById('pathSequence');
    const pathNameInput = document.getElementById('pathName');
    const savePathBtn = document.getElementById('savePath');
    const highlightPathBtn = document.getElementById('highlightPath');

    if (savePathBtn && pathInput) {
      savePathBtn.addEventListener('click', () => {
        const sequence = pathInput.value.trim();
        const name = pathNameInput ? pathNameInput.value.trim() : '';
        if (sequence) {
          this.emit('path:save', { sequence, name });
          pathInput.value = '';
          if (pathNameInput) pathNameInput.value = '';
        }
      });
    }

    if (highlightPathBtn && pathInput) {
      highlightPathBtn.addEventListener('click', () => {
        const sequence = pathInput.value.trim();
        if (sequence) {
          this.emit('path:highlight', { sequence });
        }
      });
    }

    // Path navigation
    this.setupButton('prevPath', 'path:prev');
    this.setupButton('nextPath', 'path:next');
    this.setupButton('clearAllPaths', 'path:clearAll');
  }

  setupButton(id, eventName) {
    const button = document.getElementById(id);
    if (button) {
      button.addEventListener('click', () => this.emit(eventName));
    }
  }

  setRenderer(format) {
    if (format === 'gfa') {
      this.renderer = new GfaRenderer(this.canvasManager.canvas);
    } else {
      this.renderer = new DotRenderer(this.canvasManager.canvas);
    }
  }

  render() {
    if (!this.model.graph || !this.renderer) return;

    // Get highlighted path
    const currentPath = this.model.paths.getCurrentPath();
    const highlightedPath = currentPath ? {
      nodes: currentPath.nodes,
      edges: currentPath.edges,
      currentColor: currentPath.color
    } : null;

    this.renderer.draw(
      this.model.graph,
      this.model.transform,
      this.model.selection.nodes,
      this.model.pinnedNodes,
      highlightedPath
    );
  }

  findNodeAt(x, y) {
    if (!this.model.graph) return null;

    for (const [nodeId, node] of this.model.graph.nodes) {
      if (node.contains(x, y)) {
        return node;
      }
    }
    return null;
  }

  setDraggingNode(nodeId) {
    this.canvasManager.setDraggingNode(nodeId);
  }

  updateInfoPanel(content) {
    const infoContent = document.getElementById('infoContent');
    if (infoContent) {
      infoContent.innerHTML = content;
    }
  }

  logEvent(message) {
    const debugPanel = document.getElementById('debug');
    if (debugPanel) {
      debugPanel.textContent += message + '\n';
    }
  }
}