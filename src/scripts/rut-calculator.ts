export {};

type RutInputs = {
  service: string;
  rooms: number;
  hours: number;
  frequency: string;
  rutEnabled: boolean;
};

const serviceRates: Record<string, number> = {
  hemstadning: 390,
  flyttstadning: 520,
  storstadning: 460,
  kontor: 430,
  fonsterputs: 420,
  trappstadning: 410,
  byggstadning: 480,
  airbnb: 450
};

const serviceHours: Record<string, number> = {
  hemstadning: 2,
  flyttstadning: 5,
  storstadning: 4,
  kontor: 3,
  fonsterputs: 2,
  trappstadning: 2,
  byggstadning: 4,
  airbnb: 2.5
};

function numberInput(id: string, fallback: number) {
  const input = document.getElementById(id) as HTMLInputElement | null;
  const value = Number(input?.value || fallback);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function valueInput(id: string, fallback: string) {
  const input = document.getElementById(id) as HTMLInputElement | HTMLSelectElement | null;
  return String(input?.value || fallback);
}

function money(value: number) {
  return new Intl.NumberFormat('sv-SE', { style: 'currency', currency: 'SEK', maximumFractionDigits: 0 }).format(value);
}

function calculateRut(inputs: RutInputs) {
  const rate = serviceRates[inputs.service] || serviceRates.hemstadning;
  const baseHours = inputs.hours || serviceHours[inputs.service] || 2;
  const roomFactor = Math.max(1, inputs.rooms * 0.45);
  const frequencyDiscount = inputs.frequency === 'weekly' ? 0.9 : inputs.frequency === 'biweekly' ? 0.95 : 1;
  const hours = Math.max(1.5, Math.round((baseHours + roomFactor) * 2) / 2);
  const beforeRut = Math.round(rate * hours * frequencyDiscount);
  const rut = inputs.rutEnabled ? Math.round(beforeRut * 0.5) : 0;
  const afterRut = beforeRut - rut;
  return { rate, hours, beforeRut, rut, afterRut };
}

function syncServiceDefaults() {
  const service = valueInput('rut-service', 'hemstadning');
  const hoursInput = document.getElementById('rut-hours') as HTMLInputElement | null;
  if (hoursInput && !hoursInput.dataset.userEdited) {
    hoursInput.value = String(serviceHours[service] || 2);
  }
}

function renderRutCalculator() {
  const target = document.getElementById('rut-result');
  if (!target) return;

  const service = valueInput('rut-service', 'hemstadning');
  const inputs: RutInputs = {
    service,
    rooms: numberInput('rut-rooms', 2),
    hours: numberInput('rut-hours', serviceHours[service] || 2),
    frequency: valueInput('rut-frequency', 'once'),
    rutEnabled: Boolean((document.getElementById('rut-enabled') as HTMLInputElement | null)?.checked)
  };
  const result = calculateRut(inputs);

  target.innerHTML = `
    <div class="space-y-3">
      <div class="flex items-center justify-between rounded-2xl bg-white/5 p-3">
        <span class="text-gray-400">Pris före RUT</span>
        <strong class="text-white">${money(result.beforeRut)}</strong>
      </div>
      <div class="flex items-center justify-between rounded-2xl bg-emerald-500/10 p-3">
        <span class="text-emerald-200">RUT-avdrag, preliminärt</span>
        <strong class="text-emerald-100">-${money(result.rut)}</strong>
      </div>
      <div class="rounded-3xl border border-emerald-300/20 bg-emerald-500/10 p-4">
        <p class="text-xs uppercase tracking-[0.2em] text-emerald-200">Estimerat pris efter RUT</p>
        <p class="mt-1 text-3xl font-bold text-white">${money(result.afterRut)}</p>
        <p class="mt-1 text-sm text-emerald-100">Ca ${result.hours} timmar · ${money(result.rate)}/tim</p>
      </div>
      <p class="text-xs text-gray-500">RUT är en preliminär visning. Slutlig rätt till avdrag måste verifieras mot Skatteverkets regler och kundens utrymme.</p>
    </div>
  `;
}

function initRutCalculator() {
  if (document.body.dataset.page !== 'landing') return;
  const ids = ['rut-service', 'rut-rooms', 'rut-hours', 'rut-frequency', 'rut-enabled'];
  ids.forEach((id) => {
    const input = document.getElementById(id) as HTMLInputElement | HTMLSelectElement | null;
    input?.addEventListener('input', () => {
      if (id === 'rut-hours') (input as HTMLInputElement).dataset.userEdited = 'true';
      if (id === 'rut-service') syncServiceDefaults();
      renderRutCalculator();
    });
    input?.addEventListener('change', () => {
      if (id === 'rut-service') syncServiceDefaults();
      renderRutCalculator();
    });
  });
  syncServiceDefaults();
  renderRutCalculator();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initRutCalculator);
else initRutCalculator();
