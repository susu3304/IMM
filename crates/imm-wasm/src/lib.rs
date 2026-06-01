use std::collections::BTreeMap;
use std::rc::Rc;

use imm_core::diagnostics::{Category, Diagnostic};
use imm_core::runtime::{HostFuture, HostHttpRequest, HostHttpResponse, RuntimeHost};
use serde::Serialize;
use wasm_bindgen::prelude::*;
use wasm_bindgen::JsCast;
use wasm_bindgen_futures::JsFuture;

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
pub async fn run(source: &str, trace: bool, input: Option<String>) -> Result<JsValue, JsValue> {
    execution_result(
        imm_core::run_source_with_input_async(
            source,
            trace,
            input.as_deref().unwrap_or_default(),
            Some(Rc::new(BrowserHost)),
        )
        .await,
    )
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

struct BrowserHost;

impl RuntimeHost for BrowserHost {
    fn http_request(&self, request: HostHttpRequest) -> HostFuture<HostHttpResponse> {
        Box::pin(async move { browser_fetch(request).await })
    }

    fn sleep(&self, ms: u64) -> HostFuture<()> {
        Box::pin(async move {
            let global = js_sys::global();
            let set_timeout = js_sys::Reflect::get(&global, &JsValue::from_str("setTimeout"))
                .map_err(|err| js_network_error("setTimeout lookup failed", err))?
                .dyn_into::<js_sys::Function>()
                .map_err(|err| js_network_error("setTimeout is not callable", err))?;
            let promise = js_sys::Promise::new(&mut |resolve, _reject| {
                let _ = set_timeout.call2(&global, resolve.as_ref(), &JsValue::from_f64(ms as f64));
            });
            JsFuture::from(promise)
                .await
                .map_err(|err| js_network_error("sleep failed", err))?;
            Ok(())
        })
    }

    fn now_ms(&self) -> Result<i64, Diagnostic> {
        Ok(js_sys::Date::now() as i64)
    }
}

async fn browser_fetch(request: HostHttpRequest) -> Result<HostHttpResponse, Diagnostic> {
    let init = web_sys::RequestInit::new();
    init.set_method(&request.method);

    let headers =
        web_sys::Headers::new().map_err(|err| js_network_error("request headers failed", err))?;
    for (key, value) in &request.headers {
        headers
            .append(key, value)
            .map_err(|err| js_network_error("request header append failed", err))?;
    }
    init.set_headers(headers.as_ref());

    if let Some(body) = &request.body {
        init.set_body(&JsValue::from_str(body));
    }

    let global = js_sys::global();
    let fetch = js_sys::Reflect::get(&global, &JsValue::from_str("fetch"))
        .map_err(|err| js_network_error("fetch lookup failed", err))?
        .dyn_into::<js_sys::Function>()
        .map_err(|err| js_network_error("fetch is not callable", err))?;
    let promise = fetch
        .call2(&global, &JsValue::from_str(&request.url), init.as_ref())
        .map_err(|err| js_network_error("fetch request failed", err))?
        .dyn_into::<js_sys::Promise>()
        .map_err(|err| js_network_error("fetch did not return a Promise", err))?;
    let response = JsFuture::from(promise)
        .await
        .map_err(|err| js_network_error("fetch request failed", err))?
        .dyn_into::<web_sys::Response>()
        .map_err(|err| js_network_error("fetch did not return a Response", err))?;

    let mut response_headers = BTreeMap::new();
    let entries = js_sys::try_iter(&response.headers())
        .map_err(|err| js_network_error("response header iteration failed", err))?
        .ok_or_else(|| Diagnostic::new(Category::Network, "response headers are not iterable"))?;
    for entry in entries {
        let entry = entry.map_err(|err| js_network_error("response header read failed", err))?;
        let pair = js_sys::Array::from(&entry);
        let key = pair.get(0).as_string().unwrap_or_default();
        if key.is_empty() {
            continue;
        }
        let value = pair.get(1).as_string().unwrap_or_default();
        response_headers.insert(key, value);
    }

    let body = JsFuture::from(
        response
            .text()
            .map_err(|err| js_network_error("response text failed", err))?,
    )
    .await
    .map_err(|err| js_network_error("response text failed", err))?
    .as_string()
    .unwrap_or_default();

    Ok(HostHttpResponse {
        status: response.status() as i64,
        headers: response_headers,
        body,
        url: response.url(),
        ok: response.ok(),
    })
}

fn js_network_error(context: &str, err: JsValue) -> Diagnostic {
    Diagnostic::new(
        Category::Network,
        format!("{context}: {}", js_error_text(err)),
    )
}

fn js_error_text(err: JsValue) -> String {
    if let Some(text) = err.as_string() {
        return text;
    }
    if let Ok(text) = js_sys::Reflect::get(&err, &JsValue::from_str("message")) {
        if let Some(text) = text.as_string() {
            return text;
        }
    }
    js_sys::JSON::stringify(&err)
        .ok()
        .and_then(|text| text.as_string())
        .unwrap_or_else(|| "unknown JavaScript error".to_string())
}
