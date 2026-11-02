# Coffee Run

A free 2–5 player browser game for a local network or the internet. One person hosts; everyone else joins from a phone or laptop.

## Start a game

1. Install Node.js 18 or newer on the host computer if necessary.
2. Open a terminal in this folder and run `npm install` once, then `npm start`.
3. The host opens `http://localhost:3000`. Wait for the printed **Cloudflare invite link** and share it. The in-game invite link can also be copied. The public link changes on restart.
4. Enter names. The first player is the host. At least two connected players must ready up before the host starts the shared countdown. Rounds default to three minutes; the host can choose a length from 1 to 60 minutes between rounds. Golden Coffee is worth three points. Three rounds form a championship. Look out for events, Cup Lids and Sneakers.
5. Stop the server with Ctrl+C. The host must leave the terminal running during play.

If others cannot connect, check that devices are on the same non-guest network and allow Node.js on the host's private network firewall. Some office networks isolate devices; if so, a network administrator must allow local connections. If port 3000 is taken, set `PORT` before starting (PowerShell: `$env:PORT=3001; npm start`).

## Controls

Move with WASD or the arrow keys; press Space to dash. On a touchscreen, use the joystick and DASH button. Grab a cup by walking over it; return it to your matching colored home circle. Dash into a rival carrying a cup to make them drop it. Dashes recharge in a little over two seconds.

The host simulates movement and sends updates 20 times per second. The game runs on the local network or through a Cloudflare quick tunnel and does not require accounts or a hosted service. Network latency and Wi-Fi quality can still affect play. Players can join an active round if a slot is free; they begin with zero points. If a player disconnects, the game drops their cup and tries to reconnect them for 30 seconds while preserving their slot and score. If the host does not reconnect within that period, host privileges pass to another player. Use the sound and reduced-motion controls beside the board to adjust feedback.

## Artwork

The office scene incorporates [Modern Office 2D Top-Down Props Pack](https://nacl1234.itch.io/top-down-modern-office-2d-asset-pack) and the characters use the free samples of [Modern Citizens](https://nacl1234.itch.io/modern-citizens-top-down-animated-characters), both by nacl1234. These are free, AI-assisted assets whose licenses permit use in games while restricting redistribution of the original assets. The office scene and character atlas are integrated into the game; do not redistribute the original asset packs as separate files.
