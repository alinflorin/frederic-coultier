# rhinoscriptsyntax: dimension

## AddAlignedDimension

```python
rs.AddAlignedDimension(start_point, end_point, point_on_dimension_line, style=None)
```

Adds an aligned dimension object to the document. An aligned dimension
    is a linear dimension lined up with two points

Arguments:

    start_point (point): first point of dimension
    end_point (point): second point of dimension
    point_on_dimension_line (point): location point of dimension line
    style (str, optional): name of dimension style

Returns: guid: identifier of new dimension on success
None: on error

Example:

```python
import rhinoscriptsyntax as rs
origin = 1, 1, 0
offset = 11, 5, 0
point = 1, 3, 0
rs.AddAlignedDimension( origin, offset, point )
```

See also: IsAlignedDimension

## AddDimStyle

```python
rs.AddDimStyle(dimstyle_name=None)
```

Adds a new dimension style to the document. The new dimension style will
    be initialized with the current default dimension style properties.

Arguments:

    dimstyle_name (str, optional): name of the new dimension style. If omitted, Rhino automatically generates the dimension style name

Returns: str: name of the new dimension style on success
None: on error

Example:

```python
import rhinoscriptsyntax as rs
print("New dimension style: {}".format(rs.AddDimStyle()))
print("New dimension style: {}".format(rs.AddDimStyle("MyDimStyle")))
```

See also: CurrentDimStyle, DeleteDimStyle, IsDimStyle, RenameDimStyle

## AddLeader

```python
rs.AddLeader(points, view_or_plane=None, text=None)
```

Adds a leader to the document. Leader objects are planar.
    The 3D points passed to this function should be co-planar

Arguments:

    points ([point, point, ....])list of (at least 2) 3D points
    view_or_plane (str, optional): If a view name is specified, points will be constrained
      to the view's construction plane. If a view is not specified, points
      will be constrained to a plane fit through the list of points
    text (str, optional): leader's text string

Returns: guid: identifier of the new leader on success
None: on error

Example:

```python
import rhinoscriptsyntax as rs
points = rs.GetPoints(True, False, "Select leader points")
if points: rs.AddLeader( points )
```

See also: IsLeader, LeaderText

## AddLinearDimension

```python
rs.AddLinearDimension(plane, start_point, end_point, point_on_dimension_line)
```

Adds a linear dimension to the document

Arguments:

    plane (plane): The plane on which the dimension will lie.
    start_point (point): The origin, or first point of the dimension.
    end_point (point): The offset, or second point of the dimension.
    point_on_dimension_line (point): A point that lies on the dimension line.

Returns: guid: identifier of the new object on success
None: on error

Example:

```python
import rhinoscriptsyntax as  rs
points = rs.GetPoints(True,  False, "Select 3 dimension points")
if points and len(points)>2:
    rs.AddLinearDimension(rs.WorldXYPlane(),  points[0], points[1], points[2] )
```

See also: IsLeader, LeaderText

## CurrentDimStyle

```python
rs.CurrentDimStyle(dimstyle_name=None)
```

Returns or changes the current default dimension style

Arguments:

    dimstyle_name (str, optional): name of an existing dimension style to make current

Returns: str: if dimstyle_name is not specified, name of the current dimension style
str: if dimstyle_name is specified, name of the previous dimension style
None: on error

Example:

```python
import rhinoscriptsyntax as rs
rs.AddDimStyle("MyDimStyle")
rs.CurrentDimStyle("MyDimStyle")
```

See also: AddDimStyle, DeleteDimStyle, IsDimStyle, RenameDimStyle

## DeleteDimStyle

```python
rs.DeleteDimStyle(dimstyle_name)
```

Removes an existing dimension style from the document. The dimension style
    to be removed cannot be referenced by any dimension objects.

Arguments:

    dimstyle_name (str): the name of an unreferenced dimension style

Returns: str: The name of the deleted dimension style if successful
None: on error

Example:

```python
import rhinoscriptsyntax as rs
dimstyle = rs.GetString("Dimension style to remove")
if dimstyle: rs.DeleteDimStyle(dimstyle)
```

See also: AddDimStyle, CurrentDimStyle, IsDimStyle, RenameDimStyle

## DimStyleAnglePrecision

```python
rs.DimStyleAnglePrecision(dimstyle, precision=None)
```

Returns or changes the angle display precision of a dimension style

Arguments:

    dimstyle (str): the name of an existing dimension style
    precision (number, optional): the new angle precision value. If omitted, the current angle
      precision is returned

Returns: number: If a precision is not specified, the current angle precision
number: If a precision is specified, the previous angle precision

Example:

```python
import rhinoscriptsyntax as rs
dimstyle = rs.CurrentDimStyle()
precision = rs.DimStyleAnglePrecision(dimstyle)
if precision>2:
    rs.DimStyleAnglePrecision( dimstyle, 2 )
```

See also: DimStyleArrowSize, DimStyleExtension, DimStyleFont, DimStyleLinearPrecision, DimStyleNumberFormat, DimStyleOffset, DimStyleTextAlignment, DimStyleTextHeight

## DimStyleArrowSize

```python
rs.DimStyleArrowSize(dimstyle, size=None)
```

Returns or changes the arrow size of a dimension style

Arguments:

    dimstyle (str): the name of an existing dimension style
    size (number, optional): the new arrow size. If omitted, the current arrow size is returned

Returns: number: If size is not specified, the current arrow size
number: If size is specified, the previous arrow size
None: on error

Example:

```python
import rhinoscriptsyntax as rs
dimstyle = rs.CurrentDimStyle()
size = rs.DimStyleArrowSize(dimstyle)
if size>1.0: rs.DimStyleArrowSize( dimstyle, 1.0 )
```

See also: DimStyleAnglePrecision, DimStyleExtension, DimStyleFont, DimStyleLinearPrecision, DimStyleNumberFormat, DimStyleOffset, DimStyleTextAlignment, DimStyleTextHeight

## DimStyleCount

```python
rs.DimStyleCount()
```

Returns the number of dimension styles in the document

Returns: number: the number of dimension styles in the document

Example:

```python
import rhinoscriptsyntax as rs
count = rs.DimStyleCount()
print("There are", count, "dimension styles.")
```

See also: DimStyleNames, IsDimStyle

## DimStyleExtension

```python
rs.DimStyleExtension(dimstyle, extension=None)
```

Returns or changes the extension line extension of a dimension style

Arguments:

    dimstyle (str): the name of an existing dimension style
    extension (number, optional): the new extension line extension

Returns: number: if extension is not specified, the current extension line extension
number: if extension is specified, the previous extension line extension
None: on error

Example:

```python
import rhinoscriptsyntax as rs
dimstyle = rs.CurrentDimStyle()
extension = rs.DimStyleExtension(dimstyle)
if extension>0.5: rs.DimStyleExtension( dimstyle, 0.5 )
```

See also: DimStyleAnglePrecision, DimStyleArrowSize, DimStyleFont, DimStyleLinearPrecision, DimStyleNumberFormat, DimStyleOffset, DimStyleTextAlignment, DimStyleTextHeight

## DimStyleFont

```python
rs.DimStyleFont(dimstyle, font=None)
```

Returns or changes the font used by a dimension style

Arguments:

    dimstyle (str): the name of an existing dimension style
    font (str, optional): the new font face name

Returns: str: if font is not specified, the current font if successful
str: if font is specified, the previous font if successful
None: on error

Example:

```python
import rhinoscriptsyntax as rs
dimstyle = rs.CurrentDimStyle()
font = rs.DimStyleFont(dimstyle)
if font!="Arial": rs.DimStyleFont( dimstyle, "Arial" )
```

See also: DimStyleAnglePrecision, DimStyleArrowSize, DimStyleExtension, DimStyleLinearPrecision, DimStyleNumberFormat, DimStyleOffset, DimStyleTextAlignment, DimStyleTextHeight

## DimStyleLeaderArrowSize

```python
rs.DimStyleLeaderArrowSize(dimstyle, size=None)
```

Returns or changes the leader arrow size of a dimension style

Arguments:

    dimstyle (str): the name of an existing dimension style
    size (number, optional) the new leader arrow size

Returns: number: if size is not specified, the current leader arrow size
number: if size is specified, the previous leader arrow size
None: on error

Example:

```python
import rhinoscriptsyntax as rs
dimstyle = rs.CurrentDimStyle()
size = rs.DimStyleLeaderArrowSize(dimstyle)
if size>1.0: rs.DimStyleLeaderArrowSize( dimstyle, 1.0 )
```

See also: DimStyleAnglePrecision, DimStyleArrowSize, DimStyleExtension, DimStyleFont, DimStyleLinearPrecision, DimStyleNumberFormat, DimStyleOffset, DimStyleTextAlignment, DimStyleTextHeight

## DimStyleLengthFactor

```python
rs.DimStyleLengthFactor(dimstyle, factor=None)
```

Returns or changes the length factor of a dimension style. Length factor
    is the conversion between Rhino units and dimension units

Arguments:

    dimstyle (str): the name of an existing dimension style
    factor (number, optional): the new length factor

Returns: number: if factor is not defined, the current length factor
number: if factor is defined, the previous length factor
None: on error

Example:

```python
import rhinoscriptsyntax as rs
dimstyle = rs.CurrentDimStyle()
factor = rs.DimStyleLengthFactor(dimstyle)
if factor>1.0: rs.DimStyleLengthFactor( dimstyle, 1.0 )
```

See also: DimStylePrefix, DimStyleSuffix

## DimStyleLinearPrecision

```python
rs.DimStyleLinearPrecision(dimstyle, precision=None)
```

Returns or changes the linear display precision of a dimension style

Arguments:

    dimstyle (str): the name of an existing dimension style
    precision (number, optional): the new linear precision value

Returns: number: if precision is not specified, the current linear precision value
number: if precision is specified, the previous linear precision value
None: on error

Example:

```python
import rhinoscriptsyntax as rs
dimstyle = rs.CurrentDimStyle()
precision = rs.DimStyleLinearPrecision(dimstyle)
if precision>2: rs.DimStyleLinearPrecision( dimstyle, 2 )
```

See also: DimStyleAnglePrecision, DimStyleArrowSize, DimStyleExtension, DimStyleFont, DimStyleNumberFormat, DimStyleOffset, DimStyleTextAlignment, DimStyleTextHeight

## DimStyleNames

```python
rs.DimStyleNames(sort=False)
```

Returns the names of all dimension styles in the document

Arguments:

    sort (bool): sort the list if True, not sorting is the default (False)

Returns: list(str, ...): the names of all dimension styles in the document

Example:

```python
import rhinoscriptsyntax as rs
dimstyles = rs.DimStyleNames()
if dimstyles:
    for dimstyle in dimstyles: print(dimstyle)
```

See also: DimStyleCount, IsDimStyle

## DimStyleNumberFormat

```python
rs.DimStyleNumberFormat(dimstyle, format=None)
```

Returns or changes the number display format of a dimension style

Arguments:

    dimstyle (str): the name of an existing dimension style
    format (number, optional) the new number format
       0 = Decimal
       1 = Fractional
       2 = Feet and inches

Returns: number: if format is not specified, the current display format
number: if format is specified, the previous display format
None: on error

Example:

```python
import rhinoscriptsyntax as rs
dimstyle = rs.CurrentDimStyle()
format = rs.DimStyleNumberFormat(dimstyle)
if format>0: rs.DimStyleNumberFormat( dimstyle, 0 )
```

See also: DimStyleAnglePrecision, DimStyleArrowSize, DimStyleExtension, DimStyleFont, DimStyleLinearPrecision, DimStyleOffset, DimStyleTextAlignment, DimStyleTextHeight

## DimStyleOffset

```python
rs.DimStyleOffset(dimstyle, offset=None)
```

Returns or changes the extension line offset of a dimension style

Arguments:

    dimstyle (str): the name of an existing dimension style
    offset (number, optional): the new extension line offset

Returns: number: if offset is not specified, the current extension line offset
number: if offset is specified, the previous extension line offset
None: on error

Example:

```python
import rhinoscriptsyntax as rs
dimstyle = rs.CurrentDimStyle()
offset = rs.DimStyleOffset(dimstyle)
if offset>0.5: rs.DimStyleOffset( dimstyle, 0.5 )
```

See also: DimStyleAnglePrecision, DimStyleArrowSize, DimStyleExtension, DimStyleFont, DimStyleLinearPrecision, DimStyleNumberFormat, DimStyleTextAlignment, DimStyleTextHeight

## DimStylePrefix

```python
rs.DimStylePrefix(dimstyle, prefix=None)
```

Returns or changes the prefix of a dimension style - the text to
    prefix to the dimension text.

Arguments:

    dimstyle (str): the name of an existing dimstyle
    prefix (str, optional): the new prefix

Returns: str: if prefix is not specified, the current prefix
str: if prefix is specified, the previous prefix
None: on error

Example:

```python
import rhinoscriptsyntax as rs
dimstyle = rs.CurrentDimStyle()
rs.DimStylePrefix( dimstyle, "[" )
```

See also: DimStyleLengthFactor, DimStyleSuffix

## DimStyleScale

```python
rs.DimStyleScale(dimstyle, scale=None)
```

Returns or modifies the scale of a dimension style.

Arguments:

    dimstyle (str): the name of an existing dimstyle
    scale (number, optional): the new scale value

Returns: number: if scale is not specified, the current scale
number: if scale is specified, the previous scale
None: on error

Example:

```python
import rhinoscriptsyntax as rs
from scriptcontext import doc
dimstyle = doc.DimStyles.Current
scale = rs.DimStyleScale(dimstyle)
rs.DimStyleScale(dimstyle, scale*2.0)
```

See also: DimStyleTextHeight, DimStyleOffset

## DimStyleSuffix

```python
rs.DimStyleSuffix(dimstyle, suffix=None)
```

Returns or changes the suffix of a dimension style - the text to
    append to the dimension text.

Arguments:

    dimstyle (str): the name of an existing dimstyle
    suffix (str, optional): the new suffix

Returns: str: if suffix is not specified, the current suffix
str: if suffix is specified, the previous suffix
None: on error

Example:

```python
import rhinoscriptsyntax as rs
dimstyle = rs.CurrentDimStyle()
rs.DimStyleSuffix( dimstyle, "}" )
```

See also: DimStyleLengthFactor, DimStylePrefix

## DimStyleTextAlignment

```python
rs.DimStyleTextAlignment(dimstyle, alignment=None)
```

Returns or changes the text alignment mode of a dimension style

Arguments:

    dimstyle (str): the name of an existing dimension style
    alignment (number, optional): the new text alignment
        0 = Normal (same as 2)
        1 = Horizontal to view
        2 = Above the dimension line
        3 = In the dimension line

Returns: number: if alignment is not specified, the current text alignment
number: if alignment is specified, the previous text alignment
None: on error

Example:

```python
import rhinoscriptsyntax as rs
dimstyle = rs.CurrentDimStyle()
alignment = rs.DimStyleTextAlignment(dimstyle)
if alignment!=2: rs.DimStyleTextAlignment( dimstyle, 2 )
```

See also: DimStyleAnglePrecision, DimStyleArrowSize, DimStyleExtension, DimStyleFont, DimStyleLinearPrecision, DimStyleNumberFormat, DimStyleOffset, DimStyleTextHeight

## DimStyleTextGap

```python
rs.DimStyleTextGap(dimstyle, gap=None)
```

Returns or changes the text gap used by a dimension style

Arguments:

    dimstyle (str): the name of an existing dimension style
    gap (number, optional): the new text gap

Returns: number: if gap is not specified, the current text gap
number: if gap is specified, the previous text gap
None: on error

Example:

```python
import rhinoscriptsyntax as rs
dimstyle = rs.CurrentDimStyle()
gap = rs.DimStyleTextGap(dimstyle)
if gap>0.25: rs.DimStyleTextGap( dimstyle, 0.25 )
```

See also: DimStyleAnglePrecision, DimStyleArrowSize, DimStyleExtension, DimStyleFont, DimStyleLinearPrecision, DimStyleNumberFormat, DimStyleOffset, DimStyleTextAlignment, DimStyleTextHeight

## DimStyleTextHeight

```python
rs.DimStyleTextHeight(dimstyle, height=None)
```

Returns or changes the text height used by a dimension style

Arguments:

    dimstyle (str): the name of an existing dimension style
    height (number, optional): the new text height

Returns: number: if height is not specified, the current text height
number: if height is specified, the previous text height
None: on error

Example:

```python
import rhinoscriptsyntax as rs
dimstyle = rs.CurrentDimStyle()
height = rs.DimStyleTextHeight(dimstyle)
if offset>1.0: rs.DimStyleTextHeight( dimstyle, 1.0 )
```

See also: DimStyleAnglePrecision, DimStyleArrowSize, DimStyleExtension, DimStyleFont, DimStyleLinearPrecision, DimStyleNumberFormat, DimStyleOffset, DimStyleTextAlignment

## DimensionStyle

```python
rs.DimensionStyle(object_id, dimstyle_name=None)
```

Returns or modifies the dimension style of a dimension object

Arguments:

    object_id (guid): identifier of the object
    dimstyle_name (str, optional): the name of an existing dimension style

Returns: str: if dimstyle_name is not specified, the object's current dimension style name
str: if dimstyle_name is specified, the object's previous dimension style name
None: on error

Example:

```python
import rhinoscriptsyntax as rs
obj = rs.GetObject("Select a dimension")
if rs.IsDimension(obj): rs.DimensionStyle(obj, "Default")
```

See also: DimStyleNames, IsDimStyle

## DimensionText

```python
rs.DimensionText(object_id)
```

Returns the text displayed by a dimension object

Arguments:

    object_id (guid): identifier of the object

Returns: str: the text displayed by a dimension object

Example:

```python
import rhinoscriptsyntax as rs
obj = rs.GetObject("Select a dimension")
if rs.IsDimension(obj):
    print(rs.DimensionText(obj))
```

See also: DimensionUserText, DimensionValue, IsDimension

## DimensionUserText

```python
rs.DimensionUserText(object_id, usertext=None)
```

Returns of modifies the user text string of a dimension object. The user
    text is the string that gets printed when the dimension is defined

Arguments:

    object_id (guid): identifier of the object
    usertext (str, optional): the new user text string value

Returns: str: if usertext is not specified, the current usertext string
str: if usertext is specified, the previous usertext string

Example:

```python
import rhinoscriptsyntax as rs
obj = rs.GetObject("Select a dimension")
if rs.IsDimension(obj):
    usertext = "!= " + chr(177) + str(rs.UnitAbsoluteTolerance())
    rs.DimensionUserText( obj, usertext )
```

See also: DimensionText, DimensionValue, IsDimension

## DimensionValue

```python
rs.DimensionValue(object_id)
```

Returns the value of a dimension object

Arguments:

    object_id (guid): identifier of the object

Returns: number: numeric value of the dimension if successful

Example:

```python
import rhinoscriptsyntax as rs
obj = rs.GetObject("Select a dimension")
if rs.IsDimension(obj):
    print(rs.DimensionValue(obj))
```

See also: DimensionText, DimensionUserText, IsDimension

## IsAlignedDimension

```python
rs.IsAlignedDimension(object_id)
```

Verifies an object is an aligned dimension object

Arguments:

    object_id (guid): the object's identifier

Returns: bool: True or False.  None on error

Example:

```python
import rhinoscriptsyntax as rs
obj = rs.GetObject("Select a dimension")
if rs.IsAlignedDimension(obj):
    print("The object is an aligned dimension.")
else:
    print("The object is not an aligned dimension.")
```

See also: IsAngularDimension, IsDiameterDimension, IsDimension, IsLinearDimension, IsOrdinateDimension, IsRadialDimension

## IsAngularDimension

```python
rs.IsAngularDimension(object_id)
```

Verifies an object is an angular dimension object

Arguments:

    object_id (guid): the object's identifier

Returns: bool: True or False.
None: on error

Example:

```python
import rhinoscriptsyntax as rs
obj = rs.GetObject("Select a dimension")
if rs.IsAngularDimension(obj):
    print("The object is an angular dimension.")
else:
    print("The object is not an angular dimension.")
```

See also: IsAlignedDimension, IsDiameterDimension, IsDimension, IsLinearDimension, IsOrdinateDimension, IsRadialDimension

## IsDiameterDimension

```python
rs.IsDiameterDimension(object_id)
```

Verifies an object is a diameter dimension object

Arguments:

    object_id (guid): the object's identifier

Returns: bool: True or False.
None: on error

Example:

```python
import rhinoscriptsyntax as rs
obj = rs.GetObject("Select a dimension")
if rs.IsDiameterDimension(obj):
    print("The object is a diameter dimension.")
else:
    print("The object is not a diameter dimension.")
```

See also: IsAlignedDimension, IsAngularDimension, IsDimension, IsLinearDimension, IsOrdinateDimension, IsRadialDimension

## IsDimStyle

```python
rs.IsDimStyle(dimstyle)
```

Verifies the existance of a dimension style in the document

Arguments:

    dimstyle (str): the name of a dimstyle to test for

Returns: bool: True or False.
None: on error

Example:

```python
import rhinoscriptsyntax as rs
dimstyle = rs.GetString("Dimension style to test")
if rs.IsDimStyle(dimstyle):
    if rs.IsDimStyleReference(dimstyle):
        print("The dimension style is from a reference file.")
    else:
        print("The dimension style is not from a reference file.")
else:
    print("The dimension style does not exist.")
```

See also: IsDimStyleReference

## IsDimStyleReference

```python
rs.IsDimStyleReference(dimstyle)
```

Verifies that an existing dimension style is from a reference file

Arguments:

    dimstyle (str): the name of an existing dimension style

Returns: bool: True or False.
None: on error

Example:

```python
import rhinoscriptsyntax as rs
dimstyle = rs.GetString("Dimension style to test")
if rs.IsDimStyle(dimstyle):
    if rs.IsDimStyleReference(dimstyle):
        print("The dimension style is from a reference file.")
    else:
        print("The dimension style is not from a reference file.")
else:
    print("The dimension style does not exist.")
```

See also: IsDimStyle

## IsDimension

```python
rs.IsDimension(object_id)
```

Verifies an object is a dimension object

Arguments:

    object_id (guid): the object's identifier

Returns: bool: True or False.
None: on error

Example:

```python
import rhinoscriptsyntax as rs
obj = rs.GetObject("Select a dimension")
if rs.IsDimension(obj):
    print("The object is a dimension.")
else:
    print("The object is not a dimension.")
```

See also: IsAlignedDimension, IsAngularDimension, IsDiameterDimension, IsLinearDimension, IsOrdinateDimension, IsRadialDimension

## IsLeader

```python
rs.IsLeader(object_id)
```

Verifies an object is a dimension leader object

Arguments:

    object_id (guid): the object's identifier

Returns: bool: True or False.
None: on error

Example:

```python
import rhinoscriptsyntax as rs
obj = rs.GetObject("Select a leader")
if rs.IsLeader(obj):
    print("The object is a leader.")
else:
    print("The object is not a leader.")
```

See also: AddLeader, LeaderText

## IsLinearDimension

```python
rs.IsLinearDimension(object_id)
```

Verifies an object is a linear dimension object

Arguments:

    object_id (guid): the object's identifier

Returns: bool: True or False.
None: on error

Example:

```python
import rhinoscriptsyntax as rs
obj = rs.GetObject("Select a dimension")
if rs.IsLinearDimension(obj):
    print("The object is a linear dimension.")
else:
    print("The object is not a linear dimension.")
```

See also: IsAlignedDimension, IsAngularDimension, IsDiameterDimension, IsDimension, IsOrdinateDimension, IsRadialDimension

## IsOrdinateDimension

```python
rs.IsOrdinateDimension(object_id)
```

Verifies an object is an ordinate dimension object

Arguments:

    object_id (guid): the object's identifier

Returns: bool: True or False.
None: on error

Example:

```python
import rhinoscriptsyntax as rs
obj = rs.GetObject("Select a dimension")
if rs.IsOrdinateDimension(obj):
    print("The object is an ordinate dimension.")
else:
    print("The object is not an ordinate dimension.")
```

See also: IsAlignedDimension, IsAngularDimension, IsDiameterDimension, IsDimension, IsLinearDimension, IsRadialDimension

## IsRadialDimension

```python
rs.IsRadialDimension(object_id)
```

Verifies an object is a radial dimension object

Arguments:

    object_id (guid): the object's identifier

Returns: bool: True or False.
None: on error

Example:

```python
import rhinoscriptsyntax as rs
obj = rs.GetObject("Select a dimension")
if rs.IsRadialDimension(obj):
    print("The object is a radial dimension.")
else:
    print("The object is not a radial dimension.")
```

See also: IsAlignedDimension, IsAngularDimension, IsDiameterDimension, IsDimension, IsLinearDimension, IsOrdinateDimension

## LeaderText

```python
rs.LeaderText(object_id, text=None)
```

Returns or modifies the text string of a dimension leader object

Arguments:

    object_id (guid): the object's identifier
    text (string, optional): the new text string

Returns: str: if text is not specified, the current text string
str: if text is specified, the previous text string
None on error

Example:

```python
import rhinoscriptsyntax as rs
obj = rs.GetObject("Select a leader")
if rs.IsLeader(obj): print(rs.LeaderText(obj))
```

See also: AddLeader, IsLeader

## RenameDimStyle

```python
rs.RenameDimStyle(oldstyle, newstyle)
```

Renames an existing dimension style

Arguments:

    oldstyle (str): the name of an existing dimension style
    newstyle (str): the new dimension style name

Returns: str: the new dimension style name if successful
None: on error

Example:

```python
import rhinoscriptsyntax as rs
oldstyle = rs.GetString("Old dimension style name")
if oldstyle:
    newstyle = rs.GetString("New dimension style name")
    if newstyle: rs.RenameDimStyle( oldstyle, newstyle )
```

See also: AddDimStyle, CurrentDimStyle, DeleteDimStyle, IsDimStyle
