// editor.js — Editor tools and canvas interactions

import { PLACE_RADIUS, TRANSITION_WIDTH, TRANSITION_HEIGHT } from './renderer.js';

export class Editor {
  /**
   * @param {SVGElement} svg
   * @param {import('./model.js').PetriNet} petriNet
   * @param {import('./renderer.js').Renderer} renderer
   * @param {Function} onChangeCallback
   */
  constructor(svg, petriNet, renderer, onChangeCallback) {
    this.svg = svg;
    this.net = petriNet;
    this.renderer = renderer;
    this.onChange = onChangeCallback;

    this.mode = 'select'; // 'select' | 'place' | 'transition' | 'arc' | 'delete'
    this.selectedId = null;
    this.selectedType = null;

    // Drag state
    this._dragging = false;
    this._dragId = null;
    this._dragOffsetX = 0;
    this._dragOffsetY = 0;

    // Arc drawing state
    this._arcSource = null; // { id, type }
    this._arcSourcePos = null;

    this._bindEvents();
  }

  setMode(mode) {
    this.mode = mode;
    this._arcSource = null;
    this.renderer.clearOverlay();
    this.svg.style.cursor = mode === 'select' ? 'default' :
      mode === 'delete' ? 'crosshair' : 'crosshair';
    // Deselect when switching modes (except select)
    if (mode !== 'select') {
      this.select(null, null);
    }
  }

  select(id, type) {
    this.selectedId = id;
    this.selectedType = type;
    this.renderer.setSelected(id);
    this.onChange('select', { id, type });
  }

  _bindEvents() {
    this.svg.addEventListener('mousedown', (e) => this._onMouseDown(e));
    this.svg.addEventListener('mousemove', (e) => this._onMouseMove(e));
    this.svg.addEventListener('mouseup', (e) => this._onMouseUp(e));
    this.svg.addEventListener('dblclick', (e) => this._onDblClick(e));
  }

  _getSVGPoint(e) {
    const rect = this.svg.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  }

  _onMouseDown(e) {
    const pt = this._getSVGPoint(e);
    const hit = this.renderer.hitTest(pt.x, pt.y);

    switch (this.mode) {
      case 'select':
        if (hit) {
          this.select(hit.id, hit.type);
          if (hit.type === 'place' || hit.type === 'transition') {
            this._dragging = true;
            this._dragId = hit.id;
            const elem = hit.type === 'place' ? this.net.places.get(hit.id) : this.net.transitions.get(hit.id);
            this._dragOffsetX = pt.x - elem.x;
            this._dragOffsetY = pt.y - elem.y;
          }
        } else {
          this.select(null, null);
        }
        break;

      case 'place':
        if (!hit) {
          const place = this.net.addPlace(pt.x, pt.y, '', 0);
          this.select(place.id, 'place');
          this.onChange('add', { type: 'place', id: place.id });
        }
        break;

      case 'transition':
        if (!hit) {
          const t = this.net.addTransition(pt.x, pt.y, '');
          this.select(t.id, 'transition');
          this.onChange('add', { type: 'transition', id: t.id });
        }
        break;

      case 'arc':
        if (hit && (hit.type === 'place' || hit.type === 'transition')) {
          if (!this._arcSource) {
            // First click: set source
            this._arcSource = hit;
            const elem = hit.type === 'place' ? this.net.places.get(hit.id) : this.net.transitions.get(hit.id);
            this._arcSourcePos = { x: elem.x, y: elem.y };
          } else {
            // Second click: create arc
            this._createArc(this._arcSource, hit);
            this._arcSource = null;
            this._arcSourcePos = null;
            this.renderer.clearOverlay();
          }
        }
        break;

      case 'delete':
        if (hit) {
          this.net.removeElement(hit.id);
          if (this.selectedId === hit.id) {
            this.select(null, null);
          }
          this.onChange('delete', { id: hit.id });
        }
        break;
    }
  }

  _onMouseMove(e) {
    const pt = this._getSVGPoint(e);

    if (this._dragging && this._dragId) {
      const elem = this.net.places.get(this._dragId) || this.net.transitions.get(this._dragId);
      if (elem) {
        elem.x = pt.x - this._dragOffsetX;
        elem.y = pt.y - this._dragOffsetY;
        this.onChange('move', { id: this._dragId });
      }
    }

    if (this.mode === 'arc' && this._arcSource) {
      this.renderer.renderTempArc(this._arcSourcePos.x, this._arcSourcePos.y, pt.x, pt.y);
    }
  }

  _onMouseUp(e) {
    this._dragging = false;
    this._dragId = null;
  }

  _onDblClick(e) {
    // Double-click on a place/transition to quick-edit label
    const pt = this._getSVGPoint(e);
    const hit = this.renderer.hitTest(pt.x, pt.y);
    if (hit && (hit.type === 'place' || hit.type === 'transition')) {
      this.select(hit.id, hit.type);
      this.onChange('dblclick', { id: hit.id, type: hit.type });
    }
  }

  _createArc(source, target) {
    // Arcs must connect a place and a transition (not same type)
    if (source.type === target.type) return;

    let placeId, transitionId, direction;

    if (source.type === 'place') {
      placeId = source.id;
      transitionId = target.id;
      direction = 'place_to_transition';
    } else {
      placeId = target.id;
      transitionId = source.id;
      direction = 'transition_to_place';
    }

    const arc = this.net.addArc(placeId, transitionId, direction, 1);
    if (arc) {
      this.select(arc.id, 'arc');
      this.onChange('add', { type: 'arc', id: arc.id });
    }
  }
}
