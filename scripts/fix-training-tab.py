from pathlib import Path
import re

p = Path('index.html')
s = p.read_text(encoding='utf-8')

nav_re = re.compile(r'function nav\(v,t,icon\)\{.*?\}\nfunction render\(\)', re.S)
nav_new = '''async function openTrainingTab(){try{state.view="training";const p=$("page");if(p)p.innerHTML=`<div class="top"><div><h2>ИИ-тренировки</h2><div class="muted">Загружаем сценарии...</div></div></div><div class="empty">Подготавливаем AI-тренировки…</div>`;if(!state.scenarios?.length&&state.user){const q=await sb.from("saletrening_scenarios").select("*").eq("active",true).order("id");if(q.error)throw q.error;state.scenarios=q.data||[]}render()}catch(e){console.error("Training tab:",e);const p=$("page");if(p)p.innerHTML=`<div class="top"><div><h2>ИИ-тренировки</h2><div class="muted">Ошибка загрузки сценариев</div></div></div><div class="empty"><b>Не удалось загрузить тренировки.</b><br><span class="muted">${esc(e.message||"Проверьте подключение к Supabase")}</span><br><button class="primary" style="margin-top:14px" onclick="openTrainingTab()">Повторить</button></div>`}}
function nav(v,t,icon){return `<button class="${state.view===v?"active":""}" onclick="${v==='training'?"openTrainingTab()":"state.view='"+v+"';page()"}"><span class="nav-icon">${icon}</span>${t}</button>`}function render()'''
s, n = nav_re.subn(nav_new, s, count=1)
if n != 1:
    raise SystemExit('nav function not found')

training_re = re.compile(r'function trainingList\(\)\{.*?\}\n?function scenarios\(\)', re.S)
training_new = '''function trainingList(){return `<div class="top"><div><h2>ИИ-тренировки</h2><div class="muted">Выбери ситуацию и начни живой диалог с AI-клиентом</div></div></div>${scenarioCards(state.scenarios||[])}`}function scenarios()'''
s, n = training_re.subn(training_new, s, count=1)
if n != 1:
    raise SystemExit('trainingList function not found')

p.write_text(s, encoding='utf-8')
print('AI training tab repaired')
