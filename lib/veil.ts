// The veil: a heavily blurred copy of the camera, produced on the sender's own
// device. While veiled, this is the only video track handed to WebRTC, so the
// sharp image never leaves the browser — a stranger can't "unblur" it, even
// with a modified client, because the detail simply isn't in the stream.
//
// The blur is done by shrinking each frame to a tiny thumbnail and stretching
// it back up. That destroys detail irreversibly (unlike a CSS blur on the
// receiver) and works in every browser; ctx.filter softens the result further
// where supported.

const OUT_WIDTH = 480;
const THUMB_WIDTH = 24;
const FPS = 15;

export interface Veil {
  track: MediaStreamTrack;
  stop: () => void;
}

export function createVeil(source: MediaStreamTrack): Veil {
  const settings = source.getSettings();
  const aspect =
    settings.width && settings.height ? settings.height / settings.width : 3 / 4;
  const outH = Math.round(OUT_WIDTH * aspect);
  const thumbH = Math.max(1, Math.round(THUMB_WIDTH * aspect));

  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.srcObject = new MediaStream([source]);
  void video.play().catch(() => {});

  const thumb = document.createElement("canvas");
  thumb.width = THUMB_WIDTH;
  thumb.height = thumbH;
  const tctx = thumb.getContext("2d")!;

  const out = document.createElement("canvas");
  out.width = OUT_WIDTH;
  out.height = outH;
  const octx = out.getContext("2d")!;
  octx.imageSmoothingEnabled = true;
  octx.imageSmoothingQuality = "high";
  if ("filter" in octx) octx.filter = "blur(10px) saturate(1.2)";

  const draw = () => {
    // Fill first so the blur's soft edges fade into colour, not transparency.
    octx.fillStyle = "#10121c";
    octx.fillRect(0, 0, OUT_WIDTH, outH);
    if (video.readyState >= 2) {
      tctx.drawImage(video, 0, 0, THUMB_WIDTH, thumbH);
      // Overdraw past the edges so the blur doesn't darken the borders.
      octx.drawImage(thumb, -20, -20, OUT_WIDTH + 40, outH + 40);
    }
  };
  draw();
  // A timer rather than requestAnimationFrame: rAF stops entirely in a
  // background tab, which would freeze the outgoing video.
  const timer = setInterval(draw, 1000 / FPS);

  const track = out.captureStream(FPS).getVideoTracks()[0];

  return {
    track,
    stop: () => {
      clearInterval(timer);
      track.stop();
      video.srcObject = null;
    },
  };
}
