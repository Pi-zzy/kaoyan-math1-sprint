(() => {
  "use strict";
  const storageKey = "math-i-study-studio-v1";
  const cards = Array.from(document.querySelectorAll("[data-course]"));
  const courseIds = new Set(cards.map(card => card.dataset.course));
  const allowedStatuses = new Set(["not-started", "reading", "review", "recalled"]);
  const documentLinks = Array.from(document.querySelectorAll("a[data-document-id]"));
  const documentIds = new Set(documentLinks.map(link => link.dataset.documentId));
  const storageStatus = document.getElementById("storage-status");
  let subjectFilter = "all";
  let progress = { version: 1, statuses: {}, lastDocument: null };
  let storageAvailable = true;

  function validateProgress(candidate) {
    if (!candidate || candidate.version !== 1 || !candidate.statuses ||
        typeof candidate.statuses !== "object" || Array.isArray(candidate.statuses)) {
      throw new Error("不是有效的数学一学习进度备份。");
    }
    const statuses = {};
    Object.entries(candidate.statuses).forEach(([identifier, status]) => {
      if (courseIds.has(identifier) && allowedStatuses.has(status)) statuses[identifier] = status;
    });
    const lastDocument = candidate.lastDocument && documentIds.has(candidate.lastDocument.identifier)
      ? { identifier: candidate.lastDocument.identifier } : null;
    return { version: 1, statuses, lastDocument };
  }

  function saveProgress(message) {
    try {
      localStorage.setItem(storageKey, JSON.stringify(progress));
      storageAvailable = true;
      storageStatus.textContent = message || "已保存到当前浏览器；这是学习自评，不是考试成绩。";
    } catch (error) {
      storageAvailable = false;
      storageStatus.textContent = "浏览器无法保存本地进度。当前页面仍可使用，请导出备份。";
    }
  }

  function updateProgress() {
    let recalled = 0;
    let review = 0;
    cards.forEach(card => {
      const status = progress.statuses[card.dataset.course] || "not-started";
      card.dataset.state = status;
      card.querySelector("select").value = status;
      if (status === "recalled") recalled += 1;
      if (status === "review") review += 1;
    });
    document.getElementById("progress-summary").textContent = `已自测 ${recalled} / ${cards.length} 站 · 待回炉 ${review} 站`;
    document.getElementById("progress-fill").style.width = `${cards.length ? recalled / cards.length * 100 : 0}%`;
    document.querySelector("[role='progressbar']").setAttribute("aria-valuenow", String(recalled));
    const resume = progress.lastDocument && documentLinks.find(link =>
      link.dataset.documentId === progress.lastDocument.identifier);
    document.getElementById("resume-box").hidden = !resume;
    if (resume) {
      document.getElementById("resume-title").textContent = progress.lastDocument.identifier.replace(/\.html$/, "").replaceAll("/", " / ");
      const resumeLink = document.getElementById("resume-link");
      resumeLink.href = resume.href;
      resumeLink.dataset.documentId = resume.dataset.documentId;
    }
  }

  function filterCourses() {
    const query = document.getElementById("course-search").value.trim().toLocaleLowerCase();
    const terms = query.split(/\s+/).filter(Boolean);
    let visibleCount = 0;
    cards.forEach(card => {
      const matchesSubject = subjectFilter === "all" || card.dataset.subject === subjectFilter;
      const searchText = card.dataset.search.toLocaleLowerCase();
      const visible = matchesSubject && terms.every(term => searchText.includes(term));
      card.hidden = !visible;
      if (visible) visibleCount += 1;
    });
    document.getElementById("filter-count").textContent = `显示 ${visibleCount} 个专题`;
    document.getElementById("no-results").hidden = visibleCount !== 0;
  }

  try {
    const saved = localStorage.getItem(storageKey);
    if (saved) progress = validateProgress(JSON.parse(saved));
  } catch (error) {
    storageAvailable = false;
    storageStatus.textContent = "本地记录不可读取。未修改原记录；你可以导入已导出的进度备份。";
  }
  updateProgress();

  document.querySelectorAll("[data-filter]").forEach(button => {
    button.addEventListener("click", () => {
      subjectFilter = button.dataset.filter;
      document.querySelectorAll("[data-filter]").forEach(filterButton => {
        const active = filterButton === button;
        filterButton.classList.toggle("active", active);
        filterButton.setAttribute("aria-pressed", String(active));
      });
      filterCourses();
    });
  });
  document.getElementById("course-search").addEventListener("input", filterCourses);
  document.getElementById("clear-search").addEventListener("click", () => {
    document.getElementById("course-search").value = "";
    document.querySelector("[data-filter='all']").click();
  });
  document.querySelectorAll("[data-status]").forEach(select => {
    select.addEventListener("change", () => {
      progress.statuses[select.dataset.status] = select.value;
      saveProgress();
      updateProgress();
    });
  });
  document.addEventListener("click", event => {
    const link = event.target.closest("a[data-document-id]");
    if (link && documentIds.has(link.dataset.documentId)) {
      progress.lastDocument = { identifier: link.dataset.documentId };
      saveProgress();
    }
  });
  document.getElementById("export-progress").addEventListener("click", () => {
    const backup = { ...progress, exportedAt: new Date().toISOString() };
    const file = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(file);
    const download = document.createElement("a");
    download.href = url;
    download.download = "数学一-学习进度.json";
    document.body.appendChild(download);
    download.click();
    download.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    storageStatus.textContent = "已请求导出学习进度，请确认浏览器下载文件后再清理记录。";
  });
  const fileInput = document.getElementById("progress-file");
  document.getElementById("import-progress").addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", async () => {
    const file = fileInput.files[0];
    if (!file) return;
    try {
      if (file.size > 2 * 1024 * 1024) throw new Error("备份文件过大，请选择导出的学习进度 JSON。");
      const imported = validateProgress(JSON.parse(await file.text()));
      progress = imported;
      saveProgress("已导入备份；专题状态仅为你自己的学习记录。");
      updateProgress();
    } catch (error) {
      storageStatus.textContent = `导入失败，现有进度未变：${error.message}`;
    } finally {
      fileInput.value = "";
    }
  });
  if (!storageAvailable) document.body.dataset.storageUnavailable = "true";
})();
