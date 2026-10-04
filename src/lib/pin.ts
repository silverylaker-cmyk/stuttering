/**
 * 원장 PIN: SHA-256(salt + pin). 기기 로컬 잠금 용도이며 보안 등급이 낮다는 점을 전제로 한다.
 */
import { PROGRAM } from '../config/program';

const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');

export function newSalt(): string {
  const a = new Uint8Array(16);
  crypto.getRandomValues(a);
  return hex(a.buffer);
}

export async function hashPin(pin: string, salt: string): Promise<string> {
  const data = new TextEncoder().encode(`${salt}:${pin}`);
  return hex(await crypto.subtle.digest('SHA-256', data));
}

export async function verifyPin(pin: string, salt: string, hash: string): Promise<boolean> {
  return (await hashPin(pin, salt)) === hash;
}

export function isValidPin(pin: string): boolean {
  const { minLength, maxLength } = PROGRAM.pin;
  return new RegExp(`^\\d{${minLength},${maxLength}}$`).test(pin);
}
