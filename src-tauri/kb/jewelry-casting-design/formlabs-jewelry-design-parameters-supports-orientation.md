# Formlabs white paper: Jewelry 3D Printing - Basic Design Parameters, Supports and Orientation (Oct 2017)

Source: https://formlabs-media.formlabs.com/rs/060-UIG-504/images/Jewelry-3D-Printing-Basic-Design-Parameters-Supports-Orientation.pdf
Written for the Form 2 (laser SLA, Castable Resin), but the design and casting principles carry over to LCD resin printers such as the Elegoo Mars 5. Summary/notes, not a verbatim copy. All dimensions in mm.
Keywords: wall thickness, hollow, prong, bezel, draft, investment, holes, fillet, engraving, relief, watertight, orientation, supports, peel, islands, sprue, casting.

## Printing mechanics that affect design
- Fine jewelry detail: 25 micron layers recommended.
- Each layer peels from the tank film; peel and resin-flow forces distort very thin or very heavy parts.
- Prints are "green" off the machine; post-cure fully (heat + light). A fully cured part gives better casting. Castable resin is soft when green.
- Thin parts cure more easily than thick ones.

## Wall thickness and weight (ring test: 0.3 / 0.5 / 0.75 mm walls)
- 0.3 mm: walls print concave, casting incompletely filled. Not usable.
- 0.5 mm: reliable fill but some distortion/concavity; filing flat would leave dangerously thin walls.
- 0.75 mm: works well, strong enough for everyday wear.
- Too heavy: needs stronger supports, costs more, uncomfortable. Too light: distortion, may not cast. Large pieces should be hollow forms with a wall that survives wear (example: 18 mm wide bangle with 0.9 mm wall).

## Hollow pieces: must be open
- A hollow form with one small hole (3.5 mm) cannot be cast: uncured resin inside is hard to wash/cure (uncured resin reacts with investment), investment cannot fill it or be removed, and the investment "core" floats on a tiny stem that breaks under metal flow.
- Fix 1: add multiple large access openings (can be decorative).
- Fix 2: build in several parts (with keys/locators) and assemble.

## Prongs and bezels for small stones
- Example: 8 mm centre stone, 2.5 mm side stones. Side stones: bezel 0.4 mm, prongs 0.7 mm diameter. Centre stone: bezel and prongs 1 mm.
- 0.3 mm bezel prints but is problematic to cast and can become dangerously thin after finishing.
- Where small stones sit within walls: wall minimum 0.5 mm, prongs minimum 0.5 mm.
- Vertical walls and prongs set too close print fused, and the sliver of investment between them breaks during casting (metal runs free, investment particles end up in the metal as voids/inclusions).
- **Use draft:** taper walls and prongs from thicker base to thinner top; about 5 degrees is usually enough; more is better if the design allows. It widens the investment gap, keeps the upper space defined, and guides stone setting.

## Holes
- Through holes minimum 0.5 mm, and only in very thin material; smaller holes may not cast or print consistently, and a small hole in thick metal risks investment breaking and the hole filling (and leaving investment particles in the casting).
- Better: drill small holes after casting. Model a shallow divot (e.g. difference a sphere at each end) as a drill guide.
- Alternative: add an ajour (larger opening) behind the hole, which also saves weight (example: ~1.5 mm real hole, or rectangular ajours behind round stones).

## Internal corners and surface flow
- Fillet internal edges (sharp negative corners let investment edges break off); fillet external edges too if the design allows.
- Sharp edges, rough finish and un-smoothed support scars cause turbulent metal flow, so porosity. Spend time cleaning and smoothing the print.

## Engraved details
- Letters 1.5 mm tall: smallest ornate script fails at both 0.3 and 0.5 mm depth; slightly better at 0.3 mm depth (shorter investment columns are stronger).
- Give engraved/negative features draft.
- For very small engraving, have it laser/machine/hand engraved after casting.
- Even if it casts, polishing may erase fine detail.

## Surface relief
- Casting is matte, then tumbled and polished (subtractive). Fine raised detail diminishes: exaggerate relief (e.g. a 0.3 mm wire in a groove: keep width, increase groove depth and wire height).

## Watertight models
- Model must be a closed, boolean-unified solid (not just grouped parts, no open seams).

## Orientation and supports
- Every layer must trace down to the plate via supports ("islands" = unsupported features that float off).
- Touch points as small as 0.3 mm; small tips support details without obscuring them but hold less. Jewelry is light, so a single large support at the bottom of the shank can work for simple rings.
- Large flat surfaces parallel to the plate suffer big peel/flow forces and need massive supports: angle them.
- Hollow objects: orient so the opening faces down into the tank (to avoid trapping resin) - but experiment; results varied.
- Check with a layer slider that internal tips, prongs and filigree points are supported by earlier layers, not floating (e.g. flip a setting so internal heart points build from supported layers).
- Abrupt thin-to-thick transitions shrink unevenly (prong shrinks before it meets the bezel): orient so the thin-to-thick transition is minimised and the thin part is built as it joins the mass.
- Experiment with your own printer; the best orientation is not always the "obvious" one.

## Casting notes
- Place the sprue where metal flows best and clean-up is easy; ask the caster.
- Gold and silver are fine; platinum is hard from castable resin (casters often make a mold and cast waxes instead).
- Complex designs: print a spare in case a casting fails.
