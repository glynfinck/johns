// Generate the Web Push key pair once per environment. The public half goes
// in NEXT_PUBLIC_VAPID_PUBLIC_KEY, the private half in VAPID_PRIVATE_KEY.
// Changing them later invalidates every device's subscription.
import webpush from "web-push";

const { publicKey, privateKey } = webpush.generateVAPIDKeys();
console.log(`NEXT_PUBLIC_VAPID_PUBLIC_KEY=${publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${privateKey}`);
