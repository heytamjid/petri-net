// renderer.js — SVG rendering engine for the Petri Net

const SVG_NS = 'http://www.w3.org/2000/svg';
const PLACE_RADIUS = 28;
const TRANSITION_WIDTH = 16;
const TRANSITION_HEIGHT = 50;
const TOKEN_RADIUS = 4;
const ARROWHEAD_SIZE = 10;

export { PLACE_RADIUS, TRANSITION_WIDTH, TRANSITION_HEIGHT };

export class Renderer {
  constructor(svgElement, petriNet) {
    this.svg = svgElement;
    this.net = petriNet;
    this.enabledTransitions = new Set();
    this.selectedId = null;
    this.arcSourceId = null; // for arc-drawing preview

    // Pan & zoom state
    this.panX = 0;
    this.panY = 0;
    this.zoom = 1;
    this.MIN_ZOOM = 0.15;
    this.MAX_ZOOM = 4;

    // Root transform group (wraps all visual layers)
    this.world = this._createGroup('world');
    this.svg.appendChild(this.world);

    // Create layers inside the world group
    this.arcLayer = this._createGroup('arc-layer');
    this.nodeLayer = this._createGroup('node-layer');
    this.overlayLayer = this._createGroup('overlay-layer');
    this.world.appendChild(this.arcLayer);
    this.world.appendChild(this.nodeLayer);
    this.world.appendChild(this.overlayLayer);

    // Defs for arrowheads (outside world, defs are global)
    this._createDefs();
  }

  _createGroup(className) {
    const g = document.createElementNS(SVG_NS, 'g');
    g.setAttribute('class', className);
    return g;
  }

  _createDefs() {
    const defs = document.createElementNS(SVG_NS, 'defs');

    // Normal arrowhead
    const marker = this._createArrowMarker('arrowhead', '#667085');
    defs.appendChild(marker);

    // Enabled arrowhead
    const markerEnabled = this._createArrowMarker('arrowhead-enabled', '#16a34a');
    defs.appendChild(markerEnabled);

    // Selected arrowhead
    const markerSelected = this._createArrowMarker('arrowhead-selected', '#6366f1');
    defs.appendChild(markerSelected);

    this.svg.appendChild(defs);
  }

  _createArrowMarker(id, color) {
    const marker = document.createElementNS(SVG_NS, 'marker');
    marker.setAttribute('id', id);
    marker.setAttribute('viewBox', '0 0 10 10');
    marker.setAttribute('refX', '10');
    marker.setAttribute('refY', '5');
    marker.setAttribute('markerWidth', ARROWHEAD_SIZE);
    marker.setAttribute('markerHeight', ARROWHEAD_SIZE);
    marker.setAttribute('orient', 'auto-start-reverse');
    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('d', 'M 0 0 L 10 5 L 0 10 z');
    path.setAttribute('fill', color);
    marker.appendChild(path);
    return marker;
  }

  setEnabledTransitions(enabledIds) {
    this.enabledTransitions = new Set(enabledIds);
  }

  setSelected(id) {
    this.selectedId = id;
  }

  // ---- Pan & Zoom ----

  /** Convert screen (SVG element) coordinates to world coordinates */
  screenToWorld(sx, sy) {
    return {
      x: (sx - this.panX) / this.zoom,
      y: (sy - this.panY) / this.zoom,
    };
  }

  /** Apply pan delta in screen pixels */
  pan(dx, dy) {
    this.panX += dx;
    this.panY += dy;
    this._updateTransform();
  }

  /** Zoom toward a screen point */
  zoomAt(screenX, screenY, delta) {
    const oldZoom = this.zoom;
    const factor = delta > 0 ? 0.9 : 1.1;
    this.zoom = Math.min(this.MAX_ZOOM, Math.max(this.MIN_ZOOM, this.zoom * factor));

    // Keep the point under the cursor fixed
    this.panX = screenX - (screenX - this.panX) * (this.zoom / oldZoom);
    this.panY = screenY - (screenY - this.panY) * (this.zoom / oldZoom);
    this._updateTransform();
  }

  resetView() {
    this.panX = 0;
    this.panY = 0;
    this.zoom = 1;
    this._updateTransform();
  }

  _updateTransform() {
    this.world.setAttribute('transform', `translate(${this.panX},${this.panY}) scale(${this.zoom})`);
  }

  /** Full re-render */
  render() {
    this.arcLayer.innerHTML = '';
    this.nodeLayer.innerHTML = '';
    this.overlayLayer.innerHTML = '';
    this._updateTransform();

    // Draw arcs first (behind nodes)
    for (const arc of this.net.arcs.values()) {
      this._renderArc(arc);
    }

    // Draw places
    for (const place of this.net.places.values()) {
      this._renderPlace(place);
    }

    // Draw transitions
    for (const t of this.net.transitions.values()) {
      this._renderTransition(t);
    }
  }

  _renderPlace(place) {
    const g = document.createElementNS(SVG_NS, 'g');
    g.setAttribute('class', 'place-group');
    g.setAttribute('data-id', place.id);

    const isSelected = place.id === this.selectedId;

    // Outer circle
    const circle = document.createElementNS(SVG_NS, 'circle');
    circle.setAttribute('cx', place.x);
    circle.setAttribute('cy', place.y);
    circle.setAttribute('r', PLACE_RADIUS);
    circle.setAttribute('class', `place ${isSelected ? 'selected' : ''}`);
    g.appendChild(circle);

    // Tokens
    this._renderTokens(g, place);

    // Label
    const label = document.createElementNS(SVG_NS, 'text');
    label.setAttribute('x', place.x);
    label.setAttribute('y', place.y + PLACE_RADIUS + 18);
    label.setAttribute('class', 'label');
    label.textContent = place.label;
    g.appendChild(label);

    this.nodeLayer.appendChild(g);
  }

  _renderTokens(g, place) {
    const n = place.tokens;
    if (n === 0) return;

    if (n <= 5) {
      // Draw individual token dots
      const positions = this._tokenPositions(n);
      for (const [dx, dy] of positions) {
        const dot = document.createElementNS(SVG_NS, 'circle');
        dot.setAttribute('cx', place.x + dx);
        dot.setAttribute('cy', place.y + dy);
        dot.setAttribute('r', TOKEN_RADIUS);
        dot.setAttribute('class', 'token');
        g.appendChild(dot);
      }
    } else {
      // Draw number
      const text = document.createElementNS(SVG_NS, 'text');
      text.setAttribute('x', place.x);
      text.setAttribute('y', place.y);
      text.setAttribute('class', 'token-count');
      text.textContent = n;
      g.appendChild(text);
    }
  }

  _tokenPositions(n) {
    const s = 8; // spacing
    switch (n) {
      case 1: return [[0, 0]];
      case 2: return [[-s, 0], [s, 0]];
      case 3: return [[0, -s], [-s, s], [s, s]];
      case 4: return [[-s, -s], [s, -s], [-s, s], [s, s]];
      case 5: return [[0, 0], [-s, -s], [s, -s], [-s, s], [s, s]];
      default: return [];
    }
  }

  _renderTransition(t) {
    const g = document.createElementNS(SVG_NS, 'g');
    g.setAttribute('class', 'transition-group');
    g.setAttribute('data-id', t.id);

    const isEnabled = this.enabledTransitions.has(t.id);
    const isSelected = t.id === this.selectedId;

    const rect = document.createElementNS(SVG_NS, 'rect');
    rect.setAttribute('x', t.x - TRANSITION_WIDTH / 2);
    rect.setAttribute('y', t.y - TRANSITION_HEIGHT / 2);
    rect.setAttribute('width', TRANSITION_WIDTH);
    rect.setAttribute('height', TRANSITION_HEIGHT);
    rect.setAttribute('class', `transition ${isEnabled ? 'enabled' : ''} ${isSelected ? 'selected' : ''}`);
    g.appendChild(rect);

    // Label
    const label = document.createElementNS(SVG_NS, 'text');
    label.setAttribute('x', t.x);
    label.setAttribute('y', t.y + TRANSITION_HEIGHT / 2 + 18);
    label.setAttribute('class', 'label');
    label.textContent = t.label;
    g.appendChild(label);

    this.nodeLayer.appendChild(g);
  }

  _renderArc(arc) {
    const place = this.net.places.get(arc.placeId);
    const transition = this.net.transitions.get(arc.transitionId);
    if (!place || !transition) return;

    const isSelected = arc.id === this.selectedId;
    const isConnectedToEnabled = this.enabledTransitions.has(arc.transitionId);

    let markerEnd = null;
    let markerStart = null;
    let sourceX, sourceY, targetX, targetY;

    let sourceType, targetType;

    if (arc.direction === 'place_to_transition') {
      [sourceX, sourceY] = [place.x, place.y];
      [targetX, targetY] = [transition.x, transition.y];
      sourceType = 'place'; targetType = 'transition';
      markerEnd = this._markerUrl(isSelected, isConnectedToEnabled);
    } else if (arc.direction === 'transition_to_place') {
      [sourceX, sourceY] = [transition.x, transition.y];
      [targetX, targetY] = [place.x, place.y];
      sourceType = 'transition'; targetType = 'place';
      markerEnd = this._markerUrl(isSelected, isConnectedToEnabled);
    } else {
      // Bidirectional: draw from place to transition
      [sourceX, sourceY] = [place.x, place.y];
      [targetX, targetY] = [transition.x, transition.y];
      sourceType = 'place'; targetType = 'transition';
      markerEnd = this._markerUrl(isSelected, isConnectedToEnabled);
      markerStart = this._markerUrl(isSelected, isConnectedToEnabled);
    }

    // Compute clipped endpoints
    const [sx, sy] = this._clipToNode(sourceX, sourceY, targetX, targetY, sourceType);
    const [tx, ty] = this._clipToNode(targetX, targetY, sourceX, sourceY, targetType);

    const g = document.createElementNS(SVG_NS, 'g');
    g.setAttribute('class', 'arc-group');
    g.setAttribute('data-id', arc.id);

    // Invisible fat line for easier clicking
    const hitArea = document.createElementNS(SVG_NS, 'line');
    hitArea.setAttribute('x1', sx);
    hitArea.setAttribute('y1', sy);
    hitArea.setAttribute('x2', tx);
    hitArea.setAttribute('y2', ty);
    hitArea.setAttribute('class', 'arc-hit-area');
    g.appendChild(hitArea);

    // Visible line
    const line = document.createElementNS(SVG_NS, 'line');
    line.setAttribute('x1', sx);
    line.setAttribute('y1', sy);
    line.setAttribute('x2', tx);
    line.setAttribute('y2', ty);
    line.setAttribute('class', `arc ${isSelected ? 'selected' : ''} ${isConnectedToEnabled ? 'enabled' : ''}`);
    if (markerEnd) line.setAttribute('marker-end', markerEnd);
    if (markerStart) line.setAttribute('marker-start', markerStart);
    g.appendChild(line);

    // Weight label (if > 1)
    if (arc.weight > 1) {
      const mx = (sx + tx) / 2;
      const my = (sy + ty) / 2;
      // Offset perpendicular to the line
      const dx = tx - sx;
      const dy = ty - sy;
      const len = Math.sqrt(dx * dx + dy * dy) || 1;
      const ox = -dy / len * 14;
      const oy = dx / len * 14;

      const bg = document.createElementNS(SVG_NS, 'rect');
      bg.setAttribute('x', mx + ox - 10);
      bg.setAttribute('y', my + oy - 10);
      bg.setAttribute('width', 20);
      bg.setAttribute('height', 18);
      bg.setAttribute('rx', 4);
      bg.setAttribute('class', 'arc-weight-bg');
      g.appendChild(bg);

      const text = document.createElementNS(SVG_NS, 'text');
      text.setAttribute('x', mx + ox);
      text.setAttribute('y', my + oy + 2);
      text.setAttribute('class', 'arc-weight');
      text.textContent = arc.weight;
      g.appendChild(text);
    }

    // Bidirectional indicator
    if (arc.direction === 'bidirectional') {
      const mx = (sx + tx) / 2;
      const my = (sy + ty) / 2;
      const dx = tx - sx;
      const dy = ty - sy;
      const len = Math.sqrt(dx * dx + dy * dy) || 1;
      const ox = -dy / len * (arc.weight > 1 ? -14 : 14);
      const oy = dx / len * (arc.weight > 1 ? -14 : 14);

      const tag = document.createElementNS(SVG_NS, 'text');
      tag.setAttribute('x', mx + ox);
      tag.setAttribute('y', my + oy + 2);
      tag.setAttribute('class', 'arc-bidi-tag');
      tag.textContent = 'R/W';
      g.appendChild(tag);
    }

    this.arcLayer.appendChild(g);
  }

  _markerUrl(isSelected, isEnabled) {
    if (isSelected) return 'url(#arrowhead-selected)';
    if (isEnabled) return 'url(#arrowhead-enabled)';
    return 'url(#arrowhead)';
  }

  /** Clip a line endpoint to the boundary of a place (circle) or transition (rect) */
  _clipToNode(nodeX, nodeY, otherX, otherY, nodeType) {
    const dx = otherX - nodeX;
    const dy = otherY - nodeY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist === 0) return [nodeX, nodeY];

    const ux = dx / dist;
    const uy = dy / dist;

    if (nodeType === 'place') {
      const offset = PLACE_RADIUS + 2;
      return [nodeX + ux * offset, nodeY + uy * offset];
    } else {
      // Transition rectangle
      const hw = TRANSITION_WIDTH / 2 + 2;
      const hh = TRANSITION_HEIGHT / 2 + 2;
      // Find intersection with rectangle
      let t = Infinity;
      if (ux !== 0) t = Math.min(t, hw / Math.abs(ux));
      if (uy !== 0) t = Math.min(t, hh / Math.abs(uy));
      return [nodeX + ux * t, nodeY + uy * t];
    }
  }

  /** Render temporary arc-drawing line from source to mouse */
  renderTempArc(fromX, fromY, toX, toY) {
    this.overlayLayer.innerHTML = '';
    const line = document.createElementNS(SVG_NS, 'line');
    line.setAttribute('x1', fromX);
    line.setAttribute('y1', fromY);
    line.setAttribute('x2', toX);
    line.setAttribute('y2', toY);
    line.setAttribute('class', 'arc temp-arc');
    line.setAttribute('marker-end', 'url(#arrowhead)');
    this.overlayLayer.appendChild(line);
  }

  clearOverlay() {
    this.overlayLayer.innerHTML = '';
  }

  /** Hit-test: find element under a point */
  hitTest(x, y) {
    // Check places
    for (const place of this.net.places.values()) {
      const dx = x - place.x;
      const dy = y - place.y;
      if (dx * dx + dy * dy <= (PLACE_RADIUS + 4) ** 2) {
        return { type: 'place', id: place.id };
      }
    }
    // Check transitions
    for (const t of this.net.transitions.values()) {
      const hw = TRANSITION_WIDTH / 2 + 4;
      const hh = TRANSITION_HEIGHT / 2 + 4;
      if (Math.abs(x - t.x) <= hw && Math.abs(y - t.y) <= hh) {
        return { type: 'transition', id: t.id };
      }
    }
    // Check arcs (proximity to line segment)
    for (const arc of this.net.arcs.values()) {
      const place = this.net.places.get(arc.placeId);
      const transition = this.net.transitions.get(arc.transitionId);
      if (!place || !transition) continue;
      const dist = this._pointToSegmentDist(x, y, place.x, place.y, transition.x, transition.y);
      if (dist < 10) {
        return { type: 'arc', id: arc.id };
      }
    }
    return null;
  }

  _pointToSegmentDist(px, py, ax, ay, bx, by) {
    const abx = bx - ax, aby = by - ay;
    const apx = px - ax, apy = py - ay;
    const t = Math.max(0, Math.min(1, (apx * abx + apy * aby) / (abx * abx + aby * aby)));
    const cx = ax + t * abx - px;
    const cy = ay + t * aby - py;
    return Math.sqrt(cx * cx + cy * cy);
  }
}
