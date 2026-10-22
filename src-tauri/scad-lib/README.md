# Bundled OpenSCAD libraries

Every `.scad` file in this folder ships inside the app and is offered to every model:

```openscad
include <BOSL2/std.scad>
include <BOSL2/nurbs.scad>
```

They are served from memory by `src/scadlib.rs`: nothing here is written into a `.fc` file, and
`include`/`use` can't reach anything outside this folder. Paths resolve relative to the including
file first, then from this folder. Debug builds read the folder from disk on every render, so edits
show up without a rebuild. `every_bundled_file_parses` (in `src/scadlib.rs`) checks that the engine
can parse everything here.

| folder   | what                                                                                  |
|----------|---------------------------------------------------------------------------------------|
| `BOSL2/` | [BOSL2](https://github.com/BelfrySCAD/BOSL2) v2.0.776 (commit `dd79b22`), BSD-2-Clause: the library files, `LICENSE` and `README.md` only |

## Updating BOSL2

Copy the top-level `*.scad` files, `LICENSE` and `README.md` of a new BOSL2 checkout over `BOSL2/`,
re-apply the patch below, update the version above, and run `cargo test`. Also refresh the copy in
`kb/openscad-examples/BelfrySCAD_BOSL2/` (the agent reads the documentation there).

## Local patches

The embedded engine (openrscad) can't parse everything OpenSCAD can; these lines are rewritten to
equivalent code it accepts:

- `BOSL2/linalg.scad`, in `_im_shape`: a C-style `for` with an empty init clause,
  `[for(;is_list(list) && len(list)>0;list=list[0]) len(list)]`, becomes
  `[for(l=list; is_list(l) && len(l)>0; l=l[0]) len(l)]`.
