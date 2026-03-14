# Petri Net Simulator

An interactive, visual Petri Net simulator built with vanilla JavaScript and SVG. Designed as an educational tool to help students understand Petri Net behavior through hands-on experimentation.

## Features

### Visual Editor
- **Toolbar-based** workflow — select a tool, click on the canvas to create elements
- **Drag-and-drop** repositioning of places and transitions
- **Double-click** any element to edit its label
- **Properties panel** to configure labels, token counts, arc weights, and arc directions

### Petri Net Support
- **Places** (circles) with configurable initial tokens
- **Transitions** (bars) with visual enabled/disabled state
- **Weighted arcs** — arc weights greater than 1 are supported
- **Bidirectional (read/write) arcs** — a token is read but not consumed
- Standard **Place → Transition** and **Transition → Place** arc directions

### Simulation
- **Play N steps** — fire N transitions in sequence (set count in the input box); stops early on deadlock
- **Manual firing** — double-click an enabled (green) transition to fire it yourself
- **Reset** — return to the initial marking at any time
- **Firing log** — timestamped trace of every fired transition

### Canvas Navigation
- **Scroll wheel** to zoom in/out (cursor-centered)
- **Right-click drag** or **middle-click drag** to pan
- **`0` key** to reset view to default

### Analysis
- **Enabled transition highlighting** — enabled transitions glow green in real-time
- **Marking vector** displayed at the bottom of the canvas (`M = [...]`)
- **Analyze** button computes:
  - **Reachable states** (via reachability graph)
  - **Boundedness** (k-bound per place and global)
  - **Deadlock detection** (identifies deadlock markings)
  - **Liveness** (L1 — identifies dead transitions)

### Pre-built Examples
- **German Traffic Light** — models the Red → Red+Yellow → Green → Yellow → Red cycle with a control place for determinism
- **Producer-Consumer** — classic concurrency pattern with a shared buffer

### Save / Load
- **Export** your Petri Net as a `.json` file
- **Import** a previously saved `.json` file
- Share designs with others — just send the JSON file

## Getting Started

### Prerequisites
A modern web browser (Chrome, Firefox, Edge, Safari). No build tools or dependencies required.

### Running
Since the project uses ES modules, it needs to be served over HTTP (not `file://`). Use any static file server:

**Python:**
```bash
cd petrinet-simulator
python -m http.server 3000
```

**Node.js (npx):**
```bash
cd petrinet-simulator
npx serve .
```

**VS Code:**
Install the "Live Server" extension, right-click `index.html` → "Open with Live Server".

Then open `http://localhost:3000` in your browser.

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `V` | Select / Move tool |
| `P` | Add Place tool |
| `T` | Add Transition tool |
| `A` | Draw Arc tool |
| `D` | Delete tool |
| `Space` | Play N steps |
| `R` | Reset to initial marking |
| `Delete` | Remove selected element |
| `Esc` | Back to Select tool |
| `0` | Reset view (zoom/pan) |
| `Scroll` | Zoom in/out |
| `Right-drag` | Pan canvas |
| Double-click | Fire an enabled transition / Edit label |

## How to Use

1. **Build a net:** Select the Place or Transition tool from the toolbar and click on the canvas to place elements. Use the Arc tool to connect them — click a source, then click a target (arcs must connect a place to a transition or vice versa).

2. **Configure:** Select an element to see its properties on the right panel. Set token counts for places, weights for arcs, and change arc directions (including bidirectional).

3. **Simulate:** Set the step count and click Play (or press Space) to fire transitions. Double-click a green (enabled) transition to manually choose which one fires.

4. **Analyze:** Click the Analyze button to compute boundedness, liveness, and deadlock properties of your net.

5. **Save/Load:** Export your net as JSON to save it, or import a previously saved JSON file.

## Project Structure

```
petrinet-simulator/
├── index.html          App shell and layout
├── css/
│   └── style.css       Styling
├── js/
│   ├── app.js          Main application wiring
│   ├── model.js        PetriNet data model (Place, Transition, Arc)
│   ├── renderer.js     SVG rendering engine
│   ├── editor.js       Editor tools and canvas interactions
│   ├── simulator.js    Firing rules and step execution
│   ├── analyzer.js     Property analysis (reachability, boundedness, liveness)
│   └── examples.js     Pre-built example nets
```

## Petri Net Theory (Quick Reference)

A **Petri Net** is a tuple (P, T, F, W, M₀) where:
- **P** = set of places (drawn as circles)
- **T** = set of transitions (drawn as bars/rectangles)
- **F** = set of arcs connecting places to transitions and vice versa
- **W** = weight function on arcs (default 1)
- **M₀** = initial marking (token distribution)

**Firing rule:** A transition is *enabled* if every input place has at least as many tokens as the weight of the connecting arc. When fired, it consumes tokens from input places and produces tokens in output places.

**Key properties:**
- **Boundedness** — no place ever exceeds k tokens across all reachable markings
- **Liveness** — every transition can eventually fire from any reachable state
- **Deadlock-freedom** — the system never reaches a state where no transition is enabled

## License

MIT
