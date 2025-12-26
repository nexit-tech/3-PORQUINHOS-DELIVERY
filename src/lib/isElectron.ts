export function isElectron(): boolean {
  if (typeof window === 'undefined') return false;
  
  // Verifica se está rodando no Electron
  return !!(window as any).require || 
         !!(window as any).electron ||
         navigator.userAgent.toLowerCase().includes('electron');
}