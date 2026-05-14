// ══ FILE OPERATIONS ══
import { ST, esc, fmtBytes } from './state.js';
import { openModal, closeModal, toast } from './modals.js';

export function navigateTo(path) {
  window.location.href = path;
}

export function filterFiles() {
  const q = document.getElementById("file-search").value.toLowerCase();
  document.querySelectorAll("#file-tbody tr").forEach((tr) => {
    const name = (tr.dataset.name || "").toLowerCase();
    tr.style.display = !q || name.includes(q) ? "" : "none";
  });
}

let sortDir = { name: true, size: true, mtime: true };
export function sortTable(col) {
  const asc = (sortDir[col] = !sortDir[col]);
  const tbody = document.getElementById("file-tbody");
  const rows = Array.from(tbody.querySelectorAll("tr[data-name]"));
  rows.sort((a, b) => {
    let va = a.dataset[col] || "",
      vb = b.dataset[col] || "";
    if (col === "size" || col === "mtime") {
      va = parseFloat(va) || 0;
      vb = parseFloat(vb) || 0;
      return asc ? va - vb : vb - va;
    }
    return asc ? va.localeCompare(vb) : vb.localeCompare(va);
  });
  rows.forEach((r) => tbody.appendChild(r));
  document.querySelectorAll(".file-table th[id]").forEach((th) => {
    th.classList.remove("sorted");
    th.querySelector(".sort-arrow").textContent = "↕";
  });
  const th = document.getElementById("th-" + col);
  if (th) {
    th.classList.add("sorted");
    th.querySelector(".sort-arrow").textContent = asc ? "↑" : "↓";
  }
}

function toggleAllChecks(el) {
  document
    .querySelectorAll(".row-check-item")
    .forEach((c) => (c.checked = el.checked));
  updateBulkBar();
}
export function updateBulkBar() {
  const checked = document.querySelectorAll(".row-check-item:checked").length;
  const bar = document.getElementById("bulk-bar");
  bar.classList.toggle("show", checked > 0);
  document.getElementById("bulk-count").textContent = checked + "개 선택";
}
export function clearSelection() {
  document
    .querySelectorAll(".row-check-item")
    .forEach((c) => (c.checked = false));
  const all = document.getElementById("chk-all");
  if (all) all.checked = false;
  updateBulkBar();
}
function getSelectedNames() {
  return Array.from(document.querySelectorAll(".row-check-item:checked"))
    .map((c) => c.closest("tr").dataset.name)
    .filter(Boolean);
}
function getSelectedValues() {
  return Array.from(document.querySelectorAll(".row-check-item:checked"))
    .map((c) => c.closest("tr").dataset.value)
    .filter(Boolean);
}
export function downloadSelected() {
  // This one takes all the selected and forms the right zip download
  const url = new URL(window.location.href);
  getSelectedValues().forEach((val) => {
    url.searchParams.append("file", val);
  });
  url.searchParams.append("bulk", "true");
  window.open(url.href, "_blank");
  clearSelection();
}
export function downloadBulk() {
  // This one selects everything in the current view and forms the right zip download
  document.querySelectorAll("#file-tbody tr[data-name]").forEach((tr) => {
    if (tr.style.display !== "none") {
      const cb = tr.querySelector(".row-check-item");
      if (cb) cb.checked = true;
    }
  });
  updateBulkBar();
  downloadSelected();
}
function deleteSelected() {
  const vals = getSelectedValues();
  if (!vals.length) return;
  if (!confirm(`${vals.length}개 항목을 삭제하시겠습니까?`)) return;
  Promise.all(vals.map((val) => deleteFile(val, true)))
    .then(() => location.reload())
    .catch(() => toast("삭제 실패", "error"));
}
function getCsrfToken() {
  const meta = document.querySelector('meta[name="csrf-token"]');
  return meta ? meta.getAttribute("content") : "";
}
export function deleteFile(path, bulk) {
  let ok;
  !bulk
    ? (ok = confirm("파일 또는 디렉토리를 삭제하시겠습니까?"))
    : (ok = true);

  if (ok) {
    var url = "";
    location.protocol !== "https:"
      ? (url = "http://" + window.location.host + path)
      : (url = "https://" + window.location.host + path);
    fetch(url, {
      method: "DELETE",
      headers: { "X-CSRF-Token": getCsrfToken() },
    })
      .then(() => location.reload())
      .catch(() => toast("삭제 실패", "error"));
  }
}

// ══ UPLOAD ══
export function openUpload() {
  openModal("upload-modal");
}
export function openMkdir() {
  openModal("mkdir-modal");
  setTimeout(() => document.getElementById("mkdir-input").focus(), 50);
}

export function handleFileSelect(files) {
  Array.from(files).forEach((f) => {
    if (
      !ST.pendingUploads.find((p) => p.name === f.name && p.size === f.size)
    ) {
      ST.pendingUploads.push(f);
    }
  });
  renderUploadList();
}
function renderUploadList() {
  const list = document.getElementById("upload-file-list");
  list.innerHTML = "";
  ST.pendingUploads.forEach((f, i) => {
    const item = document.createElement("div");
    item.className = "upload-file-item";
    item.innerHTML = `<span class="fname">${esc(f.name)}</span><span class="fsize">${fmtBytes(f.size)}</span>
<button class="fremove" onclick="removeUpload(${i})">✕</button>`;
    list.appendChild(item);
  });
}
export function removeUpload(i) {
  ST.pendingUploads.splice(i, 1);
  renderUploadList();
}
export function startUpload() {
  if (!ST.pendingUploads.length) {
    toast("선택된 파일이 없습니다", "warn");
    return;
  }
  const fd = new FormData();
  ST.pendingUploads.forEach((f) => fd.append("file", f));
  const wrap = document.getElementById("upload-progress-wrap");
  const bar = document.getElementById("upload-progress-bar");
  wrap.style.display = "block";
  bar.style.width = "0";

  const xhr = new XMLHttpRequest();
  xhr.open("POST", `${window.location.href}upload`);
  xhr.setRequestHeader("X-CSRF-Token", getCsrfToken());
  xhr.upload.onprogress = (e) => {
    if (e.lengthComputable) bar.style.width = (e.loaded / e.total) * 100 + "%";
  };
  xhr.onload = () => {
    if (xhr.status === 200) {
      toast("업로드 완료!", "success");
      closeModal("upload-modal");
      ST.pendingUploads = [];
      setTimeout(() => location.reload(), 600);
    } else if (xhr.status === 413) {
      const limitBytes = parseInt(
        document.querySelector('meta[name="max-upload"]')?.content || "0",
        10,
      );
      const msg =
        limitBytes > 0
          ? "업로드 거부: " +
            fmtBytes(limitBytes) +
            " 서버 제한 초과"
          : "업로드 거부: 파일이 너무 큽니다";
      toast(msg, "error");
    } else toast("업로드 실패: " + xhr.statusText, "error");
  };
  xhr.onerror = () => toast("업로드 실패", "error");
  xhr.send(fd);
}
export function createDir() {
  const name = document.getElementById("mkdir-input").value.trim();
  if (!name) return;

  const target = name.endsWith("/") ? name : name + "/";
  fetch(target, {
    method: "POST",
    headers: { "X-CSRF-Token": getCsrfToken() },
  })
    .then((r) => {
      // if response http.Created
      if (r.status === 201) {
        toast("생성 완료: " + name, "success");
        closeModal("mkdir-modal");
        setTimeout(() => location.reload(), 600);
      } else toast("실패", "error");
    })
    .catch(() => toast("네트워크 오류", "error"));
}

// ══ DRAG-DROP ══
function initDrop() {
  const overlay = document.getElementById("drop-overlay");
  let dragCnt = 0;
  document.addEventListener("dragenter", (e) => {
    if (!e.dataTransfer.types.includes("Files")) return;
    dragCnt++;
    overlay.classList.add("active");
    e.preventDefault();
  });
  document.addEventListener("dragleave", () => {
    if (--dragCnt <= 0) {
      dragCnt = 0;
      overlay.classList.remove("active");
    }
  });
  document.addEventListener("dragover", (e) => {
    e.preventDefault();
  });
  document.addEventListener("drop", (e) => {
    e.preventDefault();
    dragCnt = 0;
    overlay.classList.remove("active");
    const files = e.dataTransfer.files;
    if (files.length) {
      handleFileSelect(files);
      openModal("upload-modal");
    }
  });
  // modal drop area
  const mda = document.getElementById("modal-drop-area");
  if (mda) {
    mda.addEventListener("dragover", (e) => {
      e.preventDefault();
      mda.classList.add("hover");
    });
    mda.addEventListener("dragleave", () => mda.classList.remove("hover"));
    mda.addEventListener("drop", (e) => {
      e.preventDefault();
      mda.classList.remove("hover");
      handleFileSelect(e.dataTransfer.files);
    });
  }
}

export function initFiles() {
  initDrop();
}
