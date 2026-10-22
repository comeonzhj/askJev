/* ==========================================================================
   遇事不决问 Jev
   纯静态 · 浏览器直连 Jev API
   ========================================================================== */

(() => {
  "use strict";

  const DEFAULT_ENDPOINT = "https://jevtypesafe.org/api/v1/decide";
  const STORE_KEY = "askjev.settings.v1";
  const MAX_STATE = 8000;

  const LIMITS = { choice: { min: 2, max: 20 }, score: { min: 2, max: 10 } };

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  /* ---------- 状态 ------------------------------------------------------- */

  const state = {
    mode: "choice",
    settings: loadSettings(),
    busy: false,
    last: null,
  };

  function loadSettings() {
    try {
      const raw = JSON.parse(localStorage.getItem(STORE_KEY) || "{}");
      return {
        apiKey: typeof raw.apiKey === "string" ? raw.apiKey : "",
        endpoint: raw.endpoint || DEFAULT_ENDPOINT,
      };
    } catch {
      return { apiKey: "", endpoint: DEFAULT_ENDPOINT };
    }
  }

  function saveSettings(next) {
    state.settings = { ...state.settings, ...next };
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(state.settings));
    } catch {
      toast("浏览器拒绝了本地存储，Key 只在本次会话有效。");
    }
    paintKeyState();
  }

  /* ---------- 顶栏 / 滚动 ------------------------------------------------- */

  const topbar = $(".topbar");

  function onScroll() {
    topbar.classList.toggle("is-stuck", window.scrollY > 24);
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  function paintKeyState() {
    const ready = Boolean(state.settings.apiKey);
    $("#keyBtn").classList.toggle("is-ready", ready);
    $("#keyBtnLabel").textContent = ready ? "KEY 已接入" : "API KEY";
  }

  /* ---------- 进场动画 ---------------------------------------------------- */

  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-in");
        io.unobserve(entry.target);
      });
    },
    { threshold: 0.12, rootMargin: "0px 0px -8% 0px" }
  );

  $$(".reveal").forEach((el, i) => {
    el.style.transitionDelay = `${Math.min(i * 60, 400)}ms`;
    io.observe(el);
  });

  /* ---------- 动态行 ------------------------------------------------------ */

  const LIMIT_BY_TYPE = LIMITS;

  function makeRow(list, value, type, index) {
    const row = document.createElement("div");
    row.className = "row";

    const idx = document.createElement("span");
    idx.className = "idx";
    idx.textContent = String(index + 1).padStart(2, "0");

    const input = document.createElement("input");
    input.type = "text";
    input.value = value;
    input.spellcheck = false;
    input.maxLength = 120;
    input.placeholder = type === "choice" ? `选项 ${index + 1}` : `第 ${index + 1} 档`;

    const del = document.createElement("button");
    del.type = "button";
    del.className = "del";
    del.textContent = "×";
    del.setAttribute("aria-label", "删除这一项");
    del.addEventListener("click", () => {
      row.remove();
      renumber(list);
      syncLimits(list, type);
    });

    row.append(idx, input, del);
    return row;
  }

  function renumber(list) {
    $$(".row", list).forEach((row, i) => {
      $(".idx", row).textContent = String(i + 1).padStart(2, "0");
      $("input", row).placeholder = row.dataset.type === "score" ? `第 ${i + 1} 档` : `选项 ${i + 1}`;
    });
  }

  function syncLimits(list, type) {
    const rows = $$(".row", list);
    const { min, max } = LIMIT_BY_TYPE[type];
    rows.forEach((row) => {
      $(".del", row).disabled = rows.length <= min;
    });
    const addBtn = type === "choice" ? $("#addChoice") : $("#addLevel");
    addBtn.disabled = rows.length >= max;
  }

  function addRow(list, type, value = "") {
    const rows = $$(".row", list);
    const { max } = LIMIT_BY_TYPE[type];
    if (rows.length >= max) return;
    const row = makeRow(list, value, type, rows.length);
    row.dataset.type = type;
    list.append(row);
    renumber(list);
    syncLimits(list, type);
    if (!value) $("input", row).focus();
  }

  function readRows(list) {
    return $$(".row input", list)
      .map((input) => input.value.trim())
      .filter(Boolean);
  }

  /* 初始：选项两行，刻度五档 */
  const choiceRows = $("#choiceRows");
  const scaleRows = $("#scaleRows");

  ["", ""].forEach((v) => addRow(choiceRows, "choice", v));
  ["很低", "较低", "中等", "较高", "很高"].forEach((v) => addRow(scaleRows, "score", v));

  $("#addChoice").addEventListener("click", () => addRow(choiceRows, "choice"));
  $("#addLevel").addEventListener("click", () => addRow(scaleRows, "score"));

  /* ---------- 模式切换 ---------------------------------------------------- */

  function setMode(mode) {
    state.mode = mode;
    $$(".seg").forEach((btn) => {
      const on = btn.dataset.mode === mode;
      btn.classList.toggle("is-on", on);
      btn.setAttribute("aria-selected", String(on));
    });
    $$(".mode-panel").forEach((panel) => {
      panel.classList.toggle("is-on", panel.dataset.panel === mode);
    });
    if (mode === "noul") {
      $("#question").placeholder = "例如：这件事现在还值得继续投入吗？";
    } else {
      $("#question").placeholder = "例如：我该不该接下这个 offer？";
    }
  }

  $$(".seg").forEach((btn) =>
    btn.addEventListener("click", () => setMode(btn.dataset.mode))
  );

  /* ---------- 字数 -------------------------------------------------------- */

  function bindCount(input, out, max) {
    const paint = () => {
      out.textContent = `${input.value.length} / ${max}`;
    };
    input.addEventListener("input", paint);
    paint();
  }
  bindCount($("#context"), $("#contextCount"), 6000);
  bindCount($("#question"), $("#questionCount"), 600);

  /* ---------- 设置弹窗 ---------------------------------------------------- */

  const modal = $("#keyModal");

  function openModal() {
    $("#apiKey").value = state.settings.apiKey;
    $("#endpoint").value = state.settings.endpoint || DEFAULT_ENDPOINT;
    $("#testResult").textContent = "";
    modal.hidden = false;
    document.body.classList.add("is-locked");
    setTimeout(() => $("#apiKey").focus(), 60);
  }

  function closeModal() {
    modal.hidden = true;
    const verdictOpen = !$("#verdict").hidden;
    if (!verdictOpen) document.body.classList.remove("is-locked");
  }

  $("#keyBtn").addEventListener("click", openModal);
  $$("[data-close]", modal).forEach((el) => el.addEventListener("click", closeModal));

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !modal.hidden) closeModal();
  });

  $("#peekBtn").addEventListener("click", () => {
    const input = $("#apiKey");
    const show = input.type === "password";
    input.type = show ? "text" : "password";
    $("#peekBtn").textContent = show ? "隐藏" : "显示";
  });

  $("#saveBtn").addEventListener("click", () => {
    const key = $("#apiKey").value.trim();
    const endpoint = $("#endpoint").value.trim() || DEFAULT_ENDPOINT;
    if (key && !/^https?:\/\//i.test(endpoint)) {
      toast("端点需要以 http(s):// 开头。");
      return;
    }
    saveSettings({ apiKey: key, endpoint });
    closeModal();
    toast(key ? "已接入。可以开始求问了。" : "已清除 Key。");
  });

  /* ---------- 请求 -------------------------------------------------------- */

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  function buildQuestions(mode) {
    if (mode === "choice") {
      const labels = readRows(choiceRows).slice(0, LIMITS.choice.max);
      if (labels.length < LIMITS.choice.min) throw new Error("选项至少要有两项。");

      const criteria = {};
      const map = {};
      labels.forEach((label, i) => {
        const key = `opt_${i + 1}`;
        criteria[key] = label;
        map[key] = label;
      });

      return {
        payload: {
          type: "choice",
          instructions:
            "根据背景与待决之事，判断哪一个选项最值得选择。每个选项的判断都应当有独立依据。",
          criteria,
        },
        map,
      };
    }

    if (mode === "score") {
      const levels = readRows(scaleRows).slice(0, LIMITS.score.max);
      if (levels.length < LIMITS.score.min) throw new Error("刻度至少要有两档。");
      return {
        payload: {
          type: "score",
          instructions:
            "根据背景与待决之事，把结论落在下面这个从低到高的刻度上，选择最贴合的一档。",
          criteria: levels,
        },
        map: null,
      };
    }

    return {
      payload: {
        type: "noul",
        instructions: "根据背景与待决之事，判断这件事是否应当去做。",
      },
      map: null,
    };
  }

  async function callJev(payload, { key, endpoint, signal } = {}) {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal,
    });

    const text = await res.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = null;
    }

    if (!res.ok) {
      const detail = data && (data.message || data.error || data.title);
      const err = new Error(detail || `请求失败（HTTP ${res.status}）`);
      err.status = res.status;
      throw err;
    }

    const answers = (data && (data.answers || (data.data && data.data.answers))) || null;
    if (!answers) throw new Error("返回里没有答案，检查端点是否为 Jev 的 decide 接口。");

    return {
      answers,
      model: data.model || (data.data && data.data.model) || "jev",
      usage: data.usage || (data.data && data.data.usage) || null,
    };
  }

  function describeError(err) {
    if (err.name === "AbortError") return "等待超时。灯没亮，换个网络或稍后再试。";
    const s = err.status;
    if (s === 401 || s === 403) return "API Key 不被接受。检查是否填错，或该 Key 已失效。";
    if (s === 402) return "账户余额不足，Jev 拒绝了这次求问。";
    if (s === 413) return "背景信息过长，Jev 只收 8000 字符以内。";
    if (s === 429) return "请求太密集，等几秒再问。";
    if (s === 451) return "当前网络所在区域被 Jev 屏蔽。试试更换网络出口。";
    if (s >= 500) return "Jev 那边出了故障，暂时没有回应。";
    if (err instanceof TypeError) return "请求发不出去。可能是网络问题，或端点不允许跨域。";
    return err.message || "发生了未知错误。";
  }

  /* ---------- 结果渲染 ---------------------------------------------------- */

  const verdict = $("#verdict");
  const veilText = $("#veilText");
  const VEIL_LINES = ["正在拨开迷雾", "正在称量你的处境", "正在收拢所有变量", "答案就要显形"];

  let veilTimer = null;

  function startSeeking() {
    state.busy = true;
    document.body.classList.add("is-seeking", "is-locked");
    $("#submitBtn").disabled = true;
    $("#formError").classList.remove("is-on");

    let i = 0;
    veilText.textContent = VEIL_LINES[0];
    veilTimer = setInterval(() => {
      i = (i + 1) % VEIL_LINES.length;
      veilText.style.opacity = "0";
      setTimeout(() => {
        veilText.textContent = VEIL_LINES[i];
        veilText.style.opacity = "1";
      }, 220);
    }, 1900);
  }

  function stopSeeking() {
    state.busy = false;
    document.body.classList.remove("is-seeking");
    if ($("#verdict").hidden) document.body.classList.remove("is-locked");
    $("#submitBtn").disabled = false;
    if (veilTimer) clearInterval(veilTimer);
    veilTimer = null;
  }

  function answerText(answer, mode, map) {
    if (mode === "choice") {
      const raw = answer.choice;
      if (!raw) return "无解";
      return map[raw] || raw;
    }
    if (mode === "score") {
      if (typeof answer.score !== "number") return "无解";
      return state.last.levels[Math.round(answer.score)] || String(answer.score);
    }
    return Number(answer.noul) >= 0.5 ? "是" : "否";
  }

  function confidenceOf(answer, mode) {
    if (mode === "noul") {
      const p = Number(answer.noul) || 0;
      return Math.max(p, 1 - p);
    }
    return typeof answer.confidence === "number" ? answer.confidence : null;
  }

  function renderDist(answer, mode, map) {
    const box = $("#verdictDist");
    box.innerHTML = "";

    let rows = [];

    if (mode === "choice") {
      const probs = answer.probabilities || {};
      rows = Object.entries(probs)
        .map(([k, v]) => ({ label: map[k] || k, value: Number(v) || 0, top: k === answer.choice }))
        .sort((a, b) => b.value - a.value);
    } else if (mode === "score") {
      const probs = answer.probabilities || {};
      rows = state.last.levels.map((label, i) => ({
        label,
        value: Number(probs[String(i)]) || 0,
        top: Math.round(answer.score) === i,
      }));
    } else {
      const p = Number(answer.noul) || 0;
      rows = [
        { label: "是", value: p, top: p >= 0.5 },
        { label: "否", value: 1 - p, top: p < 0.5 },
      ];
    }

    if (!rows.length) {
      box.hidden = true;
      return;
    }
    box.hidden = false;

    rows.forEach((r) => {
      const row = document.createElement("div");
      row.className = "dist-row" + (r.top ? " is-top" : "");

      const name = document.createElement("span");
      name.className = "dist-name";
      name.textContent = r.label;

      const bar = document.createElement("span");
      bar.className = "dist-bar";
      const fill = document.createElement("span");
      fill.className = "dist-fill";
      fill.style.setProperty("--w", `${Math.max(0, Math.min(1, r.value)) * 100}%`);
      bar.append(fill);

      const num = document.createElement("span");
      num.className = "dist-num";
      num.textContent = `${(r.value * 100).toFixed(1)}%`;

      row.append(name, bar, num);
      box.append(row);
    });
  }

  function showVerdict(result) {
    const { answer, mode, map, model, question } = result;

    const text = answerText(answer, mode, map);
    const el = $("#verdictAnswer");
    el.textContent = text;
    const len = Array.from(text).length;
    el.classList.toggle("is-long", len >= 4 && len <= 9);
    el.classList.toggle("is-xlong", len > 9);

    $("#verdictQuestion").textContent = question;

    const conf = confidenceOf(answer, mode);
    $("#verdictConf").textContent = conf === null ? "—" : `${Math.round(conf * 100)}%`;

    const modeLabel =
      mode === "choice" ? "选项" : mode === "score" ? "评分" : "是否";
    $("#verdictType").textContent = modeLabel;
    $("#verdictModel").textContent = model;

    renderDist(answer, mode, map);

    verdict.hidden = false;
    document.body.classList.add("is-locked");

    requestAnimationFrame(() => {
      requestAnimationFrame(() => verdict.classList.add("is-open"));
    });
  }

  function hideVerdict() {
    verdict.classList.remove("is-open");
    setTimeout(() => {
      verdict.hidden = true;
      document.body.classList.remove("is-locked");
    }, 900);
  }

  /* ---------- 提交 -------------------------------------------------------- */

  $("#form").addEventListener("submit", async (e) => {
    e.preventDefault();
    if (state.busy) return;

    const formError = $("#formError");
    formError.classList.remove("is-on");

    if (!state.settings.apiKey) {
      toast("先接入 Jev 的 API Key。");
      openModal();
      return;
    }

    let built;
    try {
      built = buildQuestions(state.mode);
    } catch (err) {
      formError.textContent = err.message;
      formError.classList.add("is-on");
      return;
    }

    const context = $("#context").value.trim();
    const question = $("#question").value.trim();

    if (!question) {
      formError.textContent = "还没说清要定哪件事。";
      formError.classList.add("is-on");
      $("#question").focus();
      return;
    }

    const composed = [
      context ? `【背景】\n${context}` : "",
      `【待决之事】\n${question}`,
    ]
      .filter(Boolean)
      .join("\n\n");

    if (composed.length > MAX_STATE) {
      formError.textContent = `背景加问题共 ${composed.length} 字，超出 Jev 的 ${MAX_STATE} 字上限。`;
      formError.classList.add("is-on");
      return;
    }

    const levels = state.mode === "score" ? readRows(scaleRows) : null;

    startSeeking();
    const started = Date.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000);

    try {
      const { answers, model } = await callJev(
        {
          state: composed,
          questions: { decision: built.payload },
        },
        {
          key: state.settings.apiKey,
          endpoint: state.settings.endpoint || DEFAULT_ENDPOINT,
          signal: controller.signal,
        }
      );

      const answer = answers.decision || Object.values(answers)[0];
      if (!answer) throw new Error("Jev 没有返回这道题的答案。");

      // 给迷雾一点时间，不要闪一下就走。
      const elapsed = Date.now() - started;
      if (elapsed < 1400) await sleep(1400 - elapsed);

      state.last = { answer, mode: state.mode, map: built.map, model, question, levels };

      stopSeeking();
      showVerdict(state.last);
    } catch (err) {
      stopSeeking();
      formError.textContent = describeError(err);
      formError.classList.add("is-on");
      formError.scrollIntoView({ behavior: "smooth", block: "center" });
    } finally {
      clearTimeout(timeout);
    }
  });

  /* ---------- 判词操作 ---------------------------------------------------- */

  $("#againBtn").addEventListener("click", () => {
    hideVerdict();
    setTimeout(() => {
      $("#ritual").scrollIntoView({ behavior: "smooth", block: "start" });
    }, 320);
  });

  $("#closeBtn").addEventListener("click", hideVerdict);

  $("#copyBtn").addEventListener("click", async () => {
    if (!state.last) return;
    const { answer, mode, map, question } = state.last;
    const text = answerText(answer, mode, map);
    const conf = confidenceOf(answer, mode);

    const lines = [
      `判词：${text}`,
      `所问：${question}`,
      conf !== null ? `把握：${Math.round(conf * 100)}%` : "",
      "",
      "— 遇事不决问 Jev",
    ].filter(Boolean);

    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      toast("判词已复制。");
    } catch {
      toast("复制失败，浏览器拒绝了剪贴板权限。");
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !verdict.hidden) hideVerdict();
  });

  /* ---------- 测试连接 ---------------------------------------------------- */

  $("#testBtn").addEventListener("click", async () => {
    const key = $("#apiKey").value.trim();
    const endpoint = $("#endpoint").value.trim() || DEFAULT_ENDPOINT;
    const out = $("#testResult");

    if (!key) {
      out.textContent = "先填一个 Key。";
      return;
    }

    out.textContent = "正在敲门…";
    const btn = $("#testBtn");
    btn.disabled = true;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);

    try {
      const { model } = await callJev(
        {
          state: "ping",
          questions: { alive: { type: "noul", instructions: "Is this service reachable?" } },
        },
        { key, endpoint, signal: controller.signal }
      );
      out.textContent = `通了。模型：${model}`;
    } catch (err) {
      out.textContent = describeError(err);
    } finally {
      clearTimeout(timeout);
      btn.disabled = false;
    }
  });

  /* ---------- Toast ------------------------------------------------------- */

  let toastTimer = null;

  function toast(msg) {
    const el = $("#toast");
    el.textContent = msg;
    el.classList.add("is-on");
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("is-on"), 2800);
  }

  /* ---------- 首屏小交互 -------------------------------------------------- */

  $(".hero-foot").addEventListener("click", () => {
    $("#ritual").scrollIntoView({ behavior: "smooth", block: "start" });
  });

  paintKeyState();
})();
