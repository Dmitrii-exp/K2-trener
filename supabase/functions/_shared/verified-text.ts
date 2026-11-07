import { createClient } from "jsr:@supabase/supabase-js@2";
import { VerifiedTextError } from "./scoring-transcript.ts";

type Turn = { speaker: "manager" | "client"; content: string };
function serverClient() {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
}

export async function openVerifiedText(sessionId: string, employeeId: string) {
  const db = serverClient();
  const {data: session, error} = await db.from("saletrening_sessions")
    .select("id,voice_mode,verified_text_dialogue,verified_text_version")
    .eq("id", sessionId).eq("employee_id", employeeId).in("status", ["started", "in_progress"]).maybeSingle();
  if (error) throw new VerifiedTextError("Не удалось загрузить историю тренировки.", 503);
  if (!session) throw new VerifiedTextError("Тренировка недоступна.", 403);
  if (session.voice_mode === true) return null;
  const history: Turn[] = session.verified_text_dialogue;
  return {
    history,
    async append(message: string, reply: string) {
      const next: Turn[] = [...history];
      if (message) next.push({speaker: "manager", content: message});
      next.push({speaker: "client", content: reply});
      const {data, error} = await db.from("saletrening_sessions")
        .update({verified_text_dialogue: next, verified_text_version: session.verified_text_version + 1})
        .eq("id", sessionId).eq("employee_id", employeeId).eq("verified_text_version", session.verified_text_version)
        .in("status", ["started", "in_progress"]).select("id").maybeSingle();
      if (error) throw new VerifiedTextError("Не удалось сохранить подтверждённые реплики.", 503);
      if (!data) throw new VerifiedTextError("История тренировки изменилась. Повторите запрос.", 409);
    }
  };
}
