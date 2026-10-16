import { withAiAccess } from "../_shared/ai-access.ts";
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json; charset=utf-8"}});
const clean=(v:unknown,max=5000)=>String(v??"").trim().slice(0,max);

const supportedRoles:Record<string,string[]>={
  filipp:[], anton:["neutral","good"], alexander:["neutral","good"], ermil:["neutral","good"], zahar:["neutral","good"], kirill:["neutral","strict","good"]
};

Deno.serve(withAiAccess("yandex-tts", async(req)=>{
  if(req.method==='OPTIONS') return new Response('ok',{status:200,headers:cors});
  if(req.method!=='POST') return json({ok:false,error:'Method not allowed'},405);
  try{
    if(!req.headers.get('Authorization')?.startsWith('Bearer ')) return json({ok:false,error:'Authorization required'},401);
    const body=await req.json();
    const text=clean(body?.text);
    const voice=clean(body?.voice,80)||'alena';
    const requestedRole=clean(body?.role,80)||'neutral';
    const roles=supportedRoles[voice];
    const role=roles&&roles.length?(roles.includes(requestedRole)?requestedRole:'neutral'):undefined;
    const speedValue=Number(body?.speed);
    const speed=Math.min(1.5,Math.max(0.5,Number.isFinite(speedValue)?speedValue:0.96));
    const pitchValue=Number(body?.pitchShift ?? body?.pitch_shift);
    const pitchShift=Math.min(1000,Math.max(-1000,Number.isFinite(pitchValue)?pitchValue:0));
    if(!text) return json({ok:false,error:'text is required'},400);

    const apiKey=Deno.env.get('YANDEX_API_KEY')?.trim();
    const folderId=Deno.env.get('YANDEX_FOLDER_ID')?.trim();
    if(!apiKey) throw new Error('YANDEX_API_KEY is missing');
    const headers:Record<string,string>={Authorization:`Api-Key ${apiKey}`,"Content-Type":"application/json"};
    if(folderId && Deno.env.get('YANDEX_USE_FOLDER_HEADER')==='true') headers['x-folder-id']=folderId;

    const hints:any[]=[{voice},{speed:String(speed)},{pitchShift:String(pitchShift)}];
    if(role) hints.push({role});
    const response=await fetch('https://tts.api.cloud.yandex.net/tts/v3/utteranceSynthesis',{method:'POST',headers,body:JSON.stringify({text,hints,outputAudioSpec:{containerAudio:{containerAudioType:'WAV'}},loudnessNormalizationType:'LUFS'})});
    const raw=await response.text();
    let data:any=null;try{data=raw?JSON.parse(raw):null}catch{}
    if(!response.ok) throw new Error(`SpeechKit HTTP ${response.status}: ${data?.message||raw.slice(0,1200)}`);
    const chunks:string[]=[];const add=(v:any)=>{if(v&&typeof v.data==='string')chunks.push(v.data)};
    add(data?.audioChunk);add(data?.result?.audioChunk);
    if(!chunks.length)throw new Error('SpeechKit returned no audio');
    return json({ok:true,audio_base64:chunks.join(''),mime:'audio/wav',voice,role:role||null,speed,pitch_shift:pitchShift});
  }catch(error){console.error('yandex-tts:',error);return json({ok:false,error:error instanceof Error?error.message:String(error)},500)}
}));
