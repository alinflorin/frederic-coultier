# rhinoscriptsyntax: block

## AddBlock

```python
rs.AddBlock(object_ids, base_point, name=None, delete_input=False)
```

Adds a new block definition to the document

Arguments:

    object_ids ([guid, ....]) objects that will be included in the block
    base_point (point): 3D base point for the block definition
    name (str, optional): name of the block definition. If omitted a name will be
      automatically generated
    delete_input (bool): if True, the object_ids will be deleted

Returns: str: name of new block definition on success

Example:

```python
import rhinoscriptsyntax as rs
objs = rs.GetObjects("Select objects to define block")
if objs:
    point = rs.GetPoint("Block base point")
    if point:
        block = rs.AddBlock(objs, point, None, True)
        rs.InsertBlock(block, point)
```

See also: InsertBlock

## BlockContainerCount

```python
rs.BlockContainerCount(block_name)
```

Returns number of block definitions that contain a specified
    block definition

Arguments:

    block_name (str): the name of an existing block definition

Returns: number: the number of block definitions that contain a specified block definition

Example:

```python
import rhinoscriptscriptsyntax as rs
block = rs.GetString("Block name to query")
if rs.IsBlock(block):
    count = rs.BlockContainerCount(block)
    print("This block is nested in {} block(s).".format(count))
```

See also: BlockContainers, IsBlock

## BlockContainers

```python
rs.BlockContainers(block_name)
```

Returns names of the block definitions that contain a specified block
    definition.

Arguments:

    block_name (str): the name of an existing block definition

Returns: list(str, ...): A list of block definition names

Example:

```python
import rhinoscriptsyntax as rs
blockname = rs.GetString("Block name to query")
if rs.IsBlock(blockname):
    blocks = rs.BlockContainers(blockname)
    for block in blocks: print(block)
```

See also: BlockContainerCount, IsBlock

## BlockCount

```python
rs.BlockCount()
```

Returns the number of block definitions in the document

Returns: number: the number of block definitions in the document

Example:

```python
import rhinoscriptsyntax as rs
count = rs.BlockCount()
print("There are {} blocks".format(count)
```

See also: BlockNames, IsBlock

## BlockDescription

```python
rs.BlockDescription(block_name, description=None)
```

Returns or sets the description of a block definition

Arguments:

    block_name (str): the name of an existing block definition
    description (str, optional): The new description.

Returns: str: if description is not specified, the current description
str: if description is specified, the previous description

Example:

```python
import rhinoscriptsyntax as rs
blockname = rs.GetString("Block name to list description")
if rs.IsBlock(blockname):
    desc = rs.BlockDescription(blockname)
    if desc is None: print("No description")
    else: print(desc)
```

See also: IsBlock

## BlockInstanceCount

```python
rs.BlockInstanceCount(block_name,where_to_look=0)
```

Counts number of instances of the block in the document.
    Nested instances are not included in the count.

Arguments:

    block_name (str): the name of an existing block definition
    where_to_look (number, optional):
      0 = get top level references in active document.
      1 = get top level and nested references in active document.
      2 = check for references from other instance definitions

Returns: number: the number of instances of the block in the document

Example:

```python
import rhinoscriptsyntax as rs
blockname = rs.GetString("Block to count")
if rs.IsBlock(blockname):
    count = rs.BlockInstanceCount(blockname)
    print("{} block(s) found.".format(count))
```

See also: BlockInstanceInsertPoint, BlockInstances, BlockInstanceXform, IsBlockInstance

## BlockInstanceInsertPoint

```python
rs.BlockInstanceInsertPoint(object_id)
```

Returns the insertion point of a block instance.

Arguments:

    object_id (guid): The identifier of an existing block insertion object

Returns: point: The insertion 3D point if successful

Example:

```python
import rhinoscriptsyntax as rs
strObject = rs.GetObject("Select block")
if rs.IsBlockInstance(strObject):
    rs.AddPoint( rs.BlockInstanceInsertPoint(strObject) )
```

See also: BlockInstanceCount, BlockInstances, BlockInstanceXform, IsBlockInstance

## BlockInstanceName

```python
rs.BlockInstanceName(object_id)
```

Returns the block name of a block instance

Arguments:

    object_id (guid): The identifier of an existing block insertion object

Returns: str: the block name of a block instance

Example:

```python
import rhinoscriptsyntax as rs
strObject = rs.GetObject("Select block")
if rs.IsBlockInstance(strObject):
    print(rs.BlockInstanceName(strObject))
```

See also: BlockInstanceCount, BlockInstances, BlockInstanceXform, IsBlockInstance

## BlockInstanceXform

```python
rs.BlockInstanceXform(object_id)
```

Returns the location of a block instance relative to the world coordinate
    system origin (0,0,0). The position is returned as a 4x4 transformation
    matrix

Arguments:

    object_id (guid): The identifier of an existing block insertion object

Returns: transform: the location, as a transform matrix, of a block instance relative to the world coordinate
system origin

Example:

```python
import rhinoscriptsyntax as rs
obj = rs.GetObject("Select block to query")
if rs.IsBlockInstance(obj):
    arrMatrix = rs.BlockInstanceXform(obj)
    if arrMatrix is not None:
        pointId = rs.AddPoint([0,0,0])
        rs.TransformObject( pointId, arrMatrix)
```

See also: BlockInstanceCount, BlockInstanceInsertPoint, BlockInstances, IsBlockInstance

## BlockInstances

```python
rs.BlockInstances(block_name,where_to_look=0)
```

Returns the identifiers of the inserted instances of a block.

Arguments:

    block_name (str): the name of an existing block definition
    where_to_look (number, optional):
      0 = get top level references in active document.
      1 = get top level and nested references in active document.
      2 = check for references from other instance definitions

Returns: list(guid, ...): Ids identifying the instances of a block in the model.

Example:

```python
import rhinoscriptsyntax as rs
strBlock = rs.GetString("Block to select")
if rs.IsBlock(strBlock):
    arrObjects = rs.BlockInstances(strBlock)
    if arrobjects:
        rs.SelectObjects(arrObjects)
```

See also: BlockInstanceCount, BlockInstanceInsertPoint, BlockInstanceXform, IsBlockInstance

## BlockNames

```python
rs.BlockNames( sort=False )
```

Returns the names of all block definitions in the document

Arguments:

    sort (bool): True to return a sorted list

Returns: list(str, ...): the names of all block definitions in the document

Example:

```python
import rhinoscriptsyntax as rs
names = rs.BlockNames(True)
if names:
    for name in names: print(name)
```

See also: BlockCount, IsBlock

## BlockObjectCount

```python
rs.BlockObjectCount(block_name)
```

Returns number of objects that make up a block definition

Arguments:

    block_name (str): name of an existing block definition

Returns: number: the number of objects that make up a block definition

Example:

```python
import rhinoscriptsyntax as rs
count = rs.BlockObjectCount()
print("There are {} blocks".format(count))
```

See also: BlockNames, BlockObjects, IsBlock

## BlockObjects

```python
rs.BlockObjects(block_name)
```

Returns identifiers of the objects that make up a block definition

Arguments:

    block_name (str): name of an existing block definition

Returns: list(guid, ...): list of identifiers on success

Example:

```python
import rhinoscriptsyntax as rs
strBlock = rs.GetString("Block name to list identifiers")
if rs.IsBlock(strBlock):
    objects = rs.BlockObjects(strBlock)
    if objects:
        for item in objects: print(item)
```

See also: BlockNames, BlockObjectCount, IsBlock

## BlockPath

```python
rs.BlockPath(block_name)
```

Returns path to the source of a linked or embedded block definition.
    A linked or embedded block definition is a block definition that was
    inserted from an external file.

Arguments:

    block_name (str): name of an existing block definition

Returns: str: path to the linked block on success

Example:

```python
import rhinoscriptsyntax as rs
strBlock = rs.GetString("Block name to list path")
if rs.IsBlockEmbedded(strBlock):
    print(rs.BlockPath(strBlock))
```

See also: IsBlock, IsBlockEmbedded

## BlockStatus

```python
rs.BlockStatus(block_name)
```

Returns the status of a linked block

Arguments:

    block_name (str): Name of an existing block

Returns: number: the status of a linked block
  Value Description
  -3    Not a linked block definition.
  -2    The linked block definition's file could not be opened or could not be read.
  -1    The linked block definition's file could not be found.
   0    The linked block definition is up-to-date.
   1    The linked block definition's file is newer than definition.
   2    The linked block definition's file is older than definition.
   3    The linked block definition's file is different than definition.

Example:

```python
import rhinoscriptsyntax as rs
block = rs.GetString("Block name to list description")
if rs.IsBlock(block):
    status = rs.BlockStatus(block)
    print("block status for {} is {}".format(block, status))
```

See also: IsBlock

## DeleteBlock

```python
rs.DeleteBlock(block_name)
```

Deletes a block definition and all of it's inserted instances.

Arguments:

    block_name (str): name of an existing block definition

Returns: bool: True or False indicating success or failure

Example:

```python
import rhinoscriptsyntax as rs
strBlock = rs.GetString("Block name to delete")
if rs.IsBlock(strBlock):
    rs.DeleteBlock(strBlock)
```

See also: BlockNames, ExplodeBlockInstance, IsBlock

## ExplodeBlockInstance

```python
rs.ExplodeBlockInstance(object_id, explode_nested_instances=False)
```

Explodes a block instance into it's geometric components. The
    exploded objects are added to the document

Arguments:

    object_id (guid): The identifier of an existing block insertion object
    explode_nested_instances (bool, optional): By default nested blocks are not exploded.

Returns: list(guid, ...): identifiers for the newly exploded objects on success

Example:

```python
import rhinoscriptsyntax as rs
strObject = rs.GetObject("Select block instance to explode")
if rs.IsBlockInstance(strObject):
    rs.ExplodeBlockInstance(strObject)
```

See also: DeleteBlock, IsBlockInstance

## InsertBlock

```python
rs.InsertBlock( block_name, insertion_point, scale=(1,1,1), angle_degrees=0, rotation_normal=(0,0,1) )
```

Inserts a block whose definition already exists in the document

Arguments:

    block_name (str): name of an existing block definition
    insertion_point (point): insertion point for the block
    scale ({number, number, number]): x,y,z scale factors
    angle_degrees (number, optional): rotation angle in degrees
    rotation_normal (vector, optional): the axis of rotation.

Returns: guid: id for the block that was added to the doc

## InsertBlock2

```python
rs.InsertBlock2(block_name, xform)
```

Inserts a block whose definition already exists in the document

Arguments:

    block_name (str): name of an existing block definition
    xform (transform): 4x4 transformation matrix to apply

Returns: guid: id for the block that was added to the doc on success

## IsBlock

```python
rs.IsBlock(block_name)
```

Verifies the existence of a block definition in the document.

Arguments:

    block_name (str): name of an existing block definition

Returns: bool: True or False

Example:

```python
import rhinoscriptsyntax as rs
strBlock = rs.GetString("Block name")
if rs.IsBlock(strBlock):
    print("The block definition exists.")
else:
    print("The block definition does not exist.")
```

See also: IsBlockEmbedded, IsBlockInstance, IsBlockInUse, IsBlockReference

## IsBlockEmbedded

```python
rs.IsBlockEmbedded(block_name)
```

Verifies a block definition is embedded, or linked, from an external file.

Arguments:

    block_name (str): name of an existing block definition

Returns: bool: True or False

Example:

```python
import rhinoscriptsyntax as rs
strBlock = rs.GetString("Block name")
if rs.IsBlock(strBlock):
    if rs.IsBlockEmbedded(strBlock):
        print("The block definition is embedded.")
    else:
        print("The block definition is not embedded.")
else:
    print("The block definition does not exist.")
```

See also: IsBlock, IsBlockInstance, IsBlockInUse, IsBlockReference

## IsBlockInUse

```python
rs.IsBlockInUse(block_name, where_to_look=0)
```

Verifies that a block definition is being used by an inserted instance

Arguments:

    block_name (str): name of an existing block definition
    where_to_look (number, optional): One of the following values
         0 = Check for top level references in active document
         1 = Check for top level and nested references in active document
         2 = Check for references in other instance definitions

Returns: bool: True or False

Example:

```python
import rhinoscriptsyntax as rs
strBlock = rs.GetString("Block name")
if rs.IsBlock(strBlock):
    if rs.IsBlockInUse(strBlock):
        print("The block definition is in use.")
    else:
        print("The block definition is not in use.")
else:
    print("The block definition does not exist.")
```

See also: IsBlock, IsBlockInstance, IsBlockEmbedded, IsBlockReference

## IsBlockInstance

```python
rs.IsBlockInstance(object_id)
```

Verifies an object is a block instance

Arguments:

    object_id (guid): The identifier of an existing block insertion object

Returns: bool: True or False

Example:

```python
import rhinoscriptsyntax as rs
obj = rs.GetObject("Select block instance")
if rs.IsBlockInstance(obj):
    print("The object is a block instance.")
else:
    print("The object is not a block instance.")
```

See also: IsBlock, IsBlockEmbedded, IsBlockInUse, IsBlockReference

## IsBlockReference

```python
rs.IsBlockReference(block_name)
```

Verifies that a block definition is from a reference file.

Arguments:

    block_name (str): name of an existing block definition

Returns: bool: True or False

Example:

```python
import rhinoscriptsyntax as rs
strBlock = rs.GetString("Block name")
if rs.IsBlock(strBlock):
    if rs.IsBlockReference(strBlock):
        print("The block definition is a reference definition.")
    else:
        print("The block definition is not a reference definition.")
else:
    print("The block definition does not exist.")
```

See also: IsBlock, IsBlockEmbedded, IsBlockInUse, IsBlockInstance

## RenameBlock

```python
rs.RenameBlock( block_name, new_name )
```

Renames an existing block definition

Arguments:

    block_name (str): name of an existing block definition
    new_name (str): name to change to

Returns: bool: True or False indicating success or failure

Example:

```python
import rhinoscriptsyntax as rs
strOldBlock = rs.GetString("Old block name")
if strOldBlock:
    strNewBlock = rs.GetString("New block name")
    if strNewBlock:
        rs.RenameBlock (strOldBlock, strNewBlock)
```

See also: BlockNames, IsBlock
