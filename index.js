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
  console.error("ERROR: Environment variable belum lengkap.");

  if (!TOKEN) {
    console.error("TOKEN belum dipasang.");
  }

  if (!GUILD_ID) {
    console.error("GUILD_ID belum dipasang.");
  }

  if (!CHANNEL_ID) {
    console.error("CHANNEL_ID belum dipasang.");
  }

  process.exit(1);
}

// =========================
// VOICE STATE
// =========================

let connection = null;
let reconnectTimer = null;
let connecting = false;

// =========================
// RECONNECT
// =========================

function scheduleReconnect(delay) {
  if (reconnectTimer) {
    return;
  }

  console.log(
    "Reconnect VC dalam " + Math.round(delay / 1000) + " detik..."
  );

  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connectToVC();
  }, delay);
}

// =========================
// CLEANUP CONNECTION
// =========================

function destroyConnection() {
  if (!connection) {
    return;
  }

  try {
    connection.removeAllListeners();
  } catch (error) {}

  try {
    connection.destroy();
  } catch (error) {}

  connection = null;
}

// =========================
// CONNECT TO VOICE CHANNEL
// =========================

async function connectToVC() {
  if (connecting) {
    return;
  }

  connecting = true;

  try {
    const guild = client.guilds.cache.get(GUILD_ID);

    if (!guild) {
      throw new Error(
        "Guild tidak ditemukan: " + GUILD_ID
      );
    }

    console.log(
      "Server ditemukan: " + guild.name
    );

    const channel = await client.channels.fetch(CHANNEL_ID);

    if (!channel) {
      throw new Error(
        "Channel tidak ditemukan: " + CHANNEL_ID
      );
    }

    console.log(
      "Channel ditemukan: " + channel.name
    );

    if (
      channel.type !== ChannelType.GuildVoice &&
      channel.type !== ChannelType.GuildStageVoice
    ) {
      throw new Error(
        "CHANNEL_ID bukan voice channel."
      );
    }

    // Bersihkan koneksi lama
    destroyConnection();

    console.log("Menghubungkan ke voice channel...");

    connection = joinVoiceChannel({
      channelId: channel.id,
      guildId: guild.id,
      adapterCreator: guild.voiceAdapterCreator,
      selfDeaf: false,
      selfMute: false
    });

    // =========================
    // VOICE ERROR
    // =========================

    connection.on("error", (error) => {
      console.error(
        "Voice connection error:",
        error.message
      );

      connecting = false;

      destroyConnection();

      scheduleReconnect(10000);
    });

    // =========================
    // VOICE STATE
    // =========================

    connection.on(
      VoiceConnectionStatus.Ready,
      () => {
        console.log(
          "Voice connection READY."
        );
      }
    );

    connection.on(
      VoiceConnectionStatus.Disconnected,
      () => {
        console.log(
          "Bot terputus dari VC."
        );

        connecting = false;

        destroyConnection();

        scheduleReconnect(5000);
      }
    );

    connection.on(
      VoiceConnectionStatus.Destroyed,
      () => {
        console.log(
          "Voice connection destroyed."
        );

        connecting = false;
      }
    );

    // =========================
    // WAIT READY
    // =========================

    await entersState(
      connection,
      VoiceConnectionStatus.Ready,
      120000
    );

    console.log(
      "================================="
    );

    console.log(
      "BOT BERHASIL MASUK VC"
    );

    console.log(
      "Server : " + guild.name
    );

    console.log(
      "Channel: " + channel.name
    );

    console.log(
      "================================="
    );

    connecting = false;

  } catch (error) {

    console.error(
      "Gagal masuk VC:",
      error.message
    );

    connecting = false;

    destroyConnection();

    scheduleReconnect(10000);
  }
}

// =========================
// DISCORD READY
// =========================

client.once(
  "clientReady",
  async () => {

    console.log(
      "================================="
    );

    console.log(
      "Login sebagai " + client.user.tag
    );

    console.log(
      "Discord client READY."
    );

    console.log(
      "================================="
    );

    await connectToVC();
  }
);

// =========================
// CLIENT ERROR
// =========================

client.on("error", (error) => {
  console.error(
    "Discord client error:",
    error.message
  );
});

// =========================
// WARN
// =========================

client.on("warn", (message) => {
  console.warn(
    "Discord warning:",
    message
  );
});

// =========================
// PROCESS ERROR PROTECTION
// =========================

process.on("unhandledRejection", (error) => {
  console.error(
    "Unhandled rejection:",
    error
  );
});

process.on("uncaughtException", (error) => {
  console.error(
    "Uncaught exception:",
    error
  );
});

// =========================
// START
// =========================

console.log(
  "Aeden sedang dinyalakan..."
);

client.login(TOKEN)
  .then(() => {
    console.log(
      "Login Discord berhasil diproses."
    );
  })
  .catch((error) => {
    console.error(
      "Gagal login Discord:",
      error.message
    );
  });
