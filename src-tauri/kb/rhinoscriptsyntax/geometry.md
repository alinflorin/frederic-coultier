# rhinoscriptsyntax: geometry

## AddClippingPlane

```python
rs.AddClippingPlane(plane, u_magnitude, v_magnitude, views=None)
```

Create a clipping plane for visibly clipping away geometry in a specific
    view. Note, clipping planes are infinite

Arguments:

    plane (plane): the plane
    u_magnitude, v_magnitude (number): size of the plane
    views ([str|guid, ...]): Titles or ids the the view(s) to clip. If omitted, the active
      view is used.

Returns: guid: object identifier on success
None: on failure

Example:

```python
import rhinoscriptsyntax as rs
rs.AddClippingPlane( rs.WorldXYPlane(), 5.0, 3.0 )
```

See also: IsClippingPlane

## AddPictureFrame

```python
rs.AddPictureFrame(plane, filename, width=0.0, height=0.0, self_illumination=True, embed=False, use_alpha=False, make_mesh=False)
```

Creates a picture frame and adds it to the document.

Arguments:

    plane (plane): The plane in which the PictureFrame will be created.  The bottom-left corner of picture will be at plane's origin. The width will be in the plane's X axis direction, and the height will be in the plane's Y axis direction.
    filename (str): The path to a bitmap or image file.
    width (number, optional): If both dblWidth and dblHeight = 0, then the width and height of the PictureFrame will be the width and height of the image. If dblWidth = 0 and dblHeight is > 0, or if dblWidth > 0 and dblHeight = 0, then the non-zero value is assumed to be an aspect ratio of the image's width or height, which ever one is = 0. If both dblWidth and dblHeight are > 0, then these are assumed to be the width and height of in the current unit system.
    height (number, optional):  If both dblWidth and dblHeight = 0, then the width and height of the PictureFrame will be the width and height of the image. If dblWidth = 0 and dblHeight is > 0, or if dblWidth > 0 and dblHeight = 0, then the non-zero value is assumed to be an aspect ratio of the image's width or height, which ever one is = 0. If both dblWidth and dblHeight are > 0, then these are assumed to be the width and height of in the current unit system.
    self_illumination (bool, optional): If True, then the image mapped to the picture frame plane always displays at full intensity and is not affected by light or shadow.
    embed (bool, optional): If True, then the function adds the image to Rhino's internal bitmap table, thus making the document self-contained.
    use_alpha (bool, optional): If False, the picture frame is created without any transparency texture.  If True, a transparency texture is created with a "mask texture" set to alpha, and an instance of the diffuse texture in the source texture slot.
    make_mesh (bool, optional): If True, the function will make a PictureFrame object from a mesh rather than a plane surface.

Returns: guid: object identifier on success
None: on failure

## AddPoint

```python
rs.AddPoint(point, y=None, z=None)
```

Adds point object to the document.

Arguments:

    point (point): a point3d or list(x,y,z) location of point to add

Returns: guid: identifier for the object that was added to the doc

Example:

```python
import rhinoscriptsyntax as rs
rs.AddPoint( (1,2,3) )
```

See also: IsPoint, PointCoordinates

## AddPointCloud

```python
rs.AddPointCloud(points, colors=None)
```

Adds point cloud object to the document

Arguments:

    points ([point, ....]): list of values where every multiple of three represents a point
    colors ([color, ...]): list of colors to apply to each point

Returns: guid: identifier of point cloud on success

Example:

```python
import rhinoscriptsyntax as rs
points = (0,0,0), (1,1,1), (2,2,2), (3,3,3)
rs.AddPointCloud(points)
```

See also: IsPointCloud, PointCloudCount, PointCloudPoints

## AddPoints

```python
rs.AddPoints(points)
```

Adds one or more point objects to the document

Arguments:

    points ([point, ...]): list of points

Returns: list(guid, ...): identifiers of the new objects on success

Example:

```python
import rhinoscriptsyntax as rs
points = rs.GetPoints(True, True, "Select points")
if points: rs.AddPoints(points)
```

See also: AddPoint, AddPointCloud

## AddText

```python
rs.AddText(text, point_or_plane, height=1.0, font=None, font_style=0, justification=None)
```

Adds a text string to the document

Arguments:

    text (str): the text to display
    point_or_plane (point|plane): a 3-D point or the plane on which the text will lie.
        The origin of the plane will be the origin point of the text
    height (number, optional): the text height
    font (str, optional): the text font
    font_style (number, optional): any of the following flags
       0 = normal
       1 = bold
       2 = italic
       3 = bold and italic
    justification (number, optional): text justification. Values may be added to create combinations.
       1 = Left
       2 = Center (horizontal)
       4 = Right
       65536 = Bottom
       131072 = Middle (vertical)
       262144 = Top

Returns: guid: identifier for the object that was added to the doc on success
None: on failure

Example:

```python
import rhinoscriptsyntax as rs
point = rs.GetPoint("Pick point")
if point: rs.AddText("Hello Rhino!", point)
```

See also: IsText

## AddTextDot

```python
rs.AddTextDot(text, point)
```

Add a text dot to the document.

Arguments:

    text (str): string in dot
    point (point): A 3D point identifying the origin point.

Returns: guid: The identifier of the new object if successful

Example:

```python
import rhinoscriptsyntax as rs
rs.AddTextDot("howdy",(1,2,3))
```

See also: IsTextDot

## Area

```python
rs.Area(object_id)
```

Compute the area of a closed curve, hatch, surface, polysurface, or mesh

Arguments:

    object_id (guid): the object's identifier

Returns: number: area if successful
None: on error

Example:

```python
import rhinoscriptsyntax as  rs
a = rs.Area('a9e34aa8-226c-4e17-9e11-b74bf2cf581b')
```

See also: IsPoint, PointCoordinates

## BoundingBox

```python
rs.BoundingBox(objects, view_or_plane=None, in_world_coords=True)
```

Returns either world axis-aligned or a construction plane axis-aligned
    bounding box of an object or of several objects

Arguments:

    objects ([guid, ...]): The identifiers of the objects
    view_or_plane (str|guid): Title or id of the view that contains the
        construction plane to which the bounding box should be aligned -or-
        user defined plane. If omitted, a world axis-aligned bounding box
        will be calculated
    in_world_coords (bool, optional): return the bounding box as world coordinates or
        construction plane coordinates. Note, this option does not apply to
        world axis-aligned bounding boxes.

Returns: list(point, point, point, point, point, point, point, point): Eight 3D points that define the bounding box.
     Points returned in counter-clockwise order starting with the bottom rectangle of the box.
None: on error

Example:

```python
import rhinoscriptsyntax as rs
object = rs.GetObject("Select object")
if object:
    box = rs.BoundingBox(object)
    if box:
        for i, point in enumerate(box):
            rs.AddTextDot( i, point )
```

## CompareGeometry

```python
rs.CompareGeometry(first, second)
```

Compares two objects to determine if they are geometrically identical.

Arguments:

    first (guid|geometry): The identifier of the first object to compare.
    second (guid|geometry): The identifier of the second object to compare.

Returns: True if the objects are geometrically identical, otherwise False.

Example:

```python
import rhinoscriptsyntax as rs
object1 = rs.GetObject("Select first object")
object2 = rs.GetObject("Select second object")
if object:
print("Objects are identical" if rs.CompareGeometry(object1, object2) else "Objects differ")
```

## ExplodeText

```python
rs.ExplodeText(text_id, delete=False)
```

Creates outline curves for a given text entity

Arguments:

    text_id (guid): identifier of Text object to explode
    delete (bool, optional): delete the text object after the curves have been created

Returns: list(guid): of outline curves

Example:

```python
import rhinoscriptsyntax as rs
text = rs.AddText("abcd", rs.WorldXYPlane())
rs.ExplodeText(text, True)
```

See also: IsHatch, HatchPattern, HatchRotation, HatchScale

## IsClippingPlane

```python
rs.IsClippingPlane(object_id)
```

Verifies that an object is a clipping plane object

Arguments:

    object_id (guid): the object's identifier

Returns: bool: True if the object with a given id is a clipping plane

Example:

```python
import rhinoscriptsyntax as rs
id = rs.GetObject("Select a clipping plane")
if rs.IsClippingPlane(id):
    print("The object is a clipping plane.")
else:
    print("The object is not a clipping plane.")
```

See also: AddClippingPlane

## IsPoint

```python
rs.IsPoint(object_id)
```

Verifies an object is a point object.

Arguments:

    object_id (guid): the object's identifier

Returns: bool: True if the object with a given id is a point

Example:

```python
import rhinoscriptsyntax as rs
id = rs.GetObject("Select a point")
if rs.IsPoint(id):
    print("The object is a point.")
else:
    print("The object is not a point.")
```

See also: AddPoint, PointCoordinates

## IsPointCloud

```python
rs.IsPointCloud(object_id)
```

Verifies an object is a point cloud object.

Arguments:

    object_id (guid): the object's identifier

Returns: bool: True if the object with a given id is a point cloud

Example:

```python
import rhinoscriptsyntax as rs
id = rs.GetObject("Select a point cloud")
if rs.IsPointCloud(id):
    print("The object is a point cloud.")
else:
    print("The object is not a point cloud.")
```

See also: AddPointCloud, PointCloudCount, PointCloudPoints

## IsText

```python
rs.IsText(object_id)
```

Verifies an object is a text object.

Arguments:

    object_id (guid): the object's identifier

Returns: bool: True if the object with a given id is a text object

Example:

```python
import rhinoscriptsyntax as rs
id = rs.GetObject("Select a text object")
if rs.IsText(id):
    print("The object is a text object.")
else:
    print("The object is not a text object.")
```

See also: AddText

## IsTextDot

```python
rs.IsTextDot(object_id)
```

Verifies an object is a text dot object.

Arguments:

    object_id (guid): the object's identifier

Returns: bool: True if the object with a given id is a text dot object

Example:

```python
import rhinoscriptsyntax as rs
id = rs.GetObject("Select a text dot object")
if rs.IsTextDot(id):
    print("The object is a text dot object.")
else:
    print("The object is not a text dot object.")
```

See also: AddTextDot

## PointCloudClosestPoints

```python
rs.PointCloudClosestPoints(pt_cloud, needle_points, distance)
```

Returns a list of lists of point indices in a point cloud that are
    closest to needle_points. Each inner list references all points within or on the surface of a sphere of distance radius.

Arguments:

    pt_cloud (guid|[point, ...]): the point cloud to be searched, or the "hay stack". This can also be a list of points.
    needle_points (guid|[point, ...]): a list of points to search in the point_cloud. This can also be specified as a point cloud.
    distance (float): the included limit for listing points.

Returns: [[int, ...], ...]: a list of lists with the indices of the found points.

Example:

```python
import rhinoscriptsyntax as rs
id = rs.GetObject("Select point cloud", rs.filter.pointcloud)
if id:
    result = rs.PointCloudClosestPoints(id, [[0,0,0]], 1.0)
    if result and result[0]:
        print("The first point next to origin within a 1.0 unit radius is: %s." % result[0][0])
    else:
        print("There is no point in the point cloud within a 1.0 unit radius sphere from origin.")
```

See also: AddPointCloud, IsPointCloud, PointCloudPoints

## PointCloudCount

```python
rs.PointCloudCount(object_id)
```

Returns the point count of a point cloud object

Arguments:

    object_id (guid): the point cloud object's identifier

Returns: number: number of points if successful

Example:

```python
import rhinoscriptsyntax as rs
id = rs.GetObject("Select point cloud", rs.filter.pointcloud)
print("Point count:{}".format(rs.PointCloudCount(id)))
```

See also: AddPointCloud, IsPointCloud, PointCloudPoints

## PointCloudHasHiddenPoints

```python
rs.PointCloudHasHiddenPoints(object_id)
```

Verifies that a point cloud has hidden points

Arguments:

    object_id (guid): the point cloud object's identifier

Returns: bool: True if cloud has hidden points, otherwise False

Example:

```python
import rhinoscriptsyntax as rs
obj = rs.GetObject("Select a point cloud", rs.filter.pointcloud)
if rs.PointCloudHasHiddenPoints(obj):
    print("The point cloud has hidden points.")
else:
    print("The point cloud has no hidden points.")
```

See also: PointCloudHasPointColors, PointCloudHidePoints, PointCloudPointColors

## PointCloudHasPointColors

```python
rs.PointCloudHasPointColors(object_id)
```

Verifies that a point cloud has point colors

Arguments:

    object_id (guid): the point cloud object's identifier

Returns: bool: True if cloud has point colors, otherwise False

Example:

```python
import rhinoscriptsyntax as rs
obj = rs.GetObject("Select a point cloud", rs.filter.pointcloud)
if rs.PointCloudHasPointColors(obj):
    print("The point cloud has point colors.")
else:
    print("The point cloud has no point colors.")
```

See also: PointCloudHasPointColors, PointCloudHidePoints, PointCloudPointColors

## PointCloudHidePoints

```python
rs.PointCloudHidePoints(object_id, hidden=[])
```

Returns or modifies the hidden points of a point cloud object

Arguments:

    object_id (guid): the point cloud object's identifier
    hidden ([bool, ....]): list of booleans matched to the index of points to be hidden

Returns: list(bool, ....): List of point cloud hidden states

Example:

```python
import rhinoscriptsyntax as rs
obj = rs.GetObject("Select point cloud", rs.filter.pointcloud)
if obj:
    hidden = [True] * rs.PointCloudCount(obj)
    for i in range(len(hidden)):
        hidden[i] = (i%2==0)
    rs.PointCloudHidePoints(obj, hidden)
```

See also: PointCloudHasPointColors, PointCloudPointColors

## PointCloudKNeighbors

```python
rs.PointCloudKNeighbors(pt_cloud, needle_points, amount=1)
```

Returns amount indices of points in a point cloud that are near needle_points.

Arguments:

    pt_cloud (guid|[point, ...]): the point cloud to be searched, or the "hay stack". This can also be a list of points.
    needle_points (guid|[point, ...]): a list of points to search in the point_cloud. This can also be specified as a point cloud.
    amount (int, optional): the amount of required closest points. Defaults to 1.

Returns: [int, int,...]: a list of indices of the found points, if amount equals 1.
[[int, ...], ...]: nested lists with amount items within a list, with the indices of the found points.

Example:

```python
import rhinoscriptsyntax as rs
id = rs.GetObject("Select point cloud", rs.filter.pointcloud)
if id:
    result = rs.PointCloudKNeighbors(id, [(0,0,0)])
    if result:
        print("The closest point to origin has index : %s." % result[0])
```

See also: AddPointCloud, IsPointCloud, PointCloudPoints

## PointCloudPointColors

```python
rs.PointCloudPointColors(object_id, colors=[])
```

Returns or modifies the point colors of a point cloud object

Arguments:

    object_id (guid): the point cloud object's identifier
    colors ([color, ...]) list of color values if you want to adjust colors

Returns: list(color, ...): List of point cloud colors

Example:

```python
import rhinoscriptsyntax as rs
import random
       
def RandomColor():
    red = random.randint(0,255)
    green = random.randint(0,255)
    blue = random.randint(0,255)
    return rs.coercecolor((red,green,blue))
       
obj = rs.GetObject("Select point cloud", rs.filter.pointcloud)
if obj:
    colors = [RandomColor() for i in range(rs.PointCloudCount(obj))]
    rs.PointCloudColors(obj, colors)
```

See also: PointCloudHasHiddenPoints, PointCloudHasPointColors, PointCloudHidePoints

## PointCloudPoints

```python
rs.PointCloudPoints(object_id)
```

Returns the points of a point cloud object

Arguments:

    object_id (guid): the point cloud object's identifier

Returns: list(guid, ...): list of points if successful

Example:

```python
import rhinoscriptsyntax as rs
id = rs.GetObject("Select point cloud", rs.filter.pointcloud)
points = rs.PointCloudPoints(id)
if points: for point in points: print(point)
```

See also: AddPointCloud, IsPointCloud, PointCloudCount

## PointCoordinates

```python
rs.PointCoordinates(object_id, point=None)
```

Returns or modifies the X, Y, and Z coordinates of a point object

Arguments:

    object_id (guid): The identifier of a point object
    point (point, optional): A new 3D point location.

Returns: point: If point is not specified, the current 3-D point location
point: If point is specified, the previous 3-D point location

Example:

```python
import rhinoscriptsyntax as rs
id = rs.GetObject("Select point", rs.filter.point)
point = rs.PointCoordinates(id)
if point: print(point)
```

See also: AddPoint, IsPoint

## TextDotFont

```python
rs.TextDotFont(object_id, fontface=None)
```

Returns or modified the font of a text dot

Arguments:

    object_id (guid): identifier of a text dot object
    fontface (str, optional): new font face name

Returns: str: If font is not specified, the current text dot font
str: If font is specified, the previous text dot font
None: on error

Example:

```python
import rhinoscriptsyntax as rs
obj = rs.GetObject("Select text dot")
if rs.IsTextDot(obj): rs.TextDotFont( obj, "Arial" )
```

See also: AddTextDot, IsTextDot, TextDotHeight, TextDotPoint, TextDotText

## TextDotHeight

```python
rs.TextDotHeight(object_id, height=None)
```

Returns or modified the font height of a text dot

Arguments:

    object_id (guid): identifier of a text dot object
    height (number, optional) new font height

Returns: number: If height is not specified, the current text dot height
number: If height is specified, the previous text dot height
None: on error

Example:

```python
import rhinoscriptsyntax as rs
obj = rs.GetObject("Select text dot")
if rs.IsTextDot(obj): rs.TextDotHeight(obj, 10.0)
```

See also: AddTextDot, IsTextDot, TextDotFont, TextDotPoint, TextDotText

## TextDotPoint

```python
rs.TextDotPoint(object_id, point=None)
```

Returns or modifies the location, or insertion point, on a text dot object

Arguments:

    object_id (guid): identifier of a text dot object
    point (point, optional): A new 3D point location.

Returns: point: If point is not specified, the current 3-D text dot location
point: If point is specified, the previous 3-D text dot location
None: if not successful, or on error

Example:

```python
import rhinoscriptsyntax as rs
id = rs.GetObject("Select text dot")
if rs.IsTextDot(id):
    point = rs.TestDotPoint(id)
    rs.AddPoint( point )
    rs.TextDotPoint(id, [0,0,0])
```

See also: AddTextDot, IsTextDot, TextDotText

## TextDotText

```python
rs.TextDotText(object_id, text=None)
```

Returns or modifies the text on a text dot object

Arguments:

    object_id (guid): The identifier of a text dot object
    text (str, optional): a new string for the dot

Returns: str: If text is not specified, the current text dot text
str: If text is specified, the previous text dot text
None: if not successful, or on error

Example:

```python
import rhinoscriptsyntax as rs
id = rs.GetObject("Select text dot")
if rs.IsTextDot(id):
    rs.TextDotText( id, "Rhino")
```

See also: AddTextDot, IsTextDot, TextDotPoint

## TextObjectFont

```python
rs.TextObjectFont(object_id, font=None)
```

Returns of modifies the font used by a text object

Arguments:

    object_id (guid): the identifier of a text object
    font (str): the new font face name

Returns: str: if a font is not specified, the current font face name
str: if a font is specified, the previous font face name
None: if not successful, or on error

Example:

```python
import rhinoscriptsyntax as rs
obj = rs.GetObject("Select text")
if rs.IsText(obj): rs.TextObjectFont(obj, "Arial")
```

See also: AddText, IsText, TextObjectHeight, TextObjectPlane, TextObjectPoint, TextObjectStyle, TextObjectText

## TextObjectHeight

```python
rs.TextObjectHeight(object_id, height=None)
```

Returns or modifies the height of a text object

Arguments:

    object_id (guid): the identifier of a text object
    height (number, optional): the new text height.

Returns: number: if height is not specified, the current text height
number: if height is specified, the previous text height
None: if not successful, or on error

Example:

```python
import rhinoscriptsyntax as rs
obj = rs.GetObject("Select text")
if rs.IsText(obj):
    rs.TextObjectHeight( obj, 1.0 )
```

See also: AddText, IsText, TextObjectFont, TextObjectPlane, TextObjectPoint, TextObjectStyle, TextObjectText

## TextObjectPlane

```python
rs.TextObjectPlane(object_id, plane=None)
```

Returns or modifies the plane used by a text object

Arguments:

    object_id (guid): the identifier of a text object
    plane (plane): the new text object plane

Returns: plane: if a plane is not specified, the current plane if successful
plane: if a plane is specified, the previous plane if successful
None: if not successful, or on Error

Example:

```python
import rhinoscriptsyntax as rs
obj = rs.GetObject("Select text")
if rs.IsText(obj):
    plane = rs.ViewCPlane("Top")
    rs.TextObjectPlane( obj, plane )
```

See also: AddText, IsText, TextObjectFont, TextObjectHeight, TextObjectPoint, TextObjectStyle, TextObjectText

## TextObjectPoint

```python
rs.TextObjectPoint(object_id, point=None)
```

Returns or modifies the location of a text object

Arguments:

    object_id (guid): the identifier of a text object
    point (point, optional) the new text object location

Returns: point: if point is not specified, the 3D point identifying the current location
point: if point is specified, the 3D point identifying the previous location
None: if not successful, or on Error

Example:

```python
import rhinoscriptsyntax as rs
obj = rs.GetObject("Select text")
if rs.IsText(obj):
    rs.TextObjectPoint( obj, [0,0,0] )
```

See also: AddText, IsText, TextObjectFont, TextObjectHeight, TextObjectPlane, TextObjectStyle, TextObjectText

## TextObjectStyle

```python
rs.TextObjectStyle(object_id, style=None)
```

Returns or modifies the font style of a text object

Arguments:

    object_id (guid) the identifier of a text object
    style (number, optional) the font style. Can be any of the following flags
       0 = Normal
       1 = Bold
       2 = Italic

Returns: number: if style is not specified, the current font style
number: if style is specified, the previous font style
None: if not successful, or on Error

Example:

```python
import rhinoscriptsyntax as rs
obj = rs.GetObject("Select text")
if rs.IsText(obj):
    rs.TextObjectStyle( obj, 3 )
```

See also: AddText, IsText, TextObjectFont, TextObjectHeight, TextObjectPlane, TextObjectPoint, TextObjectText

## TextObjectText

```python
rs.TextObjectText(object_id, text=None)
```

Returns or modifies the text string of a text object.

Arguments:

    object_id (guid): the identifier of a text object
    text (str, optional): a new text string

Returns: str: if text is not specified, the current string value if successful
str: if text is specified, the previous string value if successful
None: if not successful, or on error

Example:

```python
import rhinoscriptsyntax as rs
obj = rs.GetObject("Select text")
if rs.IsText(obj): rs.TextObjectText(obj, "Rhino")
```

See also: AddText, IsText, TextObjectFont, TextObjectHeight, TextObjectPlane, TextObjectPoint, TextObjectStyle
