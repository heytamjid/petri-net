// simulator.js — Simulation engine (firing rules, step execution)

export class Simulator {
  constructor(petriNet) {
    this.net = petriNet;
    this.history = []; // array of { transitionId, label, markingBefore, markingAfter }
    this.stepCount = 0;
  }

  /** Check if a transition is enabled at the current marking */
  isEnabled(transitionId) {
    const inputArcs = this.net.getInputArcs(transitionId);
    for (const arc of inputArcs) {
      const place = this.net.places.get(arc.placeId);
      if (!place || place.tokens < arc.weight) {
        return false;
      }
    }
    // A transition with no input arcs is always enabled (source transition)
    return true;
  }

  /** Get all currently enabled transitions */
  getEnabledTransitions() {
    const enabled = [];
    for (const [id] of this.net.transitions) {
      if (this.isEnabled(id)) {
        enabled.push(id);
      }
    }
    return enabled;
  }

  /** Fire a specific transition. Returns true if successful. */
  fire(transitionId) {
    if (!this.isEnabled(transitionId)) return false;

    const markingBefore = this.net.getMarking();

    // Consume tokens from input places
    const inputArcs = this.net.getInputArcs(transitionId);
    for (const arc of inputArcs) {
      const place = this.net.places.get(arc.placeId);
      place.tokens -= arc.weight;
    }

    // Produce tokens in output places
    const outputArcs = this.net.getOutputArcs(transitionId);
    for (const arc of outputArcs) {
      const place = this.net.places.get(arc.placeId);
      place.tokens += arc.weight;
    }

    const markingAfter = this.net.getMarking();
    const t = this.net.transitions.get(transitionId);
    this.stepCount++;
    this.history.push({
      step: this.stepCount,
      transitionId,
      label: t ? t.label : transitionId,
      markingBefore: Object.fromEntries(markingBefore),
      markingAfter: Object.fromEntries(markingAfter),
    });

    return true;
  }

  /** Fire a random enabled transition. Returns the fired transition id, or null if deadlocked. */
  fireRandom() {
    const enabled = this.getEnabledTransitions();
    if (enabled.length === 0) return null;
    const idx = Math.floor(Math.random() * enabled.length);
    this.fire(enabled[idx]);
    return enabled[idx];
  }

  /**
   * Play N steps, firing random enabled transitions.
   * Returns an array of fired transition ids.
   * Stops early if deadlocked.
   */
  playSteps(n) {
    const fired = [];
    for (let i = 0; i < n; i++) {
      const tid = this.fireRandom();
      if (tid === null) break; // deadlock
      fired.push(tid);
    }
    return fired;
  }

  /**
   * Undo one step by popping history and restoring the previous marking.
   * Returns the history entry that was undone, or null if nothing to undo.
   */
  stepBack() {
    if (this.history.length === 0) return null;
    const entry = this.history.pop();
    this.stepCount--;
    // Restore the marking from before that transition fired
    const marking = new Map(Object.entries(entry.markingBefore));
    this.net.setMarking(marking);
    return entry;
  }

  /**
   * Undo N steps. Returns array of undone entries.
   */
  playBack(n) {
    const undone = [];
    for (let i = 0; i < n; i++) {
      const entry = this.stepBack();
      if (!entry) break;
      undone.push(entry);
    }
    return undone;
  }

  /**
   * Find a maximal set of independently enabled transitions.
   * Two transitions are independent if they don't compete for tokens
   * from any shared input place.
   * Returns an array of transition ids that can all fire simultaneously.
   */
  getMaximalConcurrentSet() {
    const enabled = this.getEnabledTransitions();
    if (enabled.length === 0) return [];

    // Greedily build a maximal independent set.
    // Track how many tokens are "reserved" per place.
    const reserved = new Map();
    const selected = [];

    for (const tid of enabled) {
      const inputArcs = this.net.getInputArcs(tid);

      // Check if this transition can fire given already-reserved tokens
      let canFire = true;
      for (const arc of inputArcs) {
        const place = this.net.places.get(arc.placeId);
        const available = place.tokens - (reserved.get(arc.placeId) || 0);
        if (available < arc.weight) {
          canFire = false;
          break;
        }
      }

      if (canFire) {
        selected.push(tid);
        // Reserve tokens for this transition
        for (const arc of inputArcs) {
          reserved.set(arc.placeId, (reserved.get(arc.placeId) || 0) + arc.weight);
        }
      }
    }

    return selected;
  }

  /**
   * Fire all transitions in a concurrent set simultaneously.
   * Saves a single history entry with all fired transitions.
   * Returns the array of fired transition ids, or empty if deadlocked.
   */
  fireConcurrent() {
    const set = this.getMaximalConcurrentSet();
    if (set.length === 0) return [];

    const markingBefore = this.net.getMarking();

    // Consume all inputs first
    for (const tid of set) {
      const inputArcs = this.net.getInputArcs(tid);
      for (const arc of inputArcs) {
        const place = this.net.places.get(arc.placeId);
        place.tokens -= arc.weight;
      }
    }

    // Then produce all outputs
    for (const tid of set) {
      const outputArcs = this.net.getOutputArcs(tid);
      for (const arc of outputArcs) {
        const place = this.net.places.get(arc.placeId);
        place.tokens += arc.weight;
      }
    }

    const markingAfter = this.net.getMarking();
    const labels = set.map(tid => {
      const t = this.net.transitions.get(tid);
      return t ? t.label : tid;
    });
    this.stepCount++;
    this.history.push({
      step: this.stepCount,
      transitionId: set,       // array for concurrent
      label: labels.join(' + '),
      markingBefore: Object.fromEntries(markingBefore),
      markingAfter: Object.fromEntries(markingAfter),
    });

    return set;
  }

  /** Check if current state is a deadlock (no enabled transitions) */
  isDeadlocked() {
    return this.getEnabledTransitions().length === 0;
  }

  /** Can we step back? */
  canStepBack() {
    return this.history.length > 0;
  }

  /** Reset simulation state */
  reset() {
    this.net.resetMarking();
    this.history = [];
    this.stepCount = 0;
  }
}
