import { registerPlugin } from '@capacitor/core';

const VolumeButtonsPlugin = registerPlugin('VolumeButtonsPlugin', {
  web: () => import('./VolumeButtonsPluginWeb').then(m => new m.VolumeButtonsPluginWeb()),
});

export default VolumeButtonsPlugin;