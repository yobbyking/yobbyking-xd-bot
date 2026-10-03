# yobbyking XD — WhatsApp Bot

> A multi-user WhatsApp bot with **tap buttons**, **contact card**, and a **.setmenuimage** command. Anyone can DM the bot and use its menu.

## ✨ Features

- 📋 **Tap-button menus** — uses WhatsApp's native listMessage (single button → menu of options)
- 💾 **Contact card on every menu** — bot sends a vCard contact card so users can save the bot
- 🖼️ **.setmenuimage command** — reply to a photo/video with `.setmenuimage` and it becomes the persistent menu header (shown on every menu reply)
- 📝 **.setstatus** — customize the footer text shown on every reply
- 🔐 **Owner system** — first user to run `.setowner` becomes the owner; unlocks admin commands
- 🎮 **Commands built in**:
  - `.menu` / `.help` — show the menu
  - `.sticker` — make a sticker from a replied photo
  - `.joke` — random joke
  - `.quote` — inspirational quote
  - `.info` — bot info (uptime, user count)
  - `.contact` / `.save` — get the bot's contact card
  - `.setowner` — claim ownership
  - `.setstatus <text>` — change the footer status (owner only)
  - `.setmenuimage` — set the menu image (owner only, reply to photo/video)
  - `.broadcast <msg>` — message all users (owner only)
  - `.ban @user` — ban a user (owner only)

## 🚀 Deploy on Railway (or any Ubuntu VPS)

### Option A — On the same Railway Ubuntu VPS we already have

```bash
ssh root@altaria.proxy.rlwy.net -p 10754
# password: 2026yobby

cd ~
git clone https://github.com/yobbyking/yobbyking-xd-bot.git
cd yobbyking-xd-bot
npm install

# Set your phone number (international format, no + or spaces)
# This will generate a pairing code so you can link your WhatsApp
export BOT_PHONE=254712345678  # <-- change to your real number

# Start in tmux (survives SSH logout)
tmux new -s bot 'node index.js 2>&1 | tee bot.log'

# See the pairing code:
tmux a -t bot
# (Press Ctrl+B then D to detach without killing it)
```

You'll see a pairing code like:
```
🔗 Your pairing code:
   ABC-XYZ-123
```

On your phone:
1. Open WhatsApp
2. Settings → Linked Devices → Link a device
3. Tap "Link with phone number instead"
4. Enter the code: `ABC-XYZ-123`

Done! The bot is now live on your WhatsApp number.

### Option B — On a fresh VPS

```bash
# Install Node 20
curl -fsSL https://deb.nodesource.com/setup_20.x | bash && apt install -y nodejs

# Clone + install
git clone https://github.com/yobbyking/yobbyking-xd-bot.git
cd yobbyking-xd-bot
npm install

# Set your phone number + start
BOT_PHONE=254712345678 tmux new -s bot 'node index.js'
```

## 📋 How to use the bot

### As a regular user
DM the bot's WhatsApp number any of these commands:
- `.menu` — shows the tap-button menu
- `.sticker` — (reply to a photo) — makes a sticker
- `.joke` — random joke
- `.quote` — random quote
- `.info` — bot info

### As the owner (admin)
- `.setowner` — claim the bot (first user to run this)
- `.setmenuimage` — (reply to a photo/video) — sets the menu image
- `.setstatus <text>` — changes the footer status
- `.broadcast <msg>` — sends your message to every user
- `.ban @user` — bans a user from using the bot

## 📁 Project structure

```
yobbyking-xd-bot/
├── index.js               # Main entry: Baileys connection + message router
├── package.json
├── commands/              # One file per command
│   ├── menu.js            # The tap-button menu
│   ├── setmenuimage.js    # Set menu image
│   ├── setowner.js        # Claim ownership
│   ├── setstatus.js       # Set footer status
│   ├── sticker.js         # Make stickers
│   ├── joke.js            # Random jokes
│   ├── quote.js           # Random quotes
│   ├── info.js            # Bot info
│   ├── contact.js         # Send bot contact card
│   ├── broadcast.js       # Owner-only broadcast
│   └── ban.js             # Owner-only ban
└── lib/
    ├── store.js           # JSON state (owner, status, menu image, users)
    ├── state.js           # Baileys auth folder helper
    └── messages.js        # Helpers for listMessage, contact cards, media
```

## 🔧 Tech notes

- **Baileys**: official `@whiskeysockets/baileys` (most reliable WhatsApp library)
- **Auth**: pairing code (no QR scan needed) — set `BOT_PHONE` env var
- **Persistence**: state saved to `store.json` + Baileys auth saved to `./auth/`
- **Buttons**: uses `listMessage` (one button → opens menu) — supported by all WhatsApp clients
- **Contact card**: sent as a vCard attachment — appears as "Save contact" button
- **Menu image**: downloaded with `downloadMediaMessage`, saved to `assets/menu-image.{jpg|mp4|webp}`, attached as header on every menu reply

## 📝 License

MIT — do whatever you want.
