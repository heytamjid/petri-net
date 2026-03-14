// analyzer.js — Property analysis: deadlock, boundedness, liveness via reachability graph

export class Analyzer {
  constructor(petriNet) {
    this.net = petriNet;
  }

  /**
   * Build the reachability graph from the current marking.
   * Returns { markings: Map<string, Map>, edges: [], bounded: bool, limit: bool }
   * We cap exploration to avoid infinite loops on unbounded nets.
   */
  buildReachabilityGraph(maxMarkings = 1000) {
    const initialMarking = this.net.getMarking();
    const initialKey = this._markingKey(initialMarking);

    const visited = new Map(); // markingKey -> marking
    visited.set(initialKey, new Map(initialMarking));

    const edges = []; // { from: key, to: key, transitionId }
    const queue = [initialKey];
    let hitLimit = false;

    while (queue.length > 0) {
      if (visited.size > maxMarkings) {
        hitLimit = true;
        break;
      }

      const currentKey = queue.shift();
      const currentMarking = visited.get(currentKey);

      // Set the net to this marking temporarily
      this.net.setMarking(currentMarking);

      // Try each transition
      for (const [tid] of this.net.transitions) {
        if (this._isEnabledAt(tid)) {
          const newMarking = this._fireAt(tid, currentMarking);
          const newKey = this._markingKey(newMarking);
          edges.push({ from: currentKey, to: newKey, transitionId: tid });

          if (!visited.has(newKey)) {
            visited.set(newKey, newMarking);
            queue.push(newKey);
          }
        }
      }
    }

    // Restore original marking
    this.net.setMarking(initialMarking);

    return { markings: visited, edges, hitLimit };
  }

  /**
   * Analyze all properties. Returns an analysis result object.
   */
  analyze() {
    const results = {
      deadlock: false,
      deadlockMarkings: [],
      bounded: true,
      kBound: 0,
      placeBounds: {},
      live: true,
      nonLiveTransitions: [],
      reachableStates: 0,
      hitLimit: false,
    };

    if (this.net.places.size === 0 && this.net.transitions.size === 0) {
      return results;
    }

    const savedMarking = this.net.getMarking();
    const { markings, edges, hitLimit } = this.buildReachabilityGraph();
    results.reachableStates = markings.size;
    results.hitLimit = hitLimit;

    // --- Boundedness ---
    // Track max tokens per place across all reachable markings
    const maxTokens = new Map();
    for (const [id] of this.net.places) {
      maxTokens.set(id, 0);
    }

    for (const marking of markings.values()) {
      for (const [pid, tokens] of marking) {
        if (tokens > maxTokens.get(pid)) {
          maxTokens.set(pid, tokens);
        }
      }
    }

    let globalMax = 0;
    for (const [pid, max] of maxTokens) {
      const place = this.net.places.get(pid);
      results.placeBounds[pid] = { label: place ? place.label : pid, bound: max };
      if (max > globalMax) globalMax = max;
    }
    results.kBound = globalMax;

    if (hitLimit) {
      results.bounded = false; // likely unbounded if we hit the limit
    }

    // --- Deadlock detection ---
    // A marking is a deadlock if no transition is enabled
    for (const [key, marking] of markings) {
      this.net.setMarking(marking);
      let anyEnabled = false;
      for (const [tid] of this.net.transitions) {
        if (this._isEnabledAt(tid)) {
          anyEnabled = true;
          break;
        }
      }
      if (!anyEnabled) {
        results.deadlock = true;
        results.deadlockMarkings.push(key);
      }
    }

    // --- Liveness ---
    // A transition t is live if, from every reachable marking, there exists a firing
    // sequence that eventually enables t.
    // Simplified check: t is live (L1) if it can fire at least once from some reachable marking.
    // Full L4-liveness is expensive; we check L1 (potentially fireable) here.
    // We also check if every transition appears in at least one edge from every marking
    // that can reach it (simplified).

    // Simple liveness: check if every transition fires in at least one reachable marking
    const transitionCanFire = new Set();
    for (const edge of edges) {
      transitionCanFire.add(edge.transitionId);
    }

    for (const [tid, t] of this.net.transitions) {
      if (!transitionCanFire.has(tid)) {
        results.live = false;
        results.nonLiveTransitions.push({ id: tid, label: t.label });
      }
    }

    // Restore marking
    this.net.setMarking(savedMarking);

    return results;
  }

  // --- Internal helpers ---

  _markingKey(marking) {
    const entries = [];
    // Sort by place id for consistent keys
    const sortedIds = Array.from(marking.keys()).sort();
    for (const id of sortedIds) {
      entries.push(`${id}:${marking.get(id)}`);
    }
    return entries.join(',');
  }

  _isEnabledAt(transitionId) {
    const inputArcs = this.net.getInputArcs(transitionId);
    for (const arc of inputArcs) {
      const place = this.net.places.get(arc.placeId);
      if (!place || place.tokens < arc.weight) return false;
    }
    return true;
  }

  _fireAt(transitionId, marking) {
    const newMarking = new Map(marking);

    const inputArcs = this.net.getInputArcs(transitionId);
    for (const arc of inputArcs) {
      newMarking.set(arc.placeId, newMarking.get(arc.placeId) - arc.weight);
    }

    const outputArcs = this.net.getOutputArcs(transitionId);
    for (const arc of outputArcs) {
      newMarking.set(arc.placeId, (newMarking.get(arc.placeId) || 0) + arc.weight);
    }

    return newMarking;
  }
}
