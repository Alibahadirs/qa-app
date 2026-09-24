/**
 * Aynı senaryonun iki kez aynı anda çalışmasını engelleyen süreç içi kilit.
 *
 * Hem elle tetikleme (HTTP) hem zamanlayıcı buradan geçer — zamanlayıcı, kullanıcının
 * başlattığı bir çalıştırmanın üstüne binmemeli. Süreç içi olduğu için tek backend
 * örneği varsayar; birden çok örnek çalıştırılacaksa bu kilit veritabanına taşınmalı.
 */
const running = new Set<string>();

export const isRunning = (scenarioId: string): boolean => running.has(scenarioId);

/** Kilidi alır; zaten alınmışsa false döner. */
export function acquireRun(scenarioId: string): boolean {
  if (running.has(scenarioId)) return false;
  running.add(scenarioId);
  return true;
}

export function releaseRun(scenarioId: string): void {
  running.delete(scenarioId);
}
