import { v4 as uuidv4 } from 'uuid';

const KEY = 'd-zimem-device-id';

export function getDeviceId(): string {
  if (typeof window === 'undefined') return '';
  let id = window.localStorage.getItem(KEY);
  if (!id) {
    id = uuidv4();
    window.localStorage.setItem(KEY, id);
  }
  return id;
}
