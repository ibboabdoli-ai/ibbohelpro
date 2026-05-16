import { t } from './i18n.js';

async function reverseGeocode(lat: number, lon: number, lang: string) {
  const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&addressdetails=1`;
  const res = await fetch(url, { headers: { 'Accept-Language': lang || 'en' } });
  const data = await res.json();
  const address = data?.address || {};
  const city = address.city || address.town || address.village || address.hamlet || address.municipality || '';
  const postcode = address.postcode || '';
  const label = [postcode, city].filter(Boolean).join(' ').trim() || data?.display_name || '';
  return label;
}

export function requestLocationAutofill({
  language,
  onAddress,
  onPolicy
}: {
  language: string;
  onAddress: (address: string) => void;
  onPolicy?: () => void;
}) {
  if (!('geolocation' in navigator)) {
    alert(t('chat.location.unsupported', 'Location is not supported on this device. Please enter your address manually.'));
    return;
  }

  const proceed = window.confirm(t('chat.location.request', 'Please allow location to autofill your address.'));
  if (!proceed) return;

  navigator.geolocation.getCurrentPosition(
    async (pos) => {
      const addr = await reverseGeocode(pos.coords.latitude, pos.coords.longitude, language || 'en');
      if (addr) {
        onAddress(addr);
        onPolicy?.();
      } else {
        alert(t('chat.location.noAddress', 'Could not resolve your location to an address. Please type it manually.'));
      }
    },
    () => {
      alert(t('chat.location.denied', 'Location access denied. Please enter your address manually.'));
    },
    { enableHighAccuracy: true, timeout: 8000 }
  );
}

export function attachLandingLocationAutofill() {
  const input = document.querySelector('input[name="location"]');
  if (!input) return;
  requestLocationAutofill({
    language: document.documentElement.lang || 'en',
    onAddress: (addr) => {
      (input as HTMLInputElement).value = addr;
    }
  });
}
