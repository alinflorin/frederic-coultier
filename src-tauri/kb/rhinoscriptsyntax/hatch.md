# rhinoscriptsyntax: hatch

## AddHatch

```python
rs.AddHatch(curve_id, hatch_pattern=None, scale=1.0, rotation=0.0)
```

Creates a new hatch object from a closed planar curve object

Arguments:

    curve_id (guid): identifier of the closed planar curve that defines the
        boundary of the hatch object
    hatch_pattern (str, optional): name of the hatch pattern to be used by the hatch
        object. If omitted, the current hatch pattern will be used
    scale (number, optional): hatch pattern scale factor
    rotation (number, optional): hatch pattern rotation angle in degrees.

Returns: guid:identifier of the newly created hatch on success
None on error

Example:

```python
import rhinoscriptsyntax as rs
circle = rs.AddCircle(rs.WorldXYPlane(), 10.0)
if rs.IsHatchPattern("Grid"):
    rs.AddHatch( circle, "Grid" )
else:
    rs.AddHatch( circle, rs.CurrentHatchPattern() )
```

See also: AddHatches, CurrentHatchPattern, HatchPatternNames

## AddHatchPatterns

```python
rs.AddHatchPatterns(filename, replace=False)
```

Adds hatch patterns to the document by importing hatch pattern definitions
    from a pattern file.

Arguments:

    filename (str): name of the hatch pattern file
    replace (bool, optional): If hatch pattern names already in the document match hatch
        pattern names in the pattern definition file, then the existing hatch
        patterns will be redefined

Returns: list(str, ...): Names of the newly added hatch patterns if successful
None: on error

Example:

```python
import rhinoscriptsyntax as rs
filename = rs.OpenFileName("Import", "Pattern Files (*.pat)|*.pat||")
if filename:
    patterns = rs.AddHatchPatterns(filename)
    if patterns:
        for pattern in patterns: print(pattern)
```

See also: HatchPatternCount, HatchPatternNames

## AddHatches

```python
rs.AddHatches(curve_ids, hatch_pattern=None, scale=1.0, rotation=0.0, tolerance=None)
```

Creates one or more new hatch objects a list of closed planar curves

Arguments:

    curve_ids ([guid, ...]): identifiers of the closed planar curves that defines the
        boundary of the hatch objects
    hatch_pattern (str, optional):  name of the hatch pattern to be used by the hatch
        object. If omitted, the current hatch pattern will be used
    scale (number, optional): hatch pattern scale factor
    rotation (number, optional): hatch pattern rotation angle in degrees.
    tolerance (number, optional): tolerance for hatch fills.

Returns: list(guid, ...): identifiers of the newly created hatch on success
None: on error

Example:

```python
import rhinoscriptsyntax as rs
curves = rs.GetObjects("Select closed planar curves", rs.filter.curve)
if curves:
    if rs.IsHatchPattern("Grid"):
        rs.AddHatches( curves, "Grid" )
    else:
        rs.AddHatches( curves, rs.CurrentHatchPattern() )
```

See also: AddHatch, CurrentHatchPattern, HatchPatternNames

## CurrentHatchPattern

```python
rs.CurrentHatchPattern(hatch_pattern=None)
```

Returns or sets the current hatch pattern file

Arguments:

    hatch_pattern(str, optional):  name of an existing hatch pattern to make current

Returns: str: if hatch_pattern is not specified, the current hatch pattern
str: if hatch_pattern is specified, the previous hatch pattern
None: on error

Example:

```python
import rhinoscriptsyntax as rs
if rs.IsHatchPattern("Hatch2"): rs.CurrentHatchPattern("Hatch2")
```

See also: HatchPatternCount, HatchPatternNames

## ExplodeHatch

```python
rs.ExplodeHatch(hatch_id, delete=False)
```

Explodes a hatch object into its component objects. The exploded objects
    will be added to the document. If the hatch object uses a solid pattern,
    then planar face Brep objects will be created. Otherwise, line curve objects
    will be created

Arguments:

    hatch_id (guid): identifier of a hatch object
    delete (bool, optional): delete the hatch object

Returns: list(guid, ...): list of identifiers for the newly created objects
None: on error

Example:

```python
import rhinoscriptsyntax as rs
id = rs.GetObject("Select object")
if rs.IsHatch(id): rs.ExplodeHatch(id, True)
```

See also: IsHatch, HatchPattern, HatchRotation, HatchScale

## HatchPattern

```python
rs.HatchPattern(hatch_id, hatch_pattern=None)
```

Returns or changes a hatch object's hatch pattern

Arguments:

    hatch_id (guid): identifier of a hatch object
    hatch_pattern (str, optional): name of an existing hatch pattern to replace the
        current hatch pattern

Returns: str: if hatch_pattern is not specified, the current hatch pattern
str: if hatch_pattern is specified, the previous hatch pattern
None: on error

Example:

```python
import rhinoscriptsyntax as rs
objects = rs.AllObjects()
if objects is not None:
    for obj in objects:
        if rs.IsHatch(obj) and rs.HatchPattern(obj)=="Solid":
            rs.SelectObject(obj)
```

See also: AddHatch, AddHatches, HatchRotation, HatchScale, IsHatch

## HatchPatternCount

```python
rs.HatchPatternCount()
```

Returns the number of hatch patterns in the document

Returns: number: the number of hatch patterns in the document

Example:

```python
import rhinoscriptsyntax as rs
print("There are {} hatch patterns.".format(rs.HatchPatternCount()))
```

See also: HatchPatternNames

## HatchPatternDescription

```python
rs.HatchPatternDescription(hatch_pattern)
```

Returns the description of a hatch pattern. Note, not all hatch patterns
    have descriptions

Arguments:

    hatch_pattern (str): name of an existing hatch pattern

Returns: str: description of the hatch pattern on success otherwise None

Example:

```python
import rhinoscriptsyntax as rs
patterns = rs.HatchPatternNames()
for pattern in patterns:
    description = rs.HatchPatternDescription(pattern)
    if description: print("{} - {}".format(pattern, description))
    else: print(pattern)
```

See also: HatchPatternCount, HatchPatternNames

## HatchPatternFillType

```python
rs.HatchPatternFillType(hatch_pattern)
```

Returns the fill type of a hatch pattern.

Arguments:

    hatch_pattern (str): name of an existing hatch pattern

Returns: number: hatch pattern's fill type if successful
        0 = solid, uses object color
        1 = lines, uses pattern file definition
        2 = gradient, uses fill color definition
None: if unsuccessful

Example:

```python
import rhinoscriptsyntax as rs
patterns = rs.HatchPatternNames()
for pattern in patterns:
    fill = rs.HatchPatternFillType(pattern)
    print("{} - {}".format(pattern, fill))
```

See also: HatchPatternCount, HatchPatternNames

## HatchPatternNames

```python
rs.HatchPatternNames()
```

Returns the names of all of the hatch patterns in the document

Returns: list(str, ...): the names of all of the hatch patterns in the document

Example:

```python
import rhinoscriptsyntax as rs
patterns = rs.HatchPatternNames()
for pattern in patterns:
    description = rs.HatchPatternDescription(pattern)
    if description: print("{} - {}".format(pattern, description))
    else: print(pattern)
```

See also: HatchPatternCount

## HatchRotation

```python
rs.HatchRotation(hatch_id, rotation=None)
```

Returns or modifies the rotation applied to the hatch pattern when
    it is mapped to the hatch's plane

Arguments:

    hatch_id (guid): identifier of a hatch object
    rotation (number, optional): rotation angle in degrees

Returns: number: if rotation is not defined, the current rotation angle
number: if rotation is specified, the previous rotation angle
None: on error

Example:

```python
import rhinoscriptsyntax as rs
objects = rs.AllObjects()
if objects:
    for obj in objects:
        if rs.IsHatch(obj) and rs.HatchRotation(obj)>0:
            rs.HatchRotation(obj,0)
```

See also: AddHatch, AddHatches, HatchPattern, HatchScale, IsHatch

## HatchScale

```python
rs.HatchScale(hatch_id, scale=None)
```

Returns or modifies the scale applied to the hatch pattern when it is
    mapped to the hatch's plane

Arguments:

    hatch_id (guid): identifier of a hatch object
    scale (number, optional):  scale factor

Returns: number: if scale is not defined, the current scale factor
number: if scale is defined, the previous scale factor
None: on error

Example:

```python
import rhinoscriptsyntax as rs
objects = rs.NormalObjects()
if objects:
    for obj in objects:
        if rs.IsHatch(obj) and rs.HatchScale(obj)>1.0:
            rs.HatchScale(obj, 1.0)
```

See also: HatchPattern, HatchRotation, IsHatch

## IsHatch

```python
rs.IsHatch(object_id)
```

Verifies the existence of a hatch object in the document

Arguments:

    object_id (guid): identifier of an object

Returns: bool: True or False

Example:

```python
import rhinoscriptsyntax as rs
obj = rs.GetObject("Select object")
if rs.IsHatch(obj): print("Object is a hatch")
else: print("Object is not a hatch")
```

See also: HatchPattern, HatchRotation, HatchScale

## IsHatchPattern

```python
rs.IsHatchPattern(name)
```

Verifies the existence of a hatch pattern in the document

Arguments:

    name (str): the name of a hatch pattern

Returns: bool: True or False

Example:

```python
import rhinoscriptsyntax as rs
hatch = rs.GetString("Hatch pattern name")
if rs.IsHatchPattern(hatch): print("The hatch pattern exists.")
else: print("The hatch pattern does not exist.")
```

See also: IsHatchPatternCurrent, IsHatchPatternReference

## IsHatchPatternCurrent

```python
rs.IsHatchPatternCurrent(hatch_pattern)
```

Verifies that a hatch pattern is the current hatch pattern

Arguments:

    hatch_pattern (str): name of an existing hatch pattern

Returns: bool: True or False
None: on error

Example:

```python
import rhinoscriptsyntax as rs
hatch = rs.GetString("Hatch pattern name")
if rs.IsHatchPattern(hatch):
    if rs.IsHatchPatternCurrent(hatch):
        print("The hatch pattern is current.")
    else:
        print("The hatch pattern is not current.")
else: print("The hatch pattern does not exist.")
```

See also: IsHatchPattern, IsHatchPatternReference

## IsHatchPatternReference

```python
rs.IsHatchPatternReference(hatch_pattern)
```

Verifies that a hatch pattern is from a reference file

Arguments:

    hatch_pattern (str): name of an existing hatch pattern

Returns: bool: True or False
None: on error

Example:

```python
import rhinoscriptsyntax as rs
hatch = rs.GetString("Hatch pattern name")
if rs.IsHatchPattern(hatch):
    if rs.IsHatchPatternReference(hatch):
        print("The hatch pattern is reference.")
    else:
        print("The hatch pattern is not reference.")
else:
    print("The hatch pattern does not exist.")
```

See also: IsHatchPattern, IsHatchPatternCurrent
