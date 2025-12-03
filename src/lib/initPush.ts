// src/lib/initPush.ts
import { PushNotifications } from '@capacitor/push-notifications';
import { LocalNotifications } from '@capacitor/local-notifications';

export async function initPush() {
  // 1) Pedir permisos de notificaciones (Android 13+ y iOS)
  const perm = await PushNotifications.requestPermissions();
  if (perm.receive !== 'granted') {
    console.warn('Permiso de notificaciones no concedido');
    return;
  }

  // 2) Registrar para recibir el token de FCM
  await PushNotifications.register();

  // 3) Listeners básicos (opcional pero útil)
  PushNotifications.addListener('registration', (token) => {
    console.log('FCM token:', token.value);
    // TODO: envía este token a tu backend si vas a mandar push desde servidor
  });

  PushNotifications.addListener('registrationError', (err) => {
    console.error('Error registrando push:', err);
  });

  PushNotifications.addListener('pushNotificationReceived', (notif) => {
    console.log('Push recibida en foreground:', notif);
  });

  PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
    console.log('Usuario tocó la notificación:', action);
    // TODO: navega a alguna pantalla si quieres
  });

  // 4) (SOLO ANDROID) Crea el canal 'alcalc_general' con la importancia que quieras
  try {
    await LocalNotifications.createChannel({
      id: 'alcalc_general',            // 👈 Debe igualar al del Manifest
      name: 'AL Calculadora',          // Texto visible en ajustes del sistema
      description: 'Notificaciones generales de la app',
      importance: 4,                   // 1=min, 2=low, 3=default, 4=high, 5=max
      visibility: 1,                   // 1=public, 0=private, -1=secret
      sound: undefined,                // o 'default' o un nombre de .wav/.mp3 en res/raw
      lights: true,
      vibration: true,
    });
    console.log('Canal alcalc_general creado/actualizado');
  } catch (e) {
    console.warn('No se pudo crear el canal (Android < 8?):', e);
  }
}
