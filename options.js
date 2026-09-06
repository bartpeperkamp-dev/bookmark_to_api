function saveOptions() {
  browser.storage.local.set({
    url: document.getElementById("url").value,
    token: document.getElementById("token").value
  }).then(() => {
    let status = document.getElementById("status");
    status.textContent = "Saved.";
    setTimeout(() => { status.textContent = ""; }, 1500);
  });
}

function restoreOptions() {
  browser.storage.local.get(["url", "token"]).then((result) => {
    document.getElementById("url").value = result.url || "";
    document.getElementById("token").value = result.token || "";
  });
}

document.addEventListener("DOMContentLoaded", restoreOptions);
document.getElementById("save").addEventListener("click", saveOptions);
