const mentorId=(v:unknown)=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
export async function claimMentorTurn(admin:any,userId:string,body:any,message:string){
 if(!mentorId(body?.dialogue_id)||!mentorId(body?.request_id))return {error:'Некорректный диалог. Откройте его из истории.',status:400};
 const {data,error}=await admin.rpc('claim_mentor_turn_with_files',{p_user_id:userId,p_dialogue_id:body.dialogue_id,p_request_id:body.request_id,p_message:message,p_attachments:body.attachments||[]});
 if(error)return {error:'Не удалось сохранить сообщение. Повторите попытку.',status:503};
 if(data?.state==='cached')return {reply:data.reply,cached:true};
 if(data?.state==='busy')return {error:'Ответ ещё формируется. Повторите проверку позже.',status:409};
 if(data?.state==='forbidden')return {error:'Диалог недоступен.',status:404};
 if(data?.state==='full')return {error:'В этом диалоге достигнут предел сообщений. Начните новый чат; история сохранена.',status:409};
 if(data?.state!=='claimed')return {error:'Не удалось продолжить этот запрос. Откройте диалог заново.',status:409};
 return {messages:data.messages.map((m:any)=>({role:m.role==='assistant'?'assistant':'user',content:String(m.content||''),attachments:m.attachments||[]}))};
}
