# rhinoscriptsyntax: light

## AddDirectionalLight

```python
rs.AddDirectionalLight(start_point, end_point)
```

Adds a new directional light object to the document

Arguments:

    start_point(point): starting point of the light
    end_point (point): ending point and direction of the light

Returns: (guid): identifier of the new object if successful

Example:

```python
import rhinoscriptsyntax as rs
end = rs.GetPoint("End of light vector direction")
if end:
    start = rs.GetPoint("Start of light vector direction", end)
    if start: rs.AddDirectionalLight( start, end )
```

See also: IsDirectionalLight

## AddLinearLight

```python
rs.AddLinearLight(start_point, end_point, width=None)
```

Adds a new linear light object to the document

Arguments:

    start_point (point): starting point of the light
    end_point (point): ending point and direction of the light
    width (number): width of the light

Returns: guid: identifier of the new object if successful
None: on error

Example:

```python
import rhinoscriptsyntax as rs
start = rs.GetPoint("Light origin")
if start:
    end = rs.GetPoint("Light length and direction", start)
    if end: rs.AddLinearLight(start, end)
```

See also: IsLinearLight

## AddPointLight

```python
rs.AddPointLight(point)
```

Adds a new point light object to the document

Arguments:

    point (point): the 3d location of the point

Returns: guid: identifier of the new object if successful

Example:

```python
import rhinoscriptsyntax as rs
point = rs.GetPoint("Point light location")
if point: rs.AddPointLight(point)
```

See also: IsPointLight

## AddRectangularLight

```python
rs.AddRectangularLight(origin, width_point, height_point)
```

Adds a new rectangular light object to the document

Arguments:

    origin (point): 3d origin point of the light
    width_point (point): 3d width and direction point of the light
    height_point (point): 3d height and direction point of the light

Returns: guid: identifier of the new object if successful

Example:

```python
import rhinoscriptsyntax as rs
rect = rs.GetRectangle(2)
if rect: rs.AddRectangularLight( rect[0], rect[1], rect[3] )
```

See also: IsRectangularLight

## AddSpotLight

```python
rs.AddSpotLight(origin, radius, apex_point)
```

Adds a new spot light object to the document

Arguments:

    origin (point): 3d origin point of the light
    radius (number):  radius of the cone
    apex_point (point): 3d apex point of the light

Returns: guid: identifier of the new object

Example:

```python
import rhinoscriptsyntax as rs
radius = 5.0
origin = rs.GetPoint("Base of cone")
if origin:
    apex = rs.GetPoint("End of cone", origin)
    if apex: rs.AddSpotLight(origin, radius, apex)
```

See also: IsSpotLight, SpotLightHardness, SpotLightShadowIntensity

## EnableLight

```python
rs.EnableLight(object_id, enable=None)
```

Enables or disables a light object

Arguments:

    object_id (guid): the light object's identifier
    enable (bool, optional): the light's enabled status

Returns: bool: if enable is not specified, the current enabled status
bool: if enable is specified, the previous enabled status
None: on error

Example:

```python
import rhinoscriptsyntax as rs
id = rs.GetObject("Select light", rs.filter.light)
if id: rs.EnableLight( id, False )
```

See also: IsLight, IsLightEnabled, LightColor, LightCount, LightName, LightObjects

## IsDirectionalLight

```python
rs.IsDirectionalLight(object_id)
```

Verifies a light object is a directional light

Arguments:

    object_id (guid): the light object's identifier

Returns: bool: True or False

Example:

```python
import rhinoscriptsyntax as rs
id = rs.GetObject("Select a light", rs.filter.light)
if rs.IsDirectionalLight(id):
    print("The object is a directional light.")
else:
    print("The object is not a directional light.")
```

See also: AddDirectionalLight

## IsLight

```python
rs.IsLight(object_id)
```

Verifies an object is a light object

Arguments:

    object_id (guid): the light object's identifier

Returns: bool: True or False

Example:

```python
import rhinoscriptsyntax as rs
id = rs.GetObject("Select a light")
if rs.IsLight(id):
    print("The object is a light.")
else:
    print("The object is not a light.")
```

See also: EnableLight, IsLightEnabled, LightColor, LightCount, LightName, LightObjects

## IsLightEnabled

```python
rs.IsLightEnabled(object_id)
```

Verifies a light object is enabled

Arguments:

    object_id (guid): the light object's identifier

Returns: bool: True or False

Example:

```python
import rhinoscriptsyntax as rs
id = rs.GetObject("Select a light", rs.filter.light)
if rs.IsLightEnabled(id):
    print("The light is enabled (on).")
else:
    print("The light is disabled (off).")
```

See also: EnableLight, IsLight, LightColor, LightCount, LightName, LightObjects

## IsLightReference

```python
rs.IsLightReference(object_id)
```

Verifies a light object is referenced from another file

Arguments:

    object_id (guid): the light object's identifier

Returns: bool: True or False

Example:

```python
import rhinoscriptsyntax as rs
id = rs.GetObject("Select a light", rs.filter.light)
if rs.IsLightReference(id):
    print("The light is a reference object.")
else:
    print("The light is not a reference object.")
```

See also: IsObjectReference

## IsLinearLight

```python
rs.IsLinearLight(object_id)
```

Verifies a light object is a linear light

Arguments:

    object_id (guid): the light object's identifier

Returns: bool: True or False

Example:

```python
import rhinoscriptsyntax as rs
id = rs.GetObject("Select a light", rs.filter.light)
if rs.IsLinearLight(id):
    print("The object is a linear light.")
else:
    print("The object is not a linear light.")
```

See also: AddLinearLight

## IsPointLight

```python
rs.IsPointLight(object_id)
```

Verifies a light object is a point light

Arguments:

    object_id (guid): the light object's identifier

Returns: bool: True or False

Example:

```python
import rhinoscriptsyntax as rs
id = rs.GetObject("Select a light", rs.filter.light)
if rs.IsPointLight(id):
    print("The object is a point light.")
else:
    print("The object is not a point light.")
```

See also: AddPointLight

## IsRectangularLight

```python
rs.IsRectangularLight(object_id)
```

Verifies a light object is a rectangular light

Arguments:

    object_id (guid): the light object's identifier

Returns: bool: True or False

Example:

```python
import rhinoscriptsyntax as rs
id = rs.GetObject("Select a light", rs.filter.light)
if rs.IsRectangularLight(id):
    print("The object is a rectangular light.")
else:
    print("The object is not a rectangular light.")
```

See also: AddRectangularLight

## IsSpotLight

```python
rs.IsSpotLight(object_id)
```

Verifies a light object is a spot light

Arguments:

    object_id (guid): the light object's identifier

Returns: bool: True or False

Example:

```python
import rhinoscriptsyntax as rs
id = rs.GetObject("Select a light", rs.filter.light)
if rs.IsSpotLight(id):
    print("The object is a spot light.")
else:
    print("The object is not a spot light.")
```

See also: AddSpotLight, SpotLightHardness, SpotLightShadowIntensity

## LightColor

```python
rs.LightColor(object_id, color=None)
```

Returns or changes the color of a light

Arguments:

    object_id (guid): the light object's identifier
    color (color, optional): the light's new color

Returns: color: if color is not specified, the current color
color: if color is specified, the previous color

Example:

```python
import rhinoscriptsyntax as rs
id = rs.GetObject("Select a light", rs.filter.light)
if id: rs.LightColor( id, (0,255,255) )
```

See also: EnableLight, IsLight, IsLightEnabled, LightCount, LightName, LightObjects

## LightCount

```python
rs.LightCount()
```

Returns the number of light objects in the document

Returns: number: the number of light objects in the document

Example:

```python
import rhinoscriptsyntax as rs
print("There are {} lights".format(rs.LightCount()))
```

See also: EnableLight, IsLight, IsLightEnabled, LightColor, LightName, LightObjects

## LightDirection

```python
rs.LightDirection(object_id, direction=None)
```

Returns or changes the direction of a light object

Arguments:

    object_id (guid): the light object's identifier
    direction (vector, optional): the light's new direction

Returns: vector: if direction is not specified, the current direction
vector: if direction is specified, the previous direction

Example:

```python
import rhinoscriptsyntax as rs
id = rs.GetObject("Select a light", rs.filter.light)
if id: print( rs.LightDirection(id) )
```

See also: IsLight, LightLocation

## LightLocation

```python
rs.LightLocation(object_id, location=None)
```

Returns or changes the location of a light object

Arguments:

    object_id (guid): the light object's identifier
    location (point, optional): the light's new location

Returns: point: if location is not specified, the current location
point: if location is specified, the previous location

Example:

```python
import rhinoscriptsyntax as rs
id = rs.GetObject("Select a light", rs.filter.light)
if id: rs.AddPoint( rs.LightLocation(id) )
```

See also: IsLight, LightDirection

## LightName

```python
rs.LightName(object_id, name=None)
```

Returns or changes the name of a light object

Arguments:

    object_id (guid): the light object's identifier
    name (str, optional): the light's new name

Returns: str: if name is not specified, the current name
str: if name is specified, the previous name

Example:

```python
import rhinoscriptsyntax as rs
id = rs.GetObject("Select a light", rs.filter.light)
if id:
    name = rs.GetString("New light name")
    if name: rs.LightName(id, name)
```

See also: EnableLight, IsLight, IsLightEnabled, LightColor, LightCount, LightObjects

## LightObjects

```python
rs.LightObjects()
```

Returns list of identifiers of light objects in the document

Returns: list(guid, ...): the list of identifiers of light objects in the document

Example:

```python
import rhinoscriptsyntax as rs
lights = rs.LightObjects()
if lights:
    rs.AddLayer( "Lights" )
    for light in lights: rs.ObjectLayer( light, "Lights" )
```

See also: EnableLight, IsLight, IsLightEnabled, LightColor, LightCount, LightName

## RectangularLightPlane

```python
rs.RectangularLightPlane(object_id)
```

Returns the plane of a rectangular light object

Arguments:

    object_id (guid): the light object's identifier

Returns: plane: the plane if successful
None: on error

Example:

```python
import rhinoscriptsyntax as rs
id = rs.GetObject("Select a rectangular light", rs.filter.light)
if id:
    rc = rs.RectangularLightPlane(id)
    if rc:
        plane, extents = rc
        rs.AddPlaneSurface( plane, extents[0], extents[1] )
```

See also: IsRectangularLight

## SpotLightHardness

```python
rs.SpotLightHardness(object_id, hardness=None)
```

Returns or changes the hardness of a spot light. Spotlight hardness
    controls the fully illuminated region.

Arguments:

    object_id (guid): the light object's identifier
    hardness (number, optional): the light's new hardness

Returns: number: if hardness is not specified, the current hardness
number: if hardness is specified, the previous hardness

Example:

```python
import rhinoscriptsyntax as rs
id = rs.GetObject("Select a light", rs.filter.light)
if id: rs.SpotLightHardness(id, 0.75)
```

See also: AddSpotLight, IsSpotLight, SpotLightRadius, SpotLightShadowIntensity

## SpotLightRadius

```python
rs.SpotLightRadius(object_id, radius=None)
```

Returns or changes the radius of a spot light.

Arguments:

    object_id (guid): the light object's identifier
    radius (number, optional): the light's new radius

Returns: number: if radius is not specified, the current radius
number: if radius is specified, the previous radius

Example:

```python
import rhinoscriptsyntax as rs
id = rs.GetObject("Select a light", rs.filter.light)
if id: rs.SpotLightRadius(id, 5.0)
```

See also: AddSpotLight, IsSpotLight, SpotLightHardness, SpotLightShadowIntensity

## SpotLightShadowIntensity

```python
rs.SpotLightShadowIntensity(object_id, intensity=None)
```

Returns or changes the shadow intensity of a spot light.

Arguments:

    object_id (guid): the light object's identifier
    intensity (number, optional): the light's new intensity

Returns: number: if intensity is not specified, the current intensity
number: if intensity is specified, the previous intensity

Example:

```python
import rhinoscriptsyntax as rs
id = rs.GetObject("Select a light", rs.filter.light)
if id: rs.SpotLightShadowIntensity(id, 0.75)
```

See also: AddSpotLight, IsSpotLight, SpotLightHardness, SpotLightRadius
