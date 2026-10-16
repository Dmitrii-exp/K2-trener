import { withAiAccess } from "../_shared/ai-access.ts";
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json; charset=utf-8"}});
Deno.serve(withAiAccess("speechkit-test", async(req)=>{
 if(req.method==='OPTIONS') return new Response('ok',{status:200,headers:cors});
 if(req.method!=='POST') return json({ok:false,error:'POST required'},405);
 try{
  if(!req.headers.get('Authorization')?.startsWith('Bearer ')) return json({ok:false,error:'Authorization required'},401);
  const apiKey=Deno.env.get('YANDEX_API_KEY')?.trim();
  if(!apiKey) return json({ok:false,error:'YANDEX_API_KEY is missing'},500);
  const payload={text:'Привет! Это тест Yandex SpeechKit.',hints:[{voice:'marina'},{role:'friendly'}],outputAudioSpec:{containerAudio:{containerAudioType:'WAV'}},loudnessNormalizationType:'LUFS'};
  const endpoints=['https://tts.api.ml.yandexcloud.kz/tts/v3/utteranceSynthesis','https://tts.api.cloud.yandex.net/tts/v3/utteranceSynthesis'];
  const results=[];
  for(const endpoint of endpoints){
   const started=Date.now();
   try{
    const r=await fetch(endpoint,{method:'POST',headers:{Authorization:`Api-Key ${apiKey}`,"Content-Type":"application/json"},body:JSON.stringify(payload)});
    const raw=await r.text(); let data:any=null; try{data=raw?JSON.parse(raw):null}catch{}
    const chunks:string[]=[]; const add=(v:any)=>{if(v&&typeof v.data==='string')chunks.push(v.data)}; add(data?.audioChunk); add(data?.result?.audioChunk);
    results.push({endpoint,status:r.status,ok:r.ok,elapsed_ms:Date.now()-started,audio_chunk_count:chunks.length,audio_base64_length:chunks.join('').length,error:r.ok?null:(data?.error?.message||data?.message||raw.slice(0,800))});
   }catch(e){results.push({endpoint,status:0,ok:false,elapsed_ms:Date.now()-started,error:e instanceof Error?e.message:String(e)})}
  }
  return json({ok:results.some(x=>x.ok),secret_present:true,results});
 }catch(e){return json({ok:false,error:e instanceof Error?e.message:String(e)},500)}
}));
