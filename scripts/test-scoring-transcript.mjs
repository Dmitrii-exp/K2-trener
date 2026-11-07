import assert from "node:assert/strict";
import test from "node:test";
import { scoringTranscript, VerifiedTextError } from "../supabase/functions/_shared/scoring-transcript.ts";

const supplied = [{speaker:"manager",content:"Untrusted text"}, {speaker:"client",content:"Untrusted response"}];
const recorded = [{speaker:"manager",content:"Actual input"}, {speaker:"client",content:"Actual reply"}];

test("a text score uses recorded turns even if the browser replaces its draft", () => {
  assert.deepEqual(scoringTranscript({id:"text",voice_mode:false,transcript:supplied,verified_text_dialogue:recorded}), recorded);
});
test("an unverified or incomplete text transcript cannot be evaluated", () => {
  for (const verified_text_dialogue of [undefined, [], recorded.slice(1)]) {
    assert.throws(
      () => scoringTranscript({id:"text",voice_mode:false,transcript:supplied,verified_text_dialogue}),
      error => error instanceof VerifiedTextError && error.status === 409
    );
  }
});
