// Shared quiz engine for the Kids Learning Hub.
// Each quiz page calls QuizCore.start(config) where config provides:
//   title, emoji, storageKey, subtitle (optional),
//   difficulties: [{ label, value }],
//   makeQuestion(difficulty) -> { prompt, answer, choices? }
// If a question returns `choices`, it will render as multiple-choice buttons.
// Otherwise it renders a numeric input.

(function (global) {
  const QuizCore = {};

  QuizCore.start = function (cfg) {
    const root = document.getElementById("quiz-root");
    root.innerHTML = renderShell(cfg);

    const $ = id => document.getElementById(id);
    const setup = $("setup"), quiz = $("quiz"), result = $("result");
    const questionEl = $("question"), answerEl = $("answer"), checkBtn = $("checkBtn");
    const feedbackEl = $("feedback"), choicesEl = $("choices");
    const qNum = $("qNum"), scoreVal = $("scoreVal"), streakVal = $("streakVal"), timerVal = $("timerVal");
    const progressFill = $("progressFill"), bestScore = $("bestScore");

    bestScore.innerText = localStorage.getItem(cfg.storageKey) || "—";

    let current = null, questionCount = 0, score = 0, streak = 0, bestStreak = 0;
    let totalQuestions = 20, difficulty = cfg.difficulties[0].value, useTimer = false;
    let timerId = null, timeLeft = 15, locked = false;

    // Sound via Web Audio
    let audioCtx = null;
    function beep(freq, dur = 0.12, type = "sine") {
      try {
        if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const o = audioCtx.createOscillator(), g = audioCtx.createGain();
        o.type = type; o.frequency.value = freq; g.gain.value = 0.15;
        o.connect(g); g.connect(audioCtx.destination);
        o.start();
        g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + dur);
        o.stop(audioCtx.currentTime + dur);
      } catch(e) {}
    }
    const soundCorrect = () => { beep(660, 0.1); setTimeout(() => beep(880, 0.15), 90); };
    const soundWrong = () => beep(220, 0.25, "sawtooth");

    function confetti() {
      const host = $("confetti");
      const colors = ["#ff6b6b","#4ecdc4","#ffa726","#42a5f5","#ab47bc","#66bb6a","#ffeb3b"];
      for (let i = 0; i < 60; i++) {
        const s = document.createElement("span");
        s.style.left = Math.random() * 100 + "vw";
        s.style.background = colors[i % colors.length];
        s.style.animationDuration = (1.5 + Math.random() * 1.8) + "s";
        s.style.transform = `rotate(${Math.random()*360}deg)`;
        host.appendChild(s);
        setTimeout(() => s.remove(), 3500);
      }
    }

    $("startBtn").onclick = () => {
      difficulty = $("difficulty").value;
      totalQuestions = parseInt($("totalQ").value, 10);
      useTimer = $("timerMode").checked;
      questionCount = 0; score = 0; streak = 0; bestStreak = 0;
      setup.classList.add("hidden"); quiz.classList.remove("hidden");
      newQuestion();
    };

    $("playAgain").onclick = () => {
      result.classList.add("hidden"); setup.classList.remove("hidden");
    };

    answerEl.addEventListener("input", () => { checkBtn.disabled = answerEl.value === "" || locked; });
    answerEl.addEventListener("keydown", e => {
      if (e.key === "Enter" && !checkBtn.disabled) submit(answerEl.value);
    });
    checkBtn.addEventListener("click", () => submit(answerEl.value));

    function startTimer() {
      clearInterval(timerId);
      if (!useTimer) { timerVal.innerText = "—"; return; }
      timeLeft = 15; timerVal.innerText = timeLeft + "s";
      timerId = setInterval(() => {
        timeLeft--; timerVal.innerText = timeLeft + "s";
        if (timeLeft <= 0) { clearInterval(timerId); submit(null, true); }
      }, 1000);
    }

    function newQuestion() {
      if (questionCount >= totalQuestions) return showResult();
      current = cfg.makeQuestion(difficulty);
      questionCount++; locked = false;
      questionEl.innerHTML = current.prompt;
      qNum.innerText = questionCount;
      progressFill.style.width = ((questionCount - 1) / totalQuestions * 100) + "%";
      feedbackEl.innerText = ""; feedbackEl.className = "feedback";
      answerEl.value = ""; checkBtn.disabled = true;

      if (current.choices) {
        choicesEl.classList.remove("hidden");
        $("numericRow").classList.add("hidden");
        choicesEl.innerHTML = "";
        current.choices.forEach(c => {
          const b = document.createElement("button");
          b.className = "choice-btn";
          b.innerText = c;
          b.onclick = () => submit(c);
          choicesEl.appendChild(b);
        });
      } else {
        choicesEl.classList.add("hidden");
        $("numericRow").classList.remove("hidden");
        answerEl.focus();
      }
      startTimer();
    }

    function submit(userVal, timedOut = false) {
      if (locked) return;
      locked = true;
      clearInterval(timerId);
      const correct = current.answer;
      const isRight = !timedOut && String(userVal).trim() == String(correct).trim();

      // Disable all choice buttons to prevent re-click
      choicesEl.querySelectorAll("button").forEach(b => b.disabled = true);

      if (isRight) {
        score++; streak++; bestStreak = Math.max(bestStreak, streak);
        const bonus = streak >= 5 ? " 🔥🔥🔥" : streak >= 3 ? " 🔥" : "";
        feedbackEl.innerText = "✅ Correct!" + bonus;
        feedbackEl.className = "feedback correct";
        soundCorrect();
        if (streak > 0 && streak % 5 === 0) confetti();
      } else {
        streak = 0;
        feedbackEl.innerText = timedOut
          ? `⏰ Time's up! Answer was ${correct}`
          : `❌ Not quite! Answer was ${correct}`;
        feedbackEl.className = "feedback incorrect";
        soundWrong();
      }

      scoreVal.innerText = score;
      streakVal.innerText = streak;
      progressFill.style.width = (questionCount / totalQuestions * 100) + "%";

      setTimeout(newQuestion, isRight ? 900 : 1800);
    }

    function showResult() {
      quiz.classList.add("hidden");
      result.classList.remove("hidden");
      const pct = Math.round(score / totalQuestions * 100);
      let trophy = "🎯", msg = "Keep practicing, you're doing great!";
      if (pct === 100) { trophy = "🏆"; msg = "PERFECT SCORE! You're a math champion!"; confetti(); }
      else if (pct >= 90) { trophy = "🥇"; msg = "Amazing work!"; confetti(); }
      else if (pct >= 75) { trophy = "🥈"; msg = "Great job — almost there!"; }
      else if (pct >= 50) { trophy = "🥉"; msg = "Nice effort — a little more practice!"; }
      else { trophy = "💪"; msg = "Don't give up — try again!"; }

      $("trophy").innerText = trophy;
      $("finalScore").innerText = `${score} / ${totalQuestions}  (${pct}%)`;
      $("finalMsg").innerText = `${msg}  •  Best streak: ${bestStreak}`;

      const prev = parseInt(localStorage.getItem(cfg.storageKey) || "0", 10);
      if (score > prev) {
        localStorage.setItem(cfg.storageKey, score);
        bestScore.innerText = score;
      }
    }
  };

  function renderShell(cfg) {
    const diffOpts = cfg.difficulties.map((d, i) =>
      `<option value="${d.value}"${i === 0 ? " selected" : ""}>${d.label}</option>`
    ).join("");

    return `
      <div class="top-bar">
        <a href="index.html" class="brand">🎓 Kids Learning Hub</a>
        <span style="font-size:13px;opacity:0.9">🏆 Best: <span id="bestScore">—</span></span>
      </div>

      <div class="card">
        <h1><a href="index.html" class="title-link">${cfg.emoji} ${cfg.title}</a></h1>
        <p class="subtitle">${cfg.subtitle || "Answer as many as you can. Build your streak!"}</p>

        <div id="setup" class="setup">
          <label>Difficulty</label>
          <select id="difficulty">${diffOpts}</select>

          <label>How many questions?</label>
          <select id="totalQ">
            <option value="10">10 (Quick)</option>
            <option value="20" selected>20 (Regular)</option>
            <option value="30">30 (Long)</option>
          </select>

          <label><input type="checkbox" id="timerMode" /> Timer mode (15s per question)</label>

          <div style="text-align:center; margin-top:22px">
            <button id="startBtn">🚀 Start Quiz</button>
          </div>
        </div>

        <div id="quiz" class="hidden">
          <div class="hud">
            <div class="hud-item"><div class="label">Question</div><div class="val" id="qNum">1</div></div>
            <div class="hud-item"><div class="label">Score</div><div class="val" id="scoreVal">0</div></div>
            <div class="hud-item"><div class="label">Streak 🔥</div><div class="val" id="streakVal">0</div></div>
            <div class="hud-item"><div class="label">Timer ⏱</div><div class="val" id="timerVal">—</div></div>
          </div>
          <div class="progress-bar"><div class="progress-fill" id="progressFill"></div></div>

          <div class="question" id="question">…</div>

          <div class="answer-row" id="numericRow">
            <input type="number" id="answer" inputmode="numeric" autocomplete="off" />
            <button id="checkBtn" disabled>Check</button>
          </div>
          <div class="choices hidden" id="choices"></div>

          <div class="feedback" id="feedback"></div>
        </div>

        <div id="result" class="hidden result">
          <div class="trophy" id="trophy">🏆</div>
          <div class="score-big" id="finalScore">0 / 0</div>
          <div class="message" id="finalMsg"></div>
          <button id="playAgain">🔁 Play Again</button>
          <a href="index.html"><button class="secondary">🏠 Hub</button></a>
        </div>
      </div>

      <div class="confetti" id="confetti"></div>
    `;
  }

  global.QuizCore = QuizCore;
})(window);
