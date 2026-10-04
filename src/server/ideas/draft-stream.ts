import { DRAFT_FAILED_MARKER } from "./application-rules";

/**
 * Passes the model's text through, holding back a short tail: if the stream
 * ends with one of `failureLines` (aiStream's AI_STREAM_LINES), that line is
 * replaced by DRAFT_FAILED_MARKER, which the page understands. Nothing else is
 * changed, so a draft the assistant broke off is never mistaken for a finished one.
 */
export function markFailure(source: ReadableStream<Uint8Array>, failureLines: readonly string[]): ReadableStream<Uint8Array> {
  const holdBack = Math.max(0, ...failureLines.map((l) => l.length)) + 4;
  const dec = new TextDecoder();
  const enc = new TextEncoder();
  let tail = "";
  return source.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        tail += dec.decode(chunk, { stream: true });
        if (tail.length > holdBack) {
          controller.enqueue(enc.encode(tail.slice(0, tail.length - holdBack)));
          tail = tail.slice(tail.length - holdBack);
        }
      },
      flush(controller) {
        tail += dec.decode();
        const trimmed = tail.trimEnd();
        const failed = failureLines.find((l) => trimmed.endsWith(l));
        if (failed) tail = `${trimmed.slice(0, trimmed.length - failed.length).trimEnd()}\n\n${DRAFT_FAILED_MARKER}`;
        controller.enqueue(enc.encode(tail));
      },
    }),
  );
}
