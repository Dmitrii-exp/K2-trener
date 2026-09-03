/* SaleTrening local Supabase client — no external CDN required. */
(function(){
  'use strict';
  const STORAGE_KEY='saletrening.auth.session';
  const URL='https://svxykakyrloqzloerygb.supabase.co';
  const KEY='sb_publishable_r7wu9xAgaiIZBTg4tBiJvQ_CVKHaUoi';
  const listeners=[];
  let session=null;
  try{session=JSON.parse(localStorage.getItem(STORAGE_KEY)||'null')}catch{session=null}

  function decodeJwtPayload(token){
    try{
      const part=String(token||'').split('.')[1];
      if(!part)return null;
      const b64=part.replace(/-/g,'+').replace(/_/g,'/');
      const json=decodeURIComponent(atob(b64).split('').map(c=>'%'+('00'+c.charCodeAt(0).toString(16)).slice(-2)).join(''));
      return JSON.parse(json);
    }catch{return null}
  }
  function needsRefresh(s){
    const exp=Number(decodeJwtPayload(s?.access_token)?.exp||s?.expires_at||0);
    return !!s?.refresh_token && !!exp && exp <= Math.floor(Date.now()/1000)+60;
  }
  const headers=(token)=>({'Content-Type':'application/json','apikey':KEY,'Authorization':'Bearer '+(token||KEY)});
  async function request(path,opts={},token){
    const h={...headers(token),...(opts.headers||{})};
    const r=await fetch(URL+path,{...opts,headers:h});
    const text=await r.text(); let data=null;
    try{data=text?JSON.parse(text):null}catch{data=text}
    if(!r.ok){const msg=data?.msg||data?.message||data?.error_description||data?.error||text||('HTTP '+r.status);const e=new Error(msg);e.status=r.status;e.data=data;throw e}
    return data;
  }
  function save(s){session=s||null;if(session)localStorage.setItem(STORAGE_KEY,JSON.stringify(session));else localStorage.removeItem(STORAGE_KEY)}
  function emit(event,s){listeners.slice().forEach(fn=>{try{fn(event,s)}catch(e){setTimeout(()=>{throw e})}})}

  async function refreshSession(){
    if(!session?.refresh_token)return {data:{session:null},error:null};
    try{
      const d=await request('/auth/v1/token?grant_type=refresh_token',{method:'POST',body:JSON.stringify({refresh_token:session.refresh_token})});
      if(d?.access_token){
        const next={...session,...d,user:d.user||session.user};
        save(next);
        emit('TOKEN_REFRESHED',next);
        return {data:{session:next},error:null};
      }
      throw new Error('Supabase не вернул новый access token');
    }catch(error){
      return {data:{session:null},error};
    }
  }

  function auth(){
    return {
      async getSession(){
        if(session && needsRefresh(session)){
          const r=await refreshSession();
          if(r.data.session)return r;
          if(r.error?.status===400||r.error?.status===401)save(null);
        }
        return {data:{session},error:null};
      },
      async refreshSession(){return refreshSession()},
      async signUp({email,password,options}={}){
        try{const d=await request('/auth/v1/signup',{method:'POST',body:JSON.stringify({email,password,data:options?.data||{}})});if(d?.access_token){save(d);emit('SIGNED_IN',d)} return {data:{user:d?.user||d,session:d?.access_token?d:null},error:null}}
        catch(error){return {data:{user:null,session:null},error}}
      },
      async signInWithPassword({email,password}={}){
        try{const d=await request('/auth/v1/token?grant_type=password',{method:'POST',body:JSON.stringify({email,password})});save(d);emit('SIGNED_IN',d);return {data:{user:d.user,session:d},error:null}}
        catch(error){return {data:{user:null,session:null},error}}
      },
      async signOut(){try{if(session?.access_token)await request('/auth/v1/logout',{method:'POST'},session.access_token)}catch{}save(null);emit('SIGNED_OUT',null);return {error:null}},
      async resetPasswordForEmail(email,{redirectTo}={}){try{await request('/auth/v1/recover',{method:'POST',body:JSON.stringify({email,redirect_to:redirectTo})});return {data:{},error:null}}catch(error){return {data:null,error}}},
      async updateUser(attributes){try{const current=await refreshSession();if(current.data.session){}const d=await request('/auth/v1/user',{method:'PUT',body:JSON.stringify(attributes)},session?.access_token);if(session)save({...session,user:d});return {data:{user:d},error:null}}catch(error){return {data:{user:null},error}}},
      onAuthStateChange(fn){listeners.push(fn);return {data:{subscription:{unsubscribe(){const i=listeners.indexOf(fn);if(i>=0)listeners.splice(i,1)}}}}}
    }
  }

  class Query{
    constructor(table){this.table=table;this.method='GET';this.body=null;this.params=[];this.headers={};this.singleMode=null}
    select(cols='*'){if(this.method==='GET'){this.params.push('select='+encodeURIComponent(cols))}else{this.headers.Prefer='return=representation';this.params.push('select='+encodeURIComponent(cols))}return this}
    insert(body){this.method='POST';this.body=body;this.headers.Prefer='return=representation';return this}
    update(body){this.method='PATCH';this.body=body;this.headers.Prefer='return=representation';return this}
    eq(k,v){this.params.push(encodeURIComponent(k)+'=eq.'+encodeURIComponent(String(v)));return this}
    order(k,opt={}){this.params.push('order='+encodeURIComponent(k)+'.'+(opt.ascending===false?'desc':'asc'));return this}
    limit(n){this.params.push('limit='+encodeURIComponent(n));return this}
    maybeSingle(){this.singleMode='maybe';return this.exec()}
    single(){this.singleMode='single';return this.exec()}
    then(resolve,reject){return this.exec().then(resolve,reject)}
    catch(reject){return this.exec().catch(reject)}
    async exec(){
      try{
        if(session && needsRefresh(session))await refreshSession();
        const qs=this.params.length?'?'+this.params.join('&'):'';
        const data=await request('/rest/v1/'+encodeURIComponent(this.table)+qs,{method:this.method,body:this.body==null?undefined:JSON.stringify(this.body),headers:this.headers},session?.access_token);
        if(this.singleMode==='single'){if(!Array.isArray(data)||data.length!==1)throw new Error('Ожидалась одна запись');return {data:data[0],error:null}}
        if(this.singleMode==='maybe')return {data:Array.isArray(data)?(data[0]||null):data,error:null};
        return {data,error:null}
      }catch(error){return {data:null,error}}
    }
  }
  const client={
    from(table){return new Query(table)},
    auth:auth(),
    functions:{
      async invoke(name,{body,headers}={}){try{if(session&&needsRefresh(session))await refreshSession();return {data:await request('/functions/v1/'+encodeURIComponent(name),{method:'POST',body:JSON.stringify(body||{}),headers:headers||{}},session?.access_token),error:null}}catch(error){return {data:null,error}}}
    },
    async rpc(name,args={}){try{if(session&&needsRefresh(session))await refreshSession();return {data:await request('/rest/v1/rpc/'+encodeURIComponent(name),{method:'POST',body:JSON.stringify(args)},session?.access_token),error:null}}catch(error){return {data:null,error}}}
  };
  window.supabase={createClient(){return client}};
})();