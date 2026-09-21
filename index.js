const express = require('express');
const app = express();

// سيرفر ويب مصغر لإبقاء البوت أونلاين
app.get('/', (req, res) => res.send('Bot is active and running!'));
app.listen(process.env.PORT || 3000, () => {
    console.log("🌐 HTTP Server running to keep bot online.");
});

const { Client, GatewayIntentBits } = require("discord.js");
const fs = require("fs");

// منع كراش البوت عند أي خطأ مفاجئ
process.on("uncaughtException", (err) => {
    console.error("⚠️ خطأ غير متوقع:", err);
});

process.on("unhandledRejection", (reason, promise) => {
    console.error("⚠️ رفض غير معالج:", reason);
});

// ========================================
// الإعدادات الرئيسية
// ========================================
const TOKEN = process.env.TOKEN;

const STAFF_ROLE_ID = "1532531348408107039";
const OWNER_ROLE_ID = "1536295568589062174";
const BOT_OWNER_ID = "1381660062790979587";
const JAIL_ROLE_ID = "1541170009949347880";

const JAIL_DATA_FILE = "./jail.json";

// ========================================
// التعامل مع ملف قاعدة البيانات jail.json
// ========================================
if (!fs.existsSync(JAIL_DATA_FILE)) {
    fs.writeFileSync(JAIL_DATA_FILE, JSON.stringify({}, null, 2));
}

function loadJailData() {
    try {
        return JSON.parse(fs.readFileSync(JAIL_DATA_FILE, "utf8"));
    } catch {
        return {};
    }
}

function saveJailData(data) {
    fs.writeFileSync(JAIL_DATA_FILE, JSON.stringify(data, null, 2));
}

// ========================================
// إنشاء البوت وتحديد الصلاحيات
// ========================================
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

client.once("clientReady", () => {
    console.log(`✅ البوت متصل الآن بنجاح باسم: ${client.user.tag}`);
});

function getPowerLevel(member) {
    if (member.id === BOT_OWNER_ID) return 3;
    if (member.roles.cache.has(OWNER_ROLE_ID)) return 2;
    if (member.roles.cache.has(STAFF_ROLE_ID)) return 1;
    return 0;
}

function canUseJail(member) {
    return getPowerLevel(member) >= 1;
}

// دالة جلب العضو المحدثة والمضمونة (تتعرف على المنشن والـ ID مباشرة)
async function getTargetMember(message) {
    // 1. البحث عبر المنشن الصريح
    if (message.mentions.members && message.mentions.members.size > 0) {
        return message.mentions.members.first();
    }

    // 2. البحث عن الـ ID داخل نص الرسالة واستخراجه
    const match = message.content.match(/\d{17,20}/);
    if (match) {
        const targetId = match[0];
        try {
            return await message.guild.members.fetch(targetId);
        } catch (e) {
            console.error("لم يتم العثور على العضو بالـ ID:", targetId);
            return null;
        }
    }

    return null;
}

// ========================================
// الأحداث والأوامر (سجن / حرية)
// ========================================
client.on("messageCreate", async (message) => {
    if (message.author.bot || !message.guild) return;

    const content = message.content.trim();

    // ----------------------------------------
    // أمر السجن
    // ----------------------------------------
    if (content.startsWith("سجن")) {
        if (!canUseJail(message.member)) return;

        const member = await getTargetMember(message);
        if (!member) {
            return message.reply("❌ اكتب ID الصحيح للشخص أو سو له منشن!");
        }

        if (member.user.bot) return message.reply("❌ ما تقدر تسجن البوتات");
        if (member.id === message.author.id) return message.reply("❌ ما تقدر تسجن نفسك");

        // استثناءات الحماية الخاصة
        if (member.id === BOT_OWNER_ID) return message.reply("بدري عليك تسجن رماد يا حمار 😎");
        if (member.id === message.guild.ownerId) return message.reply("من جدك انت ؟ ");
        if (member.id === "1133082717777576089") return message.reply("قم انقلع تسجن حسنة الجميع تخسي");
        if (member.id === "1412618243461480489") return message.reply("تبي تسجن الملكه محروم");
        if (member.roles.cache.has(OWNER_ROLE_ID)) return message.reply("تسوقها؟ ذا Owner اقلب وجهك 😂");

        const isOwner = message.author.id === message.guild.ownerId;
        const isTargetAdmin = member.permissions.has("Administrator");

        if (!isOwner) {
            if (isTargetAdmin) return message.reply("❌ لا يمكنك سجن هذا الشخص لأنه إداري!");
            if (member.roles.highest.position >= message.member.roles.highest.position) {
                return message.reply("❌ لا يمكنك سجن شخص رتبته أعلى منك أو تساؤيك!");
            }
        }

        const executorPower = getPowerLevel(message.member);
        const targetPower = getPowerLevel(member);

        if (executorPower === 1 && targetPower >= 1) {
            return message.reply("❌ ما تقدر تسجن شخص عنده نفس رتبتك أو أعلى منك");
        }

        const jailRole = message.guild.roles.cache.get(JAIL_ROLE_ID);
        if (!jailRole) return message.reply("❌ ما لقيت رتبة السجن، تأكد من الـID في الإعدادات");
        if (member.roles.cache.has(JAIL_ROLE_ID)) return message.reply("❌ هذا الشخص مسجون بالفعل");

        // حفظ الرتب
        const jailData = loadJailData();
        const oldRoles = member.roles.cache
            .filter(role => role.id !== message.guild.id && role.id !== JAIL_ROLE_ID && !role.managed)
            .map(role => role.id);

        jailData[member.id] = {
            roles: oldRoles,
            jailedBy: message.author.id,
            jailedAt: Date.now()
        };
        saveJailData(jailData);

        const processingMessage = await message.reply("⏳ ...جاري سجن العضو");

        try {
            // سحب الرتب الممكنة حبة حبة لمنع التعليق
            for (const roleId of oldRoles) {
                const roleObj = message.guild.roles.cache.get(roleId);
                if (roleObj && roleObj.position < message.guild.members.me.roles.highest.position) {
                    await member.roles.remove(roleObj).catch(() => {});
                }
            }

            await member.roles.add(jailRole);
            await processingMessage.edit(`✅ تم سجن العضو ${member}`);

        } catch (error) {
            console.error("خطأ أثناء السجن:", error);
            await processingMessage.edit("❌ حدث خطأ أثناء تنفيذ السجن (تأكد أن رتبة البوت أعلى من رتبة العضو ورتبة السجن).");
        }
    }

    // ----------------------------------------
    // أمر فك السجن
    // ----------------------------------------
    if (content.startsWith("حرية") || content.startsWith("حريه")) {
        if (!canUseJail(message.member)) return;

        const member = await getTargetMember(message);
        if (!member) return message.reply("❌ اكتب ID الصحيح للشخص أو سو له منشن!");
        if (member.user.bot) return message.reply("❌ نظام السجن مخصص للأعضاء فقط");

        const jailRole = message.guild.roles.cache.get(JAIL_ROLE_ID);
        if (!jailRole) return message.reply("❌ ما لقيت رتبة السجن");
        if (!member.roles.cache.has(JAIL_ROLE_ID)) return message.reply("❌ هذا الشخص مو مسجون");

        const jailData = loadJailData();
        const savedData = jailData[member.id];

        const processingMessage = await message.reply("⏳ جاري فك السجن واسترجاع الرتب...");

        try {
            await member.roles.remove([jailRole, JAIL_ROLE_ID]).catch(() => {});

            if (savedData && savedData.roles) {
                for (const roleId of savedData.roles) {
                    const roleObj = message.guild.roles.cache.get(roleId);
                    if (roleObj && !roleObj.managed && roleObj.position < message.guild.members.me.roles.highest.position) {
                        await member.roles.add(roleObj).catch(() => {});
                    }
                }
                delete jailData[member.id];
                saveJailData(jailData);
            }

            await processingMessage.edit(`تم تحرير ${member}`);

        } catch (error) {
            console.error("❌ خطأ أثناء فك السجن:", error);
            await processingMessage.edit("❌ صار خطأ أثناء فك السجن");
        }
    }
});

// ========================================
// تشغيل البوت
// ========================================
if (!TOKEN) {
    console.error("❌ خطأ: لم يتم العثور على TOKEN!");
} else {
    client.login(TOKEN).catch(err => {
        console.error("❌ فشل تسجيل الدخول:", err);
    });
}