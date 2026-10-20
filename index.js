"use strict";

const {
  Client,
  GatewayIntentBits,
  PermissionFlagsBits,
} = require("discord.js");

const {
  joinVoiceChannel,
  getVoiceConnection,
  VoiceConnectionStatus,
  entersState,
} = require("@discordjs/voice");

// =====================================================
// CONFIG
// =====================================================

const TOKEN = (process.env.TOKEN || "").trim();
const GUILD_ID = (process.env.GUILD_ID || "").trim();
const CHANNEL_ID = (process.env.CHANNEL_ID || "").trim();

function sanitize(value) {
  let text =
    typeof value === "string"
      ? value
      : value && typeof value.message === "string"
        ? value.message
        : String(value);

  if (TOKEN) {
    text = text.split(TOKEN).join("[REDACTED]");
  }

  return text;
}

function log(...parts) {
  console.log(...parts.map(sanitize));
}

function logError(...parts) {
  console.error(...parts.map(sanitize));
}

// =====================================================
// ENV CHECK
// =====================================================

const missing = [];

if (!TOKEN) missing.push("TOKEN");
if (!GUILD_ID) missing.push("GUILD_ID");
if (!CHANNEL_ID) missing.push("CHANNEL_ID");

if (missing.length > 0) {
  logError(
    "[BOOT] Environment variable belum dipasang: " +
    missing.join(", ")
  );

  process.exit(1);
}

if (
  !/^\d{17,20}$/.test(GUILD_ID) ||
  !/^\d{17,20}$/.test(CHANNEL_ID)
) {
  logError(
    "[BOOT] GUILD_ID / CHANNEL_ID harus berupa ID Discord 17-20 digit."
  );

  process.exit(1);
}

// =====================================================
// DISCORD CLIENT
// =====================================================

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
  ],
  allowedMentions: {
    parse: [],
    repliedUser: false,
  },
});

// =====================================================
// VOICE STATE
// =====================================================

const voice = {
  connection: null,
  connecting: false,
  reconnectTimer: null,
  attempt: 0,
};

let shuttingDown = false;

// =====================================================
// RECONNECT
// =====================================================

function scheduleReconnect(reason, delay = null) {
  if (shuttingDown) {
    return;
  }

  if (voice.reconnectTimer) {
    return;
  }

  voice.attempt++;

  const reconnectDelay =
    delay !== null
      ? delay
      : Math.min(
          5000 * Math.pow(2, voice.attempt - 1),
          300000
        );

  log(
    "[VOICE] Reconnect #" +
      voice.attempt +
      " dalam " +
      Math.round(reconnectDelay / 1000) +
      " detik (" +
      reason +
      ")."
  );

  voice.reconnectTimer = setTimeout(() => {
    voice.reconnectTimer = null;
    connectToVC();
  }, reconnectDelay);
}

// =====================================================
// DESTROY CURRENT CONNECTION
// =====================================================

function destroyConnection(connectionToDestroy = null) {
  const current =
    connectionToDestroy || voice.connection;

  if (!current) {
    return;
  }

  if (voice.connection === current) {
    voice.connection = null;
  }

  try {
    current.destroy();
  } catch {}
}

// =====================================================
// VOICE HANDLERS
// =====================================================

function attachHandlers(connection) {
  connection.on(
    "stateChange",
    (oldState, newState) => {
      log(
        "[VOICE] " +
          oldState.status +
          " -> " +
          newState.status
      );
    }
  );

  connection.on("error", (error) => {
    if (voice.connection !== connection) {
      return;
    }

    logError(
      "[VOICE] Connection error:",
      error
    );

    destroyConnection(connection);

    scheduleReconnect(
      "voice connection error",
      10000
    );
  });

  connection.on(
    VoiceConnectionStatus.Disconnected,
    async () => {
      if (voice.connection !== connection) {
        return;
      }

      log(
        "[VOICE] Bot terputus dari VC."
      );

      try {
        await Promise.race([
          entersState(
            connection,
            VoiceConnectionStatus.Signalling,
            5000
          ),
          entersState(
            connection,
            VoiceConnectionStatus.Connecting,
            5000
          ),
        ]);

        if (voice.connection !== connection) {
          return;
        }

        log(
          "[VOICE] Koneksi sedang mencoba pulih..."
        );

      } catch {
        if (voice.connection !== connection) {
          return;
        }

        log(
          "[VOICE] Koneksi tidak pulih. Reconnect."
        );

        destroyConnection(connection);

        scheduleReconnect(
          "disconnected",
          5000
        );
      }
    }
  );

  connection.on(
    VoiceConnectionStatus.Destroyed,
    () => {
      if (voice.connection !== connection) {
        return;
      }

      voice.connection = null;

      scheduleReconnect(
        "connection destroyed",
        10000
      );
    }
  );
}

// =====================================================
// CONNECT TO VC
// =====================================================

async function connectToVC() {
  if (voice.connecting || shuttingDown) {
    return;
  }

  voice.connecting = true;

  let newConnection = null;

  try {
    const guild =
      client.guilds.cache.get(GUILD_ID);

    if (!guild) {
      throw new Error(
        "Guild tidak ditemukan: " +
          GUILD_ID
      );
    }

    log(
      "[DISCORD] Server ditemukan: " +
        guild.name
    );

    let channel =
      guild.channels.cache.get(
        CHANNEL_ID
      );

    if (!channel) {
      channel =
        await guild.channels
          .fetch(CHANNEL_ID)
          .catch(() => null);
    }

    if (!channel) {
      throw new Error(
        "Voice channel tidak ditemukan: " +
          CHANNEL_ID
      );
    }

    if (!channel.isVoiceBased()) {
      throw new Error(
        "CHANNEL_ID bukan voice channel."
      );
    }

    log(
      "[DISCORD] Channel ditemukan: " +
        channel.name
    );

    // =================================================
    // PERMISSION CHECK
    // =================================================

    const me = guild.members.me;

    const permissions =
      me
        ? channel.permissionsFor(me)
        : null;

    if (
      permissions &&
      !permissions.has(
        PermissionFlagsBits.ViewChannel
      )
    ) {
      throw new Error(
        "Bot tidak punya permission View Channel."
      );
    }

    if (
      permissions &&
      !permissions.has(
        PermissionFlagsBits.Connect
      )
    ) {
      throw new Error(
        "Bot tidak punya permission Connect."
      );
    }

    // =================================================
    // CEK KONEKSI LAMA
    // =================================================

    const existing =
      getVoiceConnection(GUILD_ID);

    if (existing) {
      if (
        existing.state.status ===
        VoiceConnectionStatus.Ready
      ) {
        const currentChannelId =
          me?.voice?.channelId;

        if (
          currentChannelId === CHANNEL_ID
        ) {
          log(
            "[VOICE] Bot sudah berada di VC."
          );

          voice.connection = existing;
          voice.connecting = false;
          voice.attempt = 0;

          return;
        }
      }

      destroyConnection(existing);
    }

    // =================================================
    // JOIN VC
    // =================================================

    log(
      "[VOICE] Menghubungkan ke VC..."
    );

    newConnection =
      joinVoiceChannel({
        channelId: CHANNEL_ID,
        guildId: GUILD_ID,
        adapterCreator:
          guild.voiceAdapterCreator,

        // Bot AFK tidak perlu menerima audio
        selfDeaf: true,

        // Bot juga tidak mengirim audio
        selfMute: true,
      });

    voice.connection =
      newConnection;

    attachHandlers(
      newConnection
    );

    // =================================================
    // WAIT READY
    // =================================================

    await entersState(
      newConnection,
      VoiceConnectionStatus.Ready,
      120000
    );

    if (
      voice.connection !==
      newConnection
    ) {
      return;
    }

    voice.attempt = 0;

    log(
      "========================================"
    );

    log(
      "[VOICE] BOT BERHASIL MASUK VC"
    );

    log(
      "[VOICE] Server : " +
        guild.name
    );

    log(
      "[VOICE] Channel: " +
        channel.name
    );

    log(
      "[VOICE] Status  : STANDBY 24/7"
    );

    log(
      "========================================"
    );

  } catch (error) {
    logError(
      "[VOICE] Gagal masuk VC:",
      error
    );

    if (
      newConnection &&
      voice.connection ===
        newConnection
    ) {
      destroyConnection(
        newConnection
      );
    }

    scheduleReconnect(
      "gagal connect",
      10000
    );

  } finally {
    voice.connecting = false;
  }
}

// =====================================================
// WATCHDOG
// =====================================================

function watchdog() {
  if (
    shuttingDown ||
    voice.connecting ||
    voice.reconnectTimer
  ) {
    return;
  }

  const guild =
    client.guilds.cache.get(
      GUILD_ID
    );

  if (!guild) {
    return;
  }

  const connection =
    getVoiceConnection(
      GUILD_ID
    );

  const me =
    guild.members.me;

  const currentChannelId =
    me?.voice?.channelId;

  const status =
    connection?.state?.status;

  const noConnection =
    !connection ||
    status ===
      VoiceConnectionStatus.Destroyed;

  const wrongChannel =
    status ===
      VoiceConnectionStatus.Ready &&
    currentChannelId &&
    currentChannelId !==
      CHANNEL_ID;

  if (
    noConnection ||
    wrongChannel
  ) {
    log(
      "[WATCHDOG] Koneksi VC tidak sehat. Reconnect."
    );

    connectToVC();
  }
}

// =====================================================
// BOT VOICE STATE UPDATE
// =====================================================

client.on(
  "voiceStateUpdate",
  (oldState, newState) => {
    if (
      newState.id !==
      client.user?.id
    ) {
      return;
    }

    if (
      newState.channelId !==
      CHANNEL_ID
    ) {
      log(
        "[VOICE] Bot tidak berada di channel target."
      );

      setTimeout(
        watchdog,
        3000
      );
    }
  }
);

// =====================================================
// READY
// =====================================================

let booted = false;

client.once(
  "clientReady",
  async () => {
    if (booted) {
      return;
    }

    booted = true;

    log(
      "========================================"
    );

    log(
      "[DISCORD] Online sebagai " +
        client.user.tag
    );

    log(
      "[DISCORD] Client READY"
    );

    log(
      "========================================"
    );

    await connectToVC();

    setInterval(
      watchdog,
      60000
    );
  }
);

// =====================================================
// ERROR HANDLING
// =====================================================

client.on(
  "error",
  (error) => {
    logError(
      "[DISCORD] Client error:",
      error
    );
  }
);

client.on(
  "shardError",
  (error) => {
    logError(
      "[DISCORD] Shard error:",
      error
    );
  }
);

process.on(
  "unhandledRejection",
  (error) => {
    logError(
      "[ERROR] Unhandled rejection:",
      error
    );
  }
);

process.on(
  "uncaughtException",
  (error) => {
    logError(
      "[ERROR] Uncaught exception:",
      error
    );
  }
);

// =====================================================
// SHUTDOWN
// =====================================================

async function shutdown(signal) {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;

  log(
    "[BOOT] " +
      signal +
      " diterima. Shutdown..."
  );

  if (voice.reconnectTimer) {
    clearTimeout(
      voice.reconnectTimer
    );

    voice.reconnectTimer =
      null;
  }

  destroyConnection();

  try {
    await client.destroy();
  } catch {}

  process.exit(0);
}

process.on(
  "SIGTERM",
  () => shutdown("SIGTERM")
);

process.on(
  "SIGINT",
  () => shutdown("SIGINT")
);

// =====================================================
// LOGIN
// =====================================================

log(
  "Aeden sedang dinyalakan..."
);

client
  .login(TOKEN)
  .then(() => {
    log(
      "[DISCORD] Login berhasil."
    );
  })
  .catch((error) => {
    const message =
      sanitize(error);

    if (
      /token/i.test(message)
    ) {
      logError(
        "[DISCORD] Login gagal: TOKEN tidak valid."
      );
    } else {
      logError(
        "[DISCORD] Login gagal:",
        message
      );
    }

    process.exit(1);
  });
