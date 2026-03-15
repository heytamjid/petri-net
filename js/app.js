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
    document.getElementById('btn-back').addEventListener('click', () => this.playBack());
    document.getElementById('btn-reset').addEventListener('click', () => this.resetSimulation());

    // Firing mode tooltip
    const modeSelect = document.getElementById('firing-mode');
    const descriptions = {
      interleaving: 'One transition fires per step. Highest priority wins; random among equal priority.',
      maximal: 'All independently enabled transitions fire together in one step. Priority determines token reservation order.',
    };
    modeSelect.title = descriptions[modeSelect.value];
    modeSelect.addEventListener('change', () => {
      modeSelect.title = descriptions[modeSelect.value];
      this.log(`Firing mode: ${modeSelect.value === 'maximal' ? 'Maximal Concurrency' : 'Interleaving'}`);
    });
  }

  _isConcurrentMode() {
    return document.getElementById('firing-mode').value === 'maximal';
  }

  /** Play forward N steps with animation */
  async playSteps() {
    if (this._animating) return;
    const n = parseInt(document.getElementById('step-count').value, 10) || 1;
    this._animating = true;
    this._setSimButtonsDisabled(true);

    let firedCount = 0;

    if (this._isConcurrentMode()) {
      // Maximal concurrency: fire all independent transitions per step
      for (let i = 0; i < n; i++) {
        const set = this.simulator.getMaximalConcurrentSet();
        if (set.length === 0) {
          this.log('DEADLOCK: No more transitions can fire.');
          break;
        }

        // Animate all transitions in the set simultaneously
        await Promise.all(set.map(tid => this._animateFiring(tid)));
        this.simulator.fireConcurrent();
        firedCount++;
        const labels = set.map(tid => this.net.transitions.get(tid)?.label || tid);
        this.log(`Step ${this.simulator.stepCount}: Fired [${labels.join(' + ')}]`);
        this.refresh();

        if (i < n - 1) await new Promise(r => setTimeout(r, 400));
      }
    } else {
      // Interleaving: one transition per step (highest priority, random among ties)
      for (let i = 0; i < n; i++) {
        const enabled = this.simulator.getEnabledTransitions();
        if (enabled.length === 0) {
          this.log('DEADLOCK: No more transitions can fire.');
          break;
        }
        const tid = this.simulator._pickByPriority(enabled);
        const t = this.net.transitions.get(tid);

        await this._animateFiring(tid);
        this.simulator.fire(tid);
        firedCount++;
        this.log(`Step ${this.simulator.stepCount}: Fired ${t ? t.label : tid}`);
        this.refresh();

        if (i < n - 1) await new Promise(r => setTimeout(r, 400));
      }
    }

    if (firedCount > 1) {
      this.log(`Completed ${firedCount}/${n} steps.`);
    }
    this._animating = false;
    this._setSimButtonsDisabled(false);
  }

  /** Play backward N steps with animation */
  async playBack() {
    if (this._animating) return;
    const n = parseInt(document.getElementById('step-count').value, 10) || 1;

    if (!this.simulator.canStepBack()) {
      this.log('Nothing to undo.');
      return;
    }

    this._animating = true;
    this._setSimButtonsDisabled(true);

    let undoneCount = 0;
    for (let i = 0; i < n; i++) {
      if (!this.simulator.canStepBack()) break;

      const entry = this.simulator.history[this.simulator.history.length - 1];
      await this._animateFiring(entry.transitionId, true);
      this.simulator.stepBack();
      undoneCount++;
      this.log(`Undo step ${this.simulator.stepCount + 1}: Reverted ${entry.label}`);
      this.refresh();

      if (i < n - 1) await new Promise(r => setTimeout(r, 400));
    }

    if (undoneCount > 1) {
      this.log(`Reverted ${undoneCount}/${n} steps.`);
    }
    this._animating = false;
    this._setSimButtonsDisabled(false);
  }

  _setSimButtonsDisabled(disabled) {
    for (const id of ['btn-play', 'btn-back', 'btn-reset']) {
      document.getElementById(id).disabled = disabled;
    }
  }

  resetSimulation() {
    if (this._animating) return;
    this.simulator.reset();
    this.log('Simulation reset to initial marking.');
    this.refresh();
  }

  // ===================== FIRING ANIMATION =====================

  /**
   * Animate a transition firing.
   * Forward: tokens travel from input places -> transition -> output places.
   * Backward (reverse=true): tokens travel from output places -> transition -> input places.
   * Returns a promise that resolves when animation completes.
   */
  _animateFiring(transitionId, reverse = false) {
    const DURATION = 350; // ms per phase
    const t = this.net.transitions.get(transitionId);
    if (!t) return Promise.resolve();

    const inputArcs = this.net.getInputArcs(transitionId);
    const outputArcs = this.net.getOutputArcs(transitionId);

    // In reverse, inputs and outputs swap visually
    const consumeArcs = reverse ? outputArcs : inputArcs;
    const produceArcs = reverse ? inputArcs : outputArcs;

    return new Promise((resolve) => {
      // Phase 1: tokens travel from consume-places to transition
      const dots1 = this._createAnimDots(consumeArcs, t, true, reverse);
      this._animateDots(dots1, DURATION, () => {
        // Flash the transition
        this._flashTransition(transitionId, DURATION * 0.4, () => {
          // Phase 2: tokens travel from transition to produce-places
          const dots2 = this._createAnimDots(produceArcs, t, false, reverse);
          this._animateDots(dots2, DURATION, () => {
            resolve();
          });
        });
      });
    });
  }

  /**
   * Create animated dot elements for token travel.
   * @param {Array} arcs - arcs to animate along
   * @param {Object} transition - the transition node
   * @param {boolean} towardTransition - true if dots move toward transition, false if away
   * @param {boolean} reverse - whether this is a reverse animation
   */
  _createAnimDots(arcs, transition, towardTransition, reverse) {
    const SVG_NS = 'http://www.w3.org/2000/svg';
    const dots = [];

    for (const arc of arcs) {
      const place = this.net.places.get(arc.placeId);
      if (!place) continue;

      const fromX = towardTransition ? place.x : transition.x;
      const fromY = towardTransition ? place.y : transition.y;
      const toX = towardTransition ? transition.x : place.x;
      const toY = towardTransition ? transition.y : place.y;

      for (let w = 0; w < arc.weight; w++) {
        const dot = document.createElementNS(SVG_NS, 'circle');
        dot.setAttribute('cx', fromX);
        dot.setAttribute('cy', fromY);
        dot.setAttribute('r', 5);
        dot.setAttribute('class', reverse ? 'anim-token reverse' : 'anim-token');
        this.renderer.overlayLayer.appendChild(dot);
        dots.push({ el: dot, fromX, fromY, toX, toY });
      }
    }
    return dots;
  }

  _animateDots(dots, duration, onComplete) {
    if (dots.length === 0) {
      onComplete();
      return;
    }

    const start = performance.now();
    const step = (now) => {
      const progress = Math.min(1, (now - start) / duration);
      // Ease in-out
      const ease = progress < 0.5
        ? 2 * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 2) / 2;

      for (const dot of dots) {
        const x = dot.fromX + (dot.toX - dot.fromX) * ease;
        const y = dot.fromY + (dot.toY - dot.fromY) * ease;
        dot.el.setAttribute('cx', x);
        dot.el.setAttribute('cy', y);
        // Scale: grow in the middle of travel
        const scale = 1 + 0.5 * Math.sin(progress * Math.PI);
        dot.el.setAttribute('r', 5 * scale);
      }

      if (progress < 1) {
        requestAnimationFrame(step);
      } else {
        // Remove dots
        for (const dot of dots) {
          dot.el.remove();
        }
        onComplete();
      }
    };
    requestAnimationFrame(step);
  }

  _flashTransition(transitionId, duration, onComplete) {
    const t = this.net.transitions.get(transitionId);
    if (!t) { onComplete(); return; }

    const SVG_NS = 'http://www.w3.org/2000/svg';
    const flash = document.createElementNS(SVG_NS, 'rect');
    const hw = 16 / 2; // TRANSITION_WIDTH / 2
    const hh = 50 / 2; // TRANSITION_HEIGHT / 2
    flash.setAttribute('x', t.x - hw - 4);
    flash.setAttribute('y', t.y - hh - 4);
    flash.setAttribute('width', hw * 2 + 8);
    flash.setAttribute('height', hh * 2 + 8);
    flash.setAttribute('rx', 4);
    flash.setAttribute('class', 'anim-flash');
    this.renderer.overlayLayer.appendChild(flash);

    const start = performance.now();
    const step = (now) => {
      const progress = Math.min(1, (now - start) / duration);
      const opacity = 1 - progress;
      flash.setAttribute('opacity', opacity);
      if (progress < 1) {
        requestAnimationFrame(step);
      } else {
        flash.remove();
        onComplete();
      }
    };
    requestAnimationFrame(step);
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
      } else if (el.dataset.prop === 'priority') {
        const t = this.net.transitions.get(this.editor.selectedId);
        if (t) {
          t.priority = Math.max(1, parseInt(el.value, 10) || 1);
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
        <div class="prop-row">
          <label>Priority</label>
          <input type="number" data-prop="priority" value="${t.priority}" min="1" />
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
          if (!this._animating) this.playSteps();
          break;
        case 'b':
          if (!this._animating) this.playBack();
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
      this._renderProperties(data.id, data.type);
      // Small delay so refresh() completes and DOM settles
      setTimeout(() => {
        const input = this.propsPanel.querySelector('input[data-prop="label"]');
        if (input) { input.focus(); input.select(); }
      }, 50);
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
