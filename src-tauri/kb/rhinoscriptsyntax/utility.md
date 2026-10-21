# rhinoscriptsyntax: utility

## Angle

```python
rs.Angle(point1, point2, plane=True)
```

Measures the angle between two points

Arguments:

    point1, point2 (point): the input points
    plane (bool, optional): Boolean or Plane
      If True, angle calculation is based on the world coordinate system.
      If False, angle calculation is based on the active construction plane
      If a plane is provided, angle calculation is with respect to this plane

Returns: tuple(tuple(number, number), number, number, number, number): containing the following elements if successful
  element 0 = the X,Y angle in degrees
  element 1 = the elevation
  element 2 = delta in the X direction
  element 3 = delta in the Y direction
  element 4 = delta in the Z direction
None: if not successful

Example:

```python
import rhinoscriptsyntax as  rs
point1 = rs.GetPoint("First  point")
if point1:
    point2  = rs.GetPoint("Second point")
    if point2:
        angle  = rs.Angle(point1, point2)
        if  angle: print("Angle: {}".format(angle[0]))
```

See also: Angle2, Distance

## Angle2

```python
rs.Angle2(line1, line2)
```

Measures the angle between two lines

Arguments:

    line1 (line): List of 6 numbers or 2 Point3d.
    line2 (line): List of 6 numbers or 2 Point3d.

Returns: tuple(number, number): containing the following elements if successful.
  0 The angle in degrees.
  1 The reflex angle in degrees.
None: If not successful, or on error.

Example:

```python
import rhinoscriptsyntax as rs
point1 = rs.GetPoint("Start of first line")
point2 = rs.GetPoint("End of first line", point1)
point3 = rs.GetPoint("Start of second line")
point4 = rs.GetPoint("End of second line", point3)
angle = rs.Angle2( (point1, point2), (point3, point4))
if angle: print("Angle: {}".format(angle))
```

See also: Angle, Distance

## ClipboardText

```python
rs.ClipboardText(text=None)
```

Returns or sets a text string to the Windows clipboard

Arguments:

    text (str, optional): text to set

Returns: str: if text is not specified, the current text in the clipboard
str: if text is specified, the previous text in the clipboard
None: if not successful

Example:

```python
import rhinoscriptsyntax as rs
txt = rs.ClipboardText("Hello Rhino!")
if txt: rs.MessageBox(txt, 0, "Clipboard Text")
```

## ColorAdjustLuma

```python
rs.ColorAdjustLuma(rgb, luma, scale=False)
```

Changes the luminance of a red-green-blue value. Hue and saturation are
    not affected

Arguments:

    rgb (color): initial rgb value
    luma (number): The luminance in units of 0.1 percent of the total range. A
        value of luma = 50 corresponds to 5 percent of the maximum luminance
    scale (bool, optional): if True, luma specifies how much to increment or decrement the
        current luminance. If False, luma specified the absolute luminance.

Returns: color: modified rgb value if successful

Example:

```python
import rhinoscriptsyntax as rs
rgb = rs.ColorAdjustLuma((128, 128, 128), 50)
print("Red = {}".format(rs.ColorRedValue(rgb)))
print("Green = {}".format(rs.ColorGreenValue(rgb)))
print("Blue = {}".format(rs.ColorBlueValue(rgb)))
```

See also: ColorHLSToRGB, ColorRGBToHLS

## ColorBlueValue

```python
rs.ColorBlueValue(rgb)
```

Retrieves intensity value for the blue component of an RGB color

Arguments:

    rgb (color): the RGB color value

Returns: number: The blue component if successful, otherwise None

Example:

```python
import rhinoscriptsyntax as rs
rgb = rs.LayerColor("Default")
print("Red = {}".format(rs.ColorRedValue(rgb)))
print("Green = {}".format(rs.ColorGreenValue(rgb)))
print("Blue = {}".format(rs.ColorBlueValue(rgb)))
```

See also: ColorGreenValue, ColorRedValue

## ColorGreenValue

```python
rs.ColorGreenValue(rgb)
```

Retrieves intensity value for the green component of an RGB color

Arguments:

    rgb (color): the RGB color value

Returns: number: The green component if successful, otherwise None

Example:

```python
import rhinoscriptsyntax as rs
rgb = rs.LayerColor("Default")
print("Red = {}".format(rs.ColorRedValue(rgb)))
print("Green = {}".format(rs.ColorGreenValue(rgb)))
print("Blue = {}".format(rs.ColorBlueValue(rgb)))
```

See also: ColorBlueValue, ColorRedValue

## ColorHLSToRGB

```python
rs.ColorHLSToRGB(hls)
```

Converts colors from hue-lumanence-saturation to RGB

Arguments:

    hls (color): the HLS color value

Returns: color: The RGB color value if successful, otherwise False

Example:

```python
import rhinoscriptsyntax as rs
rgb = rs.ColorHLSToRGB( (160, 120, 0) )
print("Red = {}".format(rs.ColorRedValue(rgb)))
print("Green = {}".format(rs.ColorGreenValue(rgb)))
print("Blue = {}".format(rs.ColorBlueValue(rgb)))
```

See also: ColorAdjustLuma, ColorRGBToHLS

## ColorRGBToHLS

```python
rs.ColorRGBToHLS(rgb)
```

Convert colors from RGB to HLS

Arguments:

    rgb (color): the RGB color value

Returns: color: The HLS color value if successful, otherwise False

Example:

```python
import rhinoscriptsyntax as rs
hls = rs.ColorRGBToHLS((128, 128, 128))
print("Hue = {}".format(hls[0]))
print("Luminance = {}".format(hls[1]))
print("Saturation = {}".format(hls[2]))
```

See also: ColorAdjustLuma, ColorHLSToRGB

## ColorRedValue

```python
rs.ColorRedValue(rgb)
```

Retrieves intensity value for the red component of an RGB color

Arguments:

    hls (color): the HLS color value

Returns: color: The red color value if successful, otherwise False

Example:

```python
import rhinoscriptsyntax as rs
rgb = rs.LayerColor("Default")
print("Red = {}".format(rs.ColorRedValue(rgb)))
print("Green = {}".format(rs.ColorGreenValue(rgb)))
print("Blue = {}".format(rs.ColorBlueValue(rgb)))
```

See also: ColorBlueValue, ColorGreenValue

## ContextIsGrasshopper

```python
rs.ContextIsGrasshopper()
```

Return True if the script is being executed in a grasshopper component

Returns: bool: True if the script is being executed in a grasshopper component

Example:

```python
import rhinoscriptsyntax as  rs
print(rs.ContextIsGrasshopper())
```

See also: ContextIsRhino

## ContextIsRhino

```python
rs.ContextIsRhino()
```

Return True if the script is being executed in the context of Rhino

Returns: bool: True if the script is being executed in the context of Rhino

Example:

```python
import rhinoscriptsyntax as  rs
print(rs.ContextIsRhino())
```

See also: ContextIsGrasshopper

## CreateColor

```python
rs.CreateColor(color, g=None, b=None, a=None)
```

Converts 'color' into a native color object if possible.
    The returned data is accessible by indexing, and that is the suggested method to interact with the type.
    Red index is [0], Green index is [1], Blue index is [2] and Alpha index is [3].
    If the provided object is already a color, its value is copied.
    Alternatively, you can also pass three coordinates singularly for an RGB color, or four
    for an RGBA color point.

Arguments:

    color ([number, number, number]): list or 3 or 4 items. Also, a single int can be passed and it will be bitwise-parsed.

Returns: color: An object that can be indexed for red, green, blu, alpha. Item[0] is red.

## CreateInterval

```python
rs.CreateInterval(interval, y=None)
```

Converts 'interval' into a Rhino.Geometry.Interval.
    If the provided object is already an interval, its value is copied.
    In case the conversion fails, an error is raised.
    In case a single number is provided, it will be translated to an increasing interval that includes
    the provided input and 0. If two values are provided, they will be used instead.

Arguments:

    interval ([number, number]): or any item that can be accessed at index 0 and 1; an Interval

Returns: interval: a Rhino.Geometry.Interval. This can be seen as an object made of two items:
  [0] start of interval
  [1] end of interval

## CreatePlane

```python
rs.CreatePlane(plane_or_origin, x_axis=None, y_axis=None, ignored=None)
```

Converts input into a Rhino.Geometry.Plane object if possible.
    If the provided object is already a plane, its value is copied.
    The returned data is accessible by indexing[origin, X axis, Y axis, Z axis], and that is the suggested method to interact with the type.
    The Z axis is in any case computed from the X and Y axes, so providing it is possible but not required.
    If the conversion fails, an error is raised.

Arguments:

    plane (plane|point|point, vector, vector|[point, vector, vector])

Returns: plane: A Rhino.Geometry.plane.

## CreatePoint

```python
rs.CreatePoint(point, y=None, z=None)
```

Converts 'point' into a Rhino.Geometry.Point3d if possible.
    If the provided object is already a point, it value is copied.
    In case the conversion fails, an error is raised.
    Alternatively, you can also pass two coordinates singularly for a
    point on the XY plane, or three for a 3D point.

Arguments:

    point (Point3d|Vector3d|Point3f|Vector3f|str|guid|[number, number, number])

Returns: point: a Rhino.Geometry.Point3d. This can be seen as an object with three indices:
  [0]  X coordinate
  [1]  Y coordinate
  [2]  Z coordinate.

## CreateVector

```python
rs.CreateVector(vector, y=None, z=None)
```

Converts 'vector' into a Rhino.Geometry.Vector3d if possible.
    If the provided object is already a vector, it value is copied.
    If the conversion fails, an error is raised.
    Alternatively, you can also pass two coordinates singularly for a
    vector on the XY plane, or three for a 3D vector.

Arguments:

    vector (Vector3d|Point3d|Point3f|Vector3f\str|guid|[number, number, number])
    raise_on_error (bool, optionals): True or False

Returns: a Rhino.Geometry.Vector3d. This can be seen as an object with three indices:
result[0]: X component, result[1]: Y component, and result[2] Z component.

## CreateXform

```python
rs.CreateXform(xform)
```

Converts input into a Rhino.Geometry.Transform object if possible.
    If the provided object is already a transform, its value is copied.
    The returned data is accessible by indexing[row, column], and that is the suggested method to interact with the type.
    If the conversion fails, an error is raised.

Arguments:

    xform (list): the transform. This can be seen as a 4x4 matrix, given as nested lists or tuples.

Returns: transform: A Rhino.Geometry.Transform. result[0,3] gives access to the first row, last column.

## CullDuplicateNumbers

```python
rs.CullDuplicateNumbers(numbers, tolerance=None)
```

Removes duplicates from an array of numbers.

Arguments:

    numbers ([number, ...]): list or tuple
    tolerance (number, optional): The minimum distance between numbers.  Numbers that fall within this tolerance will be discarded.  If omitted, Rhino's internal zero tolerance is used.

Returns: list(number, ...): numbers with duplicates removed if successful.

Example:

```python
import rhinoscriptsyntax as rs
arr = [1,1,2,2,3,3,4,4,5,5]
arr = rs.CullDuplicateNumbers(arr)
for n in arr: print(n)
```

See also: CullDuplicatePoints

## CullDuplicatePoints

```python
rs.CullDuplicatePoints(points, tolerance=-1)
```

Removes duplicates from a list of 3D points.

Arguments:

    points ([point, ...]): A list of 3D points.
    tolerance (number): Minimum distance between points. Points within this
      tolerance will be discarded. If omitted, Rhino's internal zero tolerance
      is used.

Returns: list(point, ...): of 3D points with duplicates removed if successful.
None: if not successful

Example:

```python
import rhinoscriptsyntax as rs
points = rs.GetPoints(,,"First point", "Next point")
if points:
    points= rs.CullDuplicatePoints(points)
    for p in points: print(p)
```

See also: CullDuplicateNumbers

## Distance

```python
rs.Distance(point1, point2)
```

Measures distance between two 3D points, or between a 3D point and
    an array of 3D points.

Arguments:

    point1 (point): The first 3D point.
    point2 (point): The second 3D point or list of 3-D points.

Returns: point: If point2 is a 3D point then the distance if successful.
point: If point2 is a list of points, then an list of distances if successful.
None: if not successful

Example:

```python
import rhinoscriptsyntax as rs
point1 = rs.GetPoint("First point")
if point1:
    point2 = rs.GetPoint("Second point")
    if point2:
        print("Distance: {}".format(rs.Distance(point1, point2)))
```

See also: Angle, Angle2

## GetSettings

```python
rs.GetSettings(filename, section=None, entry=None)
```

Returns string from a specified section in a initialization file.

Arguments:

    filename (str): name of the initialization file
    section (str, optional): section containing the entry
    entry (str, optional): entry whose associated string is to be returned

Returns: list(str, ...): If section is not specified, a list containing all section names
list:(str, ...): If entry is not specified, a list containing all entry names for a given section
str: If section and entry are specified, a value for entry
None: if not successful

Example:

```python
import rhinoscriptsyntax as rs
filename = rs.OpenFileName("Open", "Initialization Files (*.ini)|*.ini||")
if filename:
    sections = rs.GetSettings(filename)
    if sections:
        section = rs.ListBox(sections, "Select a section", filename)
        if section:
            entries = rs.GetSettings(filename, section)
            if entries:
                entry = rs.ListBox(entries, "Select an entry", section)
                if entry:
                    value = rs.GetSettings(filename, section, entry)
                    if value: rs.MessageBox( value, 0, entry )
```

## Polar

```python
rs.Polar(point, angle_degrees, distance, plane=None)
```

Returns 3D point that is a specified angle and distance from a 3D point

Arguments:

    point (point): the point to transform
    plane (plane, optional): plane to base the transformation. If omitted, the world
      x-y plane is used

Returns: point: resulting point is successful
None: on error

Example:

```python
import rhinoscriptsyntax as rs
point = (1.0, 1.0, 0.0)
result = rs.Polar(point, 45.0, 1.414214)
print(result)
```

See also: PointAdd, PointCompare, PointDivide, PointScale, PointSubtract

## SimplifyArray

```python
rs.SimplifyArray(points)
```

Flattens an array of 3-D points into a one-dimensional list of real numbers. For example, if you had an array containing three 3-D points, this method would return a one-dimensional array containing nine real numbers.

Arguments:

    points ([point, ...]): Points to flatten

Returns: list(number, ...): A one-dimensional list containing real numbers, if successful, otherwise None

Example:

```python
import rhinoscriptsyntax as rs
points = rs.GetPoints()
if points:
    numbers = rs.SimplifyArray(points)
    for n in numbers: print(n)
```

## Sleep

```python
rs.Sleep(milliseconds)
```

Suspends execution of a running script for the specified interval

Arguments:

    milliseconds (number): thousands of a second

Returns: None

Example:

```python
import rhinoscriptsyntax as rs
print("This")
rs.Sleep(2000)
print("is")
rs.Sleep(2000)
print("a")
rs.Sleep(2000)
print("slow")
rs.Sleep(2000)
print("message!")
```

## SortPointList

```python
rs.SortPointList(points, tolerance=None)
```

Sorts list of points so they will be connected in a "reasonable" polyline order

Arguments:

    points ({point, ...])the points to sort
    tolerance (number, optional): minimum distance between points. Points that fall within this tolerance
      will be discarded. If omitted, Rhino's internal zero tolerance is used.

Returns: list(point, ...): of sorted 3D points if successful
None: on error

Example:

```python
import rhinoscriptsyntax as rs
points = rs.GetPointCoordinates()
if points:
    sorted = rs.SortPointList(points)
    rs.AddPolyline(sorted)
```

See also: SortPoints

## SortPoints

```python
rs.SortPoints(points, ascending=True, order=0)
```

Sorts the components of an array of 3D points

Arguments:

    points ([point, ...]): points to sort
    ascending (bool, optional: ascending if omitted (True) or True, descending if False.
    order (number, optional): the component sort order
      Value       Component Sort Order
      0 (default) X, Y, Z
      1           X, Z, Y
      2           Y, X, Z
      3           Y, Z, X
      4           Z, X, Y
      5           Z, Y, X

Returns: list(point, ...): sorted 3-D points if successful
None: if not successful

Example:

```python
import rhinoscriptsyntax as rs
points = rs.GetPoints()
if points:
    points = rs.SortPoints(points)
    for p in points: print(p)
```

## Str2Pt

```python
rs.Str2Pt(point)
```

convert a formatted string value into a 3D point value

Arguments:

    point (str): A string that contains a delimited point like "1,2,3".

Returns: point: Point structure from the input string.
None: error on invalid format

Example:

```python
import rhinoscriptsyntax as rs
point = rs.Str2Pt("1,2,3")
if point: rs.AddPoint( point )
```
