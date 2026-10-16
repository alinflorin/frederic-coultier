ring = "growing_faceplate"; // [growing_faceplate, basic, basic_rounded, basic_faceplate, size_test]

inner_diameter = 20; // [10:0.5:40]
thickness = 1; // [0.5:0.1:3]
min_height = 5; // [1:0.5:15]
max_height = 10; // [1:0.5:20]
faceplate_width = 10; //[5:1:40]

text_size_ratio = 0.5; //[0.1:0.1:1]
text_width_ratio = 3; //[1:0.1:4]

fn_segments_preview = 50; //[10:10:500]
fn_segments_render = 200; //[10:10:500]
fn_rounding_preview = 20; //[10:10:500]
fn_rounding_render = 50; //[10:10:500]
fn_text_preview = 50; //[10:10:500]
fn_text_render = 200; //[10:10:500]


module __Customizer_Limit__ () {}


$fn = $preview ? fn_rounding_preview: fn_rounding_render;
fn_segments = $preview ? fn_segments_preview : fn_segments_render;
fn_text = $preview ? fn_text_preview : fn_text_render;

rounding_radius = thickness/2;
inner_radius = inner_diameter/2;
ring_offset = inner_radius+rounding_radius;

growing_height = max_height-min_height;
max_offset = max_height/2-rounding_radius;
min_offset = min_height/2-rounding_radius;
growing_offset = growing_height/2;

stepsize_default = 360/fn_segments;

stop_angle = 2*asin((faceplate_width/2)/sqrt(ring_offset^2+(faceplate_width/2)^2));
growing_ratio = (180-stop_angle)/180;
stepsize_growing = (180-stop_angle)/ceil((180-stop_angle)/stepsize_default);
startstep_growing = -180+stop_angle;
laststep_growing = 180-stop_angle-stepsize_growing;

stepsize_faceplate = stop_angle/ceil(stop_angle/stepsize_default);
startstep_faceplate_half_1 = 180-stop_angle;
stopstep_faceplate_half_1 = 180-stepsize_faceplate/2;
startstep_faceplate_half_2 = 180;
stopstep_faceplate_half_2 = 180+stop_angle-stepsize_faceplate/2;

faceplate_position_x = cos(startstep_faceplate_half_2)*ring_offset;
faceplate_position_y = sin(startstep_faceplate_half_2)*ring_offset;

faceplate_offset = faceplate_width/2-rounding_radius;
faceplate_offset_half_1 = faceplate_offset;
faceplate_offset_half_2 = -faceplate_offset;

text_size = max_height*text_size_ratio;
text_width = text_size*text_width_ratio;
text_depth = 0.5*thickness;

outer_diameter = inner_diameter+2*thickness;

module growing_faceplate_ring(){
    union(){
	union(){
	    for(i=[startstep_growing:stepsize_growing:laststep_growing]){
		hull(){
		    translate([cos(i)*ring_offset, sin(i)*ring_offset, min_offset+(cos((i-startstep_growing)/growing_ratio)+1)/2*growing_offset])
		    sphere(r=rounding_radius);
		    translate([cos(i)*ring_offset, sin(i)*ring_offset, -min_offset-(cos((i-startstep_growing)/growing_ratio)+1)/2*growing_offset])
		    sphere(r=rounding_radius);
		    translate([cos(i+stepsize_growing)*ring_offset, sin(i+stepsize_growing)*ring_offset, min_offset+(cos((i+stepsize_growing-startstep_growing)/growing_ratio)+1)/2*growing_offset])
		    sphere(r=rounding_radius);
		    translate([cos(i+stepsize_growing)*ring_offset, sin(i+stepsize_growing)*ring_offset, -min_offset-(cos((i+stepsize_growing-startstep_growing)/growing_ratio)+1)/2*growing_offset])
		    sphere(r=rounding_radius);
		}
	    }
	}
	union(){
	    for(i=[startstep_faceplate_half_1:stepsize_faceplate:stopstep_faceplate_half_1]){
		hull(){
		    translate([cos(i)*ring_offset, sin(i)*ring_offset, max_offset])
		    sphere(r=rounding_radius);
		    translate([cos(i)*ring_offset, sin(i)*ring_offset, -max_offset])
		    sphere(r=rounding_radius);
		    translate([cos(i+stepsize_faceplate)*ring_offset, sin(i+stepsize_faceplate)*ring_offset, max_offset])
		    sphere(r=rounding_radius);
		    translate([cos(i+stepsize_faceplate)*ring_offset, sin(i+stepsize_faceplate)*ring_offset, -max_offset])
		    sphere(r=rounding_radius);
		    translate([faceplate_position_x, faceplate_position_y+faceplate_offset_half_1, max_offset])
		    sphere(r=rounding_radius);
		    translate([faceplate_position_x, faceplate_position_y+faceplate_offset_half_1, -max_offset])
		    sphere(r=rounding_radius);
		}
	    }
	}
	union(){
	    for(i=[startstep_faceplate_half_2:stepsize_faceplate:stopstep_faceplate_half_2]){
		hull(){
		    translate([cos(i)*ring_offset, sin(i)*ring_offset, max_offset])
		    sphere(r=rounding_radius);
		    translate([cos(i)*ring_offset, sin(i)*ring_offset, -max_offset])
		    sphere(r=rounding_radius);
		    translate([cos(i+stepsize_faceplate)*ring_offset, sin(i+stepsize_faceplate)*ring_offset, max_offset])
		    sphere(r=rounding_radius);
		    translate([cos(i+stepsize_faceplate)*ring_offset, sin(i+stepsize_faceplate)*ring_offset, -max_offset])
		    sphere(r=rounding_radius);
		    translate([faceplate_position_x, faceplate_position_y+faceplate_offset_half_2, max_offset])
		    sphere(r=rounding_radius);
		    translate([faceplate_position_x, faceplate_position_y+faceplate_offset_half_2, -max_offset])
		    sphere(r=rounding_radius);
		}
	    }
	}
    }
}

module basic_ring(){
    linear_extrude(max_height){
	difference(){
	    circle(d=outer_diameter, $fn=fn_segments);
	    circle(d=inner_diameter, $fn=fn_segments);
	}
    }
}

module rounded_ring(){
    union(){
	for(i=[0:stepsize_default:360-stepsize_default]){
	    hull(){
		translate([cos(i)*ring_offset, sin(i)*ring_offset, 0])
		sphere(r=rounding_radius);
		translate([cos(i+stepsize_default)*ring_offset, sin(i+stepsize_default)*ring_offset, 0])
		sphere(r=rounding_radius);
		translate([cos(i)*ring_offset, sin(i)*ring_offset, max_height])
		sphere(r=rounding_radius);
		translate([cos(i+stepsize_default)*ring_offset, sin(i+stepsize_default)*ring_offset, max_height])
		sphere(r=rounding_radius);
	    }
	}
    }
}

module basic_faceplate_ring(overwrite_faceplate_width=0){
    used_faceplate_width = overwrite_faceplate_width!=0?overwrite_faceplate_width:faceplate_width;
    linear_extrude(max_height){
	difference(){
	    hull(){
		circle(d=outer_diameter, $fn=fn_segments);
		translate([-ring_offset,0,0])
		square([thickness, used_faceplate_width], center=true);
	    }
	    circle(d=inner_diameter, $fn=fn_segments);
	}
    }
}

module size_test_ring(){
    difference(){
        basic_faceplate_ring(text_width);
        translate([-outer_diameter/2+text_depth,0,max_height/2])
        rotate([90,0,-90])
        linear_extrude(text_depth)
        text(str(inner_diameter), size=text_size, $fn=fn_text, halign="center", valign="center");
    }
}

if (ring == "growing_faceplate")
    growing_faceplate_ring();
else if (ring == "basic")
    basic_ring();
else if (ring == "basic_rounded")
    rounded_ring();
else if (ring == "basic_faceplate")
    basic_faceplate_ring();
else if (ring == "size_test")
    size_test_ring();

