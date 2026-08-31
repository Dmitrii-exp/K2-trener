# Training logic update

## Ordinary scenario training
- Evaluation is scoped to the selected training objective only.
- A focused objection scenario such as `Дорого` evaluates only the manager's handling of that objection, not unrelated sales competencies.
- Score: 1–100.
- 90–100: отлично; 80–89: хорошо; 60–79: удовлетворительно; 41–59: плохо; 1–40: очень плохо.

## Free training
- Add a separate `Свободная тренировка` mode with no single fixed objection.
- The AI client can introduce different objections from the available objection set, but does not inject an objection on every message.
- Objections should depend on the dialogue and the manager's previous answer.
- The client should progress toward a purchase when the manager demonstrates strong need discovery, product presentation/value, communication, and objection handling.
- Successful completion phrase: `Хорошо, я готов купить у вас товар. Высылайте счёт.` This ends the training successfully.

## Existing cold-call mode
- Keep cold-call evaluation separate from ordinary training evaluation.
- Do not replace the cold-call 5×20 scoring model with the ordinary 1–100 model.
