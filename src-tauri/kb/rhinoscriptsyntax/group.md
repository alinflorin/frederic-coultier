# rhinoscriptsyntax: group

## AddGroup

```python
rs.AddGroup(group_name=None)
```

Adds a new empty group to the document

Arguments:

    group_name (str, optional): name of the new group. If omitted, rhino automatically
        generates the group name

Returns: str: name of the new group if successful
None: is not successful or on error

Example:

```python
import rhinoscriptsyntax as rs
name = rs.AddGroup("NewGroup")
```

See also: DeleteGroup, GroupCount, GroupNames, IsGroup, RenameGroup

## AddObjectToGroup

```python
rs.AddObjectToGroup(object_id, group_name)
```

Adds a single object to an existing group.

Arguments:

    object_id (guid): String or Guid representing the object identifier
    group_name (str): the name of an existing group

Returns: True or False representing success or failure

Example:

```python
import rhinoscriptsyntax as rs
name = "NewGroup"
id = rs.GetObject("Select object to add to group")
if id: rs.AddObjectToGroup(id,name)
```

See also: AddObjectsToGroup, IsGroupEmpty, ObjectGroups, ObjectsByGroup

## AddObjectsToGroup

```python
rs.AddObjectsToGroup(object_ids, group_name)
```

Adds one or more objects to an existing group.

Arguments:

    object_ids ([guid, ...]) list of Strings or Guids representing the object identifiers
    group_name (str): the name of an existing group

Returns: number: number of objects added to the group

Example:

```python
import rhinoscriptsyntax as rs
name = "NewGroup"
object_ids = rs.GetObjects("Select objects to add to group")
if object_ids: rs.AddObjectsToGroup(object_ids, name)
```

See also: AddObjectToGroup, IsGroupEmpty, ObjectGroups, ObjectsByGroup

## DeleteGroup

```python
rs.DeleteGroup(group_name)
```

Removes an existing group from the document. Reference groups cannot be
    removed. Deleting a group does not delete the member objects

Arguments:

    group_name (str): the name of an existing group

Returns: bool: True or False representing success or failure

Example:

```python
import rhinoscriptsyntax as rs
groups = rs.GroupNames()
if groups:
    for group in groups: rs.DeleteGroup(group)
```

See also: AddGroup, GroupCount, GroupNames, IsGroup, RenameGroup

## GroupCount

```python
rs.GroupCount()
```

Returns the number of groups in the document

Returns: number: the number of groups in the document

Example:

```python
import rhinoscriptsyntax as rs
numgroups = rs.GroupCount()
print("Group count:{}".format(numgroups))
```

See also: AddGroup, DeleteGroup, GroupNames, IsGroup, RenameGroup

## GroupNames

```python
rs.GroupNames()
```

Returns the names of all the groups in the document
    None if no names exist in the document

Returns: list(str, ...): the names of all the groups in the document.  None if no names exist in the document

Example:

```python
import rhinoscriptsyntax as rs
groups = rs.GroupNames()
if groups:
    for group in groups: print(group)
```

See also: AddGroup, DeleteGroup, GroupCount, IsGroup, RenameGroup

## HideGroup

```python
rs.HideGroup(group_name)
```

Hides a group of objects. Hidden objects are not visible, cannot be
    snapped to, and cannot be selected

Arguments:

    group_name (str): the name of an existing group

Returns: number: The number of objects that were hidden

Example:

```python
import rhinoscriptsyntax as rs
groups = rs.GroupNames()
if groups:
    for group in groups: rs.HideGroup(group)
```

See also: LockGroup, ShowGroup, UnlockGroup

## IsGroup

```python
rs.IsGroup(group_name)
```

Verifies the existance of a group

Arguments:

    group_name (str): the name of the group to check for

Returns: bool: True or False

Example:

```python
import rhinoscriptsyntax as rs
group = rs.GetString("Group name to verify")
if rs.IsGroup(group):
    print("The group exists.")
else:
    print("The group does not exist.")
```

See also: AddGroup, DeleteGroup, GroupCount, GroupNames, RenameGroup

## IsGroupEmpty

```python
rs.IsGroupEmpty(group_name)
```

Verifies that an existing group is empty, or contains no object members

Arguments:

    group_name (str): the name of an existing group

Returns: bool: True or False if group_name exists
None: if group_name does not exist

Example:

```python
import rhinoscriptsyntax as rs
names = rs.GroupNames()
if names:
    for name in names:
        if rs.IsGroupEmpty(name): rs.DeleteGroup(name)
```

See also: AddObjectsToGroup, AddObjectToGroup, RemoveObjectFromAllGroups, RemoveObjectFromGroup, RemoveObjectsFromGroup

## LockGroup

```python
rs.LockGroup(group_name)
```

Locks a group of objects. Locked objects are visible and they can be
    snapped to. But, they cannot be selected

Arguments:

    group_name (str): the name of an existing group

Returns: number: Number of objects that were locked if successful
None: on error

Example:

```python
import rhinoscriptsyntax as rs
names = rs.GroupNames()
if names:
    for name in names: rs.LockGroup(name)
```

See also: HideGroup, ShowGroup, UnlockGroup

## ObjectTopGroup

```python
rs.ObjectTopGroup(object_id)
```

Returns the top most group name that an object is assigned.  This function primarily applies to objects that are members of nested groups

Arguments:

    object_id (guid): String or Guid representing the object identifier

Returns: str: the top group's name if successful
None: if not successful

Example:

```python
import rhinoscriptsyntax as rs
id = rs.GetObject("Select object to add to group")
groupName = rs.ObjectTopGroup(id)
```

See also: ObjectGroups

## RemoveObjectFromAllGroups

```python
rs.RemoveObjectFromAllGroups(object_id)
```

Removes a single object from any and all groups that it is a member.
    Neither the object nor the group can be reference objects

Arguments:

    object_id (guid): the object identifier

Returns: bool: True or False indicating success or failure

Example:

```python
import rhinoscriptsyntax as rs
object = rs.GetObject("Select object")
if object: rs.RemoveObjectFromAllGroups(object)
```

See also: IsGroupEmpty, ObjectGroups, ObjectsByGroup, RemoveObjectFromGroup, RemoveObjectsFromGroup

## RemoveObjectFromGroup

```python
rs.RemoveObjectFromGroup(object_id, group_name)
```

Remove a single object from an existing group

Arguments:

    object_id (guid): the object identifier
    group_name (str): the name of an existing group

Returns: bool: True or False indicating success or failure

Example:

```python
import rhinoscriptsyntax as rs
name = "NewGroup"
id = rs.GetObject("Select object")
if name: rs.RemoveObjectFromGroup(id,name)
```

See also: IsGroupEmpty, ObjectGroups, ObjectsByGroup, RemoveObjectFromAllGroups, RemoveObjectsFromGroup

## RemoveObjectsFromGroup

```python
rs.RemoveObjectsFromGroup(object_ids, group_name)
```

Removes one or more objects from an existing group

Arguments:

    object_ids ([guid, ...]): a list of object identifiers
    group_name (str): the name of an existing group

Returns: number: The number of objects removed from the group is successful
None: on error

Example:

```python
import rhinoscriptsyntax as rs
group = "NewGroup"
ids = rs.GetObjects("Select objects")
if ids: rs.RemoveObjectsFromGroup(ids,group)
```

See also: IsGroupEmpty, ObjectGroups, ObjectsByGroup, RemoveObjectFromAllGroups, RemoveObjectFromGroup

## RenameGroup

```python
rs.RenameGroup(old_name, new_name)
```

Renames an existing group

Arguments:

    old_name (str): the name of an existing group
    new_name (str): the new group name

Returns: str: the new group name if successful
None: on error

Example:

```python
import rhinoscriptsyntax as rs
strOldGroup = rs.GetString("Old group name")
if strOldGroup:
    strNewGroup = rs.GetString("New group name")
    if strNewName: rs.RenameGroup(strOldGroup, strNewGroup)
```

See also: AddGroup, DeleteGroup, GroupCount, GroupNames, IsGroup

## ShowGroup

```python
rs.ShowGroup(group_name)
```

Shows a group of previously hidden objects. Hidden objects are not
    visible, cannot be snapped to, and cannot be selected

Arguments:

    group_name (str): the name of an existing group

Returns: number: The number of objects that were shown if successful
None: on error

Example:

```python
import rhinoscriptsyntax as rs
groups = rs.GroupNames()
if groups:
    for group in groups: rs.ShowGroup(group)
```

See also: HideGroup, LockGroup, UnlockGroup

## UnlockGroup

```python
rs.UnlockGroup(group_name)
```

Unlocks a group of previously locked objects. Lockes objects are visible,
    can be snapped to, but cannot be selected

Arguments:

    group_name (str): the name of an existing group

Returns: number: The number of objects that were unlocked if successful
None: on error

Example:

```python
import rhinoscriptsyntax as rs
groups = rs.GroupNames()
if groups:
    for group in groups: rs.UnlockGroup(group)
```

See also: HideGroup, LockGroup, ShowGroup
