// model.js — Petri Net data model

let nextId = 1;
function genId(prefix) {
  return `${prefix}_${nextId++}`;
}

export class Place {
  constructor(id, x, y, label = '', tokens = 0) {
    this.id = id;
    this.x = x;
    this.y = y;
    this.label = label;
    this.tokens = tokens;
  }
}

export class Transition {
  constructor(id, x, y, label = '') {
    this.id = id;
    this.x = x;
    this.y = y;
    this.label = label;
  }
}

export class Arc {
  /**
   * @param {string} id
   * @param {string} placeId
   * @param {string} transitionId
   * @param {'place_to_transition'|'transition_to_place'|'bidirectional'} direction
   * @param {number} weight
   */
  constructor(id, placeId, transitionId, direction, weight = 1) {
    this.id = id;
    this.placeId = placeId;
    this.transitionId = transitionId;
    this.direction = direction;
    this.weight = weight;
  }
}

export class PetriNet {
  constructor() {
    this.places = new Map();
    this.transitions = new Map();
    this.arcs = new Map();
    this._initialMarking = null;
  }

  addPlace(x, y, label, tokens = 0) {
    const id = genId('p');
    const place = new Place(id, x, y, label || id, tokens);
    this.places.set(id, place);
    return place;
  }

  addTransition(x, y, label) {
    const id = genId('t');
    const t = new Transition(id, x, y, label || id);
    this.transitions.set(id, t);
    return t;
  }

  addArc(placeId, transitionId, direction, weight = 1) {
    // Validate
    if (!this.places.has(placeId) || !this.transitions.has(transitionId)) {
      return null;
    }
    // Check for duplicate arc between same place-transition pair with same direction
    for (const arc of this.arcs.values()) {
      if (arc.placeId === placeId && arc.transitionId === transitionId) {
        if (arc.direction === direction) return null; // duplicate
        if (arc.direction === 'bidirectional' || direction === 'bidirectional') return null;
        // If both normal directions exist, could upgrade to bidirectional
        if (
          (arc.direction === 'place_to_transition' && direction === 'transition_to_place') ||
          (arc.direction === 'transition_to_place' && direction === 'place_to_transition')
        ) {
          arc.direction = 'bidirectional';
          arc.weight = weight;
          return arc;
        }
      }
    }
    const id = genId('a');
    const arc = new Arc(id, placeId, transitionId, direction, weight);
    this.arcs.set(id, arc);
    return arc;
  }

  removePlace(id) {
    this.places.delete(id);
    // Remove connected arcs
    for (const [arcId, arc] of this.arcs) {
      if (arc.placeId === id) this.arcs.delete(arcId);
    }
  }

  removeTransition(id) {
    this.transitions.delete(id);
    for (const [arcId, arc] of this.arcs) {
      if (arc.transitionId === id) this.arcs.delete(arcId);
    }
  }

  removeArc(id) {
    this.arcs.delete(id);
  }

  removeElement(id) {
    if (this.places.has(id)) this.removePlace(id);
    else if (this.transitions.has(id)) this.removeTransition(id);
    else if (this.arcs.has(id)) this.removeArc(id);
  }

  /** Get all arcs where transition is an input consumer (place -> transition) */
  getInputArcs(transitionId) {
    const result = [];
    for (const arc of this.arcs.values()) {
      if (arc.transitionId === transitionId) {
        if (arc.direction === 'place_to_transition' || arc.direction === 'bidirectional') {
          result.push(arc);
        }
      }
    }
    return result;
  }

  /** Get all arcs where transition produces tokens (transition -> place) */
  getOutputArcs(transitionId) {
    const result = [];
    for (const arc of this.arcs.values()) {
      if (arc.transitionId === transitionId) {
        if (arc.direction === 'transition_to_place' || arc.direction === 'bidirectional') {
          result.push(arc);
        }
      }
    }
    return result;
  }

  /** Get current marking as a Map of placeId -> tokenCount */
  getMarking() {
    const m = new Map();
    for (const [id, place] of this.places) {
      m.set(id, place.tokens);
    }
    return m;
  }

  /** Set marking from a Map of placeId -> tokenCount */
  setMarking(marking) {
    for (const [id, tokens] of marking) {
      const place = this.places.get(id);
      if (place) place.tokens = tokens;
    }
  }

  /** Save the current marking as the initial marking */
  saveInitialMarking() {
    this._initialMarking = this.getMarking();
  }

  /** Reset to initial marking */
  resetMarking() {
    if (this._initialMarking) {
      this.setMarking(this._initialMarking);
    }
  }

  /** Serialize to plain JSON object */
  toJSON() {
    return {
      places: Array.from(this.places.values()),
      transitions: Array.from(this.transitions.values()),
      arcs: Array.from(this.arcs.values()),
    };
  }

  /** Deserialize from JSON */
  static fromJSON(data) {
    const net = new PetriNet();
    let maxId = 0;
    for (const p of data.places) {
      const place = new Place(p.id, p.x, p.y, p.label, p.tokens);
      net.places.set(p.id, place);
      const num = parseInt(p.id.split('_')[1], 10);
      if (num > maxId) maxId = num;
    }
    for (const t of data.transitions) {
      const tr = new Transition(t.id, t.x, t.y, t.label);
      net.transitions.set(t.id, tr);
      const num = parseInt(t.id.split('_')[1], 10);
      if (num > maxId) maxId = num;
    }
    for (const a of data.arcs) {
      const arc = new Arc(a.id, a.placeId, a.transitionId, a.direction, a.weight);
      net.arcs.set(a.id, arc);
      const num = parseInt(a.id.split('_')[1], 10);
      if (num > maxId) maxId = num;
    }
    nextId = maxId + 1;
    net.saveInitialMarking();
    return net;
  }

  clear() {
    this.places.clear();
    this.transitions.clear();
    this.arcs.clear();
    this._initialMarking = null;
  }
}
