(() => {
  'use strict';

  // TEXT TRAINING ONLY.
  // Do not replace navigation or the original training UI.
  // Keep the existing DB/session/trainingChat flow and only disable speech in standard training.
  function install() {
    if (window.__saleTreningTextOnlyV5) return;
    window.__saleTreningTextOnlyV5 = true;

    if (typeof startTraining === 'function') {
      window.startTraining = async function(id) {
        const s = state.scenarios.find(x => Number(x.id) === Number(id));
        if (!s) return;

        const {data, error} = await sb.from('saletrening_sessions').insert({
          employee_id: state.user.id,
          company_id: state.profile.company_id,
          scenario_id: id,
          status: 'started',
          transcript: [],
          voice_mode: false
        }).select().single();

        if (error) {
          toast(error.message);
          return;
        }

        state.session = {...data, scenario: s};
        state.messages = [];
        state.view = 'training';
        await saveSession();
        trainingChat();

        try {
          const opening = await aiClientReply('', true);
          state.messages.push({speaker:'client', content:opening});
          await saveSession();
          trainingChat();
          // NO speech here. Standard training is text-only.
        } catch (e) {
          console.error('chat-client opening:', e);
          trainingChat();
          toast('Не удалось получить первую реплику AI-клиента: ' + (e.message || 'ошибка'));
        }
      };
    }

    if (typeof sendMessage === 'function') {
      window.sendMessage = async function() {
        const input = document.getElementById('msg');
        const text = input?.value.trim();
        if (!text) return;

        state.messages.push({speaker:'manager', content:text});
        input.value = '';
        await saveSession();
        trainingChat();

        try {
          const reply = await aiClientReply(text);
          state.messages.push({speaker:'client', content:reply});
          await saveSession();
          trainingChat();
          // NO speech here. Standard training is text-only.
        } catch (e) {
          console.error('chat-client:', e);
          trainingChat();
          toast('AI-клиент временно недоступен: ' + (e.message || 'ошибка'));
        }
      };
    }

    // Clear any speech left queued by an earlier version.
    try { window.speechSynthesis?.cancel(); } catch (_) {}
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', install, {once:true});
  } else {
    install();
  }
})();
