# rhinoscriptsyntax: document

## CreatePreviewImage

```python
rs.CreatePreviewImage(filename, view=None, size=None, flags=0, wireframe=False)
```

Create a bitmap preview image of the current model

Arguments:

    filename (str): name of the bitmap file to create
    view (str, optional): title of the view. If omitted, the active view is used
    size (number, optional): two integers that specify width and height of the bitmap
    flags (number, optional): Bitmap creation flags. Can be the combination of:
        1 = honor object highlighting
        2 = draw construction plane
        4 = use ghosted shading
    wireframe (bool, optional): If True then a wireframe preview image. If False,
        a rendered image will be created

Returns: bool: True or False indicating success or failure

Example:

```python
import rhinoscriptsyntax as  rs
result = rs.CreatePreviewImage("test.jpg")
if result:
    print( "test.jpg created successfully.")
else:
    print( "Unable to create preview image.")
```

See also: ExtractPreviewImage

## DocumentModified

```python
rs.DocumentModified(modified=None)
```

Returns or sets the document's modified flag. This flag indicates whether
    or not any changes to the current document have been made. NOTE: setting the
    document modified flag to False will prevent the "Do you want to save this
    file..." from displaying when you close Rhino.

Arguments:

    modified (bool): the modified state, either True or False

Returns: bool: if no modified state is specified, the current modified state
bool: if a modified state is specified, the previous modified state

Example:

```python
import rhinoscriptsyntax as rs
modified = rs.IsDocumentModified()
if not modified: rs.DocumentModified(True)
```

See also: IsDocumentModified

## DocumentName

```python
rs.DocumentName()
```

Returns the name of the currently loaded Rhino document (3DM file)

Returns: str: the name of the currently loaded Rhino document (3DM file)

Example:

```python
import rhinoscriptsyntax as rs
name = rs.DocumentName()
print(name)
```

See also: DocumentPath

## DocumentPath

```python
rs.DocumentPath()
```

Returns path of the currently loaded Rhino document (3DM file)

Returns: str: the path of the currently loaded Rhino document (3DM file)

Example:

```python
import rhinoscriptsyntax as rs
path = rs.DocumentPath()
print(path)
```

See also: DocumentName

## EnableRedraw

```python
rs.EnableRedraw(enable=True)
```

Enables or disables screen redrawing

Arguments:

    enable (bool, optional): True to enable, False to disable

Returns: bool: previous screen redrawing state

Example:

```python
import rhinoscriptsyntax as rs
redraw = rs.EnableRedraw(True)
```

See also: Redraw

## ExtractPreviewImage

```python
rs.ExtractPreviewImage(filename, modelname=None)
```

Extracts the bitmap preview image from the specified model (.3dm)

Arguments:

    filename (str): name of the bitmap file to create. The extension of
       the filename controls the format of the bitmap file created.
       (.bmp, .tga, .jpg, .jpeg, .pcx, .png, .tif, .tiff)
    modelname (str, optional): The model (.3dm) from which to extract the
       preview image. If omitted, the currently loaded model is used.

Returns: bool: True or False indicating success or failure

Example:

```python
import rhinoscriptsyntax as rs
result = rs.ExtractPreviewImage("test.jpg")
if result:
    print("Test.jpg created successfully.")
else:
    print("Unable to extract preview image.")
```

See also: CreatePreviewImage

## IsDocumentModified

```python
rs.IsDocumentModified()
```

Verifies that the current document has been modified in some way

Returns: bool: True or False. None on error

Example:

```python
import rhinoscriptsyntax as rs
modified = rs.IsDocumentModified()
if not modified: rs.DocumentModified(True)
```

See also: DocumentModified

## Notes

```python
rs.Notes(newnotes=None)
```

Returns or sets the document's notes. Notes are generally created
    using Rhino's Notes command

Arguments:

    newnotes (str): new notes to set

Returns: str: if `newnotes` is omitted, the current notes if successful
str: if `newnotes` is specified, the previous notes if successful

Example:

```python
import rhinoscriptsyntax as rs
notes = rs.Notes()
if notes: rs.MessageBox(notes)
```

## ReadFileVersion

```python
rs.ReadFileVersion()
```

Returns the file version of the current document. Use this function to
    determine which version of Rhino last saved the document. Note, this
    function will not return values from referenced or merged files.

Returns: str: the file version of the current document

Example:

```python
import rhinoscriptsyntax as rs
print("ReadFileVersion = {}".format(rs.ReadFileVersion()))
```

See also: DocumentName, DocumentPath

## Redraw

```python
rs.Redraw()
```

Redraws all views

Returns: None

Example:

```python
import rhinoscriptsyntax as rs
rs.Redraw()
```

See also: EnableRedraw

## RenderAntialias

```python
rs.RenderAntialias(style=None)
```

Returns or sets render antialiasing style

Arguments:

    style (number, optional): level of antialiasing (0=none, 1=normal, 2=best)

Returns: number: if style is not specified, the current antialiasing style
number: if style is specified, the previous antialiasing style

Example:

```python
import rhinoscriptsyntax as rs
rs.RenderAntialias(1)
```

See also: RenderColor, RenderResolution, RenderSettings

## RenderColor

```python
rs.RenderColor(item, color=None)
```

Returns or sets the render ambient light or background color

Arguments:

    item (number): 0=ambient light color, 1=background color
    color (color, optional): the new color value. If omitted, the current item color is returned

Returns: color: if color is not specified, the current item color
color: if color is specified, the previous item color

Example:

```python
import rhinoscriptsyntax as rs
render_background_color = 1
rs.RenderColor( render_background_color, (0,0,255) )
```

See also: RenderAntialias, RenderResolution, RenderSettings

## RenderMeshDensity

```python
rs.RenderMeshDensity(density=None)
```

Returns or sets the render mesh density property of the active document.
        For more information on render meshes, see the Document Properties: Mesh topic in the Rhino help file.

Arguments:

    density (number, optional): the new render mesh density, which is a number between 0.0 and 1.0.

Returns: number: if density is not specified, the current render mesh density if successful.
number: if density is specified, the previous render mesh density if successful.

Example:

```python
import rhinoscriptsyntax as  rs
print("Quality: %s" % rs.RenderMeshQuality())
print("Mesh density: %s" % rs.RenderMeshDensity())
print("Maximum angle: %s" % rs.RenderMeshMaxAngle())
print("Maximum aspect ratio: %s" % rs.RenderMeshMaxAspectRatio())
print("Minimun edge length: %s" % rs.RenderMeshMinEdgeLength())
print("Maximum edge length: %s" % rs.RenderMeshMaxEdgeLength())
print("Maximum distance, edge to surface: %s" % rs.RenderMeshMaxDistEdgeToSrf())
print("Minumum initial grid quads: %s" % rs.RenderMeshMinInitialGridQuads())
print("Other settings: %s" % rs.RenderMeshSettings())
```

See also: RenderMeshDensity, RenderMeshMaxAngle, RenderMeshMaxAspectRatio, RenderMeshMaxDistEdgeToSrf, RenderMeshMaxEdgeLength, RenderMeshMinEdgeLength, RenderMeshMinInitialGridQuads, RenderMeshQuality, RenderMeshSettings

## RenderMeshMaxAngle

```python
rs.RenderMeshMaxAngle(angle_degrees=None)
```

Returns or sets the render mesh maximum angle property of the active document.  
      For more information on render meshes, see the Document Properties: Mesh topic in the Rhino help file.

Arguments:

    angle_degrees (number, optional): the new maximum angle, which is a positive number in degrees.

Returns: number: if angle_degrees is not specified, the current maximum angle if successful.
number: if angle_degrees is specified, the previous maximum angle if successful.
None: if not successful, or on error.

Example:

```python
import rhinoscriptsyntax as  rs
print("Quality: %s" % rs.RenderMeshQuality())
print("Mesh density: %s" % rs.RenderMeshDensity())
print("Maximum angle: %s" % rs.RenderMeshMaxAngle())
print("Maximum aspect ratio: %s" % rs.RenderMeshMaxAspectRatio())
print("Minimun edge length: %s" % rs.RenderMeshMinEdgeLength())
print("Maximum edge length: %s" % rs.RenderMeshMaxEdgeLength())
print("Maximum distance, edge to surface: %s" % rs.RenderMeshMaxDistEdgeToSrf())
print("Minumum initial grid quads: %s" % rs.RenderMeshMinInitialGridQuads())
print("Other settings: %s" % rs.RenderMeshSettings())
```

See also: RenderMeshDensity, RenderMeshMaxAngle, RenderMeshMaxAspectRatio, RenderMeshMaxDistEdgeToSrf, RenderMeshMaxEdgeLength, RenderMeshMinEdgeLength, RenderMeshMinInitialGridQuads, RenderMeshQuality, RenderMeshSettings

## RenderMeshMaxAspectRatio

```python
rs.RenderMeshMaxAspectRatio(ratio=None)
```

Returns or sets the render mesh maximum aspect ratio property of the active document.
      For more information on render meshes, see the Document Properties: Mesh topic in the Rhino help file.

Arguments:

    ratio (number, optional): the render mesh maximum aspect ratio.  The suggested range, when not zero, is from 1 to 100.

Returns: number: if ratio is not specified, the current render mesh maximum aspect ratio if successful.
number: if ratio is specified, the previous render mesh maximum aspect ratio if successful.
None: if not successful, or on error.

Example:

```python
import rhinoscriptsyntax as  rs
print("Quality: %s" % rs.RenderMeshQuality())
print("Mesh density: %s" % rs.RenderMeshDensity())
print("Maximum angle: %s" % rs.RenderMeshMaxAngle())
print("Maximum aspect ratio: %s" % rs.RenderMeshMaxAspectRatio())
print("Minimun edge length: %s" % rs.RenderMeshMinEdgeLength())
print("Maximum edge length: %s" % rs.RenderMeshMaxEdgeLength())
print("Maximum distance, edge to surface: %s" % rs.RenderMeshMaxDistEdgeToSrf())
print("Minumum initial grid quads: %s" % rs.RenderMeshMinInitialGridQuads())
print("Other settings: %s" % rs.RenderMeshSettings())
```

See also: RenderMeshDensity, RenderMeshMaxAngle, RenderMeshMaxAspectRatio, RenderMeshMaxDistEdgeToSrf, RenderMeshMaxEdgeLength, RenderMeshMinEdgeLength, RenderMeshMinInitialGridQuads, RenderMeshQuality, RenderMeshSettings

## RenderMeshMaxDistEdgeToSrf

```python
rs.RenderMeshMaxDistEdgeToSrf(distance=None)
```

Returns or sets the render mesh maximum distance, edge to surface parameter of the active document.
      For more information on render meshes, see the Document Properties: Mesh topic in the Rhino help file.

Arguments:

    distance (number, optional): the render mesh maximum distance, edge to surface.

Returns: number: if distance is not specified, the current render mesh maximum distance, edge to surface if successful.
number: if distance is specified, the previous render mesh maximum distance, edge to surface if successful.
None: if not successful, or on error.

Example:

```python
import rhinoscriptsyntax as  rs
print("Quality: %s" % rs.RenderMeshQuality())
print("Mesh density: %s" % rs.RenderMeshDensity())
print("Maximum angle: %s" % rs.RenderMeshMaxAngle())
print("Maximum aspect ratio: %s" % rs.RenderMeshMaxAspectRatio())
print("Minimun edge length: %s" % rs.RenderMeshMinEdgeLength())
print("Maximum edge length: %s" % rs.RenderMeshMaxEdgeLength())
print("Maximum distance, edge to surface: %s" % rs.RenderMeshMaxDistEdgeToSrf())
print("Minumum initial grid quads: %s" % rs.RenderMeshMinInitialGridQuads())
print("Other settings: %s" % rs.RenderMeshSettings())
```

See also: RenderMeshDensity, RenderMeshMaxAngle, RenderMeshMaxAspectRatio, RenderMeshMaxDistEdgeToSrf, RenderMeshMaxEdgeLength, RenderMeshMinEdgeLength, RenderMeshMinInitialGridQuads, RenderMeshQuality, RenderMeshSettings

## RenderMeshMaxEdgeLength

```python
rs.RenderMeshMaxEdgeLength(distance=None)
```

Returns or sets the render mesh maximum edge length parameter of the active document.
      For more information on render meshes, see the Document Properties: Mesh topic in the Rhino help file.

Arguments:

    distance (number, optional): the render mesh maximum edge length.

Returns: number: if distance is not specified, the current render mesh maximum edge length if successful.
number: if distance is specified, the previous render mesh maximum edge length if successful.
None: if not successful, or on error.

Example:

```python
import rhinoscriptsyntax as  rs
print("Quality: %s" % rs.RenderMeshQuality())
print("Mesh density: %s" % rs.RenderMeshDensity())
print("Maximum angle: %s" % rs.RenderMeshMaxAngle())
print("Maximum aspect ratio: %s" % rs.RenderMeshMaxAspectRatio())
print("Minimun edge length: %s" % rs.RenderMeshMinEdgeLength())
print("Maximum edge length: %s" % rs.RenderMeshMaxEdgeLength())
print("Maximum distance, edge to surface: %s" % rs.RenderMeshMaxDistEdgeToSrf())
print("Minumum initial grid quads: %s" % rs.RenderMeshMinInitialGridQuads())
print("Other settings: %s" % rs.RenderMeshSettings())
```

See also: RenderMeshDensity, RenderMeshMaxAngle, RenderMeshMaxAspectRatio, RenderMeshMaxDistEdgeToSrf, RenderMeshMaxEdgeLength, RenderMeshMinEdgeLength, RenderMeshMinInitialGridQuads, RenderMeshQuality, RenderMeshSettings

## RenderMeshMinEdgeLength

```python
rs.RenderMeshMinEdgeLength(distance=None)
```

Returns or sets the render mesh minimum edge length parameter of the active document.
      For more information on render meshes, see the Document Properties: Mesh topic in the Rhino help file.

Arguments:

    distance (number, optional): the render mesh minimum edge length.

Returns: number: if distance is not specified, the current render mesh minimum edge length if successful.
number: if distance is specified, the previous render mesh minimum edge length if successful.
None: if not successful, or on error.

Example:

```python
import rhinoscriptsyntax as  rs
print("Quality: %s" % rs.RenderMeshQuality())
print("Mesh density: %s" % rs.RenderMeshDensity())
print("Maximum angle: %s" % rs.RenderMeshMaxAngle())
print("Maximum aspect ratio: %s" % rs.RenderMeshMaxAspectRatio())
print("Minimun edge length: %s" % rs.RenderMeshMinEdgeLength())
print("Maximum edge length: %s" % rs.RenderMeshMaxEdgeLength())
print("Maximum distance, edge to surface: %s" % rs.RenderMeshMaxDistEdgeToSrf())
print("Minumum initial grid quads: %s" % rs.RenderMeshMinInitialGridQuads())
print("Other settings: %s" % rs.RenderMeshSettings())
```

See also: RenderMeshDensity, RenderMeshMaxAngle, RenderMeshMaxAspectRatio, RenderMeshMaxDistEdgeToSrf, RenderMeshMaxEdgeLength, RenderMeshMinEdgeLength, RenderMeshMinInitialGridQuads, RenderMeshQuality, RenderMeshSettings

## RenderMeshMinInitialGridQuads

```python
rs.RenderMeshMinInitialGridQuads(quads=None)
```

Returns or sets the render mesh minimum initial grid quads parameter of the active document.
      For more information on render meshes, see the Document Properties: Mesh topic in the Rhino help file.

Arguments:

    quads (number, optional): the render mesh minimum initial grid quads. The suggested range is from 0 to 10000.

Returns: number: if quads is not specified, the current render mesh minimum initial grid quads if successful.
number: if quads is specified, the previous render mesh minimum initial grid quads if successful.
None: if not successful, or on error.

Example:

```python
import rhinoscriptsyntax as  rs
print("Quality: %s" % rs.RenderMeshQuality())
print("Mesh density: %s" % rs.RenderMeshDensity())
print("Maximum angle: %s" % rs.RenderMeshMaxAngle())
print("Maximum aspect ratio: %s" % rs.RenderMeshMaxAspectRatio())
print("Minimun edge length: %s" % rs.RenderMeshMinEdgeLength())
print("Maximum edge length: %s" % rs.RenderMeshMaxEdgeLength())
print("Maximum distance, edge to surface: %s" % rs.RenderMeshMaxDistEdgeToSrf())
print("Minumum initial grid quads: %s" % rs.RenderMeshMinInitialGridQuads())
print("Other settings: %s" % rs.RenderMeshSettings())
```

See also: RenderMeshDensity, RenderMeshMaxAngle, RenderMeshMaxAspectRatio, RenderMeshMaxDistEdgeToSrf, RenderMeshMaxEdgeLength, RenderMeshMinEdgeLength, RenderMeshMinInitialGridQuads, RenderMeshQuality, RenderMeshSettings

## RenderMeshQuality

```python
rs.RenderMeshQuality(quality=None)
```

Returns or sets the render mesh quality of the active document.
        For more information on render meshes, see the Document Properties: Mesh topic in the Rhino help file.

Arguments:

    quality (number, optional): the render mesh quality, either:
      0: Jagged and faster.  Objects may look jagged, but they should shade and render relatively quickly.
      1: Smooth and slower.  Objects should look smooth, but they may take a very long time to shade and render.
      2: Custom.

Returns: number: if quality is not specified, the current render mesh quality if successful.
number: if quality is specified, the previous render mesh quality if successful.
None: if not successful, or on error.

Example:

```python
import rhinoscriptsyntax as  rs
print("Quality: %s" % rs.RenderMeshQuality())
print("Mesh density: %s" % rs.RenderMeshDensity())
print("Maximum angle: %s" % rs.RenderMeshMaxAngle())
print("Maximum aspect ratio: %s" % rs.RenderMeshMaxAspectRatio())
print("Minimun edge length: %s" % rs.RenderMeshMinEdgeLength())
print("Maximum edge length: %s" % rs.RenderMeshMaxEdgeLength())
print("Maximum distance, edge to surface: %s" % rs.RenderMeshMaxDistEdgeToSrf())
print("Minumum initial grid quads: %s" % rs.RenderMeshMinInitialGridQuads())
print("Other settings: %s" % rs.RenderMeshSettings())
```

See also: RenderMeshDensity, RenderMeshMaxAngle, RenderMeshMaxAspectRatio, RenderMeshMaxDistEdgeToSrf, RenderMeshMaxEdgeLength, RenderMeshMinEdgeLength, RenderMeshMinInitialGridQuads, RenderMeshQuality, RenderMeshSettings

## RenderMeshSettings

```python
rs.RenderMeshSettings(settings=None)
```

Returns or sets the render mesh settings of the active document.
      For more information on render meshes, see the Document Properties: Mesh topic in the Rhino help file.

Arguments:

    settings (number, optional): the render mesh settings, which is a bit-coded number that allows or disallows certain features.
    The bits can be added together in any combination to form a value between 0 and 7.  The bit values are as follows:
      0: No settings enabled.
      1: Refine mesh enabled.
      2: Jagged seams enabled.
      4: Simple planes enabled.
      8: Texture is packed, scaled and normalized; otherwise unpacked, unscaled and normalized.

Returns: number: if settings is not specified, the current render mesh settings if successful.
number: if settings is specified, the previous render mesh settings if successful.
None: if not successful, or on error.

Example:

```python
import rhinoscriptsyntax as  rs
print("Quality: %s" % rs.RenderMeshQuality())
print("Mesh density: %s" % rs.RenderMeshDensity())
print("Maximum angle: %s" % rs.RenderMeshMaxAngle())
print("Maximum aspect ratio: %s" % rs.RenderMeshMaxAspectRatio())
print("Minimun edge length: %s" % rs.RenderMeshMinEdgeLength())
print("Maximum edge length: %s" % rs.RenderMeshMaxEdgeLength())
print("Maximum distance, edge to surface: %s" % rs.RenderMeshMaxDistEdgeToSrf())
print("Minumum initial grid quads: %s" % rs.RenderMeshMinInitialGridQuads())
print("Other settings: %s" % rs.RenderMeshSettings())
```

See also: RenderMeshDensity, RenderMeshMaxAngle, RenderMeshMaxAspectRatio, RenderMeshMaxDistEdgeToSrf, RenderMeshMaxEdgeLength, RenderMeshMinEdgeLength, RenderMeshMinInitialGridQuads, RenderMeshQuality, RenderMeshSettings

## RenderResolution

```python
rs.RenderResolution(resolution=None)
```

Returns or sets the render resolution

Arguments:

    resolution ([number, number], optional): width and height of render

Returns: tuple(number, number): if resolution is not specified, the current resolution width,height
tuple(number, number): if resolution is specified, the previous resolution width, height

Example:

```python
import rhinoscriptsyntax as rs
sizex, sizey = rs.Viewsize()
resolution = sizex/2 , sizey/2
rs.RenderResolution( resolution )
```

See also: RenderAntialias, RenderColor, RenderSettings

## RenderSettings

```python
rs.RenderSettings(settings=None)
```

Returns or sets render settings

Arguments:

    settings (number, optional): bit-coded flags of render settings to modify.
      0=none,
      1=create shadows,
      2=use lights on layers that are off,
      4=render curves and isocurves,
      8=render dimensions and text

Returns: number: if settings are not specified, the current render settings in bit-coded flags
number: if settings are specified, the previous render settings in bit-coded flags

Example:

```python
import rhinoscriptsyntax as rs
render_annotations = 8
settings = rs.RenderSettings()
if settings & render_annotations:
    settings = settings - render_annotations
    rs.RenderSettings( settings )
```

See also: RenderAntialias, RenderColor, RenderResolution

## UnitAbsoluteTolerance

```python
rs.UnitAbsoluteTolerance(tolerance=None, in_model_units=True)
```

Resturns or sets the document's absolute tolerance. Absolute tolerance
    is measured in drawing units. See Rhino's document properties command
    (Units and Page Units Window) for details

Arguments:

    tolerance (number, optional): the absolute tolerance to set
    in_model_units (bool, optional): Return or modify the document's model units (True)
                          or the document's page units (False)

Returns: number: if tolerance is not specified, the current absolute tolerance
number: if tolerance is specified, the previous absolute tolerance

Example:

```python
import rhinoscriptsyntax as rs
tol = rs.UnitAbsoluteTolerance()
if tol<0.01:
    rs.UnitAbsoluteTolerance( 0.01 )
```

See also: UnitAngleTolerance, UnitDistanceDisplayPrecision, UnitRelativeTolerance, UnitSystem

## UnitAngleTolerance

```python
rs.UnitAngleTolerance(angle_tolerance_degrees=None, in_model_units=True)
```

Return or set the document's angle tolerance. Angle tolerance is
    measured in degrees. See Rhino's DocumentProperties command
    (Units and Page Units Window) for details

Arguments:

    angle_tolerance_degrees (number, optional): the angle tolerance to set
    in_model_units (number, optional): Return or modify the document's model units (True)
                           or the document's page units (False)

Returns: number: if angle_tolerance_degrees is not specified, the current angle tolerance
number: if angle_tolerance_degrees is specified, the previous angle tolerance

Example:

```python
import rhinoscriptsyntax as rs
tol = rs.UnitAngleTolerance()
if tol<3.0:
    rs.UnitAngleTolerance(3.0)
```

See also: UnitAbsoluteTolerance, UnitDistanceDisplayPrecision, UnitRelativeTolerance, UnitSystem

## UnitDistanceDisplayPrecision

```python
rs.UnitDistanceDisplayPrecision(precision=None, model_units=True)
```

Return or set the document's distance display precision

Arguments:

    precision (number, optional): The distance display precision.  If the current distance display mode is Decimal, then precision is the number of decimal places.
                                  If the current distance display mode is Fractional (including Feet and Inches), then the denominator = (1/2)^precision.
                                  Use UnitDistanceDisplayMode to get the current distance display mode.
    model_units (bool, optional): Return or modify the document's model units (True) or the document's page units (False). The default is True.

Returns: number: If precision is not specified, the current distance display precision if successful. If precision is specified, the previous distance display precision if successful. If not successful, or on error.

Example:

```python
import rhinoscriptsyntax as rs
precision = 3
rs.UnitDistanceDisplayPrecision( precision )
```

See also: UnitAbsoluteTolerance, UnitAngleTolerance, UnitRelativeTolerance, UnitSystem

## UnitRelativeTolerance

```python
rs.UnitRelativeTolerance(relative_tolerance=None, in_model_units=True)
```

Return or set the document's relative tolerance. Relative tolerance
    is measured in percent. See Rhino's DocumentProperties command
    (Units and Page Units Window) for details

Arguments:

    relative_tolerance (number, optional) the relative tolerance in percent
    in_model_units (bool, optional): Return or modify the document's model units (True)
                           or the document's page units (False)

Returns: number: if relative_tolerance is not specified, the current tolerance in percent
number: if relative_tolerance is specified, the previous tolerance in percent

Example:

```python
import rhinoscriptsyntax as rs
tol = rs.UnitRelativeTolerance()
if tol<1.0:
    rs.UnitRelativeTolerance(1.0)
```

See also: UnitAbsoluteTolerance, UnitAngleTolerance, UnitDistanceDisplayPrecision, UnitSystem

## UnitScale

```python
rs.UnitScale(to_system, from_system=None)
```

Return the scale factor for changing between unit systems.

Arguments:

    to_system (number): The unit system to convert to. The unit systems are are:
       0 - No unit system
       1 - Microns (1.0e-6 meters)
       2 - Millimeters (1.0e-3 meters)
       3 - Centimeters (1.0e-2 meters)
       4 - Meters
       5 - Kilometers (1.0e+3 meters)
       6 - Microinches (2.54e-8 meters, 1.0e-6 inches)
       7 - Mils (2.54e-5 meters, 0.001 inches)
       8 - Inches (0.0254 meters)
       9 - Feet (0.3408 meters, 12 inches)
      10 - Miles (1609.344 meters, 5280 feet)
      11 - *Reserved for custom Unit System*
      12 - Angstroms (1.0e-10 meters)
      13 - Nanometers (1.0e-9 meters)
      14 - Decimeters (1.0e-1 meters)
      15 - Dekameters (1.0e+1 meters)
      16 - Hectometers (1.0e+2 meters)
      17 - Megameters (1.0e+6 meters)
      18 - Gigameters (1.0e+9 meters)
      19 - Yards (0.9144  meters, 36 inches)
      20 - Printer point (1/72 inches, computer points)
      21 - Printer pica (1/6 inches, (computer picas)
      22 - Nautical mile (1852 meters)
      23 - Astronomical (1.4959787e+11)
      24 - Lightyears (9.46073e+15 meters)
      25 - Parsecs (3.08567758e+16)
    from_system (number, optional): the unit system to convert from (see above). If omitted,
        the document's current unit system is used

Returns: number: scale factor for changing between unit systems

Example:

```python
import rhinoscriptsyntax as rs
print(rs.UnitScale(3, 4)) # 100.0
print(rs.UnitScale(3, 8)) # 2.54
print(rs.UnitScale(8, 9)) # 12.0
```

See also: UnitSystem, UnitSystemName

## UnitSystem

```python
rs.UnitSystem(unit_system=None, scale=False, in_model_units=True)
```

Return or set the document's unit system. See Rhino's DocumentProperties
    command (Units and Page Units Window) for details

Arguments:

    unit_system (number, optional): The unit system to set the document to. The unit systems are:
       0 - No unit system
       1 - Microns (1.0e-6 meters)
       2 - Millimeters (1.0e-3 meters)
       3 - Centimeters (1.0e-2 meters)
       4 - Meters
       5 - Kilometers (1.0e+3 meters)
       6 - Microinches (2.54e-8 meters, 1.0e-6 inches)
       7 - Mils (2.54e-5 meters, 0.001 inches)
       8 - Inches (0.0254 meters)
       9 - Feet (0.3048 meters, 12 inches)
      10 - Miles (1609.344 meters, 5280 feet)
      11 - *Reserved for custom Unit System*
      12 - Angstroms (1.0e-10 meters)
      13 - Nanometers (1.0e-9 meters)
      14 - Decimeters (1.0e-1 meters)
      15 - Dekameters (1.0e+1 meters)
      16 - Hectometers (1.0e+2 meters)
      17 - Megameters (1.0e+6 meters)
      18 - Gigameters (1.0e+9 meters)
      19 - Yards (0.9144  meters, 36 inches)
      20 - Printer point (1/72 inches, computer points)
      21 - Printer pica (1/6 inches, (computer picas)
      22 - Nautical mile (1852 meters)
      23 - Astronomical (1.4959787e+11)
      24 - Lightyears (9.46073e+15 meters)
      25 - Parsecs (3.08567758e+16)
    scale (bool, optional): Scale existing geometry based on the new unit system.
        If not specified, any existing geometry is not scaled (False)
    in_model_units (number, optional): Return or modify the document's model units (True)
        or the document's page units (False). The default is True.

Returns: number: if unit_system is not specified, the current unit system
number: if unit_system is specified, the previous unit system
None: on error

Example:

```python
import rhinoscriptsyntax as rs
rhUnitMillimeters = 2
rhUnitInches = 8
current_system = rs.UnitSystem()
if current_system==rhUnitMillimeters:
    rs.UnitSystem(rhUnitInches, True)
```

See also: UnitAbsoluteTolerance, UnitAngleTolerance, UnitDistanceDisplayPrecision, UnitRelativeTolerance

## UnitSystemName

```python
rs.UnitSystemName(capitalize=False, singular=True, abbreviate=False, model_units=True)
```

Returns the name of the current unit system

Arguments:

    capitalize (bool, optional): Capitalize the first character of the units system name (e.g. return "Millimeter" instead of "millimeter"). The default is not to capitalize the first character (false).
    singular (bool, optional): Return the singular form of the units system name (e.g. "millimeter" instead of "millimeters"). The default is to return the singular form of the name (true).
    abbreviate (bool, optional): Abbreviate the name of the units system (e.g. return "mm" instead of "millimeter"). The default is not to abbreviate the name (false).
    model_units (bool, optional): Return the document's model units (True) or the document's page units (False). The default is True.

Returns: str: The name of the current units system if successful.

Example:

```python
import rhinoscriptsyntax as rs
system = rs.UnitSystemName(False, False, False)
print("The units system is set to{}".format(system))
```

See also: UnitSystem
