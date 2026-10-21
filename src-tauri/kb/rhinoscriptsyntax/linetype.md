# rhinoscriptsyntax: linetype

## IsLinetype

```python
rs.IsLinetype(name_or_id)
```

Verifies the existance of a linetype in the document

Arguments:

    name_or_id (guid|str): The name or identifier of an existing linetype.

Returns: bool: True or False

Example:

```python
import rhinoscriptsyntax as rs
name = rs.GetString("Linetype name")
if rs.IsLinetype(name): print("The linetype exists.")
else: print("The linetype does not exist")
```

See also: IsLinetypeReference

## IsLinetypeReference

```python
rs.IsLinetypeReference(name_or_id)
```

Verifies that an existing linetype is from a reference file

Arguments:

    name_or_id (guid|str): The name or identifier of an existing linetype.

Returns: bool: True or False

Example:

```python
import rhinoscriptsyntax as rs
name = rs.GetString("Linetype name")
if rs.IsLinetype(name):
    if rs.IsLinetypeReference(name):
        print("The linetype is a reference linetype.")
    else:
        print("The linetype is not a reference linetype.")
else:
    print("The linetype does not exist.")
```

See also: IsLinetype

## LinetypeCount

```python
rs.LinetypeCount()
```

Returns number of linetypes in the document

Returns: number: the number of linetypes in the document

Example:

```python
import rhinoscriptsyntax as rs
count = rs.LinetypeCount()
print("There are {} linetypes".format(count))
```

See also: LinetypeNames

## LinetypeNames

```python
rs.LinetypeNames(sort=False)
```

Returns names of all linetypes in the document

Arguments:

    sort (bool, optional): return a sorted list of the linetype names

Returns: list(str, ...): list of linetype names if successful

Example:

```python
import rhinoscriptsyntax as rs
names = rs.LinetypeNames()
if names:
    for name in names: print(name)
```

See also: LinetypeCount
