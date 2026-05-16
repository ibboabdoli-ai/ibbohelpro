import { t } from '../i18n.js';

export function getGuidedPrompt(stepIndex: number, steps: Array<{ prompt: string }>) {
  const step = steps[stepIndex];
  if (!step) return null;
  const label = t('chat.stepProgress', 'Step {current}/{total}')
    .replace('{current}', stepIndex + 1)
    .replace('{total}', steps.length);
  return { label, prompt: step.prompt };
}

export function shouldStayInFlow(chatState: { started: boolean }) {
  return Boolean(chatState?.started);
}
