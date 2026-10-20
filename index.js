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

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates
  ]
});

const TOKEN = process.env.TOKEN;
const GUILD_ID = process.env.GUILD_ID;
const CHANNEL_ID = process.env.CHANNEL_ID;

if (!TOKEN || !GUILD_ID || !CHANNEL_ID) {
  console.error(
    "ERROR: Ada environment variable yang belum dipasang."
  );
  process.exit(1);
}

let connection = null;
let reconnecting = false;
let reconnectTimer = null;

function scheduleReconnect(delay = 10000) {
  if (reconnectTimer) {
    return;
  }

  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;

    console.log("Mencoba reconnect VC...");

    connectToVC();
  }, delay);
}

async function connectToVC() {
  if (reconnecting) {
    return;
  }

  reconnecting = true;

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
        "Channel tidak ditemukan."
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

    if (connection) {
      try {
        connection.removeAllListeners();
        connection.destroy();
      } catch (error) {}

      connection = null;
    }

    connection = joinVoiceChannel({
      channelId: channel.id,
      guildId: guild.id,
      adapterCreator: guild.voiceAdapterCreator,
      selfDeaf: false,
      selfMute: false
    });

    // Tangani error voice supaya proses Node tidak crash
    connection.on("error", (error) => {
      console.error(
        "Voice connection error:",
        error.message
      );

      reconnecting = false;

      try {
        connection.destroy();
      } catch (error) {}

      connection = null;

      scheduleReconnect(10000);
    });

    connection.on(
      VoiceConnectionStatus.Disconnected,
      () => {
        console.log(
          "Bot terputus dari VC."
        );

        reconnecting = false;

        try {
          connection.destroy();
        } catch (error) {}

        connection = null;

        scheduleReconnect(5000);
      }
    );

    connection.on(
      VoiceConnectionStatus.Destroyed,
      () => {
        console.log(
          "Voice connection destroyed."
        );

        reconnecting = false;
      }
    );

    await entersState(
      connection,
      VoiceConnectionStatus.Ready,
      60000
    );

    console.log(
      "Bot berhasil masuk VC."
    );

    reconnecting = false;

  } catch (err) {

    console.error(
      "Gagal masuk VC:",
      err.message
    );

    reconnecting = false;

    if (connection) {
      try {
        connection.destroy();
      } catch (error) {}

      connection = null;
    }

    scheduleReconnect(10000);
  }
}

client.once(
  "clientReady",
  async () => {

    console.log(
      "Login sebagai " + client.user.tag
    );

    await connectToVC();
  }
);

console.log(
  "Aeden sedang dinyalakan..."
);

client.login(TOKEN)
  .then(() => {
    console.log(
      "Login Discord berhasil diproses."
    );
  })
  .catch((err) => {
    console.error(
      "Gagal login Discord:",
      err.message
    );
  });
