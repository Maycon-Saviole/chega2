// Capacitor Runtime Shim para web
export const Capacitor = {
    isNativePlatform: () => {
        // Verifica se estamos em um app nativo ou web
        return typeof window !== 'undefined' && 
               (window.Capacitor || 
                /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
                'capacitor' in window);
    },
    
    getPlatform: () => {
        const ua = navigator.userAgent;
        if (/Android/i.test(ua)) return 'android';
        if (/iPhone|iPad|iPod/i.test(ua)) return 'ios';
        return 'web';
    },
    
    Plugins: {
        VolumeButtons: {
            setEmergencyPattern: async (options) => {
                console.log('VolumeButtons.setEmergencyPattern (web):', options);
                return { success: true };
            },
            
            startDetection: async () => {
                console.log('VolumeButtons.startDetection (web)');
                return { started: true };
            },
            
            addListener: (eventName, callback) => {
                console.log(`VolumeButtons.addListener: ${eventName} (web)`);
                // Simula eventos para web
                if (eventName === 'volumeButtonPressed') {
                    // Para teste, dispara evento após 3 segundos
                    setTimeout(() => {
                        callback({
                            button: 'VOLUME_UP',
                            pressCount: 1,
                            timestamp: Date.now()
                        });
                    }, 3000);
                }
                
                return {
                    remove: () => console.log('Listener removido')
                };
            }
        }
    }
};

// Inicialização automática
if (typeof window !== 'undefined') {
    window.Capacitor = window.Capacitor || Capacitor;
    
    // Disparar evento quando Capacitor estiver pronto
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(() => {
            window.dispatchEvent(new Event('capacitorReady'));
        }, 100);
    });
}