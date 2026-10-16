
//qapass 1602a
// see 
// - https://docs.arduino.cc/learn/electronics/lcd-displays/
// - https://funduino.de/DL/1602LCD.pdf
module qapass_1602a_led(anchor=CENTER,spin=0,orient=UP) {
    gap=7;
    h = $parent_size.z;
    h2 = h-gap;
    led_w=70.7;
    led_h=23.8;
    plate_w=80;
    plate_h=36;
    scr_sz = [led_w + 1 , led_h + 0.6];
    ofs = 0;
    holes_dist_x = 75.4;
    holes_dist_y = 31.4;
    module oled_preview() {
        box_preview("#44ba")
        back(ofs) up(h2) diff() cube([plate_w, plate_h, 1.6],anchor=BOTTOM) {
            up(1) position(TOP+CENTER)
                recolor("#0007") cube([led_w,led_h,1.5],anchor=BOTTOM+CENTER);
            
        }
    }

    component(anchor,spin,orient,size=[scr_sz.x,scr_sz.y,h]) {
        box_half(BOT)
            back(ofs)
                for(y = [-holes_dist_y/2,holes_dist_y/2])
                    for(x = [-holes_dist_x/2,holes_dist_x/2])
                        right(x) fwd(y) box_pos() 
                            standoff(h=h2,od=4,id=2.9,depth = -2, iround=0.25, fillet=2);


        box_part(TOP) box_cutout(rect(scr_sz,rounding=1),chamfer=0.75);

        box_part(BOT) up(0.001) oled_preview();
        children();
    }
}
