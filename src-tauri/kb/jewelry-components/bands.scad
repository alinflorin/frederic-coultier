// Ring bands. Finger axis along Y, centred at the origin; the top of the band is at
// z = inner_d / 2 + thick, which is where a stone head or a bezel is placed.

// Inner diameter (mm) from a European size (inner circumference in mm) or a US size.
function eu_to_d(eu) = eu / PI;
function us_to_d(us) = 11.63 + 0.8128 * us;

// profile: "comfort" (domed outside, flat inside), "flat", "knife" (ridged)
module ring_band(inner_d = 17.3, width = 2.4, thick = 1.6, profile = "comfort", steps = 12) {
  r = inner_d / 2;
  dome = profile == "flat" ? 0 : profile == "knife" ? 0.85 * thick : min(0.6 * thick, 0.3 * width);
  power = profile == "knife" ? 1 : 2;
  edge = [for (i = [0 : steps]) let (y = -width / 2 + width * i / steps)
    [r + thick - dome * pow(abs(2 * y / width), power), y]];
  rotate([90, 0, 0])
    rotate_extrude($fn = 96)
      polygon(concat([[r, -width / 2]], edge, [[r, width / 2]]));
}

// demo: ring_band(17.3, 2.4, 1.6, "comfort");
// demo: ring_band(us_to_d(7), 3, 1.8, "flat");
// demo: ring_band(eu_to_d(54), 2, 1.5, "knife");
