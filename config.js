// ============================================================
//  OUR MUSEUM — settings
//  Fill these in once. Instructions are in README.md.
// ============================================================
window.MUSEUM_CONFIG = {

  // 1) Paste your Firebase web app settings here (Firebase console →
  //    Project settings → Your apps → SDK setup and configuration → Config).
  //    While apiKey still says PASTE, the site runs in demo mode on one computer.
  firebase: {
    apiKey: "AIzaSyBw_GnjL47jiHZfkaEWdg-7bCSjYxclvOM",
    authDomain: "our-museum-6c132.firebaseapp.com",
    databaseURL: "https://our-museum-6c132-default-rtdb.firebaseio.com",
    projectId: "our-museum-6c132",
    storageBucket: "our-museum-6c132.firebasestorage.app",
    messagingSenderId: "83792987189",
    appId: "1:83792987189:web:08b9a3d0d451bfb71cdd7c"
  },

  // 2) The two people allowed in. Emails must match the accounts you create
  //    in Firebase → Authentication → Users. Use lowercase.
  people: {
    a: {
      name: "Mohammad",
      email: "nooritawfeeq41456@gmail.com",
      avatar: "avatars/me.glb",     // your Avaturn file (leave as is if you named it me.glb)
      height: 1.76                  // meters
    },
    b: {
      name: "Mahsa",                // her name, shown on the plaque and her name tag
      email: "zamanimahsa177@gmail.com",
      avatar: "avatars/her.glb",
      height: 1.62
    }
  }
};
