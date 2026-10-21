# rhinoscriptsyntax: material

## AddMaterialToLayer

```python
rs.AddMaterialToLayer(layer)
```

Add material to a layer and returns the new material's index. If the
    layer already has a material, then the layer's current material index is
    returned

Arguments:

    layer (str): name of an existing layer.

Returns: number: Material index of the layer if successful
None: if not successful or on error

Example:

```python
import rhinoscriptsyntax as rs
layer = rs.CurrentLayer()
index = rs.LayerMaterialIndex(layer)
if index==-1: index = rs.AddMaterialToLayer(layer)
```

See also: LayerMaterialIndex, IsMaterialDefault

## AddMaterialToObject

```python
rs.AddMaterialToObject(object_id)
```

Adds material to an object and returns the new material's index. If the
    object already has a material, the the object's current material index is
    returned.

Arguments:

    object_id (guid): identifier of an object

Returns: number: material index of the object

Example:

```python
import rhinoscriptsyntax as rs
obj = rs.GetObject()
if obj:
    index = rs.ObjectMaterialIndex(obj)
    if index==-1: index = rs.AddMaterialToObject(obj)
```

See also: IsMaterialDefault, ObjectMaterialIndex, ObjectMaterialSource

## CopyMaterial

```python
rs.CopyMaterial(source_index, destination_index)
```

Copies definition of a source material to a destination material

Arguments:

    source_index, destination_index (number): indices of materials to copy

Returns: bool: True or False indicating success or failure

Example:

```python
import rhinoscriptsyntax as rs
src = rs.LayerMaterialIndex("Default")
dest = rs.LayerMaterialIndex(rs.CurrentLayer())
if src>=0 and dest>=0 and src!=dest:
    rs.CopyMaterial( src, dest )
```

See also: LayerMaterialIndex, ObjectMaterialIndex

## IsMaterialDefault

```python
rs.IsMaterialDefault(material_index)
```

Verifies a material is a copy of Rhino's built-in "default" material.
    The default material is used by objects and layers that have not been
    assigned a material.

Arguments:

    material_index (number): the zero-based material index

Returns: bool: True or False indicating success or failure

Example:

```python
import rhinoscriptsyntax as rs
obj = rs.GetObject()
if obj:
    index = rs.ObjectMaterialIndex(obj)
    if rs.IsMaterialDefault(index):
        print("Object is assigned default material.")
    else:
        print("Object is not assigned default material.")
```

See also: LayerMaterialIndex, ObjectMaterialIndex

## IsMaterialReference

```python
rs.IsMaterialReference(material_index)
```

Verifies a material is referenced from another file

Arguments:

    material_index (number): the zero-based material index

Returns: bool: True or False indicating success or failure

Example:

```python
import rhinoscriptsyntax as rs
obj = rs.GetObject()
if obj:
    index = rs.ObjectMaterialIndex(obj)
    if rs.IsMaterialReference(index):
        print("The material is referenced from another file.")
    else:
        print("The material is not referenced from another file.")
```

See also: IsLayerReference, IsLightReference, IsObjectReference

## MatchMaterial

```python
rs.MatchMaterial(source, destination)
```

Copies the material definition from one material to one or more objects

Arguments:

    source (number|guid): source material index -or- identifier of the source object.
      The object must have a material assigned
    destination ([guid, ...]) identifiers(s) of the destination object(s)

Returns: number: number of objects that were modified if successful
None: if not successful or on error

Example:

```python
import rhinoscriptsyntax as rs
obj = rs.GetObject("Select source object")
if obj and rs.ObjectMaterialIndex(obj)>-1:
    objects = rs.GetObjects("Select destination objects")
    if objects: rs.MatchMaterial( obj, objects )
```

See also: CopyMaterial, LayerMaterialIndex, ObjectMaterialIndex

## MaterialBump

```python
rs.MaterialBump(material_index, filename=None)
```

Returns or modifies a material's bump bitmap filename

Arguments:

    material_index (number): zero based material index
    filename (str, optional): the bump bitmap filename

Returns: str: if filename is not specified, the current bump bitmap filename
str: if filename is specified, the previous bump bitmap filename
None: if not successful or on error

Example:

```python
import rhinoscriptsyntax as rs
obj = rs.GetObject("Select object")
if obj:
    index = rs.ObjectMaterialIndex(obj)
    if index>-1:
        rs.MaterialBump( index, "C:\\Users\\Steve\\Desktop\\bumpimage.png" )
```

See also: MaterialColor, MaterialName, MaterialReflectiveColor, MaterialShine, MaterialTexture, MaterialTransparency

## MaterialColor

```python
rs.MaterialColor(material_index, color=None)
```

Returns or modifies a material's diffuse color.

Arguments:

    material_index (number): zero based material index
    color (color, optional): the new color value

Returns: color: if color is not specified, the current material color
color: if color is specified, the previous material color
None: on error

Example:

```python
import rhinoscriptsyntax as rs
obj = rs.GetObject("Select object")
if obj:
    index = rs.ObjectMaterialIndex(obj)
    if index>-1:
        rs.MaterialColor( index, (127, 255, 191) )
```

See also: MaterialBump, MaterialName, MaterialReflectiveColor, MaterialShine, MaterialTexture, MaterialTransparency

## MaterialEnvironmentMap

```python
rs.MaterialEnvironmentMap(material_index, filename=None)
```

Returns or modifies a material's environment bitmap filename.

Arguments:

    material_index (number): zero based material index
    filename (str, optional): the environment bitmap filename

Returns: str: if filename is not specified, the current environment bitmap filename
str: if filename is specified, the previous environment bitmap filename
None: if not successful or on error

Example:

```python
import rhinoscriptsyntax as rs
obj = rs.GetObject("Select object")
if obj:
    index = rs.ObjectMaterialIndex(obj)
    if index>-1:
        rs.MaterialEnvironmentMap( index, "C:\\Users\\Steve\\Desktop\\emapimage.png" )
```

See also: MaterialBump, MaterialTexture, MaterialTransparencyMap

## MaterialName

```python
rs.MaterialName(material_index, name=None)
```

Returns or modifies a material's user defined name

Arguments:

    material_index (number): zero based material index
    name (str, optional): the new name

Returns: str: if name is not specified, the current material name
str: if name is specified, the previous material name
None: on error

Example:

```python
import rhinoscriptsyntax as rs
obj = rs.GetObject("Select object")
if obj:
    index = rs.ObjectMaterialIndex(obj)
    if index>-1:
        rs.MaterialName( index, "Fancy_Material" )
```

See also: MaterialBump, MaterialColor, MaterialReflectiveColor, MaterialShine, MaterialTexture, MaterialTransparency

## MaterialReflectiveColor

```python
rs.MaterialReflectiveColor(material_index, color=None)
```

Returns or modifies a material's reflective color.

Arguments:

    material_index (number): zero based material index
    color (color, optional): the new color value

Returns: color: if color is not specified, the current material reflective color
color: if color is specified, the previous material reflective color
None: on error

Example:

```python
import rhinoscriptsyntax as rs
obj = rs.GetObject("Select object")
if obj:
    index = rs.ObjectMaterialIndex(obj)
    if index>-1:
        rs.MaterialReflectiveColor( index, (191, 191, 255) )
```

See also: MaterialBump, MaterialColor, MaterialName, MaterialShine, MaterialTexture, MaterialTransparency

## MaterialShine

```python
rs.MaterialShine(material_index, shine=None)
```

Returns or modifies a material's shine value

Arguments:

    material_index (number): zero based material index
    shine (number, optional): the new shine value. A material's shine value ranges from 0.0 to 255.0, with
      0.0 being matte and 255.0 being glossy

Returns: number: if shine is not specified, the current material shine value
number: if shine is specified, the previous material shine value
None: on error

Example:

```python
import rhinoscriptsyntax as rs
MAX_SHINE = 255.0
obj = rs.GetObject("Select object")
if obj:
    index = rs.ObjectMaterialIndex(obj)
    if index>-1:
        rs.MaterialShine( index, MAX_SHINE/2 )
```

See also: MaterialBump, MaterialColor, MaterialName, MaterialReflectiveColor, MaterialTexture, MaterialTransparency

## MaterialTexture

```python
rs.MaterialTexture(material_index, filename=None)
```

Returns or modifies a material's texture bitmap filename

Arguments:

    material_index (number): zero based material index
    filename (str, optional): the texture bitmap filename

Returns: str: if filename is not specified, the current texture bitmap filename
str: if filename is specified, the previous texture bitmap filename
None: if not successful or on error

Example:

```python
import rhinoscriptsyntax as rs
obj = rs.GetObject("Select object")
if obj:
    index = rs.ObjectMaterialIndex(obj)
    if index>-1:
        rs.MaterialTexture( index, "C:\\Users\\Steve\\Desktop\\textureimage.png" )
```

See also: MaterialBump, MaterialColor, MaterialName, MaterialReflectiveColor, MaterialShine, MaterialTransparency

## MaterialTransparency

```python
rs.MaterialTransparency(material_index, transparency=None)
```

Returns or modifies a material's transparency value

Arguments:

    material_index (number): zero based material index
    transparency (number, optional): the new transparency value. A material's transparency value ranges from 0.0 to 1.0, with
      0.0 being opaque and 1.0 being transparent

Returns: number: if transparency is not specified, the current material transparency value
number: if transparency is specified, the previous material transparency value
None: on error

Example:

```python
import rhinoscriptsyntax as rs
obj = rs.GetObject("Select object")
if obj:
    index = rs.ObjectMaterialIndex(obj)
    if index>-1:
        rs.MaterialTransparency( index, 0.50 )
```

See also: MaterialBump, MaterialColor, MaterialName, MaterialReflectiveColor, MaterialShine, MaterialTexture

## MaterialTransparencyMap

```python
rs.MaterialTransparencyMap(material_index, filename=None)
```

Returns or modifies a material's transparency bitmap filename

Arguments:

    material_index (number): zero based material index
    filename (str, optional): the transparency bitmap filename

Returns: str: if filename is not specified, the current transparency bitmap filename
str: if filename is specified, the previous transparency bitmap filename
None: if not successful or on error

Example:

```python
import rhinoscriptsyntax as rs
obj = rs.GetObject("Select object")
if obj:
    index = rs.ObjectMaterialIndex(obj)
    if index>-1:
        rs.MaterialTransparencyMap( index, "C:\\Users\\Steve\\Desktop\\texture.png" )
```

See also: MaterialBump, MaterialEnvironmentMap, MaterialTexture

## ResetMaterial

```python
rs.ResetMaterial(material_index)
```

Resets a material to Rhino's default material

Arguments:

    material_index (number) zero based material index

Returns: bool: True or False indicating success or failure

Example:

```python
import rhinoscriptsyntax as rs
obj = rs.GetObject("Select object")
if obj:
    index = rs.ObjectMaterialIndex(obj)
    if index>-1: rs.ResetMaterial(index)
```

See also: LayerMaterialIndex, ObjectMaterialIndex
