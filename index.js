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
// ENV
// =====================================================

const TOKEN = (process.env.TOKEN || "").trim();
const GUILD_ID = (process.env.GUILD_ID || "").trim();
const CHANNEL_ID = (process.env.CHANNEL_ID || "").trim();

function sanitize(value) {
  let text =
    typeof value === "string"
      ? value
      : value?.message || String(value);

  if (TOKEN) {
    text = text.replaceAll(TOKEN, "[REDACTED]");
  }

  return text;
}

function log(...args) {
  console.log(...args.map(sanitize));
}

function error(...args) {
  console.error(...args.map(sanitize));
}

// =====================================================
// ENV CHECK
// =====================================================

const missing = [];

if (!TOKEN) missing.push("TOKEN");
if (!GUILD_ID) missing.push("GUILD_ID");
if (!CHANNEL_ID) missing.push("CHANNEL_ID");

if (missing.length) {
  error(
    "[BOOT] Environment variable belum dipasang:",
    missing.join(", ")
  );

  process.exit(1);
}

if (
  !/^\d{17,20}$/.test(GUILD_ID) ||
  !/^\d{17,20}$/.test(CHANNEL_ID)
) {
  error(
    "[BOOT] GUILD_ID / CHANNEL_ID tidak valid."
  );

  process.exit(1);
}

// =====================================================
// DISCORD
// =====================================================

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
  ],
});

// =====================================================
// VOICE STATE
// =====================================================

let connection = null;
let connecting = false;
let reconnectTimer = null;
let shuttingDown = false;

let reconnectAttempt = 0;

// =====================================================
// RECONNECT
// =====================================================

function scheduleReconnect(reason, delay = 10000) {
  if (shuttingDown) return;
  if (reconnectTimer) return;
  if (connecting) return;

  reconnectAttempt++;

  const maxDelay = 5 * 60 * 1000;

  const actualDelay = Math.min(
    delay * Math.pow(2, reconnectAttempt - 1),
    maxDelay
  );

  log(
    `[VOICE] Reconnect #${reconnectAttempt} dalam ${Math.round(
      actualDelay / 1000
    )} detik (${reason})`
  );

  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connectToVC();
  }, actualDelay);
}

// =====================================================
// DESTROY
// =====================================================

function destroyConnection() {
  const current = connection;

  connection = null;

  if (current) {
    try {
      current.destroy();
    } catch {}
  }
}

// =====================================================
// VOICE ERROR HANDLERS
// =====================================================

function setupConnection(connectionInstance) {
  connectionInstance.on(
    "stateChange",
    (oldState, newState) => {
      log(
        `[VOICE] ${oldState.status} -> ${newState.status}`
      );
    }
  );

  connectionInstance.on(
    "error",
    (err) => {
      if (
        connection !== connectionInstance
      ) {
        return;
      }

      error(
        "[VOICE] Voice error:",
        err.message
      );

      destroyConnection();

      scheduleReconnect(
        "voice error",
        10000
      );
    }
  );

  connectionInstance.on(
    VoiceConnectionStatus.Disconnected,
    async () => {
      if (
        connection !== connectionInstance
      ) {
        return;
      }

      log(
        "[VOICE] Voice disconnected."
      );

      try {
        await Promise.race([
          entersState(
            connectionInstance,
            VoiceConnectionStatus.Signalling,
            5000
          ),
          entersState(
            connectionInstance,
            VoiceConnectionStatus.Connecting,
            5000
          ),
        ]);

        log(
          "[VOICE] Discord sedang memulihkan koneksi..."
        );

      } catch {
        if (
          connection !== connectionInstance
        ) {
          return;
        }

        log(
          "[VOICE] Pemulihan gagal. Reconnect."
        );

        destroyConnection();

        scheduleReconnect(
          "disconnected",
          10000
        );
      }
    }
  );

  connectionInstance.on(
    VoiceConnectionStatus.Destroyed,
    () => {
      if (
        connection !== connectionInstance
      ) {
        return;
      }

      connection = null;

      scheduleReconnect(
        "destroyed",
        10000
      );
    }
  );
}

// =====================================================
// CONNECT
// =====================================================

async function connectToVC() {
  if (shuttingDown) return;
  if (connecting) return;

  connecting = true;

  try {
    const guild =
      client.guilds.cache.get(GUILD_ID);

    if (!guild) {
      throw new Error(
        `Server tidak ditemukan: ${GUILD_ID}`
      );
    }

    log(
      `[DISCORD] Server ditemukan: ${guild.name}`
    );

    const channel =
      await guild.channels
        .fetch(CHANNEL_ID)
        .catch(() => null);

    if (!channel) {
      throw new Error(
        `Channel tidak ditemukan: ${CHANNEL_ID}`
      );
    }

    if (!channel.isVoiceBased()) {
      throw new Error(
        "CHANNEL_ID bukan voice channel."
      );
    }

    log(
      `[DISCORD] Channel target: ${channel.name}`
    );

    // =================================================
    // PERMISSION
    // =================================================

    const me = guild.members.me;

    if (me) {
      const permissions =
        channel.permissionsFor(me);

      if (
        permissions &&
        !permissions.has(
          PermissionFlagsBits.ViewChannel
        )
      ) {
        throw new Error(
          "Bot tidak punya View Channel."
        );
      }

      if (
        permissions &&
        !permissions.has(
          PermissionFlagsBits.Connect
        )
      ) {
        throw new Error(
          "Bot tidak punya Connect."
        );
      }
    }

    // =================================================
    // CEK POSISI BOT
    // =================================================

    const currentChannelId =
      me?.voice?.channelId;

    if (
      currentChannelId === CHANNEL_ID
    ) {
      log(
        `[VOICE] Bot sudah berada di channel target: ${channel.name}`
      );

      const existing =
        getVoiceConnection(GUILD_ID);

      if (existing) {
        connection = existing;
      }

      reconnectAttempt = 0;

      return;
    }

    // =================================================
    // KALAU ADA KONEKSI LAMA
    // =================================================

    const existing =
      getVoiceConnection(GUILD_ID);

    if (existing) {
      log(
        "[VOICE] Membersihkan koneksi voice lama..."
      );

      try {
        existing.destroy();
      } catch {}

      if (connection === existing) {
        connection = null;
      }
    }

    // =================================================
    // JOIN TARGET
    // =================================================

    log(
      `[VOICE] Join ke: ${channel.name}`
    );

    const newConnection =
      joinVoiceChannel({
        channelId: CHANNEL_ID,
        guildId: GUILD_ID,
        adapterCreator:
          guild.voiceAdapterCreator,

        selfDeaf: true,
        selfMute: true,
      });

    connection =
      newConnection;

    setupConnection(
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
      connection !== newConnection
    ) {
      return;
    }

    reconnectAttempt = 0;

    log(
      "========================================"
    );

    log(
      `[VOICE] BERHASIL MASUK: ${channel.name}`
    );

    log(
      "[VOICE] Status: STANDBY 24/7"
    );

    log(
      "========================================"
    );

  } catch (err) {
    error(
      "[VOICE] Gagal masuk VC:",
      err.message
    );

    if (connection) {
      try {
        connection.destroy();
      } catch {}

      connection = null;
    }

    scheduleReconnect(
      "gagal connect",
      10000
    );

  } finally {
    connecting = false;
  }
}

// =====================================================
// VOICE STATE UPDATE
// =====================================================

client.on(
  "voiceStateUpdate",
  (oldState, newState) => {

    // HANYA pantau perubahan voice milik bot
    if (
      newState.id !==
      client.user?.id
    ) {
      return;
    }

    const newChannel =
      newState.channelId;

    // Bot masuk channel target
    if (
      newChannel === CHANNEL_ID
    ) {
      log(
        "[VOICE] Bot berada di channel target."
      );

      return;
    }

    // Jangan langsung reconnect.
    // Discord kadang mengirim event transisi
    // ketika proses join masih berlangsung.
    if (connecting) {
      return;
    }

    // Bot benar-benar berada di channel lain
    if (newChannel) {
      log(
        `[VOICE] Bot berada di channel lain (${newChannel}).`
      );

      return;
    }

    // Bot benar-benar disconnected
    if (!newChannel) {
      log(
        "[VOICE] Bot disconnected dari voice."
      );

      scheduleReconnect(
        "bot disconnected",
        10000
      );
    }
  }
);

// =====================================================
// READY
// =====================================================

client.once(
  "clientReady",
  async () => {

    log(
      "========================================"
    );

    log(
      `[DISCORD] Online sebagai ${client.user.tag}`
    );

    log(
      `[DISCORD] Server ID : ${GUILD_ID}`
    );

    log(
      `[DISCORD] Channel ID: ${CHANNEL_ID}`
    );

    log(
      "========================================"
    );

    await connectToVC();
  }
);

// =====================================================
// DISCORD ERRORS
// =====================================================

client.on(
  "error",
  (err) => {
    error(
      "[DISCORD] Client error:",
      err.message
    );
  }
);

client.on(
  "shardError",
  (err) => {
    error(
      "[DISCORD] Shard error:",
      err.message
    );
  }
);

// =====================================================
// PROCESS ERRORS
// =====================================================

process.on(
  "unhandledRejection",
  (err) => {
    error(
      "[ERROR] Unhandled rejection:",
      err
    );
  }
);

process.on(
  "uncaughtException",
  (err) => {
    error(
      "[ERROR] Uncaught exception:",
      err
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
    `[BOOT] ${signal} diterima.`
  );

  if (reconnectTimer) {
    clearTimeout(
      reconnectTimer
    );

    reconnectTimer = null;
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
  .catch((err) => {
    const message =
      sanitize(err);

    if (
      /token/i.test(message)
    ) {
      error(
        "[DISCORD] Login gagal: TOKEN tidak valid."
      );
    } else {
      error(
        "[DISCORD] Login gagal:",
        message
      );
    }

    process.exit(1);
  });
