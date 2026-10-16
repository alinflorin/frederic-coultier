module esp32_wroom_32(pcb_zofs = 5,anchor=CENTER,spin=0,orient=UP) {
    h = $parent_size.z;
    gap_hole_y=47;
    gap_hole_x=23.5;
    d_hole=3.1;
    pcb = [28.5,51.8,1.5];
    usbc = [9,6.5,3.25];
    hole_gap_y=(pcb.y-gap_hole_y)/2;
    hole_gap_x=(pcb.x-gap_hole_x)/2;
    hole_pos = [
                [hole_gap_x, pcb.y-hole_gap_y],
                [pcb.x-hole_gap_x, pcb.y-hole_gap_y],
                [pcb.x-hole_gap_x, hole_gap_y],
                [hole_gap_x, hole_gap_y]
                ];
    module esp32_preview() {
        box_preview("#44ba")
        diff() cuboid(pcb,rounding=3.4,edges=[BACK+LEFT,BACK+RIGHT],anchor=FRONT+BOTTOM+LEFT) {
            up(0.001) recolor("#aaba") tag("keep") {
                position(FRONT+CENTER+BOT) 
                    cuboid(usbc,anchor=TOP+CENTER+FRONT, rounding=1.2, edges="Y");
            }
            tag("remove") {
                for(p = hole_pos)
                    move(p) position(FRONT+LEFT) cyl(d=2.3,h=pcb.z*2);

            }
        }
    }

    module esp32_standoff(pin=true) box_standoff_clamp(h=pcb_zofs,id=d_hole,od=4,pin_h=pin?3:false,fillet=1.5,gap=pcb.z) children();

    sz = [pcb.x,pcb.y,h];
    attachable(anchor,spin,orient,size=sz,cp=[sz.x/2,sz.y/2,0]) {
        union() {
            for(p = hole_pos)
                move(p) esp32_standoff(true);
            
            //move([7,2.9]) #esp32_standoff(false);
            //move([pcb.x-3.2,pcb.y-3.2]) esp32_standoff(false);
        }

        union() {
            up(pcb_zofs+0.001) box_part(BOT,FRONT+LEFT) esp32_preview();

            //move([13.75,-0.002,pcb_zofs+usb.z/2+pcb.z]) 
            up(pcb_zofs-usbc.z/2+pcb.z-0.2) position(BOT+FRONT+CENTER) {
                box_part(FRONT,undef) box_cutout(rect([usbc.x+0.4,usbc.z+0.4],rounding=0.7));
            }
            children();
        }
    }
}