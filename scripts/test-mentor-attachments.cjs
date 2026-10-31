const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{stripTypeScriptTypes}=require('node:module');
const ctx={TextDecoder,Uint8Array,btoa};vm.createContext(ctx);vm.runInContext(stripTypeScriptTypes(fs.readFileSync('supabase/functions/_shared/mentor-attachments.ts','utf8')).replace(/export /g,'')+'\nthis.check=checkMentorAttachments;this.convert=mentorMultimodal;',ctx);
const user='11111111-1111-4111-8111-111111111111',dialogue='aaaaaaaa-1111-4111-8111-111111111111';
const file=(type,ext,name='Документ')=>({type,name,path:user+'/'+dialogue+'/cccccccc-1111-4111-8111-111111111111.'+ext});
(async()=>{
 const txt=file('text/plain','txt'),pdf=file('application/pdf','pdf'),image=file('image/png','png');let downloads=0;
 const blobs={[txt.path]:new Blob(['Скидка 5%, доставка завтра.']),[pdf.path]:new Blob(['%PDF-1.7\nfixture']),[image.path]:new Blob([new Uint8Array([137,80,78,71,13,10,26,10,0])])};
 const admin={storage:{from:bucket=>{assert.equal(bucket,'mentor-private');return {download:async path=>{downloads++;return {data:blobs[path]};}};}}};
 const output=await ctx.convert(admin,[{role:'user',content:'Разбери документы',attachments:[txt,pdf,image]},{role:'assistant',content:'Ответ'},{role:'user',content:'Уточни',attachments:[txt]}],user,dialogue);
 assert.equal(downloads,3,'Immutable object fetched once per request');assert.equal(output[0].content[1].text,'Вложение: Документ');assert.match(output[0].content[2].text,/Скидка 5%/);assert.equal(output[0].content[4].type,'file');assert.match(output[0].content[4].file.file_data,/^data:application\/pdf;base64,/);assert.equal(output[0].content[6].type,'image_url');assert.equal(output[2].content[2].text,output[0].content[2].text,'Follow-up receives original text content');
 assert.throws(()=>ctx.check([{...txt,path:'other/'+dialogue+'/file.txt'}],user,dialogue));assert.throws(()=>ctx.check([{...txt,path:user+'/'+dialogue+'/../file.txt'}],user,dialogue));assert.throws(()=>ctx.check([txt,txt],user,dialogue));assert.throws(()=>ctx.check([{...txt,type:'text/html'}],user,dialogue));assert.throws(()=>ctx.check([txt,pdf,image,txt],user,dialogue));
 blobs[pdf.path]=new Blob(['not a pdf']);await assert.rejects(ctx.convert(admin,[{role:'user',content:'?',attachments:[pdf]}],user,dialogue),/формату/);
 blobs[txt.path]=new Blob(['a'.repeat(100001)]);await assert.rejects(ctx.convert(admin,[{role:'user',content:'?',attachments:[txt]}],user,dialogue),/100 000/);
 blobs[txt.path]=new Blob([new Uint8Array([255,255])]);await assert.rejects(ctx.convert(admin,[{role:'user',content:'?',attachments:[txt]}],user,dialogue),/UTF-8/);
 blobs[txt.path]=new Blob([new Uint8Array(5242881)]);await assert.rejects(ctx.convert(admin,[{role:'user',content:'?',attachments:[txt]}],user,dialogue),/5 МБ/);
 delete blobs[txt.path];await assert.rejects(ctx.convert(admin,[{role:'user',content:'?',attachments:[txt]}],user,dialogue),/прочитать/);
 console.log('PASS: private object paths, traversal/duplicates/type/count rejection, real bytes in multimodal PDF/image/text payload, follow-up context, bad signatures, UTF-8/size/missing-file errors. No paid provider call.');
})().catch(e=>{console.error(e);process.exitCode=1});
