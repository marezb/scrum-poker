export const POKER_CARDS = ['0.5', '1', '2', '3', '5', '8', '13', '21', '34', '55', '89', '?'];
export const ADMIN_PASSWORD = "AskMarekForApproval";

export function generateId(length = 10) {
    return Math.random().toString(36).substring(2, 2 + length);
}

export const firebaseConfig = {
    apiKey: ["AIzaSyAmm", "7M5bg8JMgSFFS", "qBAQ3hyIqN3qRcR1s"].join(''),
    authDomain: "scrum-poker-7d690.firebaseapp.com",
    databaseURL: "https://scrum-poker-7d690-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "scrum-poker-7d690",
    storageBucket: "scrum-poker-7d690.firebasestorage.app",
    messagingSenderId: "1009596685618",
    appId: "1:1009596685618:web:32c246a48e0df680004b2b"
};
