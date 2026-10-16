//
// Stand for MT1 taper lathe tools
//
include <NopSCADlib/core.scad>
use <NopSCADlib/utils/maths.scad>
use <NopSCADlib/utils/chamfer.scad>

use <NopSCADlib/printed/gridfinity.scad>

box = gridfinity_bin("MT1_stand", 4, 2, 8);

box_mm = gridfinity_bin_size_mm(box);
wall = 1.75;
bwall = 1;


diameters1 = [30, 43, 53];
d2 = 20;

clearance = 1;
clearance2 = 4;

MT1_base = 8.0; // smaller diameters height
MT1_D1 = 9.5; // diameter at the bottom of the taper at base height
MT1_half_angle = 1.4287;

hole_depth = box_mm.z - gridfinity_base_z() - bwall;
MT1_r1 = MT1_D1 / 2;
MT1_r2 = MT1_r1 + (hole_depth - MT1_base) * tan(MT1_half_angle);

gap = (box_mm.x - sumv(diameters1) - 2 * clearance) / (len(diameters1) - 1);
gap2 = 18;

module MT1_socket() {
    clearance = 0.3;

    translate_z(-hole_depth) {
        poly_cylinder(MT1_r1 + clearance / 2, MT1_base + eps);

        translate_z(MT1_base)
            hull() {
                poly_cylinder(MT1_r1 + clearance / 2, eps);

                translate_z(hole_depth - MT1_base)
                    poly_cylinder(MT1_r2 + clearance / 2, eps);
            }
    }
    chamfer_hole(1)
        poly_circle(MT1_r2 + clearance / 2);
}

function pos(i)  = [clearance + sumv(slice(diameters1, 0, i)) + i * gap + diameters1[i] / 2 - box_mm.x / 2, box_mm.y / 2 - clearance - diameters1[i] / 2, box_mm.z];
function pos2(i) = [clearance2 + i * gap2 + (i + 0.5) * d2 - box_mm.x / 2, -box_mm.y / 2 + clearance2 + d2 / 2, box_mm.z];

module holes()
    for(i = [0 : len(diameters1) - 1]) {
        translate(pos(i))
            children();

        translate(pos2(i))
            children();
    }

module MT1_stand_stl()
    gridfinity_bin(box) union() {
        holes()
            MT1_socket();

        translate_z(gridfinity_base_z() + bwall)
            difference() {
                rounded_rectangle([box_mm.x - 2 * wall, box_mm.y - 2 * wall, box_mm.z - gridfinity_base_z() - bwall - wall], gridfinity_corner_r() - wall);

                holes()
                    cylinder(r =  MT1_r2 + wall, h = 200, center = true);

                for(x = [-box_mm.x / 2 : 20 :  box_mm.x /2])
                    translate([x, 0])
                        cube([squeezed_wall, 200, 200], center = true);
            }
    }
