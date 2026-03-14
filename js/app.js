// app.js — Main application: ties model, renderer, editor, simulator, analyzer together

import { PetriNet } from './model.js';
import { Renderer } from './renderer.js';
import { Editor } from './editor.js';
import { Simulator } from './simulator.js';
import { Analyzer } from './analyzer.js';
import { examples } from './examples.js';

class App {
  constructor() {
    this.net = new PetriNet();
    this.svg = document.getElementById('canvas');
    this.renderer = new Renderer(this.svg, this.net);
    this.editor = new Editor(this.svg, this.net, this.renderer, (event, data) => this.onEditorChange(event, data));
    this.simulator = new Simulator(this.net);
    this.analyzer = new Analyzer(this.net);

    this._setupToolbar();
    this._setupSimControls();
    this._setupPropertiesPanel();
    this._setupFileControls();
    this._setupExamples();
    this._setupAnalyzeButton();
    this._setupKeyboardShortcuts();
    this._setupClickToFire();
    this._setupPanZoom();

    // Load default example
    const defaultExample = 'German Traffic Light';
    document.getElementById('example-select').value = defaultExample;
    this.loadExample(defaultExample);
  }

  // ===================== TOOLBAR =====================

  _setupToolbar() {
    const buttons = document.querySelectorAll('#toolbar .tool-btn');
    buttons.forEach(btn => {
      btn.addEventListener('click', () => {
        buttons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.editor.setMode(btn.dataset.mode);
      });
    });
  }

  // ===================== SIMULATION CONTROLS =====================

  _setupSimControls() {
    document.getElementById('btn-play').addEventListener('click', () => this.playSteps());
    document.getElementById('btn-reset').addEventListener('click', () => this.resetSimulation());
  }

  playSteps() {
    const n = parseInt(document.getElementById('step-count').value, 10) || 1;
    const startStep = this.simulator.stepCount;
    const fired = this.simulator.playSteps(n);
    for (let i = 0; i < fired.length; i++) {
      const t = this.net.transitions.get(fired[i]);
      this.log(`Step ${startStep + i + 1}: Fired ${t ? t.label : fired[i]}`);
    }
    if (fired.length < n) {
      this.log('DEADLOCK: No more transitions can fire.');
    }
    if (fired.length > 0) {
      this.log(`Completed ${fired.length}/${n} steps.`);
    }
    this.refresh();
  }

  resetSimulation() {
    this.simulator.reset();
    this.log('Simulation reset to initial marking.');
    this.refresh();
  }

  // ===================== PROPERTIES PANEL =====================

  _setupPropertiesPanel() {
    this.propsPanel = document.getElementById('properties-content');

    // Wire up property change events
    this.propsPanel.addEventListener('input', (e) => {
      const el = e.target;
      if (!this.editor.selectedId) return;

      if (el.dataset.prop === 'label') {
        const elem = this.net.places.get(this.editor.selectedId)
          || this.net.transitions.get(this.editor.selectedId);
        if (elem) {
          elem.label = el.value;
          this.refresh();
        }
      } else if (el.dataset.prop === 'tokens') {
        const place = this.net.places.get(this.editor.selectedId);
        if (place) {
          place.tokens = Math.max(0, parseInt(el.value, 10) || 0);
          this.net.saveInitialMarking();
          this.refresh();
        }
      } else if (el.dataset.prop === 'weight') {
        const arc = this.net.arcs.get(this.editor.selectedId);
        if (arc) {
          arc.weight = Math.max(1, parseInt(el.value, 10) || 1);
          this.refresh();
        }
      }
    });

    this.propsPanel.addEventListener('change', (e) => {
      const el = e.target;
      if (!this.editor.selectedId) return;

      if (el.dataset.prop === 'direction') {
        const arc = this.net.arcs.get(this.editor.selectedId);
        if (arc) {
          arc.direction = el.value;
          this.refresh();
        }
      }
    });
  }

  _renderProperties(id, type) {
    if (!id || !type) {
      this.propsPanel.innerHTML = '<p class="hint">Select an element to view its properties.</p>';
      return;
    }

    let html = '';
    if (type === 'place') {
      const p = this.net.places.get(id);
      if (!p) return;
      html = `
        <h4>Place</h4>
        <div class="prop-row">
          <label>Label</label>
          <input type="text" data-prop="label" value="${this._escAttr(p.label)}" />
        </div>
        <div class="prop-row">
          <label>Tokens</label>
          <input type="number" data-prop="tokens" value="${p.tokens}" min="0" />
        </div>
        <div class="prop-row hint">ID: ${p.id}</div>
      `;
    } else if (type === 'transition') {
      const t = this.net.transitions.get(id);
      if (!t) return;
      html = `
        <h4>Transition</h4>
        <div class="prop-row">
          <label>Label</label>
          <input type="text" data-prop="label" value="${this._escAttr(t.label)}" />
        </div>
        <div class="prop-row hint">ID: ${t.id}</div>
        <div class="prop-row hint">${this.simulator.isEnabled(id) ? '<span class="badge enabled">Enabled</span>' : '<span class="badge disabled">Disabled</span>'}</div>
      `;
    } else if (type === 'arc') {
      const a = this.net.arcs.get(id);
      if (!a) return;
      const pLabel = this.net.places.get(a.placeId)?.label || a.placeId;
      const tLabel = this.net.transitions.get(a.transitionId)?.label || a.transitionId;
      html = `
        <h4>Arc</h4>
        <div class="prop-row">
          <label>Weight</label>
          <input type="number" data-prop="weight" value="${a.weight}" min="1" />
        </div>
        <div class="prop-row">
          <label>Direction</label>
          <select data-prop="direction">
            <option value="place_to_transition" ${a.direction === 'place_to_transition' ? 'selected' : ''}>Place → Transition</option>
            <option value="transition_to_place" ${a.direction === 'transition_to_place' ? 'selected' : ''}>Transition → Place</option>
            <option value="bidirectional" ${a.direction === 'bidirectional' ? 'selected' : ''}>Bidirectional (R/W)</option>
          </select>
        </div>
        <div class="prop-row hint">Place: ${pLabel}</div>
        <div class="prop-row hint">Transition: ${tLabel}</div>
      `;
    }

    this.propsPanel.innerHTML = html;
  }

  _escAttr(s) {
    return s.replace(/"/g, '&quot;').replace(/</g, '&lt;');
  }

  // ===================== FILE CONTROLS =====================

  _setupFileControls() {
    document.getElementById('btn-export').addEventListener('click', () => this.exportJSON());
    document.getElementById('btn-import').addEventListener('click', () => this.importJSON());
    document.getElementById('btn-clear').addEventListener('click', () => this.clearNet());
  }

  exportJSON() {
    const data = this.net.toJSON();
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'petri-net.json';
    a.click();
    URL.revokeObjectURL(url);
    this.log('Exported Petri Net to JSON file.');
  }

  importJSON() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const data = JSON.parse(ev.target.result);
          this.net = PetriNet.fromJSON(data);
          this._reconnect();
          this.log(`Imported Petri Net: ${this.net.places.size} places, ${this.net.transitions.size} transitions, ${this.net.arcs.size} arcs.`);
          this.refresh();
        } catch (err) {
          this.log('Error importing: ' + err.message);
        }
      };
      reader.readAsText(file);
    };
    input.click();
  }

  clearNet() {
    this.net.clear();
    this.simulator.reset();
    this.editor.select(null, null);
    this.log('Canvas cleared.');
    this.refresh();
  }

  // ===================== EXAMPLES =====================

  _setupExamples() {
    const select = document.getElementById('example-select');
    for (const name of Object.keys(examples)) {
      const opt = document.createElement('option');
      opt.value = name;
      opt.textContent = name;
      select.appendChild(opt);
    }
    document.getElementById('btn-load-example').addEventListener('click', () => {
      const name = select.value;
      if (name) this.loadExample(name);
    });
  }

  loadExample(name) {
    const data = examples[name];
    if (!data) return;
    this.net = PetriNet.fromJSON(data);
    this._reconnect();
    this.log(`Loaded example: ${name}`);
    this.refresh();
  }

  /** After replacing the net, reconnect all components */
  _reconnect() {
    this.renderer.net = this.net;
    this.editor.net = this.net;
    this.simulator = new Simulator(this.net);
    this.analyzer = new Analyzer(this.net);
    this.editor.select(null, null);
  }

  // ===================== ANALYSIS =====================

  _setupAnalyzeButton() {
    document.getElementById('btn-analyze').addEventListener('click', () => this.runAnalysis());
  }

  runAnalysis() {
    if (this.net.places.size === 0) {
      this.log('Nothing to analyze. Add some elements first.');
      return;
    }

    // Save and use initial marking for analysis
    const currentMarking = this.net.getMarking();
    if (this.net._initialMarking) {
      this.net.setMarking(this.net._initialMarking);
    }

    const result = this.analyzer.analyze();

    // Restore current marking
    this.net.setMarking(currentMarking);

    const modal = document.getElementById('analysis-modal');
    const body = document.getElementById('analysis-body');

    let html = '<table class="analysis-table">';

    // Reachable states
    html += `<tr><td>Reachable States</td><td>${result.reachableStates}${result.hitLimit ? ' (limit reached, may be more)' : ''}</td></tr>`;

    // Boundedness
    html += `<tr><td>Bounded</td><td>${result.bounded ? `<span class="badge enabled">Yes</span> (${result.kBound}-bounded)` : '<span class="badge disabled">No / Unknown</span>'}</td></tr>`;

    // Place bounds
    html += '<tr><td>Place Bounds</td><td>';
    for (const [pid, info] of Object.entries(result.placeBounds)) {
      html += `${info.label}: max ${info.bound}<br>`;
    }
    html += '</td></tr>';

    // Deadlock
    html += `<tr><td>Deadlock-Free</td><td>${!result.deadlock ? '<span class="badge enabled">Yes</span>' : `<span class="badge disabled">No</span> (${result.deadlockMarkings.length} deadlock state(s))`}</td></tr>`;

    // Liveness
    html += `<tr><td>Live (L1)</td><td>${result.live ? '<span class="badge enabled">Yes</span>' : '<span class="badge disabled">No</span>'}</td></tr>`;
    if (!result.live) {
      html += '<tr><td>Dead Transitions</td><td>';
      for (const t of result.nonLiveTransitions) {
        html += `${t.label} (${t.id})<br>`;
      }
      html += '</td></tr>';
    }

    // Marking vector
    const mv = [];
    for (const [id, place] of this.net.places) {
      mv.push(`${place.label}: ${place.tokens}`);
    }
    html += `<tr><td>Current Marking</td><td>${mv.join(', ')}</td></tr>`;

    html += '</table>';
    body.innerHTML = html;
    modal.classList.add('visible');

    // Close button
    document.getElementById('analysis-close').onclick = () => modal.classList.remove('visible');
    modal.onclick = (e) => { if (e.target === modal) modal.classList.remove('visible'); };
  }

  // ===================== KEYBOARD SHORTCUTS =====================

  _setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      // Don't fire shortcuts when typing in inputs
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') return;

      const key = e.key.toLowerCase();
      const buttons = document.querySelectorAll('#toolbar .tool-btn');

      switch (key) {
        case 'v': this._activateMode('select', buttons); break;
        case 'p': this._activateMode('place', buttons); break;
        case 't': this._activateMode('transition', buttons); break;
        case 'a': this._activateMode('arc', buttons); break;
        case 'd': this._activateMode('delete', buttons); break;
        case ' ':
          e.preventDefault();
          this.playSteps();
          break;
        case 'r':
          this.resetSimulation();
          break;
        case 'delete':
        case 'backspace':
          if (this.editor.selectedId) {
            this.net.removeElement(this.editor.selectedId);
            this.editor.select(null, null);
            this.net.saveInitialMarking();
            this.refresh();
          }
          break;
        case '0':
          this.renderer.resetView();
          this.refresh();
          break;
        case 'escape':
          this.editor.setMode('select');
          this.editor.select(null, null);
          this._activateMode('select', buttons);
          break;
      }
    });
  }

  _activateMode(mode, buttons) {
    buttons.forEach(b => b.classList.toggle('active', b.dataset.mode === mode));
    this.editor.setMode(mode);
  }

  // ===================== PAN & ZOOM =====================

  _setupPanZoom() {
    // Zoom with scroll wheel
    this.svg.addEventListener('wheel', (e) => {
      e.preventDefault();
      const rect = this.svg.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      this.renderer.zoomAt(sx, sy, e.deltaY);
      this.refresh();
    }, { passive: false });

    // Pan with middle-mouse drag or right-mouse drag
    let panning = false;
    let panStartX = 0, panStartY = 0;

    this.svg.addEventListener('mousedown', (e) => {
      // Middle button (1) or right button (2)
      if (e.button === 1 || e.button === 2) {
        e.preventDefault();
        panning = true;
        panStartX = e.clientX;
        panStartY = e.clientY;
      }
    });

    window.addEventListener('mousemove', (e) => {
      if (!panning) return;
      const dx = e.clientX - panStartX;
      const dy = e.clientY - panStartY;
      panStartX = e.clientX;
      panStartY = e.clientY;
      this.renderer.pan(dx, dy);
      this.refresh();
    });

    window.addEventListener('mouseup', (e) => {
      if (e.button === 1 || e.button === 2) {
        panning = false;
      }
    });

    // Disable context menu on canvas so right-click drag works
    this.svg.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  // ===================== CLICK-TO-FIRE =====================

  _setupClickToFire() {
    // Handled via onEditorChange 'dblclick' event
  }

  // ===================== SHARED =====================

  onEditorChange(event, data) {
    if (event === 'select') {
      this._renderProperties(data.id, data.type);
    }
    if (event === 'add' || event === 'delete') {
      this.net.saveInitialMarking();
      this.simulator.reset();
    }
    if (event === 'dblclick') {
      // Double-click on enabled transition -> fire it
      if (data.type === 'transition' && this.simulator.isEnabled(data.id)) {
        const t = this.net.transitions.get(data.id);
        this.simulator.fire(data.id);
        this.log(`Step ${this.simulator.stepCount}: Fired ${t ? t.label : data.id} (manual)`);
      } else {
        // Focus the label input in properties
        setTimeout(() => {
          const input = this.propsPanel.querySelector('input[data-prop="label"]');
          if (input) input.focus();
        }, 50);
      }
    }
    this.refresh();
  }

  refresh() {
    const enabled = this.simulator.getEnabledTransitions();
    this.renderer.setEnabledTransitions(enabled);
    this.renderer.render();
    this._updateMarkingDisplay();
  }

  _updateMarkingDisplay() {
    const el = document.getElementById('marking-display');
    const parts = [];
    for (const [id, place] of this.net.places) {
      parts.push(`${place.label}: <strong>${place.tokens}</strong>`);
    }
    const zoomPct = Math.round(this.renderer.zoom * 100);
    const marking = parts.length > 0 ? `M = [ ${parts.join(' , ')} ]` : 'Empty net';
    el.innerHTML = `<span class="zoom-indicator">${zoomPct}%</span> ${marking}`;
  }

  log(message) {
    const logEl = document.getElementById('log');
    const entry = document.createElement('div');
    entry.className = 'log-entry';
    entry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
    logEl.appendChild(entry);
    logEl.scrollTop = logEl.scrollHeight;
  }
}

// Boot
window.addEventListener('DOMContentLoaded', () => {
  window.app = new App();
});
