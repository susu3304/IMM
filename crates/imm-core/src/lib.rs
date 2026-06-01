#![cfg_attr(not(feature = "native"), allow(dead_code))]

pub mod ast;
pub mod checker;
pub mod diagnostics;
pub mod lexer;
pub mod parser;
pub mod runtime;
pub mod source;
pub mod spec;
pub mod stdlib;
pub mod token;

use parser::parse_source;
use runtime::Runtime;

use crate::diagnostics::Diagnostic;

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ExecutionResult {
    pub ok: bool,
    pub stdout: String,
    pub stderr: String,
}

pub fn check_source(source: &str) -> Result<ExecutionResult, Diagnostic> {
    let program = parse_source(0, source)?;
    let mut runtime = Runtime::new(None);
    runtime.check(&program)?;
    Ok(ExecutionResult {
        ok: true,
        stdout: "OK\n".to_string(),
        stderr: String::new(),
    })
}

pub fn run_source(source: &str, trace: bool) -> Result<ExecutionResult, Diagnostic> {
    let program = parse_source(0, source)?;
    let mut runtime = Runtime::new(None);
    runtime.set_trace_enabled(trace);
    runtime.run(&program, true)?;
    Ok(ExecutionResult {
        ok: true,
        stdout: join_lines(runtime.output_lines()),
        stderr: join_lines(runtime.trace_lines()),
    })
}

pub fn format_source(source: &str) -> Result<String, Diagnostic> {
    parse_source(0, source)?;
    Ok(simple_format(source))
}

pub fn spec_json() -> Result<String, serde_json::Error> {
    spec::render_json()
}

pub fn simple_format(source: &str) -> String {
    let mut indent = 0_usize;
    let mut out = String::new();
    for raw in source.replace("\r\n", "\n").replace('\r', "\n").lines() {
        let line = raw.trim();
        if line.is_empty() {
            continue;
        }
        if line.starts_with('}') {
            indent = indent.saturating_sub(1);
        }
        out.push_str(&"    ".repeat(indent));
        out.push_str(line);
        out.push('\n');
        if line.ends_with('{') {
            indent += 1;
        }
    }
    out
}

fn join_lines(lines: Vec<String>) -> String {
    if lines.is_empty() {
        String::new()
    } else {
        let mut text = lines.join("\n");
        text.push('\n');
        text
    }
}
