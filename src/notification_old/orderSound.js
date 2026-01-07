import Sound from 'react-native-sound';

let orderSound = null;

export const playOrderSound = () => {
  if (orderSound) return;

  Sound.setCategory('Playback');

  orderSound = new Sound(
    'order_alert.mp3', // android: res/raw | ios: bundle
    Sound.MAIN_BUNDLE,
    (error) => {
      if (!error) {
        orderSound.setNumberOfLoops(-1); // 🔁 infinite loop
        orderSound.play();
      }
    }
  );
};

export const stopOrderSound = () => {
  if (orderSound) {
    orderSound.stop();
    orderSound.release();
    orderSound = null;
  }
};
