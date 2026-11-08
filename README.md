# Our Museum

A 3D museum for two people. You both sign in, walk around together, chat, and hang your own photos in the frames. Photos and chat save automatically, and each of you sees the other's changes right away.

- **Website:** GitHub Pages (free)
- **Login, chat, photos:** Firebase Realtime Database (free plan, no credit card)
- **Realistic faces:** your own avatars made from selfies at [avaturn.me](https://avaturn.me)

Setup takes about 20 minutes, one time. Do the steps in order.

---

## Step 1. Create the Firebase project

1. Go to <https://console.firebase.google.com> and sign in with your Google account.
2. Click **Create a project** (or **Add project**). Name it `our-museum`. When it asks about Google Analytics, turn it **off**. Click **Create project**, then **Continue**.

## Step 2. Turn on email login and add your two accounts

1. In the left menu, open **Build → Authentication**, then click **Get started**.
2. Under **Sign-in method**, click **Email/Password**, switch on the first toggle, and click **Save**.
3. Open the **Users** tab and click **Add user**:
   - Your email and a password.
   - Her email and a temporary password. She can change it later with **Forgot password?** on the sign-in screen.

## Step 3. Create the database and lock it to just you two

1. In the left menu, open **Build → Realtime Database** and click **Create Database**.
2. Pick the **United States** location, then choose **Start in locked mode**, and click **Enable**.
3. Open the **Rules** tab. Delete everything there and paste the contents of `database.rules.json` from this folder.
4. In what you pasted, replace `your-email@example.com` and `her-email@example.com` with your two real emails (all lowercase). Each one appears twice.
5. Click **Publish**.

These rules mean only your two accounts can read or write anything. Nobody else can see your photos or chat, even if they find the website.

## Step 4. Copy your Firebase settings into `config.js`

1. Click the gear icon next to **Project Overview**, then **Project settings**.
2. Scroll to **Your apps** and click the web icon **`</>`**. Give it any nickname, leave "Firebase Hosting" unchecked, and click **Register app**.
3. You'll see a block of code with `const firebaseConfig = { ... }`. Copy each value into the matching line of `config.js` in this folder: `apiKey`, `authDomain`, `databaseURL`, `projectId`, `storageBucket`, `messagingSenderId`, `appId`.
   - If `databaseURL` is missing, go back to **Realtime Database**. The address at the top of the Data tab (it ends in `firebaseio.com` or `firebasedatabase.app`) is your `databaseURL`.
4. Further down in `config.js`, fill in the `people` section: your name and email for `a`, and her name and email for `b`. Use the same emails as in Step 2.

## Step 5. Make your realistic avatars

Each of you does this on your own phone:

1. Go to <https://avaturn.me> and create an avatar from your selfies.
2. Export or download it as a **.glb** file.
3. Rename the files: yours `me.glb`, hers `her.glb`.

If a file is bigger than 25 MB, GitHub's website won't take it. Export it again at a lower quality.

Until the files are added, the museum shows built-in characters instead, so you can do this step later.

## Step 6. Put it on GitHub Pages

1. Go to <https://github.com> and click **New repository**. Name it `our-museum`, set it to **Public**, and click **Create repository**.
2. Click **uploading an existing file**. Drag in everything from this folder: `index.html`, `app.js`, `config.js`, `database.rules.json`, `README.md`, and the `avatars` folder with `me.glb` and `her.glb` inside. Click **Commit changes**.
3. Open the repo's **Settings → Pages**. Under **Build and deployment**, set Source to **Deploy from a branch**, Branch to **main** and **/ (root)**, then click **Save**.
4. Wait a minute or two, then refresh. Your site's address shows at the top, like `https://YOUR-USERNAME.github.io/our-museum/`.

## Step 7. Allow your website to use Firebase login

1. Back in Firebase: **Authentication → Settings → Authorized domains → Add domain**.
2. Add `YOUR-USERNAME.github.io` (your GitHub username, no `https://` and no `/our-museum`).

## Done

Open your site's address, sign in, and send her the link with her email and temporary password.

---

## Good to know

- **Privacy:** on a free GitHub account, Pages only works for public repos. That means anyone who finds the repo can see the code and download the avatar files. Your photos and chat are **not** in the repo. They're in Firebase, locked to your two accounts.
- **Free plan room:** the free database holds about 1 GB, enough for a few thousand photos. Each photo is shrunk to about 200–400 KB before it's saved.
- **Changing things later:** edit a file on GitHub (click it, then the pencil icon) and commit. The site updates in a minute or two.
- **Before Firebase is connected,** the site runs in demo mode on one computer, so you can try everything first.
