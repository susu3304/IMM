use axum::response::Html;

pub async fn index() -> Html<&'static str> {
    Html(INDEX_HTML)
}

pub async fn admin() -> Html<&'static str> {
    Html(ADMIN_HTML)
}

const INDEX_HTML: &str = r##"<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>IMM Registry</title>
  <style>
    :root { color-scheme: light dark; font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    body { margin: 0; background: #f7f7f5; color: #1c1d1f; }
    main { max-width: 920px; margin: 0 auto; padding: 40px 20px; }
    header { display: flex; align-items: baseline; justify-content: space-between; gap: 24px; margin-bottom: 28px; }
    h1 { font-size: 28px; margin: 0; }
    a { color: #075985; }
    .search { display: flex; gap: 8px; margin-bottom: 20px; }
    input { flex: 1; min-width: 0; padding: 10px 12px; border: 1px solid #c9c9c2; border-radius: 6px; font: inherit; background: white; color: inherit; }
    button { padding: 10px 14px; border: 1px solid #1f2937; border-radius: 6px; background: #1f2937; color: white; font: inherit; cursor: pointer; }
    .list { display: grid; gap: 10px; }
    .package { border: 1px solid #d8d8d0; border-radius: 8px; background: white; padding: 14px; }
    .name { font-weight: 700; font-size: 16px; }
    .meta { color: #5f6368; font-size: 13px; margin-top: 4px; }
    pre { white-space: pre-wrap; overflow-wrap: anywhere; background: #1f2937; color: #f9fafb; border-radius: 8px; padding: 14px; }
    @media (prefers-color-scheme: dark) {
      body { background: #101214; color: #eceff3; }
      input, .package { background: #181b1f; border-color: #343941; }
      .meta { color: #a8b0bb; }
    }
  </style>
</head>
<body>
<main>
  <header>
    <h1>IMM Registry</h1>
    <a href="/admin">Admin</a>
  </header>
  <form class="search" id="search-form">
    <input id="q" name="q" placeholder="Search packages" autocomplete="off">
    <button type="submit">Search</button>
  </form>
  <section class="list" id="results"></section>
  <pre id="detail" hidden></pre>
</main>
<script>
const results = document.querySelector("#results");
const detail = document.querySelector("#detail");
async function search(q = "") {
  const response = await fetch(`/api/v1/search?q=${encodeURIComponent(q)}`);
  const data = await response.json();
  results.innerHTML = "";
  detail.hidden = true;
  for (const pkg of data.packages) {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "package";
    item.style.textAlign = "left";
    item.innerHTML = `<div class="name"></div><div class="meta"></div>`;
    item.querySelector(".name").textContent = pkg.name;
    item.querySelector(".meta").textContent = `${pkg.latest_version || "no version"} ${pkg.description ? " - " + pkg.description : ""}`;
    item.addEventListener("click", () => loadPackage(pkg.name));
    results.appendChild(item);
  }
}
async function loadPackage(name) {
  const response = await fetch(`/api/v1/packages/${encodeURIComponent(name)}`);
  detail.textContent = JSON.stringify(await response.json(), null, 2);
  detail.hidden = false;
}
document.querySelector("#search-form").addEventListener("submit", (event) => {
  event.preventDefault();
  search(document.querySelector("#q").value);
});
search();
</script>
</body>
</html>"##;

const ADMIN_HTML: &str = r##"<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>IMM Registry Admin</title>
  <style>
    :root { color-scheme: light dark; font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    body { margin: 0; background: #f7f7f5; color: #1c1d1f; }
    main { max-width: 760px; margin: 0 auto; padding: 40px 20px; }
    h1 { font-size: 26px; margin: 0 0 24px; }
    form { display: grid; gap: 14px; border: 1px solid #d8d8d0; border-radius: 8px; background: white; padding: 18px; }
    label { display: grid; gap: 6px; font-weight: 650; }
    input { padding: 10px 12px; border: 1px solid #c9c9c2; border-radius: 6px; font: inherit; background: white; color: inherit; }
    button { justify-self: start; padding: 10px 14px; border: 1px solid #1f2937; border-radius: 6px; background: #1f2937; color: white; font: inherit; cursor: pointer; }
    pre { margin-top: 18px; white-space: pre-wrap; overflow-wrap: anywhere; background: #1f2937; color: #f9fafb; border-radius: 8px; padding: 14px; }
    @media (prefers-color-scheme: dark) {
      body { background: #101214; color: #eceff3; }
      input, form { background: #181b1f; border-color: #343941; }
    }
  </style>
</head>
<body>
<main>
  <h1>IMM Registry Admin</h1>
  <form id="upload-form">
    <label>
      Admin token
      <input id="token" name="token" type="password" autocomplete="current-password">
    </label>
    <label>
      Package archive
      <input id="archive" name="archive" type="file" accept=".tgz,.gz" required>
    </label>
    <button type="submit">Upload</button>
  </form>
  <pre id="output" hidden></pre>
</main>
<script>
const form = document.querySelector("#upload-form");
const output = document.querySelector("#output");
form.addEventListener("submit", async (event) => {
  event.preventDefault();
  output.hidden = false;
  output.textContent = "Uploading...";
  const body = new FormData();
  body.append("archive", document.querySelector("#archive").files[0]);
  const response = await fetch("/admin/api/v1/packages", {
    method: "POST",
    headers: { "x-admin-token": document.querySelector("#token").value },
    body
  });
  const text = await response.text();
  try {
    output.textContent = JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    output.textContent = text;
  }
});
</script>
</body>
</html>"##;
