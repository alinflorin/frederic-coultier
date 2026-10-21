# rhinoscriptsyntax: toolbar

## CloseToolbarCollection

```python
rs.CloseToolbarCollection(name, prompt=False)
```

Closes a currently open toolbar collection

Arguments:

    name (str): name of a currently open toolbar collection
    prompt  (bool, optional): if True, user will be prompted to save the collection file
      if it has been modified prior to closing

Returns: bool: True or False indicating success or failure

Example:

```python
import rhinoscriptsyntax as rs
names = rs.ToolbarCollectionNames()
if names:
    for name in names: rs.CloseToolbarCollection( name, True )
```

See also: IsToolbarCollection, OpenToolbarCollection, ToolbarCollectionCount, ToolbarCollectionNames, ToolbarCollectionPath

## HideToolbar

```python
rs.HideToolbar(name, toolbar_group)
```

Hides a previously visible toolbar group in an open toolbar collection

Arguments:

    name (str): name of a currently open toolbar file
    toolbar_group (str): name of a toolbar group to hide

Returns: bool: True or False indicating success or failure

Example:

```python
import rhinoscriptsyntax as rs
file = "C:\\SteveBaer\\AppData\\Roaming\\McNeel\\Rhinoceros\\5.0\\UI\\default.rui"
name = rs.IsToolbarCollection(file)
if names: rs.HideToolbar(name, "Layer")
```

See also: IsToolbar, IsToolbarVisible, ShowToolbar, ToolbarCount, ToolbarNames

## IsToolbar

```python
rs.IsToolbar(name, toolbar, group=False)
```

Verifies a toolbar (or toolbar group) exists in an open collection file

Arguments:

    name (str): name of a currently open toolbar file
    toolbar (str): name of a toolbar group
    group (bool, optional): if toolbar parameter is referring to a toolbar group

Returns: bool: True or False indicating success or failure

Example:

```python
import rhinoscriptsyntax as rs
file = "C:\\SteveBaer\\AppData\\Roaming\\McNeel\\Rhinoceros\\5.0\\UI\\default.rui"
name = rs.IsToolbarCollection(file)
if name:
    if rs.IsToolbar(name, "Layer"):
        print("The collection contains the Layer toolbar.")
    else:
        print("The collection does not contain the Layer toolbar.")
```

See also: HideToolbar, IsToolbarVisible, ShowToolbar, ToolbarCount, ToolbarNames

## IsToolbarCollection

```python
rs.IsToolbarCollection(file)
```

Verifies that a toolbar collection is open

Arguments:

    file (str): full path to a toolbar collection file

Returns: str: Rhino-assigned name of the toolbar collection if successful
None: if not successful

Example:

```python
import rhinoscriptsyntax as rs
file = "C:\\SteveBaer\\AppData\\Roaming\\McNeel\\Rhinoceros\\5.0\\UI\\default.rui"
name = rs.IsToolbarCollection(file)
if name: print("The default toolbar collection is loaded.")
else: print("The default toolbar collection is not loaded.")
```

See also: CloseToolbarCollection, OpenToolbarCollection, ToolbarCollectionCount, ToolbarCollectionNames, ToolbarCollectionPath

## IsToolbarDocked

```python
rs.IsToolbarDocked(name, toolbar_group)
```

Verifies that a toolbar group in an open toolbar collection is visible

Arguments:

    name (str): name of a currently open toolbar file
    toolbar_group (str): name of a toolbar group

Returns: boolean: True or False indicating success or failure
None: on error

Example:

```python
import rhinoscriptsyntax as rs
rc = rs.IsToolbarDocked("Default", "Main1")
if rc==True:
    print("The Main1 toolbar is docked.")
elif rc==False:
    print("The Main1 toolbar is not docked.")
else:
    print("The Main1 toolbar is not visible.")
```

See also: IsToolbar, IsToolbarVisible

## IsToolbarVisible

```python
rs.IsToolbarVisible(name, toolbar_group)
```

Verifies that a toolbar group in an open toolbar collection is visible

Arguments:

    name (str): name of a currently open toolbar file
    toolbar_group (str): name of a toolbar group

Returns: bool:True or False indicating success or failure
None: on error

Example:

```python
import rhinoscriptsyntax as rs
file = "C:\\SteveBaer\\AppData\\Roaming\\McNeel\\Rhinoceros\\5.0\\UI\\default.rui"
name = rs.IsToolbarCollection(file)
if name:
    if rs.IsToolbarVisible(name, "Layer"): print("The Layer toolbar is visible.")
    else: print("The Layer toolbar is not visible.")
```

See also: HideToolbar, IsToolbar, ShowToolbar, ToolbarCount, ToolbarNames

## OpenToolbarCollection

```python
rs.OpenToolbarCollection(file)
```

Opens a toolbar collection file

Arguments:

    file (str): full path to the collection file

Returns: str: Rhino-assigned name of the toolbar collection if successful
None: if not successful

Example:

```python
import rhinoscriptsyntax as rs
file = "C:\\SteveBaer\\AppData\\Roaming\\McNeel\\Rhinoceros\\5.0\\UI\\default.rui"
name = rs.IsToolbarCollection(file)
if name is None: rs.OpenToolbarCollection(file)
```

See also: CloseToolbarCollection, IsToolbarCollection, ToolbarCollectionCount, ToolbarCollectionNames, ToolbarCollectionPath

## SaveToolbarCollection

```python
rs.SaveToolbarCollection(name)
```

Saves an open toolbar collection to disk

Arguments:

    name (str): name of a currently open toolbar file

Returns: bool: True or False indicating success or failure

Example:

```python
import rhinoscriptsyntax as rs
name = "Default"
rs.SaveToolbarCollection(name)
```

See also: SaveToolbarCollectionAs

## SaveToolbarCollectionAs

```python
rs.SaveToolbarCollectionAs(name, file)
```

Saves an open toolbar collection to a different disk file

Arguments:

    name (str): name of a currently open toolbar file
    file (str): full path to file name to save to

Returns: bool: True or False indicating success or failure

Example:

```python
import rhinoscriptsyntax as rs
name = "Default"
file = "D:\\NewDefault.rui"
rs.SaveToolbarCollectionAs(name,file)
```

See also: SaveToolbarCollection

## ShowToolbar

```python
rs.ShowToolbar(name, toolbar_group)
```

Shows a previously hidden toolbar group in an open toolbar collection

Arguments:

    name (str): name of a currently open toolbar file
    toolbar_group (str): name of a toolbar group to show

Returns: bool: True or False indicating success or failure

Example:

```python
import rhinoscriptsyntax as rs
file = "C:\\SteveBaer\\AppData\\Roaming\\McNeel\\Rhinoceros\\5.0\\UI\\default.rui"
name = rs.IsToolbarCollection(file)
if name: rs.ShowToolbar(name, "Layer")
```

See also: HideToolbar, IsToolbar, IsToolbarVisible, ToolbarCount, ToolbarNames

## ToolbarCollectionCount

```python
rs.ToolbarCollectionCount()
```

Returns number of currently open toolbar collections

Returns: number: the number of currently open toolbar collections

Example:

```python
import rhinoscriptsyntax as rs
count = rs.ToolbarCollectionCount()
print("There are {} toolbar(s) collections loaded".format(count))
```

See also: CloseToolbarCollection, IsToolbarCollection, OpenToolbarCollection, ToolbarCollectionNames, ToolbarCollectionPath

## ToolbarCollectionNames

```python
rs.ToolbarCollectionNames()
```

Returns names of all currently open toolbar collections

Returns: list(str, ...): the names of all currently open toolbar collections

Example:

```python
import rhinoscriptsyntax as rs
names = rs.ToolbarCollectionNames()
if names:
    for name in names: print(name)
```

See also: CloseToolbarCollection, IsToolbarCollection, OpenToolbarCollection, ToolbarCollectionCount, ToolbarCollectionPath

## ToolbarCollectionPath

```python
rs.ToolbarCollectionPath(name)
```

Returns full path to a currently open toolbar collection file

Arguments:

    name (str): name of currently open toolbar collection

Returns: str: full path on success
None: on error

Example:

```python
import rhinoscriptsyntax as rs
names = rs.ToolbarCollectionNames()
if names:
    for name in names: print(rs.ToolbarCollectionPath(name))
```

See also: CloseToolbarCollection, IsToolbarCollection, OpenToolbarCollection, ToolbarCollectionCount, ToolbarCollectionNames

## ToolbarCount

```python
rs.ToolbarCount(name, groups=False)
```

Returns the number of toolbars or groups in a currently open toolbar file

Arguments:

    name (str): name of currently open toolbar collection
    groups (bool, optional): If true, return the number of toolbar groups in the file

Returns: number: number of toolbars on success
None: on error

Example:

```python
import rhinoscriptsyntax as rs
names = rs.ToolbarCollectionNames()
if names:
    count = rs.ToolbarCount(names[0])
    print("The {} collection contains {} toolbars.".format(names[0], count))
```

See also: HideToolbar, IsToolbar, IsToolbarVisible, ShowToolbar, ToolbarNames

## ToolbarNames

```python
rs.ToolbarNames(name, groups=False)
```

Returns the names of all toolbars (or toolbar groups) found in a
    currently open toolbar file

Arguments:

    name (str): name of currently open toolbar collection
    groups (bool, optional): If true, return the names of toolbar groups in the file

Returns: list(str, ...): names of all toolbars (or toolbar groups) on success
None: on error

Example:

```python
import rhinoscriptsytax as rs
names = rs.ToolbarCollectionNames()
if names:
    toolbars = rs.ToolbarNames(names[0])
    if toolbars:
        for toolbar in toolbars: print(toolbar)
```

See also: HideToolbar, IsToolbar, IsToolbarVisible, ShowToolbar, ToolbarCount
