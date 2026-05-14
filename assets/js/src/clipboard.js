// ══ CLIPBOARD ══
import { ST } from './state.js';
import { toast } from './modals.js';

export function onClipboardUpdate(msg) {
  // Reload side and activate clipboard tab
  sessionStorage.setItem("activeTab", "nav-clip");
  location.reload();
}

export function initClipboard() {
  // Clipboard is largely driven by WebSocket events and inline onclick handlers
  // The init just ensures the module is loaded
}

export function sendClip() {
  const txt = document.getElementById("clip-input").value.trim();
  if (!txt) return;
  var msg = {
    type: "newEntry",
    content: txt,
  };
  ST.ws.send(JSON.stringify(msg));
  document.getElementById("clip-input").value = "";
}
export function copyClip(id) {
  const body = document.querySelector("#clip-" + id + " .clip-card-body");
  if (body) {
    navigator.clipboard
      .writeText(body.textContent)
      .then(() => toast("복사됨!", "success"));
  }
}
export function deleteClip(id) {
  var msg = {
    type: "delEntry",
    content: id,
  };
  ST.ws.send(JSON.stringify(msg));
}
export function downloadClipboard() {
  window.open("/?cbDown", "_blank");
}
export function clearClipboard() {
  const result = confirm("클립보드를 지우시겠습니까?");
  if (result) {
    var msg = {
      type: "clearClipboard",
      content: "",
    };
    ST.ws.send(JSON.stringify(msg)).then(() => toast("지워졌습니다!", "success"));
  }
}
