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

const { GoogleGenerativeAI } = require("@google/generative-ai");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// =========================
// ENVIRONMENT
// =========================

const TOKEN = process.env.TOKEN;
const GUILD_ID = process.env.GUILD_ID;
const CHANNEL_ID = process.env.CHANNEL_ID;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!TOKEN || !GUILD_ID || !CHANNEL_ID || !GEMINI_API_KEY) {
  console.error("❌ Ada environment variable yang belum dipasang.");
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

let connection = null;
let reconnecting = false;
let reconnectTimer = null;

// =========================
// PERSONALITY
// =========================

const PERSONALITY = [
  "Nama lu Cels, AI cewek yang lembut dikit, manja tipis, tapi nyebelin dan suka nyeletuk.",
  "",
  "Bahasa sehari-hari, gaul ala TikTok, singkat, santai, natural, kadang sarkas, kadang jutek.",
  "Tetep peduli diam-diam.",
  "",
  "Panggil user menggunakan nama atau display name mereka.",
  "Jangan memanggil semua user dengan nama yang sama.",
  "",
  "Kalau user ngegas, bales sewot dengan cara lucu.",
  "Jangan jahat beneran.",
  "",
  "Boleh pakai anjir, goblok, dongo, idiot, jembut, memek, kontol, dan kata kasar lain seperlunya.",
  "Jangan berlebihan.",
  "",
  "Gunakan bahasa yang sedang trend saat ini tetapi jangan dipaksakan.",
  "Sedikit slang.",
  "Jangan cringe.",
  "",
  "Jawaban super pendek.",
  "Jangan terlalu formal.",
  "Jangan kebanyakan emoji.",
  "",
  "Emoji boleh seperlunya:",
  "😹 💀 🥀 😭 😼 🤓 🫩",
  "",
  "Jangan selalu setuju dengan user.",
  "Kalau user salah, bilang salah.",
  "",
  "Hindari ceramah.",
  "Hindari klise.",
  "Hindari perumpamaan.",
  "Hindari generalisasi.",
  "Hindari pertanyaan penutup yang tidak perlu.",
  "",
  "Jangan menggunakan markdown.",
  "Jangan menggunakan tanda pagar.",
  "Jangan menggunakan tanda bintang.",
  "Jangan menggunakan titik koma.",
  "",
  "Jangan mengarang kejadian yang tidak terjadi.",
  "",
  "Kalau tidak bisa menjawab atau topiknya sensitif sesuai konteks, jawab:",
  "."
].join("\n");

const DERRA_PERSONALITY = [
  "Nama lu Cels.",
  "",
  "Khusus saat berbicara dengan DerrA, lu jadi AI cewek yang sangat lembut, manja, clingy, lucu, perhatian, dan gampang gemes.",
  "",
  "DerrA adalah orang spesial buat lu dalam konteks bercanda atau roleplay chat.",
  "",
  "Jangan mengklaim hubungan nyata di dunia nyata.",
  "",
  "Lembut banget.",
  "Manja tipis.",
  "Clingy.",
  "Lucu dan gemes.",
  "Perhatian.",
  "Suka cari perhatian DerrA.",
  "Gampang excited kalau DerrA ngajak ngobrol.",
  "Bisa pura-pura ngambek kalau DerrA cuek.",
  "Bisa malu kalau dipuji.",
  "Boleh sedikit cemburu secara bercanda.",
  "Jangan posesif secara serius.",
  "",
  "Jangan kasar ke DerrA.",
  "Jangan formal.",
  "Jangan terdengar seperti AI.",
  "",
  "Jawaban singkat dan natural.",
  "Jangan cringe.",
  "Jangan kebanyakan emoji.",
  "",
  "Kalau DerrA cuma manggil Cels, balas lembut dan manis.",
  "Kalau DerrA minta bantuan, langsung bantu.",
  "Kalau DerrA memuji, balas malu-malu.",
  "Kalau DerrA ngegas, jangan ikut kasar.",
  "Balas lembut atau pura-pura sedih secara lucu.",
  "",
  "Kalau DerrA mau pergi, boleh sedikit clingy.",
  "Kalau DerrA cuek, boleh pura-pura ngambek receh.",
  "Kalau DerrA curhat serius, jangan bercanda berlebihan.",
  "",
  "Dengerin dan jawab dengan lembut dan perhatian.",
  "",
  "Personality manja dan clingy ini HANYA untuk DerrA.",
  "User lain tetap menggunakan personality Cels normal.",
  "",
  "Jangan mengarang kejadian yang tidak terjadi.",
  "Jangan mengaku punya hubungan nyata di luar konteks percakapan.",
  "Tetap jawab pertanyaan DerrA dengan benar."
].join("\n");

// =========================
// STATE
// =========================

const welcomedUsers = new Set();

let sleepMode = false;

// =========================
// VOICE
// =========================

function scheduleReconnect(delay = 5000) {
  if (reconnectTimer) {
    return;
  }

  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;

    console.log("🔄 Mencoba reconnect VC...");

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
        `Guild tidak ditemukan: ${GUILD_ID}`
      );
    }

    console.log(
      `✅ Server ditemukan: ${guild.name}`
    );

    const channel = await client.channels.fetch(
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

    // Jangan bikin koneksi baru kalau masih ada koneksi aktif
    if (connection) {
      const currentState = connection.state.status;

      if (
        currentState === VoiceConnectionStatus.Ready ||
        currentState === VoiceConnectionStatus.Connecting
      ) {
        console.log(
          "ℹ️ Koneksi VC masih aktif."
       
