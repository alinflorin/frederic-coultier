//! File-like editing of the model source, for the agent: numbered reads, exact
//! string edits, line-range edits and search. Pure functions on `&str`, so they
//! are easy to test; the caller decides how the result reaches the project.

use regex::RegexBuilder;
use serde::Serialize;

/// Lines longer than this are cut when read, so one minified line can't flood the agent.
const MAX_LINE_CHARS: usize = 2000;
const DEFAULT_READ_LIMIT: usize = 2000;
const MAX_SEARCH_HITS: usize = 200;

/// How much a change touched, shown under the agent's message in the chat.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
pub struct Delta {
    pub added: usize,
    pub removed: usize,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Edited {
    pub source: String,
    pub delta: Delta,
    /// 1-based, inclusive range of the new text in `source` (empty text: the line before it).
    pub first_line: usize,
    pub last_line: usize,
}

fn count_lines(s: &str) -> usize {
    if s.is_empty() { 0 } else { s.split('\n').count() }
}

/// Lines in `s`, the way an editor counts them: a trailing newline does not start a new line.
pub fn line_count(s: &str) -> usize {
    if s.is_empty() { 0 } else { s.strip_suffix('\n').unwrap_or(s).split('\n').count() }
}

/// 1-based line of a byte offset.
fn line_of(s: &str, byte: usize) -> usize {
    s[..byte].bytes().filter(|&b| b == b'\n').count() + 1
}

fn cut(line: &str) -> String {
    if line.chars().count() <= MAX_LINE_CHARS {
        line.to_string()
    } else {
        let head: String = line.chars().take(MAX_LINE_CHARS).collect();
        format!("{head}… [line cut at {MAX_LINE_CHARS} characters]")
    }
}

/// `cat -n` style listing of `limit` lines starting at line `offset` (1-based).
pub fn read(source: &str, offset: Option<usize>, limit: Option<usize>) -> Result<String, String> {
    let total = line_count(source);
    if total == 0 {
        return Ok("(the source is empty)".into());
    }
    let start = offset.unwrap_or(1).max(1);
    if start > total {
        return Err(format!("offset {start} is past the end: the source has {total} lines"));
    }
    let limit = limit.unwrap_or(DEFAULT_READ_LIMIT).max(1);
    let end = (start - 1 + limit).min(total);
    let width = total.to_string().len();
    let body = source
        .strip_suffix('\n')
        .unwrap_or(source)
        .split('\n')
        .enumerate()
        .skip(start - 1)
        .take(end - start + 1)
        .map(|(i, l)| format!("{:>width$}\t{}", i + 1, cut(l.strip_suffix('\r').unwrap_or(l))))
        .collect::<Vec<_>>()
        .join("\n");
    let tail = if end < total { format!("\n… {} more lines, read on from line {}", total - end, end + 1) } else { String::new() };
    Ok(format!("{body}{tail}"))
}

/// Replaces `old` with `new`, which must match exactly once unless `replace_all`.
pub fn edit(source: &str, old: &str, new: &str, replace_all: bool) -> Result<Edited, String> {
    if old.is_empty() {
        return Err("old_string is empty: to insert text use source_insert, to start over use source_write".into());
    }
    if old == new {
        return Err("old_string and new_string are identical, nothing to change".into());
    }
    let hits: Vec<usize> = source.match_indices(old).map(|(i, _)| i).collect();
    match hits.len() {
        0 => return Err(not_found(source, old)),
        1 => {}
        n if !replace_all => {
            let lines: Vec<String> = hits.iter().take(8).map(|&i| line_of(source, i).to_string()).collect();
            return Err(format!(
                "old_string matches {n} places (lines {}{}). Add surrounding lines to make it unique, or pass replace_all.",
                lines.join(", "),
                if n > 8 { ", …" } else { "" }
            ));
        }
        _ => {}
    }
    let first = hits[0];
    let out = if replace_all { source.replace(old, new) } else { format!("{}{}{}", &source[..first], new, &source[first + old.len()..]) };
    let n = if replace_all { hits.len() } else { 1 };
    let first_line = line_of(source, first);
    let new_lines = count_lines(new).max(1);
    Ok(Edited {
        source: out,
        delta: Delta { added: count_lines(new) * n, removed: count_lines(old) * n },
        first_line,
        last_line: first_line + new_lines - 1,
    })
}

/// A "not found" message that helps the agent recover: whitespace is the usual culprit.
fn not_found(source: &str, old: &str) -> String {
    let squash = |s: &str| s.split_whitespace().collect::<Vec<_>>().join(" ");
    let wanted = squash(old);
    if !wanted.is_empty() && squash(source).contains(&wanted) {
        return "old_string was not found exactly, but it matches when whitespace is ignored: check the indentation, tabs and line breaks (read the lines first).".into();
    }
    "old_string was not found in the source. Read the lines again, it may have changed.".into()
}

/// One SEARCH/REPLACE pair of a multi-edit.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Block {
    pub old: String,
    pub new: String,
}

/// Reads blocks written as
/// `<<<<<<< SEARCH` / old text / `=======` / new text / `>>>>>>> REPLACE`.
pub fn parse_blocks(input: &str) -> Result<Vec<Block>, String> {
    #[derive(PartialEq)]
    enum At {
        Outside,
        Old,
        New,
    }
    let (mut at, mut old, mut new) = (At::Outside, Vec::new(), Vec::new());
    let mut blocks = Vec::new();
    for (i, line) in input.split('\n').enumerate() {
        let l = line.trim_end_matches('\r');
        match at {
            At::Outside if l.starts_with("<<<<<<<") => at = At::Old,
            At::Outside if l.trim().is_empty() => {}
            At::Outside => return Err(format!("line {}: text outside a block; blocks look like <<<<<<< SEARCH / old / ======= / new / >>>>>>> REPLACE", i + 1)),
            At::Old if l == "=======" => at = At::New,
            At::Old => old.push(l),
            At::New if l.starts_with(">>>>>>>") => {
                blocks.push(Block { old: old.join("\n"), new: new.join("\n") });
                (old, new, at) = (Vec::new(), Vec::new(), At::Outside);
            }
            At::New => new.push(l),
        }
    }
    match at {
        At::Outside if blocks.is_empty() => Err("no SEARCH/REPLACE block found".into()),
        At::Outside => Ok(blocks),
        At::Old => Err("a block has no ======= line".into()),
        At::New => Err("a block is not closed with a >>>>>>> REPLACE line".into()),
    }
}

/// Applies the blocks one after the other; either all apply or none (the error names the block).
/// `first_line`/`last_line` of the result describe the last block.
pub fn edit_blocks(source: &str, blocks: &[Block], replace_all: bool) -> Result<Edited, String> {
    let mut cur = Edited { source: source.to_string(), delta: Delta { added: 0, removed: 0 }, first_line: 1, last_line: 1 };
    for (i, b) in blocks.iter().enumerate() {
        let e = edit(&cur.source, &b.old, &b.new, replace_all).map_err(|m| if blocks.len() > 1 { format!("block {}: {m}", i + 1) } else { m })?;
        cur = Edited {
            delta: Delta { added: cur.delta.added + e.delta.added, removed: cur.delta.removed + e.delta.removed },
            ..e
        };
    }
    Ok(cur)
}

/// Inserts `text` after line `after` (0 = at the very start, `line_count` = at the end).
pub fn insert(source: &str, after: usize, text: &str) -> Result<Edited, String> {
    let total = line_count(source);
    if after > total {
        return Err(format!("line {after} is past the end: the source has {total} lines"));
    }
    let mut lines: Vec<&str> = if source.is_empty() { Vec::new() } else { source.strip_suffix('\n').unwrap_or(source).split('\n').collect() };
    let new: Vec<&str> = text.strip_suffix('\n').unwrap_or(text).split('\n').collect();
    let n = if text.is_empty() { 0 } else { new.len() };
    if n == 0 {
        return Err("text is empty, nothing to insert".into());
    }
    lines.splice(after..after, new);
    Ok(Edited {
        source: finish(&lines, source),
        delta: Delta { added: n, removed: 0 },
        first_line: after + 1,
        last_line: after + n,
    })
}

/// Replaces lines `start..=end` (1-based) with `text`; empty `text` deletes them.
pub fn replace_lines(source: &str, start: usize, end: usize, text: &str) -> Result<Edited, String> {
    let total = line_count(source);
    if start == 0 || start > end {
        return Err(format!("invalid range {start}-{end}: lines are numbered from 1 and start must not exceed end"));
    }
    if end > total {
        return Err(format!("line {end} is past the end: the source has {total} lines"));
    }
    let mut lines: Vec<&str> = source.strip_suffix('\n').unwrap_or(source).split('\n').collect();
    let new: Vec<&str> = if text.is_empty() { Vec::new() } else { text.strip_suffix('\n').unwrap_or(text).split('\n').collect() };
    let n = new.len();
    lines.splice(start - 1..end, new);
    Ok(Edited {
        source: finish(&lines, source),
        delta: Delta { added: n, removed: end - start + 1 },
        first_line: start,
        last_line: if n == 0 { start.saturating_sub(1) } else { start + n - 1 },
    })
}

/// Joins lines back, keeping the original's trailing newline (or giving a new file one).
fn finish(lines: &[&str], original: &str) -> String {
    if lines.is_empty() {
        return String::new();
    }
    let mut s = lines.join("\n");
    if original.is_empty() || original.ends_with('\n') {
        s.push('\n');
    }
    s
}

pub fn write(old: &str, new: &str) -> Delta {
    Delta { added: line_count(new), removed: line_count(old) }
}

#[derive(Debug, Clone, Copy)]
pub struct SearchOptions {
    pub regex: bool,
    pub ignore_case: bool,
    pub context: usize,
}

/// Matches with line numbers and `context` lines around them, grep -n style.
pub fn search(source: &str, pattern: &str, o: SearchOptions) -> Result<String, String> {
    if pattern.is_empty() {
        return Err("pattern is empty".into());
    }
    let re = RegexBuilder::new(&if o.regex { pattern.to_string() } else { regex::escape(pattern) })
        .case_insensitive(o.ignore_case)
        .size_limit(1 << 20)
        .build()
        .map_err(|e| format!("invalid pattern: {e}"))?;
    let lines: Vec<&str> = source.strip_suffix('\n').unwrap_or(source).split('\n').collect();
    let hit: Vec<usize> = lines.iter().enumerate().filter(|(_, l)| re.is_match(l)).map(|(i, _)| i).collect();
    if hit.is_empty() {
        return Ok("no matches".into());
    }
    let shown = &hit[..hit.len().min(MAX_SEARCH_HITS)];
    let width = lines.len().to_string().len();
    let mut out = Vec::new();
    let mut next_free = 0usize; // first line not printed yet, so overlapping contexts merge
    for &i in shown {
        let from = i.saturating_sub(o.context).max(next_free);
        let to = (i + o.context).min(lines.len() - 1);
        if from > next_free && next_free > 0 {
            out.push("--".to_string());
        }
        for j in from..=to {
            let mark = if j == i || hit.binary_search(&j).is_ok() { ':' } else { '-' };
            out.push(format!("{:>width$}{mark}{}", j + 1, cut(lines[j])));
        }
        next_free = to + 1;
    }
    let more = if hit.len() > shown.len() { format!("\n… {} more matching lines not shown", hit.len() - shown.len()) } else { String::new() };
    Ok(format!("{}{}\n({} matching lines)", out.join("\n"), more, hit.len()))
}

#[cfg(test)]
mod tests {
    use super::*;

    const SRC: &str = "a = 1;\nb = 2;\nc = a + b;\n";

    #[test]
    fn read_numbers_lines_and_pages() {
        assert_eq!(read(SRC, None, None).unwrap(), "1\ta = 1;\n2\tb = 2;\n3\tc = a + b;");
        assert_eq!(read(SRC, Some(2), Some(1)).unwrap(), "2\tb = 2;\n… 1 more lines, read on from line 3");
        assert!(read(SRC, Some(9), None).is_err());
        assert_eq!(read("", None, None).unwrap(), "(the source is empty)");
    }

    #[test]
    fn read_pads_line_numbers() {
        let src: String = (1..=12).map(|i| format!("l{i}\n")).collect();
        let out = read(&src, Some(9), Some(2)).unwrap();
        assert!(out.starts_with(" 9\tl9\n10\tl10"), "{out}");
    }

    #[test]
    fn edit_replaces_one_exact_match() {
        let e = edit(SRC, "b = 2;", "b = 5;\nd = 0;", false).unwrap();
        assert_eq!(e.source, "a = 1;\nb = 5;\nd = 0;\nc = a + b;\n");
        assert_eq!(e.delta, Delta { added: 2, removed: 1 });
        assert_eq!((e.first_line, e.last_line), (2, 3));
    }

    #[test]
    fn edit_refuses_ambiguous_and_missing() {
        let e = edit("x;\nx;\n", "x;", "y;", false).unwrap_err();
        assert!(e.contains("2 places") && e.contains("1, 2"), "{e}");
        assert_eq!(edit("x;\nx;\n", "x;", "y;", true).unwrap().source, "y;\ny;\n");
        assert!(edit(SRC, "zzz", "y", false).unwrap_err().contains("not found"));
        assert!(edit(SRC, "a", "a", false).is_err());
        assert!(edit(SRC, "", "a", false).is_err());
    }

    #[test]
    fn edit_hints_at_whitespace() {
        let e = edit("cube( [1,2,3] );\n", "cube([1,2,3]);", "x", false).unwrap_err();
        assert!(!e.contains("whitespace"), "different tokens are not a whitespace issue: {e}");
        let e = edit("a  =   1;\n", "a = 1;", "x", false).unwrap_err();
        assert!(e.contains("whitespace"), "{e}");
    }

    #[test]
    fn insert_after_line() {
        assert_eq!(insert(SRC, 0, "// top").unwrap().source, "// top\na = 1;\nb = 2;\nc = a + b;\n");
        let e = insert(SRC, 3, "d = 3;\ne = 4;").unwrap();
        assert_eq!(e.source, "a = 1;\nb = 2;\nc = a + b;\nd = 3;\ne = 4;\n");
        assert_eq!((e.first_line, e.last_line, e.delta.added), (4, 5, 2));
        assert!(insert(SRC, 4, "x").is_err());
        assert!(insert(SRC, 1, "").is_err());
        assert_eq!(insert("", 0, "x").unwrap().source, "x\n");
    }

    #[test]
    fn replace_and_delete_lines() {
        let e = replace_lines(SRC, 2, 3, "z = 9;").unwrap();
        assert_eq!(e.source, "a = 1;\nz = 9;\n");
        assert_eq!(e.delta, Delta { added: 1, removed: 2 });
        assert_eq!(replace_lines(SRC, 1, 1, "").unwrap().source, "b = 2;\nc = a + b;\n");
        assert!(replace_lines(SRC, 3, 2, "x").is_err());
        assert!(replace_lines(SRC, 0, 1, "x").is_err());
        assert!(replace_lines(SRC, 1, 4, "x").is_err());
        assert_eq!(replace_lines("a\n", 1, 1, "").unwrap().source, "");
    }

    #[test]
    fn edits_keep_a_missing_trailing_newline() {
        assert_eq!(replace_lines("a\nb", 2, 2, "c").unwrap().source, "a\nc");
        assert_eq!(insert("a\nb", 1, "x").unwrap().source, "a\nx\nb");
    }

    #[test]
    fn search_literal_regex_and_context() {
        let o = SearchOptions { regex: false, ignore_case: false, context: 0 };
        assert_eq!(search(SRC, "a + b", o).unwrap(), "3:c = a + b;\n(1 matching lines)");
        assert_eq!(search(SRC, "zzz", o).unwrap(), "no matches");
        let re = SearchOptions { regex: true, ignore_case: true, context: 1 };
        let out = search(SRC, r"^B\s*=", re).unwrap();
        assert!(out.contains("1-a = 1;") && out.contains("2:b = 2;") && out.contains("3-c = a + b;"), "{out}");
        assert!(search(SRC, "(", SearchOptions { regex: true, ..o }).is_err());
        assert!(search(SRC, "", o).is_err());
    }

    #[test]
    fn search_merges_overlapping_context() {
        let src = "m\nx\nm\nx\nx\nx\nx\nm\n";
        let out = search(src, "m", SearchOptions { regex: false, ignore_case: false, context: 1 }).unwrap();
        // lines 1-4 form one block, a "--" separates it from 7-8
        assert_eq!(out.matches("--").count(), 1, "{out}");
        assert!(out.contains("(3 matching lines)"));
    }

    #[test]
    fn blocks_parse_and_apply_together() {
        let input = "<<<<<<< SEARCH\na = 1;\n=======\na = 10;\n>>>>>>> REPLACE\n\n<<<<<<< SEARCH\nb = 2;\n=======\n>>>>>>> REPLACE";
        let blocks = parse_blocks(input).unwrap();
        assert_eq!(blocks, [Block { old: "a = 1;".into(), new: "a = 10;".into() }, Block { old: "b = 2;".into(), new: "".into() }]);
        let e = edit_blocks(SRC, &blocks, false).unwrap();
        assert_eq!(e.source, "a = 10;\n\nc = a + b;\n");
        assert_eq!(e.delta, Delta { added: 1, removed: 2 });
        // a bad second block leaves nothing applied and says which one
        let bad = [blocks[0].clone(), Block { old: "zzz".into(), new: "y".into() }];
        assert!(edit_blocks(SRC, &bad, false).unwrap_err().starts_with("block 2:"));
    }

    #[test]
    fn block_syntax_errors() {
        assert!(parse_blocks("hello").unwrap_err().contains("outside a block"));
        assert!(parse_blocks("").unwrap_err().contains("no SEARCH"));
        assert!(parse_blocks("<<<<<<< SEARCH\nx").unwrap_err().contains("=======") );
        assert!(parse_blocks("<<<<<<< SEARCH\nx\n=======\ny").unwrap_err().contains("not closed"));
    }

    #[test]
    fn counts() {
        assert_eq!(line_count(""), 0);
        assert_eq!(line_count("a"), 1);
        assert_eq!(line_count("a\n"), 1);
        assert_eq!(line_count("a\n\n"), 2);
        assert_eq!(write("a\nb\n", "x\n"), Delta { added: 1, removed: 2 });
    }
}
