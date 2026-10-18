# Parametric jewelry components

Ready-made OpenSCAD modules for the usual parts of a piece. The renderer does not support
`include`/`use` (projects are self-contained), so **copy the modules you need into the model's
source**, above the geometry that calls them. Every module is in millimetres, has sensible defaults
and no dependencies on the others unless the header says so.

| file | modules |
|------|---------|
| `gems.scad` | `gem()` marker, `round_brilliant`, `oval_brilliant`, `princess`, `cabochon` |
| `bands.scad` | `ring_band` (comfort / flat / knife-edge), `eu_to_d`, `us_to_d` |
| `prongs.scad` | `prong_head` (3–8 prongs, with basket); needs `round_brilliant` from `gems.scad` |
| `bezel.scad` | `bezel` (closed or open back); needs `round_brilliant` from `gems.scad` |
| `findings.scad` | `jump_ring`, `bail`, `earring_post`, `hoop`, `toggle_bar` |

## Conventions

- **Ring axis along Y, stone on top (+Z).** A ring is centred at the origin; the top of the band is
  at `z = inner_d / 2 + thick`. Place a head so its girdle sits on that surface.
- **Stones are centred on their girdle plane** (`z = 0`): crown above, pavilion below, culet at
  `z = -pavilion depth`. Heads and bezels use the same plane, so a stone and its setting line up
  when they are given the same position and diameter.
- **Mark every stone with `gem() { ... }`.** The app draws what is inside `gem()` as glass and leaves
  it out of the metal weight. Define `module gem() { children(); }` once (it is in `gems.scad`); the
  line has to read exactly `module gem() {`. A stone that is not wrapped is shown as metal.
- Subtract the stone from the setting (the heads and bezels already do this), do not leave them
  overlapping in the metal: the overlap is what the casting master has to carve out.
- `$fn` is set by the caller. For stones, `facets = 16` (the default) gives a faceted look in the
  preview; use 8 for a princess-like round and 32+ for smooth settings.

## Minimum sizes for casting (see the casting notes in this knowledge base)

Prong diameter ≥ 0.8 mm (0.9 safe), bezel wall ≥ 0.5 mm, band thickness ≥ 1.2 mm for a ring,
bail wire ≥ 1.0 mm, earring post ≥ 0.8 mm. Run `check --deep` after changing them.

## Example: solitaire ring

```
module gem() { children(); }
// ... ring_band, prong_head, round_brilliant copied here ...
ring_size_mm = 17.3; band_thick = 1.6; stone_d = 5;
ring_band(ring_size_mm, 2.4, band_thick);
translate([0, 0, ring_size_mm / 2 + band_thick - 0.3]) {
  prong_head(stone_d);
  gem() round_brilliant(stone_d);
}
```
