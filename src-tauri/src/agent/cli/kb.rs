//! The knowledge base: reference files (subfolders of Markdown and other text) that ship inside
//! the app, in `src-tauri/kb/`, and that the agent searches. The search is local and lexical:
//! passages are ranked with BM25, boosted when the path or heading matches, when the exact
//! phrase occurs and when more of the query words are present.

use std::collections::{HashMap, HashSet};
use std::path::Path;
use std::sync::Arc;

use include_dir::{Dir, include_dir};

/// The folder `src-tauri/kb/`, compiled into the program.
static BAKED: Dir<'static> = include_dir!("$CARGO_MANIFEST_DIR/kb");

/// Where the documents come from. The program uses [`baked`]; tests supply their own.
pub type Source = Arc<dyn Fn(&[String]) -> Vec<Doc> + Send + Sync>;

/// The knowledge base inside the program. A debug build reads the folder from disk instead, so
/// edits show up without a rebuild.
pub fn baked() -> Source {
    Arc::new(|exts| {
        #[cfg(debug_assertions)]
        if let Ok(docs) = scan(Path::new(concat!(env!("CARGO_MANIFEST_DIR"), "/kb")), exts) {
            return docs;
        }
        let mut docs = Vec::new();
        walk_baked(&BAKED, exts, &mut docs);
        docs.sort_by(|a, b| a.rel.cmp(&b.rel));
        docs
    })
}

fn walk_baked(dir: &Dir<'_>, exts: &[String], out: &mut Vec<Doc>) {
    for f in dir.files() {
        let parts: Vec<String> = f
            .path()
            .components()
            .map(|c| c.as_os_str().to_string_lossy().to_string())
            .collect();
        if wanted(&parts, f.contents().len() as u64, exts) {
            out.push(doc(&parts, f.contents()));
        }
    }
    for d in dir.dirs() {
        walk_baked(d, exts, out);
    }
}

/// Extensions that are indexed unless `--ext` says otherwise.
pub const DEFAULT_EXTS: &[&str] = &[
    "md", "markdown", "txt", "rst", "adoc", "org", "tex", "scad", "json", "yaml", "yml", "toml",
    "csv", "tsv",
];
const MAX_FILE: u64 = 2 * 1024 * 1024;
const MAX_DEPTH: usize = 8;
const MAX_FILES: usize = 20_000;

pub struct Doc {
    /// Path below the knowledge base, with `/`.
    pub rel: String,
    /// The top-level subfolder it is in (empty for files in the root).
    pub sub: String,
    pub lines: Vec<String>,
}

/// Every indexable file below `root`. Hidden folders, `node_modules`, symbolic links and big
/// files are skipped.
pub fn scan(root: &Path, exts: &[String]) -> Result<Vec<Doc>, String> {
    if !root.is_dir() {
        return Err(format!("{} is not a folder", root.display()));
    }
    let mut docs = Vec::new();
    walk(root, root, 0, exts, &mut docs);
    docs.sort_by(|a, b| a.rel.cmp(&b.rel));
    Ok(docs)
}

fn walk(root: &Path, dir: &Path, depth: usize, exts: &[String], out: &mut Vec<Doc>) {
    let Ok(read) = std::fs::read_dir(dir) else {
        return;
    };
    for entry in read.flatten() {
        if out.len() >= MAX_FILES {
            return;
        }
        let name = entry.file_name().to_string_lossy().to_string();
        let Ok(kind) = entry.file_type() else {
            continue;
        };
        let path = entry.path();
        if kind.is_dir() {
            if depth < MAX_DEPTH && !name.starts_with('.') && name != "node_modules" {
                walk(root, &path, depth + 1, exts, out);
            }
        } else if kind.is_file() && !name.starts_with('.') {
            let Ok(rel) = path.strip_prefix(root) else {
                continue;
            };
            let parts: Vec<String> = rel
                .components()
                .map(|c| c.as_os_str().to_string_lossy().to_string())
                .collect();
            if !wanted(&parts, entry.metadata().map_or(u64::MAX, |m| m.len()), exts) {
                continue;
            }
            if let Ok(bytes) = std::fs::read(&path) {
                out.push(doc(&parts, &bytes));
            }
        }
    }
}

/// Whether a file (its path parts, relative to the root) is indexed: a wanted extension, not
/// hidden, not too big.
fn wanted(parts: &[String], size: u64, exts: &[String]) -> bool {
    let Some(name) = parts.last() else {
        return false;
    };
    let ext = Path::new(name)
        .extension()
        .map(|e| e.to_string_lossy().to_lowercase())
        .unwrap_or_default();
    size <= MAX_FILE
        && !parts
            .iter()
            .any(|p| p.starts_with('.') || p == "node_modules")
        && exts.iter().any(|e| *e == ext)
}

fn doc(parts: &[String], bytes: &[u8]) -> Doc {
    Doc {
        rel: parts.join("/"),
        sub: if parts.len() > 1 {
            parts[0].clone()
        } else {
            String::new()
        },
        lines: String::from_utf8_lossy(bytes)
            .lines()
            .map(str::to_owned)
            .collect(),
    }
}

/// The default list as owned strings, or the user's `--ext a,b`.
pub fn exts(list: Option<&str>) -> Vec<String> {
    match list {
        Some(l) => l
            .split(',')
            .map(|e| e.trim().trim_start_matches('.').to_lowercase())
            .filter(|e| !e.is_empty())
            .collect(),
        None => DEFAULT_EXTS.iter().map(|e| e.to_string()).collect(),
    }
}

// ---- words ----

const STOP: &[&str] = &[
    "a", "an", "and", "are", "as", "at", "be", "by", "do", "does", "for", "from", "how", "i", "in",
    "is", "it", "of", "on", "or", "that", "the", "to", "what", "when", "where", "which", "with",
    "you", "your",
];

/// Cuts the common English endings, so that stone/stones and setting/settings meet.
fn stem(w: &str) -> String {
    let n = w.chars().count();
    let cut = |k: usize| w.chars().take(n - k).collect::<String>();
    if n > 4 && w.ends_with("ies") {
        format!("{}y", cut(3))
    } else if n > 5 && w.ends_with("ing") {
        cut(3)
    } else if n > 4 && w.ends_with("ed") {
        cut(2)
    } else if n > 4 && w.ends_with("es") {
        cut(2)
    } else if n > 3 && w.ends_with('s') && !w.ends_with("ss") {
        cut(1)
    } else {
        w.to_string()
    }
}

fn words(text: &str) -> Vec<String> {
    text.split(|c: char| !c.is_alphanumeric())
        .filter(|w| !w.is_empty())
        .map(str::to_lowercase)
        .filter(|w| !STOP.contains(&w.as_str()))
        .map(|w| stem(&w))
        .collect()
}

// ---- passages ----

pub struct Passage {
    pub doc: usize,
    /// 1-based, inclusive.
    pub start: usize,
    pub end: usize,
    pub heading: String,
}

const MIN_CHARS: usize = 200;
const MAX_CHARS: usize = 1500;
const MAX_LINES: usize = 25;

fn is_heading(line: &str) -> Option<&str> {
    let t = line.trim_start();
    let hashes = t.chars().take_while(|c| *c == '#').count();
    (1..=6)
        .contains(&hashes)
        .then(|| t[hashes..].strip_prefix(' '))
        .flatten()
        .map(str::trim)
}

/// Splits a file at headings and blank lines; small paragraphs are merged, big ones cut.
fn passages(doc_index: usize, doc: &Doc) -> Vec<Passage> {
    let mut out = Vec::new();
    let mut heading = String::new();
    let (mut start, mut chars) = (0usize, 0usize);
    let flush = |start: usize, end: usize, heading: &str, out: &mut Vec<Passage>| {
        if end > start && doc.lines[start..end].iter().any(|l| !l.trim().is_empty()) {
            out.push(Passage {
                doc: doc_index,
                start: start + 1,
                end,
                heading: heading.to_string(),
            });
        }
    };
    for (i, line) in doc.lines.iter().enumerate() {
        if let Some(h) = is_heading(line) {
            flush(start, i, &heading, &mut out);
            start = i;
            chars = 0;
            heading = h.to_string();
        } else if line.trim().is_empty() && chars >= MIN_CHARS {
            flush(start, i, &heading, &mut out);
            start = i + 1;
            chars = 0;
            continue;
        } else if chars >= MAX_CHARS || i - start >= MAX_LINES {
            flush(start, i, &heading, &mut out);
            start = i;
            chars = 0;
        }
        chars += line.len() + 1;
    }
    flush(start, doc.lines.len(), &heading, &mut out);
    out
}

// ---- search ----

pub struct Hit {
    pub passage: usize,
    pub score: f64,
}

pub struct Index<'a> {
    pub docs: &'a [Doc],
    pub passages: Vec<Passage>,
}

impl<'a> Index<'a> {
    pub fn new(docs: &'a [Doc]) -> Self {
        let passages = docs
            .iter()
            .enumerate()
            .flat_map(|(i, d)| passages(i, d))
            .collect();
        Self { docs, passages }
    }

    fn text(&self, p: &Passage) -> String {
        self.docs[p.doc].lines[p.start - 1..p.end].join("\n")
    }

    /// Passages ranked best first; those sharing no word with the query are left out.
    pub fn search(&self, query: &str) -> Vec<Hit> {
        let terms: Vec<String> = {
            let mut seen = HashSet::new();
            words(query)
                .into_iter()
                .filter(|w| seen.insert(w.clone()))
                .collect()
        };
        if terms.is_empty() || self.passages.is_empty() {
            return Vec::new();
        }
        let bodies: Vec<Vec<String>> = self.passages.iter().map(|p| words(&self.text(p))).collect();
        let n = self.passages.len() as f64;
        let avg = bodies.iter().map(Vec::len).sum::<usize>() as f64 / n;
        let mut df: HashMap<&str, usize> = HashMap::new();
        for b in &bodies {
            let set: HashSet<&str> = b.iter().map(String::as_str).collect();
            for t in &terms {
                if set.contains(t.as_str()) {
                    *df.entry(t.as_str()).or_default() += 1;
                }
            }
        }
        let phrase = query.to_lowercase();
        let phrase = phrase.split_whitespace().collect::<Vec<_>>().join(" ");
        let (k1, b) = (1.5, 0.75);
        let mut hits = Vec::new();
        for (i, p) in self.passages.iter().enumerate() {
            let body = &bodies[i];
            let len = body.len().max(1) as f64;
            let path_words = words(&self.docs[p.doc].rel);
            let head_words = words(&p.heading);
            let (mut score, mut matched) = (0.0, 0usize);
            for t in &terms {
                let tf = body.iter().filter(|w| *w == t).count() as f64;
                let in_path = path_words.contains(t);
                let in_head = head_words.contains(t);
                if tf == 0.0 && !in_path && !in_head {
                    continue;
                }
                matched += 1;
                let d = *df.get(t.as_str()).unwrap_or(&0) as f64;
                let idf = (1.0 + (n - d + 0.5) / (d + 0.5)).ln();
                score += idf * tf * (k1 + 1.0) / (tf + k1 * (1.0 - b + b * len / avg.max(1.0)));
                if in_path {
                    score += idf * 0.8;
                }
                if in_head {
                    score += idf * 0.8;
                }
            }
            if matched == 0 || score <= 0.0 {
                continue;
            }
            score *= 0.5 + 0.5 * matched as f64 / terms.len() as f64;
            if terms.len() > 1 && self.text(p).to_lowercase().contains(&phrase) {
                score *= 1.4;
            }
            hits.push(Hit { passage: i, score });
        }
        hits.sort_by(|a, b| b.score.total_cmp(&a.score));
        hits
    }
}

pub struct Options {
    pub top: usize,
    pub per_file: usize,
    pub lines: Option<usize>,
}

/// The ranked passages as text: `path:lines  # heading` and the passage itself.
pub fn render(index: &Index, hits: &[Hit], query: &str, o: &Options) -> String {
    let mut shown = Vec::new();
    let mut per_file: HashMap<usize, usize> = HashMap::new();
    for h in hits {
        let p = &index.passages[h.passage];
        let c = per_file.entry(p.doc).or_default();
        if *c >= o.per_file {
            continue;
        }
        *c += 1;
        shown.push(h);
        if shown.len() >= o.top {
            break;
        }
    }
    if shown.is_empty() {
        return format!(
            "no passage matches {query:?}; try other words, or `kb ls` to see what there is"
        );
    }
    let mut out = format!(
        "{} of {} matching passages for {query:?}",
        shown.len(),
        hits.len()
    );
    for (rank, h) in shown.iter().enumerate() {
        let p = &index.passages[h.passage];
        let doc = &index.docs[p.doc];
        let head = if p.heading.is_empty() {
            String::new()
        } else {
            format!("  # {}", p.heading)
        };
        out.push_str(&format!(
            "\n\n{}. {}:{}-{}{head}",
            rank + 1,
            doc.rel,
            p.start,
            p.end
        ));
        let total = p.end - p.start + 1;
        let take = o.lines.map_or(total, |l| l.min(total));
        for (i, line) in doc.lines[p.start - 1..p.start - 1 + take]
            .iter()
            .enumerate()
        {
            out.push_str(&format!("\n{}\t{line}", p.start + i));
        }
        if take < total {
            out.push_str(&format!(
                "\n… {} more lines: kb cat {} {}:{}",
                total - take,
                doc.rel,
                p.start + take,
                p.end
            ));
        }
    }
    out
}

/// The best files for the query, one per line.
pub fn files(index: &Index, hits: &[Hit], top: usize) -> String {
    let mut seen = HashSet::new();
    let list: Vec<&str> = hits
        .iter()
        .map(|h| index.docs[index.passages[h.passage].doc].rel.as_str())
        .filter(|r| seen.insert(*r))
        .take(top)
        .collect();
    if list.is_empty() {
        "no file matches".into()
    } else {
        list.join("\n")
    }
}

/// The subfolders with their file counts (files in the root are listed too).
pub fn list(docs: &[Doc]) -> String {
    let mut counts: Vec<(String, usize)> = Vec::new();
    for d in docs {
        let key = if d.sub.is_empty() {
            "(top level)".to_string()
        } else {
            format!("{}/", d.sub)
        };
        match counts.iter_mut().find(|(k, _)| *k == key) {
            Some(c) => c.1 += 1,
            None => counts.push((key, 1)),
        }
    }
    if counts.is_empty() {
        return "the knowledge base is empty".into();
    }
    let width = counts.iter().map(|(k, _)| k.len()).max().unwrap_or(0);
    let mut out = format!("{} files", docs.len());
    for (k, c) in counts {
        out.push_str(&format!("\n  {k:<width$}  {c}"));
    }
    out
}

/// The file at `rel`, as `kb search` shows it.
pub fn find<'a>(docs: &'a [Doc], rel: &str) -> Result<&'a Doc, String> {
    let rel = rel.trim_start_matches("./");
    docs.iter().find(|d| d.rel == rel).ok_or_else(|| {
        format!(
            "no file {rel:?} in the knowledge base; paths are as `kb search` and `kb ls` show them"
        )
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    fn make(files: &[(&str, &str)]) -> (PathBuf, Vec<Doc>) {
        static N: std::sync::atomic::AtomicUsize = std::sync::atomic::AtomicUsize::new(0);
        let dir = std::env::temp_dir().join(format!(
            "fc-kb-{}-{}",
            std::process::id(),
            N.fetch_add(1, std::sync::atomic::Ordering::Relaxed)
        ));
        let _ = std::fs::remove_dir_all(&dir);
        for (p, t) in files {
            let f = dir.join(p);
            std::fs::create_dir_all(f.parent().unwrap()).unwrap();
            std::fs::write(f, t).unwrap();
        }
        let docs = scan(&dir, &exts(None)).unwrap();
        (dir, docs)
    }

    fn top(docs: &[Doc], q: &str) -> String {
        let idx = Index::new(docs);
        let hits = idx.search(q);
        let p = &idx.passages[hits[0].passage];
        format!("{}:{}", docs[p.doc].rel, p.heading)
    }

    const FILES: &[(&str, &str)] = &[
        (
            "settings/prongs.md",
            "# Prong settings\n\nA prong setting holds the stone with 4 or 6 metal claws.\n\n## Prong thickness\n\nUse 0.8 to 1.0 mm at the base for small stones.\n",
        ),
        (
            "settings/bezel.md",
            "# Bezel settings\n\nA bezel wraps the whole girdle with a thin wall of 0.6 mm.\n",
        ),
        (
            "casting/limits.md",
            "# Casting limits\n\nMinimum wall thickness for silver is 0.6 mm. Gold needs more.\n",
        ),
        ("notes.txt", "Remember to polish the inside of the band.\n"),
        ("image.png", "not text"),
        (".hidden/secret.md", "# Secret\n\nprong prong prong\n"),
    ];

    #[test]
    fn scans_text_files_and_skips_the_rest() {
        let (dir, docs) = make(FILES);
        let names: Vec<&str> = docs.iter().map(|d| d.rel.as_str()).collect();
        assert_eq!(
            names,
            [
                "casting/limits.md",
                "notes.txt",
                "settings/bezel.md",
                "settings/prongs.md"
            ]
        );
        assert_eq!(docs[0].sub, "casting");
        assert_eq!(docs[1].sub, "");
        assert!(scan(&dir.join("nope"), &exts(None)).is_err());
        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn finds_the_right_passage() {
        let (dir, docs) = make(FILES);
        assert_eq!(
            top(&docs, "prong setting for stones"),
            "settings/prongs.md:Prong settings"
        );
        assert_eq!(
            top(&docs, "minimum wall thickness silver"),
            "casting/limits.md:Casting limits"
        );
        assert_eq!(top(&docs, "bezel"), "settings/bezel.md:Bezel settings");
        // plurals and endings meet
        assert_eq!(top(&docs, "claw"), "settings/prongs.md:Prong settings");
        let idx = Index::new(&docs);
        assert!(idx.search("xylophone").is_empty());
        assert!(idx.search("the of and").is_empty(), "only stop words");
        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn output_names_path_lines_and_how_to_read_more() {
        let (dir, docs) = make(FILES);
        let idx = Index::new(&docs);
        let hits = idx.search("prong");
        let o = Options {
            top: 5,
            per_file: 1,
            lines: Some(1),
        };
        let text = render(&idx, &hits, "prong", &o);
        assert!(text.contains("1. settings/prongs.md:1-"), "{text}");
        assert!(
            text.contains("# Prong settings") && text.contains("1\t# Prong settings"),
            "{text}"
        );
        assert!(
            text.contains("more lines: kb cat settings/prongs.md"),
            "{text}"
        );
        assert_eq!(
            text.matches("settings/prongs.md:").count(),
            1,
            "one passage per file (the hint has no colon after the path)"
        );
        assert_eq!(files(&idx, &hits, 5), "settings/prongs.md");
        let none = render(&idx, &[], "zzz", &o);
        assert!(none.contains("no passage matches"));
        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn lists_folders() {
        let (dir, docs) = make(FILES);
        let l = list(&docs);
        assert!(
            l.contains("4 files") && l.contains("settings/    2") && l.contains("(top level)  1"),
            "{l}"
        );
        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn files_are_found_by_the_path_search_shows() {
        let (dir, docs) = make(FILES);
        assert_eq!(find(&docs, "settings/bezel.md").unwrap().sub, "settings");
        assert!(find(&docs, "./notes.txt").is_ok());
        assert!(find(&docs, "../etc/passwd").is_err());
        assert!(find(&docs, "/etc/passwd").is_err());
        assert!(find(&docs, "settings").is_err());
        assert!(list(&[]).contains("empty"));
        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn the_baked_in_folder_loads() {
        // whatever is in src-tauri/kb/ (it may be empty): it must load and be searchable
        let docs = baked()(&exts(None));
        let idx = Index::new(&docs);
        let _ = idx.search("ring");
        assert!(
            docs.iter()
                .all(|d| !d.rel.starts_with('.') && !d.rel.contains(".."))
        );
    }

    #[test]
    fn long_sections_are_cut_into_passages() {
        let body: String = (0..80)
            .map(|i| format!("line number {i} about rings\n"))
            .collect();
        let doc = Doc {
            rel: "a.md".into(),
            sub: String::new(),
            lines: body.lines().map(str::to_owned).collect(),
        };
        let ps = passages(0, &doc);
        assert!(ps.len() >= 3);
        assert!(ps.iter().all(|p| p.end - p.start < MAX_LINES + 1));
        assert_eq!(ps.first().unwrap().start, 1);
        assert_eq!(ps.last().unwrap().end, 80);
    }
}
