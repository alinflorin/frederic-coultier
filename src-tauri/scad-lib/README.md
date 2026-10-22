# Bundled OpenSCAD libraries

Every `.scad` file in this folder ships inside the app and is offered to every model:

```openscad
use <nurbs.scad>
```

They are served from memory by `src/scadlib.rs`: nothing here is written into a `.fc` file, and
`include`/`use` can't reach anything outside this folder. Paths resolve relative to the including
file first, then from this folder, so a library can `use <other.scad>` or `use <sub/x.scad>`.
Debug builds read the folder from disk on every render, so edits show up without a rebuild.

| file          | what                                                         |
|---------------|--------------------------------------------------------------|
| `nurbs.scad`  | NURBS curves and surfaces, and a polyhedron through a grid   |
