# Type Test Functions

Source: https://en.wikibooks.org/wiki/OpenSCAD_User_Manual/Type_Test_Functions

### is_undef

[Note: Requires version 2019.05]

is_undef accepts one parameter. If the parameter is undef, this function returns true. If the parameter is not undef, it returns false. When checking a variable (like `is_undef(a)`), it does the variable lookup silently, meaning that is_undef(a) does not cause `WARNING: Ignoring unknown variable 'a'. `

The alternative is code like this:

```
if(a==undef){
    //code goes here
}

```

or

```
b = (a==undef) ? true : false;

```

causes

```
WARNING: Ignoring unknown variable 'a'.

```

is_undef also works for special variables, allowing for things like this:

```
exploded = is_undef($exploded) ? 0 : $exploded; // 1 for exploded view

```

#### legacy support

For older openscad version, is_undef can be emulated with

```
function is_undef ( a ) = (undef == a) ;

```

which of-course causes warning(s), but requires no changes to code relying on is_undef().

### is_list

[Note: Requires version 2019.05]

```
echo("returning true");
echo(is_list([]));
echo(is_list([1]));
echo(is_list([1,2]));
echo(is_list([true]));
echo(is_list([1,2,[5,6],"test"]));
echo("--------");
echo("returning false");
echo(is_list(1));
echo(is_list(1/0));
echo(is_list(((1/0)/(1/0))));
echo(is_list("test"));
echo(is_list(true));
echo(is_list(false));
echo("--------");
echo("causing warnings:");
echo(is_list());
echo(is_list(1,2));

```

### is_num

[Note: Requires version 2019.05]

```
echo("a number is a number:");
echo(is_num(0.1));
echo(is_num(1));
echo(is_num(10));

echo("inf is a number:");
echo(is_num(+1/0)); //+inf
echo(is_num(-1/0)); //-inf

echo("nan is not a number:");
echo(is_num(0/0)); //nan
echo(is_num((1/0)/(1/0)));  //nan

echo("resulting in false:");
echo(is_num([]));
echo(is_num([1]));
echo(is_num("test"));
echo(is_num(false));
echo(is_num(undef));

```

### is_bool

[Note: Requires version 2019.05]

```
echo("resulting in true:");
echo(is_bool(true));
echo(is_bool(false));
echo("resulting in false:");
echo(is_bool([]));
echo(is_bool([1]));
echo(is_bool("test"));
echo(is_bool(0.1));
echo(is_bool(1));
echo(is_bool(10));
echo(is_bool(0/0)); //nan
echo(is_bool((1/0)/(1/0)));  //nan
echo(is_bool(1/0));  //inf
echo(is_bool(-1/0));  //-inf
echo(is_bool(undef));

```

### is_string

[Note: Requires version 2019.05]

```
echo("resulting in true:");
echo(is_string(""));
echo(is_string("test"));
echo("resulting in false:");
echo(is_string(0.1));
echo(is_string(1));
echo(is_string(10));
echo(is_string([]));
echo(is_string([1]));
echo(is_string(false));
echo(is_string(0/0)); //nan
echo(is_string((1/0)/(1/0)));  //nan
echo(is_string(1/0));  //inf
echo(is_string(-1/0));  //-inf
echo(is_string(undef));

```

### is_function

[Note: Requires version 2021.01]

The `is_function` check works only for expressions, so it can be applied to function literals or variables containing functions. It does not work with built-in functions or normal function definitions.

```
echo(is_function(function(x) x*x)); // ECHO: true

func = function(x) x+x;
echo(is_function(func)); // ECHO: true

function f(x) = x;
echo(is_function(f)); // WARNING: Ignoring unknown variable 'f' / ECHO: false

```

### is_object

[Note: Requires version Development snapshot]

Returns `true` if the argument is an [object](https://en.wikibooks.org/wiki/OpenSCAD_User_Manual/General#Objects), and `false` otherwise.
