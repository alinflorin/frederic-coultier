# Using the 2D Subsystem

Source: https://en.wikibooks.org/wiki/OpenSCAD_User_Manual/Using_the_2D_Subsystem

#  [2D Primitives](https://en.wikibooks.org/wiki/OpenSCAD_User_Manual/2D_Primitives)

All 2D primitives can be transformed with 3D transformations. They are usually used as part of a 3D extrusion. Although they are infinitely thin, they are rendered with a 1-unit thickness.

**Note**: Trying to subtract with `difference()` from 3D object will lead to unexpected results in final rendering.

### square

Creates a square or rectangle in the first quadrant. When `center` is true the square is centered on the origin. Argument names are optional if given in the order shown here.

```
square(size = [x, y], center = true/false);
square(size =  x    , center = true/false);

```

 ** parameters**: **size** single value, square with both sides this length 2 value array [x,y], rectangle with dimensions x and y **center** **false** (default), 1st (positive) quadrant, one corner at (0,0) **true**, square is centered at (0,0)

```
default values:  square();   yields:  square(size = [1, 1], center = false);

```

 ** examples**:

```
equivalent scripts for this example
 square(size = 10);
 square(10);
 square([10,10]);
 .
 square(10,false);
 square([10,10],false);
 square([10,10],center=false);
 square(size = [10, 10], center = false);
 square(center = false,size = [10, 10] );

```

```
equivalent scripts for this example
 square([20,10],true);
 a=[20,10];square(a,true);

```

### circle

Creates a circle at the origin. All parameters, except r, **must** be named.

```
circle(r=radius | d=diameter);

```

 **Parameters** **r** : circle radius. r name is the only one optional with circle. circle resolution is based on size, using $fa or $fs. For a small, high resolution circle you can make a large circle, then scale it down, or you could set $fn or other special variables. Note: These examples exceed the resolution of a 3d printer as well as of the display screen.

```
scale([1/100, 1/100, 1/100]) circle(200); // create a high resolution circle with a radius of 2.
circle(2, $fn=50);                        // Another way.

```

 **d** : circle diameter (only available in versions later than 2014.03). **$fa** : minimum angle (in degrees) of each fragment. **$fs** : minimum circumferential length of each fragment. **$fn** : **fixed** number of fragments in 360 degrees. Values of 3 or more override $fa and $fs. If they are used, $fa, $fs and $fn must be named parameters. [click here for more details,](https://en.wikibooks.org/wiki/OpenSCAD_User_Manual/Other_Language_Features).

```
defaults:  circle(); yields:  circle($fn = 0, $fa = 12, $fs = 2, r = 1);

```

Equivalent scripts for this example

```
 circle(10);
 circle(r=10);
 circle(d=20);
 circle(d=2+9*2);

```

#### Ellipses

An ellipse can be created from a circle by using either `scale()` or `resize()` to make the x and y dimensions unequal. See [OpenSCAD User Manual/Transformations](https://en.wikibooks.org/wiki/OpenSCAD_User_Manual/Transformations)

```
equivalent scripts for this example
 resize([30,10])circle(d=20);
 scale([1.5,.5])circle(d=20);

```

#### Regular Polygons

A regular polygon of 3 or more sides can be created by using `circle()` with $fn set to the number of sides. The following two pieces of code are equivalent.

```
 circle(r=1, $fn=4);

```

```
 module regular_polygon(order = 4, r=1){
     angles=[ for (i = [0:order-1]) i*(360/order) ];
     coords=[ for (th=angles) [r*cos(th), r*sin(th)] ];
     polygon(coords);
 }
 regular_polygon();

```

These result in the following shapes, where the polygon is inscribed within the circle with all sides (and angles) equal. One corner points to the positive x direction. For irregular shapes see the polygon primitive below.

```
script for these examples
 translate([-42,  0]){circle(20,$fn=3);%circle(20,$fn=90);}
 translate([  0,  0]) circle(20,$fn=4);
 translate([ 42,  0]) circle(20,$fn=5);
 translate([-42,-42]) circle(20,$fn=6);
 translate([  0,-42]) circle(20,$fn=8);
 translate([ 42,-42]) circle(20,$fn=12);

 color("black"){
     translate([-42,  0,1])text("3",7,,center);
     translate([  0,  0,1])text("4",7,,center);
     translate([ 42,  0,1])text("5",7,,center);
     translate([-42,-42,1])text("6",7,,center);
     translate([  0,-42,1])text("8",7,,center);
     translate([ 42,-42,1])text("12",7,,center);
 }

```

### polygon

Creates a multiple sided shape from a list of x,y coordinates. A polygon is the most powerful 2D object. It can create anything that circle and squares can, as well as much more. This includes irregular shapes with both concave and convex edges. In addition it can place holes within that shape.

```
polygon(points = [ [x, y], ... ], paths = [ [p1, p2, p3..], ...], convexity = N);

```

 Parameters **points** The list of x,y points of the polygon. : A vector of 2 element vectors. Note: points are indexed from 0 to n-1. **paths** default If no path is specified, all points are used in the order listed. single vector The order to traverse the points. Uses indices from 0 to n-1. May be in a different order and use all or part, of the points listed. multiple vectors Creates primary and secondary shapes. Secondary shapes are subtracted from the primary shape (like `difference()`). Secondary shapes may be wholly or partially within the primary shape. A closed shape is created by returning from the last point specified to the first. **convexity** Integer number of "inward" curves, ie. expected path crossings of an arbitrary line through the polygon. See below.

```
defaults:   polygon();  yields:  polygon(points = undef, paths = undef, convexity = 1);

```

#### Without holes

```
equivalent scripts for this example
 polygon(points=[[0,0],[100,0],[130,50],[30,50]]);
 polygon([[0,0],[100,0],[130,50],[30,50]], paths=[[0,1,2,3]]);
 polygon([[0,0],[100,0],[130,50],[30,50]],[[3,2,1,0]]);
 polygon([[0,0],[100,0],[130,50],[30,50]],[[1,0,3,2]]);

 a=[[0,0],[100,0],[130,50],[30,50]];
 b=[[3,0,1,2]];
 polygon(a);
 polygon(a,b);
 polygon(a,[[2,3,0,1,2]]);

```

#### One hole

```
equivalent scripts for this example
 polygon(points=[[0,0],[100,0],[0,100],[10,10],[80,10],[10,80]], paths=[[0,1,2],[3,4,5]],convexity=10);

 triangle_points =[[0,0],[100,0],[0,100],[10,10],[80,10],[10,80]];
 triangle_paths =[[0,1,2],[3,4,5]];
 polygon(triangle_points,triangle_paths,10);

```

The 1st path vector, [0,1,2], selects the points, [0,0],[100,0],[0,100], for the primary shape. The 2nd path vector, [3,4,5], selects the points, [10,10],[80,10],[10,80], for the secondary shape. The secondary shape is subtracted from the primary ( think `[difference()](https://en.wikibooks.org/wiki/OpenSCAD_User_Manual/CSG_Modelling#difference)` ). Since the secondary is wholly within the primary, it leaves a shape with a hole.

#### Multi hole

[Note: Requires version 2015.03] (for use of `concat()`)

```
      //example polygon with multiple holes
a0 = [[0,0],[100,0],[130,50],[30,50]];     // main
b0 = [1,0,3,2];
a1 = [[20,20],[40,20],[30,30]];            // hole 1
b1 = [4,5,6];
a2 = [[50,20],[60,20],[40,30]];            // hole 2
b2 = [7,8,9];
a3 = [[65,10],[80,10],[80,40],[65,40]];    // hole 3
b3 = [10,11,12,13];
a4 = [[98,10],[115,40],[85,40],[85,10]];   // hole 4
b4 = [14,15,16,17];
a  = concat (a0,a1,a2,a3,a4);
b  = [b0,b1,b2,b3,b4];
polygon(a,b);
      //alternate
polygon(a,[b0,b1,b2,b3,b4]);

```

#### Extruding a 3D shape from a polygon

```
   translate([0,-20,10]) {
       rotate([90,180,90]) {
           linear_extrude(50) {
               polygon(
                   points = [
                      //x,y
                       /*
                                  O  .
                       */
                       [-2.8,0],
                       /*
                                O__X  .
                       */
                       [-7.8,0],
                       /*
                              O
                               \
                                X__X  .
                       */
                       [-15.3633,10.30],
                       /*
                              X_______._____O
                               \
                                X__X  .
                       */
                       [15.3633,10.30],
                       /*
                              X_______._______X
                               \             /
                                X__X  .     O
                       */
                       [7.8,0],
                       /*
                              X_______._______X
                               \             /
                                X__X  .  O__X
                       */
                       [2.8,0],
                       /*
                           X__________.__________X
                            \                   /
                             \              O  /
                              \            /  /
                               \          /  /
                                X__X  .  X__X
                       */
                       [5.48858,5.3],
                       /*
                           X__________.__________X
                            \                   /
                             \   O__________X  /
                              \            /  /
                               \          /  /
                                X__X  .  X__X
                       */
                       [-5.48858,5.3],
                                   ]
                               );
                           }
       }
   }

```

#### convexity

The convexity parameter specifies the maximum number of front sides (back sides) a ray intersecting the object might penetrate. This parameter is needed only for correct display of the object in OpenCSG preview mode and has no effect on the polyhedron rendering.

This image shows a 2D shape with a convexity of 2, as the ray indicated in red crosses the 2D shapes outside⇒inside (or inside⇒outside) a maximum of 2 times. The convexity of a 3D shape would be determined in a similar way. Setting it to 10 should work fine for most cases.

### import_dxf

[Deprecated: import_dxf() is deprecated and will be removed in a future release. Use [import()](https://en.wikibooks.org/wiki/OpenSCAD_User_Manual/The_OpenSCAD_Language#import) instead.** ]**

Read a DXF file and create a 2D shape.

**Example**

```
linear_extrude(height = 5, center = true, convexity = 10)
		import_dxf(file = "example009.dxf", layer = "plate");

```

#  [Text](https://en.wikibooks.org/wiki/OpenSCAD_User_Manual/Text)

## text()

The `text` module creates text as a 2D geometric object, using fonts installed on the local system or provided as separate font file.

[Note: Requires version 2015.03]

### Parameters

 text String. The text to generate. size Number. In a western script, capital letters will be approximately this tall. Default is 10. Sets the em size of the font to 100/72 times the value specified. See **em** and the note on font sizes below. font String. The name of the font that should be used. This is not the name of the font file, but the logical font name (internally handled by the fontconfig library). This can also include a style parameter, see below. A list of installed fonts & styles can be obtained using the font list dialog (in the **Help** or **Windows** menu, depending on version). The default is "Liberation Sans". direction String. Direction of the text flow. Possible values are "ltr" (left-to-right), "rtl" (right-to-left), "ttb" (top-to-bottom) and "btt" (bottom-to-top). Default is "ltr". language String. The language of the text (e.g., "en", "ar", "ch"). Default is "en". script String. The script of the text (e.g., "latin", "arabic", "hani"). Default is "latin". halign String. The horizontal alignment for the text. Possible values are "left", "center" and "right". Default is "left". valign String. The vertical alignment for the text. Possible values are "top", "center", "baseline" and "bottom". Default is "baseline". spacing Number. Factor to increase/decrease the character spacing. The default value of 1 results in the normal spacing for the font, giving a value greater than 1 causes the letters to be spaced further apart. em Number. Specifies the size of an em-square. This is the conventional measurement used for font sizing; see the note on font sizing below. [Note: Requires version Development snapshot] $fn, $fs, and $fa used for subdividing curved segments of the glyphs.

**Example**

 _example.png)Example 1: Result.

```
text("OpenSCAD");

```

### Alignment

#### Vertical alignment

 top The text is aligned so the top of the tallest character in your text is at the given Y coordinate. center The text is aligned with the center of the bounding box at the given Y coordinate. This bounding box is based on the actual sizes of the letters, so taller letters and descenders will affect the positioning. baseline The text is aligned with the font baseline at the given Y coordinate. This is the default, and is the only option that makes *different* pieces of text align vertically, as if they were written on lined paper, regardless of character heights and descenders. bottom The text is aligned so the bottom of the lowest-reaching character in your text is at the given Y coordinate. OpenSCAD vertical text alignment

```
 text = "Align";
 font = "Liberation Sans";

 valign = [
   [  0, "top"],
   [ 40, "center"],
   [ 75, "baseline"],
   [110, "bottom"]
 ];

 for (a = valign) {
   translate([10, 120 - a[0], 0]) {
     color("red") cube([135, 1, 0.1]);
     color("blue") cube([1, 20, 0.1]);
     linear_extrude(height = 0.5) {
       text(text = str(text,"_",a[1]), font = font, size = 20, valign = a[1]);
     }
   }
 }

```

The `text()` module doesn't support multi-line text, but you can make a separate call for each line, using `translate()` to space them. A spacing of 1.4***size** is the minimum required to prevent lines overlapping (if they include descenders). 1.6***size** is approximately the default single-spacing in many word processing programs. To get evenly spaced lines, use "baseline" vertical alignment; otherwise, lines may be lower or higher depending on their contents.

#### Horizontal alignment

 left The text is aligned with the left side of the bounding box at the given X coordinate. This is the default. center The text is aligned with the center of the bounding box at the given X coordinate. right The text is aligned with the right of the bounding box at the given X coordinate. OpenSCAD horizontal text alignment

```
 text = "Align";
 font = "Liberation Sans";

 halign = [
   [10, "left"],
   [50, "center"],
   [90, "right"]
 ];

 for (a = halign) {
   translate([140, a[0], 0]) {
     color("red") cube([115, 2,0.1]);
     color("blue") cube([2, 20,0.1]);
     linear_extrude(height = 0.5) {
       text(text = str(text,"_",a[1]), font = font, size = 20, halign = a[1]);
     }
   }
 }

```

### Using Fonts & Styles

Fonts are specified by their logical font name; in addition a style parameter can be added to select a specific font style like "**bold**" or "*italic*", such as:

```
font="Liberation Sans:style=Bold Italic"

```

The font list dialog (in the **Help** or **Windows** menu, depending on version) shows the font name and the font style for each available font. For reference, the dialog also displays the location of the font file. You can drag a font in the font list into the editor window to use in the text() statement.

 OpenSCAD font list dialog

OpenSCAD includes the fonts *Liberation Mono*, *Liberation Sans*, and *Liberation Serif*. Hence, as fonts in general differ by platform type, use of these included fonts is likely to be portable across platforms.

For common/casual text usage, the specification of one of these fonts is **recommended** for this reason. Liberation Sans is the default font to encourage this.

In addition to the installed fonts ( for windows only fonts installed as admin for all users ), it's possible to add project specific font files. Supported font file formats are [TrueType](https://en.wikipedia.org/wiki/TrueType) Fonts (*.ttf) and [OpenType](https://en.wikipedia.org/wiki/OpenType) Fonts (*.otf). The files need to be registered with use<>.

```
 use <ttf/paratype-serif/PTF55F.ttf>

```

After the registration, the font is listed in the font list dialog, so in case logical name of a font is unknown, it can be looked up as it was registered.

**Example**

 _font_style_example.png)Example 2: Result.

```
 square(10);

 translate([15, 15]) {
   text("OpenSCAD", font = "Liberation Sans");
 }

 translate([15, 0]) {
   text("OpenSCAD", font = "Liberation Sans:style=Bold Italic");
 }

```

## Metrics

[Note: Requires version Development snapshot]

### textmetrics()

The `textmetrics()` function accepts the same parameters as `text()`, and returns an [object](https://en.wikibooks.org/wiki/OpenSCAD_User_Manual/General#Objects) describing how the text would be rendered.

The returned object has these members:

- **position**: the position of the lower-left corner of the generated text.
- **size**: the size of the generated text.
- **ascent**: the amount that the text extends above the baseline.
- **descent**: the amount that the text extends below the baseline.
- **offset**: the origin of the text after aligning. Text typically starts slightly right of this point.
- **advance**: the "other end" of the text, the point at which additional text should be positioned, relative to "offset". Text generally ends slightly left of this point.

```
   s = "Hello, World!";
   size = 20;
   font = "Liberation Serif";

   tm = textmetrics(s, size=size, font=font);
   echo(tm);
   translate([0,0,1]) text("Hello, World!", size=size, font=font);
   color("black") translate(tm.position) square(tm.size);

```

yields (reformatted for readability):

 Using textmetrics() to draw a box around text

```
   ECHO: {
       position = [0.7936, -4.2752];
       size = [149.306, 23.552];
       ascent = 19.2768;
       descent = -4.2752;
       offset = [0, 0];
       advance = [153.09, 0];
   }

```

### fontmetrics()

The `fontmetrics()` function accepts a font size and a font name, both optional, and returns an [object](https://en.wikibooks.org/wiki/OpenSCAD_User_Manual/General#Objects) describing global characteristics of the font.

**Parameters**

 size Number, optional. The approximate height of capital letters, as described above for `text()`. font String, optional. The name of the font, as described above. em Number, optional. The font size, the size of the em-square, as described above.

Note that omitting the size and/or font may be useful to get information about the default font.

Returns an object:

- **nominal**: usual dimensions for a glyph:

  - **ascent**: height above the baseline
  - **descent**: depth below the baseline

- **max**: maximum dimensions for a glyph:

  - **ascent**: height above the baseline
  - **descent**: depth below the baseline

- **interline**: design distance from one baseline to the next
- **font**: identification information about the font:

  - **family**: the font family name
  - **style**: the style (Regular, Italic, et cetera)

```
   echo(fontmetrics(font="Liberation Serif"));

```

yields (reformatted for readability):

```
   ECHO: {
       nominal = {
           ascent = 12.3766;
           descent = -3.0043;
       };
       max = {
           ascent = 13.6312;
           descent = -4.2114;
       };
       interline = 15.9709;
       font = {
           family = "Liberation Serif";
           style = "Regular";
       };
   }

```

## Notes

### Font sizing

#### Parameters: size and em

**size** sets the size of the text in a convenient way: it sets, approximately, the height of a capital letter in a western script.

**em** sets the size of the text in the industry-standard way: it sets the size of the [em-square](https://en.wikipedia.org/wiki/Em_(typography)).

If you try to precisely correlate either of these measurements to any particular dimension of the generated text, you are likely to be unsatisfied.

**size** is based on a miscalculation that is now maintained for compatibility. By accident, the result is that **size** approximately sets the size of capital letters. Fonts vary and may be a different height, typically slightly smaller.

**em** is the conventional way to specify font size. Its behavior - its relationship with other measurements - matches the behavior seen in other applications and typography conventions. However, because historically it specified the size of the block of metal used to print the text, it's considerably larger than most letters. The exact relationship between the nominal font size and the actual size of glyphs depends on the design of the font. For most western fonts, the height of capital letters is about 70% of the font size.

**textmetrics()** can be used to measure the dimensions of any particular text; **fontmetrics()** will return general information about the font. You can use those results to scale when you need the actual text to be a particular size.

#### Units: points, millimeters, or...?

A common point of confusion is in the units used to specify font sizes. Conventional usage specifies font sizes in points, at 72 points per inch. This yields convenient numbers like 10 for typical text sizes, but there is nothing special about points; those sizes could equally be specified in inches, millimeters, or miles.

OpenSCAD has no units. There may be units specified in exported file formats, or inferred by downstream tools, but OpenSCAD proper does not define how large a 10-unit cube is in physical units. Similarly, the size of text in OpenSCAD is specified in OpenSCAD units - which might be interpreted as millimeters or feet. If you use **em** to specify a font size of 10, you will typically get text where, as noted above, capital letters are about 7 units tall.

It is common for users to interpret OpenSCAD units as millimeters. When interpreting OpenSCAD units as millimeters, if you want to specify text sizes in points you'll want to multiply the desired size in points by 25.4/72 to get the equivalent size in millimeters.

### 3D text

 3D text example

Text can be changed from a 2 dimensional object into a 3D object by using [linear_extrude](https://en.wikibooks.org/wiki/OpenSCAD_User_Manual/2D_to_3D_Extrusion#Linear_Extrude).

```
//3d Text Example
linear_extrude(4)
    text("Text");

```

### Unicode

To allow specification of particular [Unicode](https://en.wikipedia.org/wiki/Unicode) characters, you can specify them in a string with the following escape codes;

- `\x*03 *` - hex char-value (only hex values from `01` to `7f` are supported)
- `\u*0123 *` - Unicode char with 4 hexadecimal digits (note: lowercase `\u`)
- `\U*012345*` - Unicode char with 6 hexadecimal digits (note: uppercase `\U`)

The null character (NUL) is mapped to the space character (SP).

```
 assert(version() == [2019, 5, 0]);
 assert(ord(" ") == 32);
 assert(ord("\x00") == 32);
 assert(ord("\u0000") == 32);
 assert(ord("\U000000") == 32);

```

**Example**

```
t="\u20AC10 \u263A"; // 10 euro and a smiley

```

### Font management

OpenSCAD uses fontconfig to find and manage fonts, so it's possible to list the system configured fonts on command line using the fontconfig tools in a format similar to the GUI dialog.

```
$ fc-list -f "%-60{{%{family[0]}%{:style[0]=}}}%{file}\n" | sort

...
Liberation Mono:style=Bold Italic /usr/share/fonts/truetype/liberation2/LiberationMono-BoldItalic.ttf
Liberation Mono:style=Bold        /usr/share/fonts/truetype/liberation2/LiberationMono-Bold.ttf
Liberation Mono:style=Italic      /usr/share/fonts/truetype/liberation2/LiberationMono-Italic.ttf
Liberation Mono:style=Regular     /usr/share/fonts/truetype/liberation2/LiberationMono-Regular.ttf
...

```

Under Windows, fonts are stored in the Windows Registry. To get a file with the font file names, use the command:

`reg query "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Fonts" /s > List_Fonts_Windows.txt`

#  [3D to 2D Projection](https://en.wikibooks.org/wiki/OpenSCAD_User_Manual/3D_to_2D_Projection)

Using `projection()`, you can create 2d drawings from 3d models, and export them to the dxf format. It works by projecting a 3D model to the (x,y) plane, with z at 0. If `cut=true`, only points with z=0 are considered (effectively cutting the object), with `cut=false`(*the default*), points above and below the plane are considered as well (creating a proper projection).

**Example**: Consider example002.scad, that comes with OpenSCAD.

Then you can do a 'cut' projection, which gives you the 'slice' of the x-y plane with z=0.

```
projection(cut = true) example002();

```

You can also do an 'ordinary' projection, which gives a sort of 'shadow' of the object onto the xy plane.

```
projection(cut = false) example002();

```

**Another Example**

You can also use projection to get a 'side view' of an object. Let's take example002, rotate it, and move it up out of the X-Y plane:

```
translate([0,0,25]) rotate([90,0,0]) example002();

```

Now we can get a side view with projection()

```
projection() translate([0,0,25]) rotate([90,0,0]) example002();

```

Links:

- [More complicated example](http://www.gilesbathgate.com/2010/06/extracting-2d-mendel-outlines-using-openscad/) from Giles Bathgate's blog

#  [2D to 3D Extrusion](https://en.wikibooks.org/wiki/OpenSCAD_User_Manual/2D_to_3D_Extrusion)

[Extrusion](https://en.wikipedia.org/wiki/Extrusion) is the process of creating an object with a fixed cross-sectional profile. OpenSCAD provides two commands to create 3D solids from a 2D shape: linear_extrude() and rotate_extrude(). Linear extrusion is similar to pushing Playdoh through a press with a die of a specific shape.

 linear_extrude() works like a Playdoh extrusion press

Rotational extrusion is similar to the process of [turning](https://en.wikipedia.org/wiki/Turning) or "throwing" a bowl on the [Potter's wheel](https://en.wikipedia.org/wiki/Potter%27s_wheel).

 rotate_extrude() emulates throwing a vessel

Both extrusion methods work on a (possibly disjointed) 2D shape which exists on the X-Y plane. While transformations that operates on both 2D shapes and 3D solids can move a shape off the X-Y plane, when the extrusion is performed the end result is not very intuitive. What actually happens is that any information in the third coordinate (the Z coordinate) is ignored for any 2D shape, this process amounts to an implicit [projection()](https://en.wikibooks.org/wiki/OpenSCAD_User_Manual/3D_to_2D_Projection) performed on any 2D shape before the extrusion is executed. It is recommended to perform extrusion on shapes that remains strictly on the X-Y plane.

### linear_extrude

Linear Extrusion is an operation that takes a 2D object as input and generates a 3D object as a result.

Extrusion follows the **V** vector which defaults to the **Z** axis, for specifying a custom value a version > 2021.01 is needed.

In OpenSCAD Extrusion is always performed on the projection (shadow) of the 2d object xy plane; so if you rotate or apply other transformations to the 2d object before extrusion, its shadow shape is what is extruded.

Although the extrusion is linear along the **V** vector, a twist parameter is available that causes the object to be rotated around the **V** vector as it is extruding upward. This can be used to rotate the object at its center, as if it is a spiral pillar, or produce a helical extrusion around the **V** vector, like a pig's tail.

A scale parameter is also included so that the object can be expanded or contracted over the extent of the extrusion, allowing extrusions to be flared inward or outward.

#### Usage

```
linear_extrude(height = 5, v = [0, 0, 1], center = true, convexity = 10, twist = -fanrot, slices = 20, scale = 1.0, $fn = 16) {...}

```

You must use parameter names due to a backward compatibility issue.

 **height** : The extrusion height. **center** : If true, the solid is centered after extrusion. **twist** : The extrusion twist in degrees. **scale** : Scales the 2D shape by this value over the height of the extrusion. **slices** : Similar to special variable $fn without being passed down to the child 2D shape. **segments** : Similar to slices but adding points on the polygon's segments without changing the polygon's shape. **convexity** : If parts of the model appear to be transparent, it may be because the preview needs a hint about the shape and you need to set the [convexity parameter](https://en.wikibooks.org/wiki/OpenSCAD_User_Manual/FAQ#Why_are_some_parts_(e.g._holes)_of_the_model_not_rendered_correctly?). 10 is a good value to try.

 `height` must be positive.

`v` is a 3D vector that must point into positive Z direction [Note: Requires version Development snapshot]

`$fn` is optional and specifies the resolution of the linear_extrude (higher number brings more "smoothness", but more computation time is needed).

If the extrusion fails for a non-trivial 2D shape, try setting the convexity parameter (the default is not 10, but 10 is a "good" value to try). See explanation further down.

#### Twist

Twist is the number of degrees of through which the shape is extruded. Setting the parameter twist = 360 extrudes through one revolution. The twist direction follows the left hand rule.

**0° of Twist**

```
linear_extrude(height = 10, center = true, convexity = 10, twist = 0)
translate([2, 0, 0])
circle(r = 1);

```

**-100° of Twist**

```
linear_extrude(height = 10, center = true, convexity = 10, twist = -100)
translate([2, 0, 0])
circle(r = 1);

```

**100° of Twist**

```
linear_extrude(height = 10, center = true, convexity = 10, twist = 100)
translate([2, 0, 0])
circle(r = 1);

```

**-500° of Twist**

```
linear_extrude(height = 10, center = true, convexity = 10, twist = -500)
translate([2, 0, 0])
circle(r = 1);

```

#### Center

It is similar to the parameter center of cylinders. If `center` is false the linear extrusion Z range is from 0 to height; if it is true, the range is from -height/2 to height/2.

**center = true**

```
linear_extrude(height = 10, center = true, convexity = 10, twist = -500)
translate([2, 0, 0])
circle(r = 1);

```

**center = false**

```
linear_extrude(height = 10, center = false, convexity = 10, twist = -500)
translate([2, 0, 0])
circle(r = 1);

```

#### Mesh Refinement

The slices parameter defines the number of intermediate points along the Z axis of the extrusion. Its default increases with the value of twist. Explicitly setting slices may improve the output refinement. Additional the segments parameter adds vertices (points) to the extruded polygon resulting in smoother twisted geometries. Segments need to be a multiple of the polygon's fragments to have an effect (6 or 9.. for a circle($fn=3), 8,12.. for a square() ).

```
linear_extrude(height = 10, center = false, convexity = 10, twist = 360, slices = 100)
translate([2, 0, 0])
circle(r = 1);

```

The [special variables](https://en.wikibooks.org/wiki/OpenSCAD_User_Manual/Other_Language_Features) $fn, $fs and $fa can also be used to improve the output. If slices is not defined, its value is taken from the defined $fn value.

```
linear_extrude(height = 10, center = false, convexity = 10, twist = 360, $fn = 100)
translate([2, 0, 0])
circle(r = 1);

```

#### Scale

Scales the 2D shape by this value over the height of the extrusion. Scale can be a scalar or a vector:

```
 linear_extrude(height = 10, center = true, convexity = 10, scale=3)
 translate([2, 0, 0])
 circle(r = 1);

```

```
 linear_extrude(height = 10, center = true, convexity = 10, scale=[1,5], $fn=100)
 translate([2, 0, 0])
 circle(r = 1);

```

Note that if scale is a vector, the resulting side walls may be nonplanar. Use `twist=0` and the `slices` parameter to avoid [asymmetry](https://github.com/openscad/openscad/issues/1341).

```
 linear_extrude(height=10, scale=[1,0.1], slices=20, twist=0)
 polygon(points=[[0,0],[20,10],[20,-10]]);

```

### Using with imported SVG

A common usage of linear_extrude() is to import a 2D svg

```
 linear_extrude(height = 10, center = true)
 import("knight.svg");

```

### rotate_extrude

Rotational extrusion spins a 2D shape around the Z-axis to form a solid which has rotational symmetry. One way to think of this operation is to imagine a Potter's wheel placed on the X-Y plane with its axis of rotation pointing up towards +Z. Then place the to-be-made object on this virtual Potter's wheel (possibly extending down below the X-Y plane towards -Z). The to-be-made object is the cross-section of the object on the X-Y plane (keeping only the right half, X >= 0). That is the 2D shape that will be fed to rotate_extrude() as the child in order to generate this solid. Note that the object started on the X-Y plane but is tilted up (rotated +90 degrees about the X-axis) to extrude.

Since a 2D shape is rendered by OpenSCAD on the X-Y plane, an alternative way to think of this operation is as follows: spins a 2D shape around the Y-axis to form a solid. The resultant solid is placed so that its axis of rotation lies along the Z-axis.

Just like the linear_extrude, the extrusion is always performed on the projection of the 2D polygon to the XY plane. Transformations like rotate, translate, etc. applied to the 2D polygon before extrusion modify the projection of the 2D polygon to the XY plane and therefore also modify the appearance of the final 3D object.

- A translation in Z of the 2D polygon has no effect on the result (as also the projection is not affected).
- A translation in X increases the diameter of the final object.
- A translation in Y results in a shift of the final object in Z direction.
- A rotation about the X or Y axis distorts the cross section of the final object, as also the projection to the XY plane is distorted.

Don't get confused, as OpenSCAD displays 2D polygons with a certain height in the Z direction, so the 2D object (with its height) appears to have a bigger projection to the XY plane. But for the projection to the XY plane and also for the later extrusion only the base polygon without height is used.

You cannot use rotate_extrude to produce a helix or screw thread. Doing this properly can be difficult, so it's best to find a thread library to make them for you.

The 2D shape **must** lie completely on either the right (recommended) or the left side of the Y-axis. More precisely speaking, **every** vertex of the shape must have either x >= 0 or x <= 0. If the shape spans the X axis a warning appears in the console windows and the rotate_extrude() is ignored. If the 2D shape touches the Y axis, i.e. at x=0, it **must** be a line that touches, not a point, as a point results in a zero thickness 3D object, which is invalid and results in a CGAL error. For OpenSCAD versions prior to 2016.xxxx, if the shape is in the negative axis the resulting faces are oriented inside-out, which may cause undesired effects.

#### Usage

```
rotate_extrude(angle = 360, start=0, convexity = 2) {...}

```

 Right-hand grip rule

In 2021.01 and previous, you must use parameter names due to a backward compatibility issue.

 **angle** [Note: Requires version 2019.05] : Defaults to 360. Specifies the number of degrees to sweep, starting at the positive X axis. The direction of the sweep follows the [ Right Hand Rule](https://en.wikipedia.org/wiki/right-hand_rule), hence a negative angle sweeps clockwise. **start** [Note: Requires version Development snapshot] : Defaults to 0 if **angle** is specified, and 180 if not. Specifies the starting angle of the extrusion, counter-clockwise from the positive X axis. **convexity** : If parts of the model appear to be transparent, it may be because the preview needs a hint about the shape and you need to set the [convexity parameter](https://en.wikibooks.org/wiki/OpenSCAD_User_Manual/FAQ#Why_are_some_parts_(e.g._holes)_of_the_model_not_rendered_correctly?). 10 is a good value to try.

The [standard circular-resolution variables](https://en.wikibooks.org/wiki/OpenSCAD_User_Manual/Other_Language_Features#Circle_resolution:_$fa,_$fs,_and_$fn) control the number of fragments used in the extrusion:

 **$fa** : minimum angle (in degrees) of each fragment. **$fs** : minimum circumferential length of each fragment. **$fn** : **fixed** number of fragments in 360 degrees. Values of 3 or more override $fa and $fs.

#### Examples

A simple torus can be constructed using a rotational extrude.

```
rotate_extrude(convexity = 10)
    translate([2, 0, 0])
        circle(r = 1);

```

→

#### Mesh Refinement

Increasing the number of fragments composing the 2D shape improves the quality of the mesh, but takes longer to render.

```
rotate_extrude(convexity = 10)
    translate([2, 0, 0])
        circle(r = 1, $fn = 100);

```

→

 The number of fragments used by the extrusion can also be increased.

```
rotate_extrude(convexity = 10, $fn = 100)
    translate([2, 0, 0])
        circle(r = 1, $fn = 100);

```

→

#### Extruding a Polygon

Extrusion can also be performed on polygons with points chosen by the user.

Here is a simple polygon and its 200 step rotational extrusion. (Note it has been rotated 90 degrees to show how the rotation appears; the `rotate_extrude()` needs it flat).

```
rotate([90,0,0])        polygon( points=[[0,0],[2,1],[1,2],[1,3],[3,4],[0,5]] );

```

```
rotate_extrude($fn=200) polygon( points=[[0,0],[2,1],[1,2],[1,3],[3,4],[0,5]] );

```

→→

For more information on polygons, please see: [2D Primitives: Polygon](https://en.wikibooks.org/wiki/OpenSCAD_User_Manual/2D_Primitives#polygon).

#### Combining Extrusions

Using the angle parameter [Note: Requires version 2019.05], a hook can be modeled.

```
eps = 0.01;
translate([eps, 60, 0])
    rotate_extrude(angle=270, convexity=10)
        translate([40, 0]) circle(10);
rotate_extrude(angle=90, convexity=10)
    translate([20, 0]) circle(10);
translate([20, eps, 0])
    rotate([90, 0, 0]) cylinder(r=10, h=80+eps);

```

#### Orientation

If you're making a round 360 degree extrusion, it doesn't matter where it starts. If, on the other hand, you're using $fn to make an extrusion with some specific number of sides, it can matter. With an odd number of sides, there will be a vertex on either the left or the right, and a side opposite it.

With **angle** not specified, the extrusion starts along the negative X axis, to the left of the origin. With an odd number of sides, there is a vertex on the left and a side on the right. (Note that this is inconsistent with the behavior for **angle** less than 360, and with the behavior for **circle** and other round primitives.)

With **angle** specified, and not equal to 360, the extrusion starts along the positive X axis, to the right of the origin.

For 2021.01 and earlier, if **angle** is equal to 360, the extrusion starts along the negative X axis, as for **angle** not being specified.

For the development snapshot, if **angle** is 360, the extrusion starts along the positive X axis, as for other cases where **angle** is specified. Explicitly specifying **angle**=360 thus yields results consistent with other round primitives.

A future release may change this behavior so that when **angle** is not specified the extrusion starts along the positive X axis, making all of these cases consistent.

**start** directly controls the start point. [Note: Requires version Development snapshot]

#  [DXF Extrusion](https://en.wikibooks.org/wiki/OpenSCAD_User_Manual/DXF_Extrusion)

With the import() and extrusion modules it is possible to convert 2D objects read from DXF files to 3D objects. See also [2D to 3D Extrusion](https://en.wikibooks.org/wiki/OpenSCAD_User_Manual/2D_to_3D_Extrusion).

### Linear Extrude

Example of linear extrusion of a 2D object imported from a DXF file.

```
linear_extrude(height = fanwidth, center = true, convexity = 10)
   import (file = "example009.dxf", layer = "fan_top");

```

### Rotate Extrude

Example of rotational extrusion of a 2D object imported from a DXF file.

```
rotate_extrude(convexity = 10)
   import (file = "example009.dxf", layer = "fan_side", origin = fan_side_center);

```

### Getting Inkscape to work

Inkscape is an open source drawing program. Tutorials for transferring 2d DXF drawings from Inkscape to OpenSCAD are available here:

- [http://repraprip.blogspot.com/2011/05/inkscape-to-openscad-dxf-tutorial.html](http://repraprip.blogspot.com/2011/05/inkscape-to-openscad-dxf-tutorial.html) (Very simple, needs path segments to be straight lines)
- [http://tonybuser.com/?tag=inkscape](http://web.archive.org/web/20130318112610/http://tonybuser.com/?tag=inkscape) (More complicated, involves conversion to Postscript)
- [http://bobcookdev.com/inkscape/inkscape-dxf.html](http://bobcookdev.com/inkscape/inkscape-dxf.html) (Better DXF Export, native support for bezier curves)
- [http://www.bigbluesaw.com/saw/big-blue-saw-blog/general-updates/big-blue-saws-dxf-export-for-inkscape.html](http://www.bigbluesaw.com/saw/big-blue-saw-blog/general-updates/big-blue-saws-dxf-export-for-inkscape.html) (even better support, works as of 10/29/2014, see link below registration window. Note: As of 6/17/15 only works with version 0.48.5 or earlier of inkscape, due to a breaking change made in 0.91.)
- [http://www.instructables.com/id/Convert-any-2D-image-to-a-3D-object-using-OpenSCAD/](http://www.instructables.com/id/Convert-any-2D-image-to-a-3D-object-using-OpenSCAD/) (Convert any 2D image to a 3D object using OpenSCAD)
- [http://carrefour-numerique.cite-sciences.fr/fablab/wiki/doku.php?id=projets:de_inkscape_a_openscad](http://carrefour-numerique.cite-sciences.fr/fablab/wiki/doku.php?id=projets:de_inkscape_a_openscad) (French, directly exports OpenSCAD file)

## Previous

[CSG Export](https://en.wikibooks.org/wiki/OpenSCAD_User_Manual/CSG_Export)

## Next

[Other 2D formats](https://en.wikibooks.org/wiki/OpenSCAD_User_Manual/Other_2D_formats)
