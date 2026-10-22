// Plain ring band
// include <BOSL2/std.scad>
// include <BOSL2/nurbs.scad>

// Parameters
ring_size_mm  = 17.3;   // inner diameter (EU 54) [14:0.1:24]
band_width    = 2.4;    // [1.2:0.1:6]
band_thick    = 1.6;    // [1.2:0.1:3]

$fn = 96;

// Finger axis along Y
module band() {
  rotate([90, 0, 0])
    difference() {
      cylinder(d = ring_size_mm + 2 * band_thick, h = band_width, center = true);
      cylinder(d = ring_size_mm, h = band_width + 1, center = true);
    }
}

band();
