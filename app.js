"use strict";

const $ = (id) => document.getElementById(id);
const catalog = $("catalog");
const workspace = $("workspace");
const results = $("results");
let exam;
let lastExam;
let phase = "catalog";
let deadline;
let interval;
let questionInputs = [];
let examTutorRequests;

function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}

function link(name, file) {
  const node = element("a", name);
  node.href = "data/" + encodeURIComponent(file);
  node.download = file;
  return node;
}

function timeRemaining() {
  return deadline ? Math.max(0, Math.ceil((deadline - Date.now()) / 1000)) : exam.minutes * 60;
}

function updateClock() {
  const seconds = timeRemaining();
  $("clock").textContent = Math.floor(seconds / 60) + ":" + String(seconds % 60).padStart(2, "0");
  if (phase === "running" && seconds === 0) finishExam(true);
}

function stopClock() {
  clearInterval(interval);
  deadline = undefined;
}

function addInput(container, id, caption, initial) {
  const label = element("label", caption);
  label.htmlFor = id;
  const input = element(initial === "text" ? "textarea" : "input");
  input.id = id;
  if (initial === "text") input.rows = 3;
  else input.inputMode = "decimal";
  container.append(label, input);
  return input;
}

function openExam(choice) {
  stopClock();
  examTutorRequests?.abort();
  examTutorRequests = new AbortController();
  exam = choice;
  lastExam = choice;
  phase = "ready";
  catalog.hidden = true;
  workspace.hidden = false;
  results.hidden = true;
  $("feedback").replaceChildren();
  $("start").hidden = false;
  $("submit").hidden = true;
  $("exam-title").textContent = exam.title;
  $("exam-summary").textContent = exam.summary;
  $("exam-status").textContent = "";
  const fileKeys = [...new Set(exam.questions.map((question) => question.dataset))];
  const downloadLinks = fileKeys.map((key) => link(courseFiles[key].name, courseFiles[key].file));
  $("downloads").replaceChildren(link("Download all files (.zip)", exam.id + "-data.zip"), ...downloadLinks);
  $("questions").replaceChildren();
  questionInputs = exam.questions.map((question, questionIndex) => {
    const card = element("section", undefined, "panel question");
    const file = courseFiles[question.dataset];
    card.append(element("h2", question.title), link(file.name, file.file), element("p", question.prompt));
    $("questions").append(card);
    const fields = element("fieldset");
    fields.disabled = true;
    card.append(fields);
    const checks = question.checks.map((check, index) =>
      addInput(fields, "answer-" + questionIndex + "-" + index, check.label, "number"));
    const explanation = question.explanation
      ? addInput(fields, "explanation-" + questionIndex, question.explanation, "text")
      : null;
    return { fields, checks, explanation, activeTutor: null };
  });
  updateClock();
  $("exam-title").focus();
}

function startExam() {
  if (phase !== "ready") return;
  phase = "running";
  deadline = Date.now() + exam.minutes * 60 * 1000;
  $("start").hidden = true;
  $("submit").hidden = false;
  $("exam-status").textContent = "Exam started.";
  questionInputs.forEach((response, index) => {
    response.fields.disabled = false;
    response.activeTutor = buildTutor(exam.questions[index], index, response.checks, examTutorRequests.signal);
    response.fields.after(response.activeTutor.panel);
  });
  updateClock();
  interval = setInterval(updateClock, 250);
  questionInputs[0].checks[0].focus();
}

function readNumber(text) {
  const clean = text.trim().replace(/[ \u00a0\u202f]/g, "");
  if (/^[+-]?\d{1,3}(,\d{3})+(\.\d+)?$/.test(clean)) return Number(clean.replaceAll(",", ""));
  if (/^[+-]?\d{1,3}(\.\d{3})+(,\d+)$/.test(clean)) return Number(clean.replaceAll(".", "").replace(",", "."));
  if (/^[+-]?(\d+([.,]\d+)?|[.,]\d+)$/.test(clean)) return Number(clean.replace(",", "."));
  return NaN;
}

function matches(value, expected, decimals = 0) {
  if (!Number.isFinite(value)) return false;
  return Math.abs(value - expected) < 10 ** (-decimals) * 0.00001;
}

function buildTutor(question, index, inputs, signal) {
  const tutor = element("details", undefined, "tutor");
  const panel = element("div", undefined, "tutor-panel");
  const useCourseHints = location.protocol === "file:" || location.hostname.endsWith(".github.io");
  panel.append(element("p", useCourseHints
    ? "Get a hint for your current checkpoint."
    : "Ask Gemini for one hint or help checking your approach. Your question and the exercise context are sent to Gemini."));
  const status = element("p", "", "tutor-status");
  status.setAttribute("role", "status");
  const answer = element("div", undefined, "tutor-answer");
  answer.hidden = true;
  answer.setAttribute("aria-live", "polite");
  tutor.append(element("summary", useCourseHints ? "Get a course hint" : "Get an AI hint"), panel);

  const context = {
    file: courseFiles[question.dataset].file,
    fields: question.tutorContext,
    exercise: question.prompt,
  };
  function showCourseHint() {
    const checkpoint = question.checks.find((check) => check.label === context.checkpoint);
    const next = question.checks[inputs.findIndex((input) => !input.value.trim())];
    const check = checkpoint || next || question.checks[0];
    answer.replaceChildren(element("strong", "Course hint · " + check.label), element("p", check.hint));
    answer.hidden = false;
  }

  const setCheckpoint = (label) => { if (label) context.checkpoint = label; };
  if (useCourseHints) {
    const show = element("button", "Show course hint", "quiet");
    show.type = "button";
    show.addEventListener("click", showCourseHint);
    panel.append(show, answer);
    return { panel: tutor, setCheckpoint };
  }
  const attempt = addInput(panel, "tutor-attempt-" + index, "Your attempt or question", "text");
  attempt.maxLength = 1500;
  attempt.placeholder = question.dataset === "etl"
    ? "Example: My numbers imported as text. How can I check where that happened?"
    : "Example: My row count increased after the join. How can I check what changed?";
  const ask = element("button", "Ask Gemini", "quiet");
  ask.type = "button";
  ask.disabled = true;
  panel.append(ask, status, answer);
  attempt.addEventListener("input", () => { ask.disabled = !attempt.value.trim(); });
  ask.addEventListener("click", async () => {
    const studentQuestion = attempt.value.trim();
    if (!studentQuestion || ask.disabled) return;
    ask.disabled = true;
    attempt.disabled = true;
    answer.hidden = true;
    status.textContent = "Gemini is preparing a hint…";
    try {
      const response = await fetch("./api/hint", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...context, question: studentQuestion }),
        signal,
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || typeof result.hint !== "string" || !result.hint.trim()) {
        status.textContent = result.error || "Gemini did not return a hint. You can try again.";
        showCourseHint();
        return;
      }
      answer.replaceChildren(element("strong", "Gemini hint"), element("p", result.hint));
      answer.hidden = false;
      status.textContent = "";
    } catch {
      if (!signal.aborted) {
        status.textContent = "This browser could not reach the local hint server. Try opening ExamStudio in Chrome, or use the course hint below.";
        showCourseHint();
      }
    } finally {
      if (!signal.aborted) {
        attempt.disabled = false;
        ask.disabled = !attempt.value.trim();
      }
    }
  });
  return { panel: tutor, setCheckpoint };
}

function buildRecheck(check, index) {
  const panel = element("div", undefined, "recheck");
  const input = addInput(panel, "recheck-" + index, "Revised answer · " + check.label, "number");
  const button = element("button", "Check revised answer", "quiet");
  button.type = "button";
  const status = element("p", "", "recheck-status");
  status.setAttribute("role", "status");
  const recheck = () => {
    const value = readNumber(input.value);
    if (!Number.isFinite(value)) {
      status.textContent = "Enter a numeric answer to check.";
    } else if (matches(value, check.answer, check.decimals)) {
      status.textContent = "Your revised answer matches this checkpoint.";
    } else {
      status.textContent = "Your revised answer still differs. Use the hint and check your calculation again.";
    }
  };
  input.addEventListener("input", () => { status.textContent = ""; });
  input.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    recheck();
  });
  button.addEventListener("click", recheck);
  panel.append(button, status);
  return panel;
}

function finishExam(expired) {
  if (phase !== "running") return;
  phase = "submitted";
  clearInterval(interval);
  $("submit").hidden = true;
  $("exam-status").textContent = expired ? "Time is up. Your answers were submitted." : "Exam submitted.";
  let total = 0;
  let correct = 0;
  const feedback = exam.questions.map((question, index) => {
    const response = questionInputs[index];
    response.fields.disabled = true;
    const card = element("article", undefined, "panel feedback");
    card.append(element("h3", question.title));
    const checks = element("ul");
    const expectedAnswers = element("ul");
    let firstMiss;
    question.checks.forEach((check, i) => {
      const raw = response.checks[i].value.trim();
      const value = readNumber(raw);
      const ok = matches(value, check.answer, check.decimals);
      total += 1;
      if (ok) correct += 1;
      else if (!firstMiss) firstMiss = { check, value };
      const expected = check.answer.toLocaleString("en-US", {
        minimumFractionDigits: check.decimals ?? 0,
        maximumFractionDigits: check.decimals ?? 0,
      });
      const outcome = ok ? "Correct" : raw ? "Your answer: " + raw : "Unanswered";
      checks.append(element("li", check.label + " · " + outcome));
      expectedAnswers.append(element("li", check.label + " · " + expected));
    });
    if (firstMiss) {
      const { check, value } = firstMiss;
      const message = check.known && matches(value, check.known.value, check.decimals)
        ? check.known.message : check.hint;
      const diagnosis = element("div", undefined, "diagnosis");
      diagnosis.append(element("strong", "Check first: " + check.label), element("p", message));
      card.append(diagnosis, buildRecheck(check, index));
    } else {
      card.append(element("p", "All numeric checks match.", "success"));
    }
    response.activeTutor.setCheckpoint(firstMiss?.check.label);
    card.append(checks, response.activeTutor.panel);
    const solution = element("details");
    solution.append(element("summary", "Worked solution and expected answers"), expectedAnswers, element("p", question.solution));
    if (question.code) {
      const pre = element("pre");
      pre.append(element("code", question.code));
      solution.append(pre);
    }
    card.append(solution);
    if (response.explanation) {
      card.append(element("h4", "Self-check your written explanation"),
        element("p", response.explanation.value.trim() || "No explanation submitted.", "answer-text"),
        element("p", question.rubric));
    }
    return card;
  });
  $("feedback").replaceChildren(...feedback);
  $("result-summary").textContent = correct + " of " + total + " numeric checks correct.";
  results.hidden = false;
  $("results-title").focus();
}

function showCatalog() {
  if (phase === "running" && !window.confirm("Leave this exam? Your current answers will be discarded.")) return;
  stopClock();
  examTutorRequests?.abort();
  phase = "catalog";
  workspace.hidden = true;
  catalog.hidden = false;
  const previous = $("exam-list").querySelector('[data-exam="' + lastExam.id + '"]');
  previous.focus();
}

for (const entry of exams) {
  const card = element("article", undefined, "panel exam-card");
  const button = element("button", "Open exam", "quiet");
  button.type = "button";
  button.dataset.exam = entry.id;
  button.setAttribute("aria-label", "Open exam: " + entry.title);
  button.addEventListener("click", () => openExam(entry));
  card.append(element("p", entry.tags + " · " + entry.minutes + " min", "meta"),
    element("h2", entry.title), element("p", entry.summary), button);
  $("exam-list").append(card);
}
$("random").addEventListener("click", () => {
  const choices = exams.filter((entry) => entry !== lastExam);
  openExam(choices[Math.floor(Math.random() * choices.length)]);
});
$("back").addEventListener("click", showCatalog);
$("start").addEventListener("click", startExam);
$("retry").addEventListener("click", () => openExam(exam));
$("exam-form").addEventListener("submit", (event) => {
  event.preventDefault();
  finishExam(timeRemaining() === 0);
});
document.addEventListener("visibilitychange", () => {
  if (phase === "running") updateClock();
});
