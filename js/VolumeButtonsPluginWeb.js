export class VolumeButtonsPluginWeb {
  constructor() {
    this.listeners = [];
    this.setupVolumeDetection();
  }

  async setupVolumeDetection() {
    // Detecção via JavaScript puro (fallback para web)
    document.addEventListener('keydown', (e) => {
      if (e.key === 'VolumeUp' || e.key === 'VolumeDown') {
        this.handleVolumePress(e.key);
      }
    });
  }

  handleVolumePress(key) {
    const now = Date.now();
    
    // Lógica para detectar múltiplos pressionamentos
    if (!this.lastPressTime) this.lastPressTime = 0;
    if (!this.pressCount) this.pressCount = 0;
    
    if (now - this.lastPressTime < 2000) {
      this.pressCount++;
    } else {
      this.pressCount = 1;
    }
    
    this.lastPressTime = now;
    
    // Disparar evento se 3 presses em 2 segundos
    if (this.pressCount >= 3) {
      this.dispatchEmergencyEvent();
      this.pressCount = 0;
    }
    
    // Disparar para todos os listeners
    this.listeners.forEach(callback => callback({ 
      button: key,
      pressCount: this.pressCount,
      timestamp: now 
    }));
  }

  async addListener(eventName, callback) {
    this.listeners.push(callback);
    return {
      remove: () => {
        const index = this.listeners.indexOf(callback);
        if (index > -1) this.listeners.splice(index, 1);
      }
    };
  }

  dispatchEmergencyEvent() {
    // Criar evento customizado
    const event = new CustomEvent('volumeEmergency', {
      detail: { 
        type: 'TRIPLE_PRESS',
        timestamp: new Date().toISOString(),
        action: 'ACTIVATE_EMERGENCY'
      }
    });
    window.dispatchEvent(event);
  }
}