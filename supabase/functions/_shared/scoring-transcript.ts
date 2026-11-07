type Session = {
  id: string;
  voice_mode: boolean | null;
  transcript?: unknown;
  verified_text_dialogue?: unknown;
  verified_text_version?: number;
};
export class VerifiedTextError extends Error {
  readonly status: number;
  constructor(message: string, status: number) { super(message); this.status = status; }
}

export function scoringTranscript(session: Session): unknown[] {
  // Realtime voice still requires a server-side observation channel.
  if (session.voice_mode === true) return Array.isArray(session.transcript) ? session.transcript : [];
  const turns = Array.isArray(session.verified_text_dialogue) ? session.verified_text_dialogue : [];
  if (!turns.some(turn => turn.speaker === "manager") || !turns.some(turn => turn.speaker === "client")) {
    throw new VerifiedTextError("Нет подтверждённых реплик для оценки.", 409);
  }
  return turns;
}

