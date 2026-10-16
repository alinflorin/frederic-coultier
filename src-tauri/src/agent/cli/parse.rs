//! Turns the text of an `exec_fc` call into commands: shell-like quoting, `&&` / `;` / newline
//! between commands, one here-document for multi-line text, and `--flag value` options.
//! No variables, globs or pipes: it only looks like a shell.

use std::collections::HashMap;

/// One command: its words, and the text given on its "standard input" (the here-document).
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Invocation {
    pub words: Vec<String>,
    pub stdin: Option<String>,
}

#[derive(Debug, PartialEq, Eq)]
enum Tok {
    Word(String),
    /// `&&`, `;` or a newline
    Sep,
}

/// Splits one command line into words and separators. Single quotes are literal; double quotes
/// understand `\n \t \" \\`; outside quotes a backslash escapes the next character.
fn tokenize(line: &str) -> Result<Vec<Tok>, String> {
    let mut out = Vec::new();
    let mut cur = String::new();
    let mut started = false; // an empty '' still makes a word
    let mut chars = line.chars().peekable();
    let flush = |out: &mut Vec<Tok>, cur: &mut String, started: &mut bool| {
        if *started {
            out.push(Tok::Word(std::mem::take(cur)));
            *started = false;
        }
    };
    while let Some(c) = chars.next() {
        match c {
            '\'' => {
                started = true;
                loop {
                    match chars.next() {
                        Some('\'') => break,
                        Some(ch) => cur.push(ch),
                        None => return Err("unterminated single quote".into()),
                    }
                }
            }
            '"' => {
                started = true;
                loop {
                    match chars.next() {
                        Some('"') => break,
                        Some('\\') => match chars.next() {
                            Some('n') => cur.push('\n'),
                            Some('t') => cur.push('\t'),
                            Some(ch @ ('"' | '\\')) => cur.push(ch),
                            Some(ch) => {
                                cur.push('\\');
                                cur.push(ch);
                            }
                            None => return Err("unterminated double quote".into()),
                        },
                        Some(ch) => cur.push(ch),
                        None => return Err("unterminated double quote".into()),
                    }
                }
            }
            '\\' => {
                started = true;
                match chars.next() {
                    Some(ch) => cur.push(ch),
                    None => cur.push('\\'),
                }
            }
            '&' if chars.peek() == Some(&'&') => {
                chars.next();
                flush(&mut out, &mut cur, &mut started);
                out.push(Tok::Sep);
            }
            ';' => {
                flush(&mut out, &mut cur, &mut started);
                out.push(Tok::Sep);
            }
            '\n' => {
                flush(&mut out, &mut cur, &mut started);
                out.push(Tok::Sep);
            }
            c if c.is_whitespace() => flush(&mut out, &mut cur, &mut started),
            c => {
                started = true;
                cur.push(c);
            }
        }
    }
    flush(&mut out, &mut cur, &mut started);
    Ok(out)
}

fn commands(text: &str) -> Result<Vec<Vec<String>>, String> {
    let mut all = Vec::new();
    let mut cur: Vec<String> = Vec::new();
    for t in tokenize(text)? {
        match t {
            Tok::Word(w) => cur.push(w),
            Tok::Sep => {
                if !cur.is_empty() {
                    all.push(std::mem::take(&mut cur));
                }
            }
        }
    }
    if !cur.is_empty() {
        all.push(cur);
    }
    Ok(all)
}

/// `<<EOF`, `<<'EOF'`, `<<"EOF"` or `<<-EOF` at the end of a line: (text before it, the word).
fn heredoc_marker(line: &str) -> Option<(&str, String)> {
    let t = line.trim_end();
    let at = t.rfind("<<")?;
    // a marker is not inside quotes: an even number of quotes before it, per kind
    let before = &t[..at];
    if before.matches('\'').count() % 2 == 1 || before.matches('"').count() % 2 == 1 {
        return None;
    }
    let rest = t[at + 2..].trim_start_matches('-').trim();
    let word = rest.trim_matches(|c| c == '\'' || c == '"');
    if word.is_empty() || !word.chars().all(|c| c.is_alphanumeric() || c == '_') {
        return None;
    }
    // quotes, if any, must wrap the whole word
    let quoted = rest.len() != word.len();
    if quoted
        && !((rest.starts_with('\'') && rest.ends_with('\''))
            || (rest.starts_with('"') && rest.ends_with('"')))
    {
        return None;
    }
    Some((&t[..at], word.to_string()))
}

/// The commands in `input`, in order. A here-document (`<<EOF` ... `EOF`) becomes the stdin of
/// the command that ends its line; more commands may follow the closing line.
pub fn parse(input: &str) -> Result<Vec<Invocation>, String> {
    let lines: Vec<&str> = input.split('\n').collect();
    let mut head = String::new();
    let mut tail = String::new();
    let mut stdin: Option<String> = None;
    let mut i = 0;
    while i < lines.len() {
        if stdin.is_none() {
            if let Some((before, word)) = heredoc_marker(lines[i]) {
                head.push_str(before);
                head.push('\n');
                let mut body = Vec::new();
                let mut closed = false;
                i += 1;
                while i < lines.len() {
                    if lines[i].trim_end().trim_start_matches('\t') == word {
                        closed = true;
                        break;
                    }
                    body.push(lines[i]);
                    i += 1;
                }
                if !closed {
                    return Err(format!(
                        "the here-document is not closed: end it with a line containing only {word}"
                    ));
                }
                stdin = Some(body.join("\n"));
                i += 1;
                continue;
            }
            head.push_str(lines[i]);
            head.push('\n');
        } else {
            tail.push_str(lines[i]);
            tail.push('\n');
        }
        i += 1;
    }

    let mut cmds: Vec<Invocation> = commands(&head)?
        .into_iter()
        .map(|words| Invocation { words, stdin: None })
        .collect();
    if let Some(text) = stdin {
        match cmds.last_mut() {
            Some(last) => last.stdin = Some(text),
            None => return Err("a here-document needs a command before it".into()),
        }
    }
    cmds.extend(
        commands(&tail)?
            .into_iter()
            .map(|words| Invocation { words, stdin: None }),
    );
    Ok(cmds)
}

// ---- options ----

pub struct Flag {
    pub name: &'static str,
    pub short: Option<char>,
    /// Takes a value (`--zoom 2`), as opposed to being a switch (`--ortho`).
    pub value: bool,
}

pub const fn switch(name: &'static str) -> Flag {
    Flag {
        name,
        short: None,
        value: false,
    }
}

pub const fn opt(name: &'static str) -> Flag {
    Flag {
        name,
        short: None,
        value: true,
    }
}

pub const fn short(mut f: Flag, c: char) -> Flag {
    f.short = Some(c);
    f
}

#[derive(Debug, Default)]
pub struct Parsed {
    pub pos: Vec<String>,
    flags: HashMap<&'static str, Vec<String>>,
}

impl Parsed {
    pub fn has(&self, name: &str) -> bool {
        self.flags.contains_key(name)
    }

    pub fn value(&self, name: &str) -> Option<&str> {
        self.flags
            .get(name)
            .and_then(|v| v.last())
            .map(String::as_str)
    }

    /// Every value of a repeated option.
    pub fn values(&self, name: &str) -> &[String] {
        self.flags.get(name).map_or(&[], Vec::as_slice)
    }

    pub fn number(&self, name: &str) -> Result<Option<f64>, String> {
        self.value(name)
            .map(|v| {
                v.trim()
                    .parse::<f64>()
                    .ok()
                    .filter(|n| n.is_finite())
                    .ok_or_else(|| format!("--{name} needs a number, got {v:?}"))
            })
            .transpose()
    }

    /// `--grid` / `--no-grid` style pair: Some(true), Some(false) or None.
    pub fn toggle(&self, name: &str) -> Result<Option<bool>, String> {
        match (self.has(name), self.has(&format!("no-{name}"))) {
            (true, true) => Err(format!("--{name} and --no-{name} contradict each other")),
            (true, false) => Ok(Some(true)),
            (false, true) => Ok(Some(false)),
            _ => Ok(None),
        }
    }
}

/// Sorts `words` into positional arguments and options. `--name=value` works too.
pub fn options(words: &[String], specs: &[Flag]) -> Result<Parsed, String> {
    let mut p = Parsed::default();
    let mut i = 0;
    let mut only_positional = false;
    while i < words.len() {
        let w = &words[i];
        i += 1;
        if only_positional || w == "-" || !w.starts_with('-') || w.parse::<f64>().is_ok() {
            p.pos.push(w.clone());
            continue;
        }
        if w == "--" {
            only_positional = true;
            continue;
        }
        let (name, inline) = match w.strip_prefix("--") {
            Some(rest) => match rest.split_once('=') {
                Some((n, v)) => (n.to_string(), Some(v.to_string())),
                None => (rest.to_string(), None),
            },
            None => {
                let c = w.chars().nth(1).unwrap();
                match specs.iter().find(|f| f.short == Some(c)) {
                    Some(f) => (
                        f.name.to_string(),
                        (w.len() > 2).then(|| w[2..].to_string()),
                    ),
                    None => return Err(unknown(w, specs)),
                }
            }
        };
        let Some(spec) = specs.iter().find(|f| f.name == name) else {
            return Err(unknown(w, specs));
        };
        if spec.value {
            let v = match inline {
                Some(v) => v,
                None => {
                    let v = words
                        .get(i)
                        .ok_or_else(|| format!("--{name} needs a value"))?;
                    i += 1;
                    v.clone()
                }
            };
            p.flags.entry(spec.name).or_default().push(v);
        } else {
            if inline.is_some() {
                return Err(format!("--{name} does not take a value"));
            }
            p.flags.entry(spec.name).or_default();
        }
    }
    Ok(p)
}

fn unknown(w: &str, specs: &[Flag]) -> String {
    if specs.is_empty() {
        return format!("unknown option {w}: this command takes no options");
    }
    let list: Vec<String> = specs.iter().map(|f| format!("--{}", f.name)).collect();
    format!("unknown option {w}; options: {}", list.join(" "))
}

// ---- values ----

/// `12`, `12:20`, `12:` or `:20` as 1-based inclusive line numbers; a missing end means "to the end".
pub fn range(s: &str) -> Result<(usize, Option<usize>), String> {
    let bad = || format!("{s:?} is not a line range; use N, N:M, N: or :M");
    let num = |t: &str| t.trim().parse::<usize>().map_err(|_| bad());
    match s.split_once(':') {
        None => {
            let n = num(s)?;
            Ok((n, Some(n)))
        }
        Some((a, b)) => Ok((
            if a.is_empty() { 1 } else { num(a)? },
            if b.is_empty() { None } else { Some(num(b)?) },
        )),
    }
}

/// `1.5,-2,0` as three numbers.
pub fn point(s: &str) -> Result<[f64; 3], String> {
    let parts: Vec<f64> = s
        .split(',')
        .map(|t| t.trim().parse::<f64>())
        .collect::<Result<_, _>>()
        .map_err(|_| format!("{s:?} is not a point; use X,Y,Z"))?;
    <[f64; 3]>::try_from(parts).map_err(|_| format!("{s:?} is not a point; use X,Y,Z"))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn words(input: &str) -> Vec<Vec<String>> {
        parse(input).unwrap().into_iter().map(|i| i.words).collect()
    }

    fn w(v: &[&str]) -> Vec<String> {
        v.iter().map(|s| s.to_string()).collect()
    }

    #[test]
    fn quotes_and_escapes() {
        assert_eq!(
            words(r#"src edit 'cube(1);' "a \"b\"\n c""#),
            [w(&["src", "edit", "cube(1);", "a \"b\"\n c"])]
        );
        assert_eq!(words(r"a\ b c"), [w(&["a b", "c"])]);
        assert_eq!(words("x '' y"), [w(&["x", "", "y"])]);
        assert_eq!(words("'a  b'c"), [w(&["a  bc"])]);
        assert!(parse("say 'oops").is_err());
        assert!(parse("say \"oops").is_err());
    }

    #[test]
    fn separators() {
        assert_eq!(
            words("a 1 && b 2 ; c\nd"),
            [w(&["a", "1"]), w(&["b", "2"]), w(&["c"]), w(&["d"])]
        );
        assert_eq!(words("a&&b"), [w(&["a"]), w(&["b"])]);
        assert_eq!(words("echo 'a && b'"), [w(&["echo", "a && b"])]);
        assert!(words("   ").is_empty());
    }

    #[test]
    fn heredoc_is_stdin_of_the_command_on_that_line() {
        let got = parse("src insert 3 <<EOF\nhello;\n  world;\nEOF").unwrap();
        assert_eq!(
            got,
            [Invocation {
                words: w(&["src", "insert", "3"]),
                stdin: Some("hello;\n  world;".into())
            }]
        );
        let got = parse("src write <<'END'\n$x = 1; 'q'\nEND\nrender").unwrap();
        assert_eq!(got.len(), 2);
        assert_eq!(got[0].stdin.as_deref(), Some("$x = 1; 'q'"));
        assert_eq!(
            got[1],
            Invocation {
                words: w(&["render"]),
                stdin: None
            }
        );
        let got = parse("status\nsrc write <<EOF\nx\nEOF").unwrap();
        assert_eq!(
            (got[0].stdin.as_deref(), got[1].stdin.as_deref()),
            (None, Some("x"))
        );
    }

    #[test]
    fn heredoc_edge_cases() {
        assert!(
            parse("src write <<EOF\nnever closed")
                .unwrap_err()
                .contains("not closed")
        );
        assert!(
            parse("<<EOF\nx\nEOF")
                .unwrap_err()
                .contains("needs a command")
        );
        // an empty body is still a body
        assert_eq!(
            parse("src write <<EOF\nEOF").unwrap()[0].stdin.as_deref(),
            Some("")
        );
        // << inside quotes is just text
        assert_eq!(words("src grep '<<EOF'"), [w(&["src", "grep", "<<EOF"])]);
        // the body may contain the marker syntax and blank lines
        let got =
            parse("src edit <<EOF\n<<<<<<< SEARCH\na\n=======\n\nb\n>>>>>>> REPLACE\nEOF").unwrap();
        assert_eq!(
            got[0].stdin.as_deref(),
            Some("<<<<<<< SEARCH\na\n=======\n\nb\n>>>>>>> REPLACE")
        );
    }

    const SPECS: &[Flag] = &[
        switch("all"),
        opt("zoom"),
        short(opt("context"), 'C'),
        switch("grid"),
        switch("no-grid"),
    ];

    #[test]
    fn options_sort_flags_from_positionals() {
        let p = options(&w(&["a", "--zoom", "2", "b", "-C3", "--all"]), SPECS).unwrap();
        assert_eq!(p.pos, ["a", "b"]);
        assert_eq!(p.number("zoom").unwrap(), Some(2.0));
        assert_eq!(p.number("context").unwrap(), Some(3.0));
        assert!(p.has("all") && !p.has("grid"));
        let p = options(&w(&["--zoom=1.5", "-C", "4"]), SPECS).unwrap();
        assert_eq!(
            (p.number("zoom").unwrap(), p.number("context").unwrap()),
            (Some(1.5), Some(4.0))
        );
    }

    #[test]
    fn options_negative_numbers_and_dashes() {
        let p = options(&w(&["-5", "-1.5", "--", "--all"]), SPECS).unwrap();
        assert_eq!(p.pos, ["-5", "-1.5", "--all"]);
        let p = options(&w(&["--zoom", "-2"]), SPECS).unwrap();
        assert_eq!(p.number("zoom").unwrap(), Some(-2.0));
    }

    #[test]
    fn options_errors_are_helpful() {
        let e = options(&w(&["--bogus"]), SPECS).unwrap_err();
        assert!(e.contains("--bogus") && e.contains("--zoom"), "{e}");
        assert!(
            options(&w(&["--zoom"]), SPECS)
                .unwrap_err()
                .contains("needs a value")
        );
        assert!(
            options(&w(&["--all=1"]), SPECS)
                .unwrap_err()
                .contains("does not take")
        );
        assert!(
            options(&w(&["--zoom", "x"]), SPECS)
                .unwrap()
                .number("zoom")
                .is_err()
        );
        assert!(
            options(&w(&["--bogus"]), &[])
                .unwrap_err()
                .contains("no options")
        );
    }

    #[test]
    fn toggles() {
        let t = |a: &[&str]| options(&w(a), SPECS).unwrap().toggle("grid");
        assert_eq!(t(&[]).unwrap(), None);
        assert_eq!(t(&["--grid"]).unwrap(), Some(true));
        assert_eq!(t(&["--no-grid"]).unwrap(), Some(false));
        assert!(t(&["--grid", "--no-grid"]).is_err());
    }

    #[test]
    fn ranges_and_points() {
        assert_eq!(range("5").unwrap(), (5, Some(5)));
        assert_eq!(range("5:9").unwrap(), (5, Some(9)));
        assert_eq!(range("5:").unwrap(), (5, None));
        assert_eq!(range(":9").unwrap(), (1, Some(9)));
        assert!(range("a:b").is_err() && range("").is_err());
        assert_eq!(point("1, -2.5,0").unwrap(), [1.0, -2.5, 0.0]);
        assert!(point("1,2").is_err() && point("a,b,c").is_err());
    }
}
