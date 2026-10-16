# Cooksongold: First-Time Buyers Guide to 3D Printing (precious metal 3D print and cast)

Source: https://content.yudu.com/web/2y2qk/0A2y2qn/Eguide3DPrinting/html/index.html (Cooksongold e-guide, 22 pages, read page by page)
Notes transcribed from the page images. All dimensions in mm. Cooksongold prints wax and casts for customers, so a few points concern their ordering service (marked below). Keywords: design guidelines, wall thickness, sharp edges, small holes, pilot hole, divot, hollow, watertight, STL, sprue, shrinkage, polishing, finishing, CAD software, precious metals.

## Process (pages 4-5)
- The model is printed (wax in their service; castable resin in ours), invested in heat-resistant material, burned out to leave a hollow mould, and filled with molten metal. Suited to small, accurate, intricate shapes with consistent, repeatable results.

## Design guidelines (pages 12-17)
**Wall thickness**
- The design must be thick enough to withstand the print process.
- Structural and external walls: minimum 0.8 mm of metal.
- Smaller elements such as claws or small setting bezels: minimum 0.5 mm.
- Earring posts will not print well (length and thickness): solder them on after printing.

**Sharp edges**
- Two edges meeting in a sharp point or edge do not print well; the process prefers soft, rounded edges.
- For a sharp external edge, either thicken it to 0.30 mm or use a fillet of 0.30 mm radius. Same for a sharp internal edge.
- Better to have more material than needed there, so the edges can be sharpened during finishing.

**Small holes**
- Avoid small holes; minimum 0.5 mm.
- If pilot holes for setting are needed, do not model the hole: add a conical or spherical divot as a guide for a drill, used after printing/casting. Keep the width of the divot larger than its depth.

**Hollows / multiple pieces**
- Hollow pieces cannot be processed. Work around it by printing two halves and soldering/welding them together after casting.
- Interlocking or multiple pieces must be one part, otherwise print them separately and assemble afterwards.

**Watertight models**
- Make sure the model is watertight. Check for naked and non-manifold edges and fix them; non-manifold errors mostly come from shared edges/points, so overlap areas or thicken points to avoid them. Naked edges show where there is a gap in the model.
- Elements to be printed together must be unioned into one piece, not just grouped.
- Export a high-resolution STL and look at the exported STL to confirm it is what you want.

**Sprues and shrinkage**
- Sprues feed metal into the piece; remnants may remain on some pieces. Best sprue placement depends on the design; sometimes more than one sprue is needed (size, or extra tension).
- Do not add casting sprues to the STL in their service: the order value is based on STL volume, so you would pay for them (ask the printer to place sprues at chosen points instead).
- Shrinkage happens in the print process; a scaling increase is applied to compensate (in their service, automatically; with your own process confirm the allowance with your caster).

**Finishing and polishing**
- Parts come as cast with most of the sprue cut off.
- Polishing naturally removes some material, typically around 0.1 mm, which must be factored into the design.

## Finishes (pages 20-21)
- Matte: sandblasting a polished part; sleek contemporary look.
- Natural polish: mainly machine tumbling with a small amount of hand polishing; bright finish on most of the design.
- High polish: mirror finish that reaches even difficult places.
- Prints do not come polished as standard.
- Metals offered: silver 925, gold 9 ct and 18 ct (red, yellow, white), platinum. Hallmarking certifies purity and authenticity.

## CAD software overview (pages 6-11)
- CAD: computer software to create and modify detailed digital models.
- TinkerCAD: free, browser-based, easiest; limited intricacy.
- Blender: free, open source, strong modelling and jewellery add-ons; steep learning curve, not technically CAD, needs plug-ins for metal rendering.
- Rhinoceros 3D: popular in industry, large community, no subscription; not beginner friendly, no jewellery tools built in (paid add-ons exist), limited history.
- 3Design: built for jewellers, parametric, jewellery tools, costing options; higher initial cost.

## Getting CAD files (page 18)
- Accepted formats are generally 3dm, dae, fbx, obj, ply and stl.
- Design libraries mentioned: grabcad.com, myminifactory.com, cgtrader.com, free3d.com, thingiverse.com, turbosquid.com, cults3d.com, pinshape.com.
