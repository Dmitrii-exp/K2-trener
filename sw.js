const FALLBACK="https://unpkg.com/@supabase/supabase-js@2/dist/umd/supabase.js";
self.addEventListener("install",event=>{event.waitUntil(self.skipWaiting())});
self.addEventListener("activate",event=>{event.waitUntil(self.clients.claim())});
self.addEventListener("fetch",event=>{
  const u=event.request.url;
  if(u.includes("cdn.jsdelivr.net/npm/@supabase/supabase-js@2")){
    event.respondWith(
      fetch(FALLBACK,{cache:"no-store"})
        .then(r=>{if(!r.ok)throw new Error("fallback http "+r.status);return r})
        .catch(()=>fetch(event.request))
    );
  }
});
