const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const source=fs.readFileSync('supabase-client.js','utf8');
async function run(type,stale=false,invalid=false){
 const saved=new Map(stale?[['saletrening.auth.session',JSON.stringify({access_token:'stale',user:{id:'old'}})]]:[]),calls=[];
 const context={URLSearchParams,URL,console,atob,Date,decodeURIComponent,localStorage:{getItem:k=>saved.get(k)||null,setItem:(k,v)=>saved.set(k,v),removeItem:k=>saved.delete(k)},location:{hash:'#access_token=new&refresh_token=refresh&expires_in=3600&type='+type},window:{},setTimeout,fetch:async(url,opts)=>{calls.push(opts.headers.Authorization);return {ok:!invalid,status:invalid?401:200,text:async()=>JSON.stringify(invalid?{message:'bad token'}:{id:'new',email:'employee@example.test'})}}};
 vm.createContext(context);vm.runInContext(source,context);
 const r=await context.window.supabase.createClient().auth.getSession();return {r,calls,saved};
}
(async()=>{for(const type of ['signup','invite','magiclink','recovery']){const {r,calls}=await run(type,true);assert.equal(r.data.session.user.id,'new',type+' uses URL session before stale session');assert.equal(calls[0],'Bearer new');}const x=await run('signup',false,true);assert.equal(x.r.data.session,null,'invalid token never grants session');console.log('PASS: signup, invite, magiclink and recovery redirect sessions; stale session precedence; invalid token denied');})().catch(e=>{console.error(e);process.exitCode=1});
