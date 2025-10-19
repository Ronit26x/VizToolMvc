import { GraphModel } from './core/GraphModel.js';
import { GraphView } from './core/GraphView.js';
import { GraphController } from './core/GraphController.js';

// Initialize the application
function initApp() {
  console.log('🚀 Initializing Graph Visualization Tool (Refactored Architecture)');

  // Get canvas element
  const canvas = document.getElementById('canvas');
  if (!canvas) {
    console.error('Canvas element not found');
    return;
  }

  // Create MVC components
  const model = new GraphModel();
  const view = new GraphView(canvas, model);
  const controller = new GraphController(model, view);

  // Make available globally for debugging
  window.graphApp = {
    model,
    view,
    controller,
    version: '2.0.0-refactored'
  };

  console.log('✅ Application initialized successfully');
  console.log('📊 Architecture: Model-View-Controller');
  console.log('🎨 Renderers: DOT and GFA');
  console.log('🔧 Access via window.graphApp');

  // Log initial state
  logDebug('Application ready. Load a graph file to begin.');
}

function logDebug(message) {
  const debugPanel = document.getElementById('debug');
  if (debugPanel) {
    debugPanel.textContent += message + '\n';
  }
  console.log(message);
  
}

// Wait for DOM and D3 to be ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}