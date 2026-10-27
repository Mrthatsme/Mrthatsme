// Voice-note recorder (/v/<token>). Records with the phone's microphone, or
// takes an existing recording, and uploads it for transcription.
(function () {
  var box = document.getElementById("voice");
  if (!box) return;
  var token = box.getAttribute("data-token");
  var btn = document.getElementById("v-rec");
  var file = document.getElementById("v-file");
  var status = document.getElementById("v-status");
  var recorder = null, chunks = [], stream = null, timer = null, secs = 0;
  var MAX_SECS = 600;

  function say(text, err) { status.className = "status" + (err ? " err" : ""); status.textContent = text; }

  function upload(blob) {
    if (!blob || blob.size < 2000) { say("That recording is too short. Try again.", true); return; }
    say("Sending…");
    btn.disabled = true; file.disabled = true;
    fetch("/api/voice/" + encodeURIComponent(token), {
      method: "POST", headers: { "Content-Type": blob.type || "application/octet-stream" }, body: blob
    }).then(function (r) { return r.json().then(function (b) { return { ok: r.ok, b: b }; }); })
      .then(function (res) {
        if (res.ok) say("Got it. Your written notes will be in your email in a minute or two.");
        else say(res.b && res.b.error === "too_long" ? "That recording is too long. Keep it under 10 minutes." : "Couldn't send it. Please try again.", true);
      })
      .catch(function () { say("Couldn't send. Check your signal and try again.", true); })
      .then(function () { btn.disabled = false; file.disabled = false; btn.textContent = "Tap to record"; });
  }

  function stop() {
    clearInterval(timer);
    if (recorder && recorder.state !== "inactive") recorder.stop();
    btn.classList.remove("on");
  }

  btn.addEventListener("click", function () {
    if (recorder && recorder.state === "recording") { stop(); return; }
    if (!navigator.mediaDevices || !window.MediaRecorder) { say("This phone can't record here. Use the button below to send a recording instead.", true); return; }
    navigator.mediaDevices.getUserMedia({ audio: true }).then(function (s) {
      stream = s; chunks = []; secs = 0;
      recorder = new MediaRecorder(s);
      recorder.ondataavailable = function (e) { if (e.data && e.data.size) chunks.push(e.data); };
      recorder.onstop = function () {
        stream.getTracks().forEach(function (t) { t.stop(); });
        upload(new Blob(chunks, { type: recorder.mimeType || "audio/webm" }));
      };
      recorder.start();
      btn.classList.add("on");
      btn.textContent = "Recording… tap to stop";
      say("");
      timer = setInterval(function () {
        secs++;
        btn.textContent = "Recording " + Math.floor(secs / 60) + ":" + ("0" + (secs % 60)).slice(-2) + " · tap to stop";
        if (secs >= MAX_SECS) stop();
      }, 1000);
    }).catch(function () { say("Microphone access was blocked. Allow it in your browser settings, or send a recording below.", true); });
  });

  file.addEventListener("change", function () { if (file.files && file.files[0]) upload(file.files[0]); });
})();
