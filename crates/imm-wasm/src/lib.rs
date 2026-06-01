use serde::Serialize;
use wasm_bindgen::prelude::*;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct WasmExecutionResult {
    ok: bool,
    stdout: String,
    stderr: String,
}

#[wasm_bindgen]
pub fn check(source: &str) -> Result<JsValue, JsValue> {
    execution_result(imm_core::check_source(source))
}

#[wasm_bindgen]
pub fn run(source: &str, trace: bool) -> Result<JsValue, JsValue> {
    execution_result(imm_core::run_source(source, trace))
}

#[wasm_bindgen(js_name = "formatSource")]
pub fn format_source(source: &str) -> Result<String, JsValue> {
    imm_core::format_source(source).map_err(diagnostic_to_js)
}

#[wasm_bindgen(js_name = "specJson")]
pub fn spec_json() -> Result<String, JsValue> {
    imm_core::spec_json().map_err(|err| JsValue::from_str(&err.to_string()))
}

fn execution_result(
    result: Result<imm_core::ExecutionResult, imm_core::diagnostics::Diagnostic>,
) -> Result<JsValue, JsValue> {
    let result = result.map_err(diagnostic_to_js)?;
    serde_wasm_bindgen::to_value(&WasmExecutionResult {
        ok: result.ok,
        stdout: result.stdout,
        stderr: result.stderr,
    })
    .map_err(|err| JsValue::from_str(&err.to_string()))
}

fn diagnostic_to_js(err: imm_core::diagnostics::Diagnostic) -> JsValue {
    JsValue::from_str(&err.to_string())
}
