import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { performance } from "node:perf_hooks";

const ROOT = process.cwd();
const PREVIEW_PORT = Number(process.env.RECORD_PREVIEW_PORT ?? 4174);
const CHROME_PORT = Number(process.env.RECORD_CHROME_PORT ?? 9338);
const GAP_SECONDS = Number(process.env.RECORD_GAP_SECONDS ?? 0.2);
const WIDTH = 1920;
const HEIGHT = 1080;
const OUT_DIR = path.join(ROOT, "tmp-recording");
const FRAMES_DIR = path.join(OUT_DIR, "frames");
const QC_DIR = path.join(OUT_DIR, "qc");
const SEGMENTS_FILE = path.join(ROOT, "audio-segments.json");
const SILENCE_FILE = path.join(OUT_DIR, "silence-0.2.mp3");
const AUDIO_CONCAT = path.join(OUT_DIR, "audio-concat.txt");
const NARRATION = path.join(OUT_DIR, "narration-with-gaps.m4a");
const FRAME_CONCAT = path.join(OUT_DIR, "frames-realtime.ffconcat");
const VISUAL = path.join(OUT_DIR, "tracing-auto-visual.mp4");

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function run(command, args, options = {}) {
  const res = spawnSync(command, args, {
    cwd: ROOT,
    encoding: "utf8",
    stdio: options.stdio ?? "pipe",
  });
  if (res.status !== 0) {
    throw new Error(
      `${command} ${args.join(" ")} failed\n${res.stdout ?? ""}\n${res.stderr ?? ""}`,
    );
  }
  return res.stdout ?? "";
}

function ffprobeDuration(file) {
  const out = run("ffprobe", [
    "-v",
    "error",
    "-show_entries",
    "format=duration",
    "-of",
    "default=nk=1:nw=1",
    file,
  ]);
  const value = Number(out.trim());
  if (!Number.isFinite(value)) throw new Error(`Invalid duration for ${file}`);
  return value;
}

async function waitJson(url, tries = 100) {
  let last = "";
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url);
      if (res.ok) return await res.json();
      last = `${res.status} ${res.statusText}`;
    } catch (err) {
      last = err.message;
    }
    await sleep(100);
  }
  throw new Error(`Timed out waiting for ${url}: ${last}`);
}

async function waitHttp(url, tries = 100) {
  let last = "";
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
      last = `${res.status} ${res.statusText}`;
    } catch (err) {
      last = err.message;
    }
    await sleep(100);
  }
  throw new Error(`Timed out waiting for ${url}: ${last}`);
}

function startProcess(command, args, name) {
  const proc = spawn(command, args, {
    cwd: ROOT,
    stdio: ["ignore", "pipe", "pipe"],
  });
  proc.stdout.on("data", (buf) => process.stdout.write(`[${name}] ${buf}`));
  proc.stderr.on("data", (buf) => process.stderr.write(`[${name}] ${buf}`));
  return proc;
}

async function connectToChrome() {
  await waitJson(`http://127.0.0.1:${CHROME_PORT}/json/version`);
  const tabs = await waitJson(`http://127.0.0.1:${CHROME_PORT}/json`);
  const tab = tabs.find((item) => item.type === "page");
  if (!tab) throw new Error("No Chrome page target found");

  const ws = new WebSocket(tab.webSocketDebuggerUrl);
  const pending = new Map();
  const eventHandlers = new Map();
  let id = 0;

  ws.addEventListener("message", (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && pending.has(msg.id)) {
      pending.get(msg.id)(msg);
      pending.delete(msg.id);
      return;
    }
    const handlers = eventHandlers.get(msg.method);
    if (handlers) {
      for (const handler of handlers) handler(msg.params);
    }
  });

  await new Promise((resolve, reject) => {
    ws.addEventListener("open", resolve, { once: true });
    ws.addEventListener("error", reject, { once: true });
  });

  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const msgId = ++id;
      const timer = setTimeout(() => {
        pending.delete(msgId);
        reject(new Error(`CDP timeout: ${method}`));
      }, 30_000);
      pending.set(msgId, (msg) => {
        clearTimeout(timer);
        if (msg.error) reject(new Error(`${method}: ${JSON.stringify(msg.error)}`));
        else resolve(msg);
      });
      ws.send(JSON.stringify({ id: msgId, method, params }));
    });

  const on = (method, handler) => {
    if (!eventHandlers.has(method)) eventHandlers.set(method, new Set());
    eventHandlers.get(method).add(handler);
  };

  return { ws, send, on };
}

async function waitForPage(send) {
  const expression = `
    new Promise((resolve) => {
      const deadline = Date.now() + 10000;
      const tick = () => {
        const text = document.querySelector('.scene')?.innerText ?? '';
        if (text.includes('第 1 章') && text.includes('请求级')) {
          resolve({ ok: true, text: text.slice(0, 300) });
          return;
        }
        if (Date.now() > deadline) {
          resolve({ ok: false, text: document.body.innerText.slice(0, 300) });
          return;
        }
        setTimeout(tick, 100);
      };
      tick();
    })
  `;
  const result = await send("Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  const value = result.result.result.value;
  if (!value.ok) throw new Error(`First slide did not render: ${value.text}`);
  return value.text;
}

async function evalValue(send, expression) {
  const result = await send("Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  return result.result.result?.value;
}

function ensureCleanDirs() {
  mkdirSync(OUT_DIR, { recursive: true });
  rmSync(FRAMES_DIR, { recursive: true, force: true });
  rmSync(QC_DIR, { recursive: true, force: true });
  mkdirSync(FRAMES_DIR, { recursive: true });
  mkdirSync(QC_DIR, { recursive: true });
}

function prepareAudio(segments) {
  run("ffmpeg", [
    "-y",
    "-f",
    "lavfi",
    "-i",
    "anullsrc=r=44100:cl=mono",
    "-t",
    String(GAP_SECONDS),
    "-q:a",
    "9",
    "-acodec",
    "libmp3lame",
    SILENCE_FILE,
  ]);

  const lines = [];
  for (const segment of segments) {
    lines.push(`file '${segment.audioPath.replaceAll("'", "'\\''")}'`);
    lines.push(`file '${SILENCE_FILE.replaceAll("'", "'\\''")}'`);
  }
  writeFileSync(AUDIO_CONCAT, `${lines.join("\n")}\n`);
  run("ffmpeg", [
    "-y",
    "-f",
    "concat",
    "-safe",
    "0",
    "-i",
    AUDIO_CONCAT,
    "-ar",
    "44100",
    "-ac",
    "2",
    "-c:a",
    "aac",
    "-b:a",
    "192k",
    NARRATION,
  ]);
  return ffprobeDuration(NARRATION);
}

function writeFrameConcat(frames, totalSeconds) {
  if (frames.length === 0) throw new Error("No screencast frames captured");
  const lines = ["ffconcat version 1.0"];
  for (let i = 0; i < frames.length; i++) {
    const nextStart =
      i === frames.length - 1 ? totalSeconds : Math.max(frames[i + 1].t, 0);
    const currentStart = i === 0 ? 0 : Math.max(frames[i].t, 0);
    const duration = Math.max(1 / 120, nextStart - currentStart);
    lines.push(`file '${frames[i].file.replaceAll("'", "'\\''")}'`);
    lines.push(`duration ${duration.toFixed(6)}`);
  }
  lines.push(`file '${frames.at(-1).file.replaceAll("'", "'\\''")}'`);
  writeFileSync(FRAME_CONCAT, `${lines.join("\n")}\n`);
}

async function main() {
  ensureCleanDirs();
  const rawSegments = JSON.parse(await readFile(SEGMENTS_FILE, "utf8"));
  const segments = rawSegments.map((segment) => {
    const audioPath = path.join(ROOT, "public", "audio", segment.audio);
    if (!existsSync(audioPath)) throw new Error(`Missing audio: ${audioPath}`);
    return {
      ...segment,
      audioPath,
      duration: ffprobeDuration(audioPath),
    };
  });
  const scheduledSeconds = segments.reduce(
    (sum, segment) => sum + segment.duration + GAP_SECONDS,
    0,
  );
  const narrationSeconds = prepareAudio(segments);
  console.log(
    `[record] ${segments.length} segments, scheduled=${scheduledSeconds.toFixed(
      3,
    )}s, narration=${narrationSeconds.toFixed(3)}s`,
  );

  const preview = startProcess(
    "npx",
    ["vite", "preview", "--host", "127.0.0.1", "--port", String(PREVIEW_PORT), "--strictPort"],
    "preview",
  );
  const chrome = startProcess(
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    [
      "--headless=new",
      "--disable-extensions",
      `--remote-debugging-port=${CHROME_PORT}`,
      `--user-data-dir=/tmp/tracing-video-record-${Date.now()}`,
      `--window-size=${WIDTH},${HEIGHT}`,
      "--force-device-scale-factor=1",
      "--autoplay-policy=no-user-gesture-required",
      "about:blank",
    ],
    "chrome",
  );

  const cleanup = () => {
    preview.kill("SIGTERM");
    chrome.kill("SIGTERM");
  };
  process.on("SIGINT", () => {
    cleanup();
    process.exit(130);
  });

  try {
    await waitHttp(`http://127.0.0.1:${PREVIEW_PORT}/`);
    const cdp = await connectToChrome();
    const { send, on, ws } = cdp;

    await send("Page.enable");
    await send("Runtime.enable");
    await send("Emulation.setDeviceMetricsOverride", {
      width: WIDTH,
      height: HEIGHT,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await send("Page.navigate", { url: `http://127.0.0.1:${PREVIEW_PORT}/` });
    await sleep(1000);
    await evalValue(
      send,
      `localStorage.setItem('presentation-cursor-v7', JSON.stringify({chapter:0, step:0}))`,
    );
    await send("Page.reload", { ignoreCache: true });
    const firstText = await waitForPage(send);
    console.log(`[record] first slide ready: ${firstText.replace(/\s+/g, " ").slice(0, 140)}`);

    let recordingStart = 0;
    let frameIndex = 0;
    const frames = [];
    on("Page.screencastFrame", (params) => {
      const file = path.join(
        FRAMES_DIR,
        `frame-${String(++frameIndex).padStart(6, "0")}.jpg`,
      );
      writeFileSync(file, Buffer.from(params.data, "base64"));
      const t = Math.max(0, (performance.now() - recordingStart) / 1000);
      frames.push({ file, t });
      send("Page.screencastFrameAck", { sessionId: params.sessionId }).catch(
        () => {},
      );
    });

    await send("Page.startScreencast", {
      format: "jpeg",
      quality: 88,
      maxWidth: WIDTH,
      maxHeight: HEIGHT,
      everyNthFrame: 1,
    });
    recordingStart = performance.now();
    let nextProgress = 30;
    let cumulative = 0;

    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      cumulative += segment.duration + GAP_SECONDS;
      console.log(
        `[record] ${String(i + 1).padStart(2, "0")}/${segments.length} ${segment.audio} hold=${(
          segment.duration + GAP_SECONDS
        ).toFixed(3)}s`,
      );
      while ((performance.now() - recordingStart) / 1000 < cumulative) {
        const elapsed = (performance.now() - recordingStart) / 1000;
        if (elapsed >= nextProgress) {
          console.log(
            `[record] progress ${elapsed.toFixed(1)}s / ${scheduledSeconds.toFixed(
              1,
            )}s, frames=${frames.length}`,
          );
          nextProgress += 30;
        }
        await sleep(50);
      }
      if (i < segments.length - 1) {
        await send("Input.dispatchKeyEvent", {
          type: "keyDown",
          key: "ArrowRight",
          code: "ArrowRight",
          windowsVirtualKeyCode: 39,
          nativeVirtualKeyCode: 39,
        });
        await send("Input.dispatchKeyEvent", {
          type: "keyUp",
          key: "ArrowRight",
          code: "ArrowRight",
          windowsVirtualKeyCode: 39,
          nativeVirtualKeyCode: 39,
        });
      }
    }

    await sleep(300);
    await send("Page.stopScreencast");
    ws.close();

    const actualSeconds = (performance.now() - recordingStart) / 1000;
    const totalSeconds = Math.max(scheduledSeconds, narrationSeconds);
    console.log(
      `[record] captured ${frames.length} frames, actual=${actualSeconds.toFixed(
        3,
      )}s, target=${totalSeconds.toFixed(3)}s`,
    );

    writeFrameConcat(frames, totalSeconds);
    run(
      "ffmpeg",
      [
        "-y",
        "-f",
        "concat",
        "-safe",
        "0",
        "-i",
        FRAME_CONCAT,
        "-r",
        "30",
        "-pix_fmt",
        "yuv420p",
        "-c:v",
        "libx264",
        "-preset",
        "medium",
        "-crf",
        "20",
        VISUAL,
      ],
      { stdio: "inherit" },
    );

    const stamp = new Date()
      .toISOString()
      .replace(/[-:]/g, "")
      .replace(/\..+/, "")
      .replace("T", "-");
    const output = path.join(ROOT, "recordings", `tracing-auto-${stamp}.mp4`);
    mkdirSync(path.dirname(output), { recursive: true });
    run(
      "ffmpeg",
      [
        "-y",
        "-i",
        VISUAL,
        "-i",
        NARRATION,
        "-c:v",
        "copy",
        "-c:a",
        "copy",
        "-shortest",
        output,
      ],
      { stdio: "inherit" },
    );

    for (const [name, second] of [
      ["shot-0000.png", 0],
      ["shot-0001.png", 1],
      ["shot-0010.png", 10],
      ["shot-0016.png", 16],
      ["shot-0037.png", 37],
    ]) {
      run("ffmpeg", [
        "-y",
        "-ss",
        String(second),
        "-i",
        output,
        "-frames:v",
        "1",
        path.join(QC_DIR, name),
      ]);
    }

    writeFileSync(path.join(OUT_DIR, "latest-output.txt"), `${output}\n`);
    console.log(`[record] output ${output}`);
  } finally {
    cleanup();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
