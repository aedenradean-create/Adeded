```js
const {
  Client,
  GatewayIntentBits,
  ChannelType
} = require("discord.js");

const {
  joinVoiceChannel,
  entersState,
  VoiceConnectionStatus
} = require("@discordjs/voice");

// =========================
// DISCORD CLIENT
// =========================

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates
  ]
});

// =========================
// ENVIRONMENT
// =========================

const TOKEN = process.env.TOKEN;
const GUILD_ID = process.env.GUILD_ID;
const CHANNEL_ID = process.env.CHANNEL_ID;

if (!TOKEN || !GUILD_ID || !CHANNEL_ID) {
  console.error(
    "❌ Ada environment variable yang belum dipasang."
  );

  process.exit(1);
}

// =========================
// VOICE CONNECTION
// =========================

let connection = null;
let reconnecting = false;

// =========================
// CONNECT TO VC
// =========================

async function connectToVC() {
  if (reconnecting) {
    return;
  }

  reconnecting = true;

  try {
    const guild =
      client.guilds.cache.get(GUILD_ID);

    if (!guild) {
      throw new Error(
        `Guild tidak ditemukan: ${GUILD_ID}`
      );
    }

    console.log(
      `✅ Server ditemukan: ${guild.name}`
    );

    const channel =
      await client.channels.fetch(
        CHANNEL_ID
      );

    if (!channel) {
      throw new Error(
        "Channel tidak ditemukan."
      );
    }

    console.log(
      `✅ Channel ditemukan: ${channel.name}`
    );

    if (
      channel.type !== ChannelType.GuildVoice &&
      channel.type !== ChannelType.GuildStageVoice
    ) {
      throw new Error(
        "CHANNEL_ID bukan voice channel."
      );
    }

    // Hancurkan koneksi lama kalau masih ada
    if (connection) {
      try {
        connection.destroy();
      } catch {}
    }

    // Masuk ke voice channel
    connection = joinVoiceChannel({
      channelId: channel.id,
      guildId: guild.id,
      adapterCreator:
        guild.voiceAdapterCreator,
      selfDeaf: false,
      selfMute: false
    });

    // Tunggu sampai benar-benar Ready
    await entersState(
      connection,
      VoiceConnectionStatus.Ready,
      60000
    );

    console.log(
      "✅ Bot berhasil masuk VC."
    );

    reconnecting = false;

    // =========================
    // DISCONNECTED
    // =========================

    connection.on(
      VoiceConnectionStatus.Disconnected,
      () => {
        console.log(
          "⚠️ Bot terputus dari VC."
        );

        reconnecting = false;

        setTimeout(() => {
          console.log(
            "🔄 Mencoba reconnect VC..."
          );

          connectToVC();
        }, 5000);
      }
    );

    // =========================
    // DESTROYED
    // =========================

    connection.on(
      VoiceConnectionStatus.Destroyed,
      () => {
        console.log(
          "⚠️ Voice connection destroyed."
        );

        reconnecting = false;
      }
    );

  } catch (err) {

    console.error(
      "❌ Gagal masuk VC:",
      err.message
    );

    reconnecting = false;

    setTimeout(() => {
      console.log(
        "🔄 Mencoba masuk VC lagi..."
      );

      connectToVC();
    }, 10000);
  }
}

// =========================
// READY
// =========================

client.once(
  "clientReady",
  async () => {

    console.log(
      `✅ Login sebagai ${client.user.tag}`
    );

    await connectToVC();
  }
);

// =========================
// LOGIN
// =========================

console.log(
  "🚀 Aeden sedang dinyalakan..."
);

client.login(TOKEN)
  .then(() => {

    console.log(
      "🔐 Login Discord berhasil diproses."
    );

  })
  .catch(err => {

    console.error(
      "❌ Gagal login Discord:",
      err.message
    );

  });
```
