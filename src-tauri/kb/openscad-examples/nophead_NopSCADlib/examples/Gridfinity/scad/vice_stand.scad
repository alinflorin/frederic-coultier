include <NopSCADlib/core.scad>

use <NopSCADlib/printed/gridfinity.scad>
use <NopSCADlib/utils/chamfer.scad>

box = gridfinity_bin("vice_stand", 2, 2, 5);

box_mm = gridfinity_bin_size_mm(box);

bwall = 1;
clearance = 0.5;
chamfer = 1;

vice_w = 60;
vice_d = 7.7;
jaw_w = 50.2;
total_d = 40.5;
jaw_d = total_d - vice_d;
jaw_inset = 1.5;

z_bot = gridfinity_base_z() + bwall;

module vice_stand_stl()
    gridfinity_bin(box) union() {
        translate_z(box_mm.z) {
            translate([0, total_d / 2 - jaw_d / 2])
                cube([jaw_w + 2 * clearance, jaw_d + 2 * clearance, (box_mm.z - z_bot - jaw_inset) * 2], center = true);

            translate([0, -total_d / 2 + vice_d / 2])
                cube([vice_w + 2 * clearance, vice_d + 2 * clearance, (box_mm.z - z_bot) * 2], center = true);

            chamfer_hole(chamfer) {
                translate([0, total_d / 2 - jaw_d / 2])
                    square([jaw_w + 2 * clearance, jaw_d + 2 * clearance], center = true);

                translate([0, -total_d / 2 + vice_d / 2])
                    square([vice_w + 2 * clearance, vice_d + 2 * clearance], center = true);
            }
        }
    }
