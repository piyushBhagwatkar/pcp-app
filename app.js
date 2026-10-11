"use strict";

/* ------------------------------------------------------------------ solver */

/**
 * Breadth-first brute-force search for a PCP solution.
 * Returns { status, seq, explored, note }
 * status: "FOUND" | "NO SOLUTION" | "INCONCLUSIVE"
 */
function solvePCP(A, B, maxDepth, maxStates = 200000) {
  const n = A.length;

  // Quick proof of "no solution": one side is strictly longer for every tile.
  const allTopLonger = A.every((a, i) => a.length > B[i].length);
  const allBottomLonger = A.every((a, i) => a.length < B[i].length);
  if (allTopLonger || allBottomLonger) {
    return {
      status: "NO SOLUTION", seq: null, explored: 0,
      note: "Length argument: one side is strictly longer for every tile."
    };
  }

  const queue = [{ seq: [], top: "", bot: "" }];
  let head = 0;                 // queue pointer (avoids slow Array.shift)
  const seen = new Set();       // overhangs already explored
  let hitLimit = false;
  let explored = 0;

  while (head < queue.length) {
    const { seq, top, bot } = queue[head++];
    explored++;

    if (seq.length >= maxDepth) { hitLimit = true; continue; }

    for (let i = 0; i < n; i++) {
      const t = top + A[i];
      const b = bot + B[i];

      if (t === b) {
        return { status: "FOUND", seq: [...seq, i + 1], explored, note: "Shortest solution (BFS)." };
      }
      // Prune: one string must be a prefix of the other
      if (!(t.startsWith(b) || b.startsWith(t))) continue;

      const key = t.length >= b.length ? "T|" + t.slice(b.length) : "B|" + b.slice(t.length);
      if (seen.has(key)) continue;
      seen.add(key);
      queue.push({ seq: [...seq, i + 1], top: t, bot: b });
    }

    if (seen.size > maxStates) {
      return {
        status: "INCONCLUSIVE", seq: null, explored,
        note: "Stopped after " + maxStates.toLocaleString() + " states."
      };
    }
  }

  if (hitLimit) {
    return {
      status: "INCONCLUSIVE", seq: null, explored,
      note: "No solution within depth " + maxDepth + "; a longer one may exist."
    };
  }
  return {
    status: "NO SOLUTION", seq: null, explored,
    note: "Search space exhausted: every branch was pruned."
  };
}

/* -------------------------------------------------------------- validation */

function parseList(text) {
  return text.trim() === "" ? [] : text.split(",").map(s => s.trim());
}

function validate(A, B) {
  const errors = [];
  if (A.length === 0 || B.length === 0) {
    errors.push("Both lists A and B must be non-empty.");
    return errors;
  }
  if (A.length !== B.length) {
    errors.push("Lists must have equal length (A has " + A.length + " tiles, B has " + B.length + ").");
  }
  [["A", A], ["B", B]].forEach(([name, list]) => {
    list.forEach((s, idx) => {
      if (s === "") {
        errors.push(name + "[" + (idx + 1) + "] is an empty string (not allowed).");
      } else if (!/^[A-Za-z0-9]+$/.test(s)) {
        errors.push(name + "[" + (idx + 1) + "] = '" + s + "' contains invalid characters (use letters/digits only).");
      }
    });
  });
  return errors;
}

/* ----------------------------------------------------------------- presets */

const PRESETS = {
  "Custom": ["", "", 10],
  "1. Valid: solution 3,2,3,1": ["a, ab, bba", "baa, aa, bb", 10],
  "2. Valid: trivial solution": ["a, ab", "a, ab", 10],
  "3. Valid: classic, solution 2,1,1,3": ["1, 10111, 10", "111, 10, 0", 10],
  "4. No solution (length argument)": ["a", "aa", 10],
  "5. No solution (pruning exhausts)": ["ab", "ba", 10],
  "6. Inconclusive (depth too low)": ["1, 10111, 10", "111, 10, 0", 3],
  "7. Invalid: unequal lengths": ["a, b", "a", 10],
  "8. Invalid: empty input": ["", "", 10],
  "9. Invalid: empty tile / bad chars": ["a,, b#", "a, b, c", 10]
};

/* ---------------------------------------------------------------------- UI */

const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const presetEl = $("preset"), listA = $("listA"), listB = $("listB");
const depthEl = $("depth"), depthVal = $("depthVal");
const output = $("output"), logCard = $("logCard"), logBody = $("logBody");

let history = [];
try { history = JSON.parse(localStorage.getItem("pcp-history") || "[]"); } catch (e) { history = []; }

Object.keys(PRESETS).forEach(name => {
  const opt = document.createElement("option");
  opt.value = name; opt.textContent = name;
  presetEl.appendChild(opt);
});

presetEl.addEventListener("change", () => {
  const [a, b, d] = PRESETS[presetEl.value];
  listA.value = a; listB.value = b;
  depthEl.value = d; depthVal.textContent = d;
});
depthEl.addEventListener("input", () => { depthVal.textContent = depthEl.value; });

function tableHTML(headers, rows) {
  return '<div class="table-wrap"><table><thead><tr>' +
    headers.map(h => "<th>" + esc(h) + "</th>").join("") + "</tr></thead><tbody>" +
    rows.map(r => "<tr>" + r.map(c => "<td>" + esc(c) + "</td>").join("") + "</tr>").join("") +
    "</tbody></table></div>";
}

function renderLog() {
  logCard.hidden = history.length === 0;
  logBody.innerHTML = history.map(h =>
    "<tr><td>" + esc(h.A) + "</td><td>" + esc(h.B) + "</td><td>" + esc(h.depth) +
    "</td><td>" + esc(h.result) + "</td><td>" + esc(h.seq) + "</td></tr>").join("");
}

function solveClicked() {
  const rawA = listA.value, rawB = listB.value;
  const A = parseList(rawA), B = parseList(rawB);
  const depth = parseInt(depthEl.value, 10);
  const errors = validate(A, B);

  let status, seqText = "-", html = "";

  if (errors.length) {
    status = "INVALID INPUT";
    html = '<div class="card"><div class="banner invalid">Invalid input</div><ul>' +
      errors.map(e => "<li>" + esc(e) + "</li>").join("") + "</ul></div>";
  } else {
    const r = solvePCP(A, B, depth);
    status = r.status;
    seqText = r.seq ? r.seq.join(",") : "-";

    html = '<div class="card"><h2>Tiles</h2>' +
      tableHTML(["Tile", "Top (A)", "Bottom (B)"], A.map((a, i) => [i + 1, a, B[i]]));

    if (r.status === "FOUND") {
      html += '<div class="banner found">Solution found: indices ' + esc(seqText) + "</div>";
      let top = "", bot = "";
      const rows = r.seq.map(i => {
        top += A[i - 1]; bot += B[i - 1];
        return [i, A[i - 1] + " / " + B[i - 1], top, bot];
      });
      html += "<h2>Step-by-step construction</h2>" +
        tableHTML(["Tile", "Adds (top / bottom)", "Top so far", "Bottom so far"], rows) +
        '<p>Top = Bottom = <code>' + esc(top) + "</code></p>";
    } else if (r.status === "NO SOLUTION") {
      html += '<div class="banner none">No solution exists (proven).</div>';
    } else {
      html += '<div class="banner inconclusive">Inconclusive: no solution found within the limit. ' +
        "PCP is undecidable, so a longer one may exist.</div>";
    }
    html += '<p class="note">' + esc(r.note) + " States explored: " + r.explored.toLocaleString() + "</p></div>";
  }

  output.innerHTML = html;
  output.scrollIntoView({ behavior: "smooth", block: "start" });

  history.push({ A: rawA, B: rawB, depth: depth, result: status, seq: seqText });
  try { localStorage.setItem("pcp-history", JSON.stringify(history)); } catch (e) { /* ignore */ }
  renderLog();
}

$("solveBtn").addEventListener("click", solveClicked);
$("clearLog").addEventListener("click", () => {
  history = [];
  try { localStorage.removeItem("pcp-history"); } catch (e) { /* ignore */ }
  renderLog();
});
renderLog();

/* ------------------------------------------------------ PWA: install + SW */

let deferredPrompt = null;
window.addEventListener("beforeinstallprompt", e => {
  e.preventDefault();
  deferredPrompt = e;
  $("installBtn").hidden = false;
});
$("installBtn").addEventListener("click", async () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  deferredPrompt = null;
  $("installBtn").hidden = true;
});
window.addEventListener("appinstalled", () => { $("installBtn").hidden = true; });

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(err => console.warn("SW registration failed:", err));
  });
}
