// Solitaire ring, 4 prong
// Parameters
ring_size_mm  = 17.3;   // inner diameter (EU 54)
band_width    = 2.4;
band_thick    = 1.6;
stone_d       = 5.0;    // round brilliant
prong_d       = 0.9;
prongs        = 4;

$fn = 96;

// Finger axis along Y, stone on top (+Z)
module band() {
  rotate([90, 0, 0])
    difference() {
      cylinder(d = ring_size_mm + 2 * band_thick, h = band_width, center = true);
      cylinder(d = ring_size_mm, h = band_width + 1, center = true);
    }
}

module head() {
  translate([0, 0, ring_size_mm / 2 + band_thick - 0.3]) {
    // basket
    cylinder(d1 = 3, d2 = stone_d + 0.4, h = 2.2);
    // prongs
    for (i = [0 : prongs - 1])
      rotate([0, 0, i * 360 / prongs + 45])
        translate([stone_d / 2 + 0.1, 0, 0])
          cylinder(d = prong_d, h = 3.6);
  }
}

union() {
  band();
  head();
}
