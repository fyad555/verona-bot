const express = require('express');
const app = express();
app.get('/', (req, res) => res.send('Bot is active!'));
app.listen(process.env.PORT || 3000);

const {
    Client,
    GatewayIntentBits
} = require("discord.js");

const fs = require("fs");

// ========================================
// الإعدادات
// ========================================

const TOKEN = process.env.TOKEN;

const STAFF_ROLE_ID = "1532531348408107039";
const OWNER_ROLE_ID = "1536295568589062174";
const BOT_OWNER_ID = "1381660062790979587";
const JAIL_ROLE_ID = "1541170009949347880";

const JAIL_DATA_FILE = "./jail.json";

// ========================================
// إنشاء ملف البيانات
// ========================================

if (!fs.existsSync(JAIL_DATA_FILE)) {
    fs.writeFileSync(
        JAIL_DATA_FILE,
        JSON.stringify({}, null, 2)
    );
}

// ========================================
// قراءة البيانات
// ========================================

function loadJailData() {
    try {
        return JSON.parse(
            fs.readFileSync(JAIL_DATA_FILE, "utf8")
        );
    } catch {
        return {};
    }
}

// ========================================
// حفظ البيانات
// ========================================

function saveJailData(data) {
    fs.writeFileSync(
        JAIL_DATA_FILE,
        JSON.stringify(data, null, 2)
    );
}

// ========================================
// إنشاء البوت
// ========================================

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

// ========================================
// البوت جاهز
// ========================================

client.once("clientReady", () => {
    console.log(`✅ البوت اشتغل: ${client.user.tag}`);
});

// ========================================
// مستوى الصلاحية
// ========================================

function getPowerLevel(member) {
    if (member.id === BOT_OWNER_ID) {
        return 3;
    }

    if (member.roles.cache.has(OWNER_ROLE_ID)) {
        return 2;
    }

    if (member.roles.cache.has(STAFF_ROLE_ID)) {
        return 1;
    }

    return 0;
}

// ========================================
// هل يقدر يستخدم السجن؟
// ========================================

function canUseJail(member) {
    return getPowerLevel(member) >= 1;
}

// ========================================
// الحصول على العضو من المنشن أو الـID
// ========================================

async function getTargetMember(message) {
    const mentionedMember = message.mentions.members.first();

    if (mentionedMember) {
        return mentionedMember;
    }

    const args = message.content.trim().split(/\s+/);
    const targetId = args[1];

    if (!targetId) {
        return null;
    }

    if (!/^\d{17,20}$/.test(targetId)) {
        return null;
    }

    try {
        const member = await message.guild.members.fetch(targetId);
        return member;
    } catch {
        return null;
    }
}

// ========================================
// استقبال الأوامر
// ========================================

client.on("messageCreate", async (message) => {

    if (message.author.bot) return;
    if (!message.guild) return;

    // ========================================
    // أمر السجن
    // ========================================

    if (message.content.startsWith("سجن")) {

        if (!canUseJail(message.member)) return;

        const member = await getTargetMember(message);

        if (!member) {
            return message.reply("❌ منشن الشخص أو حط ID صحيح للعضو");
        }

        if (member.user.bot) {
            return message.reply("❌ ما تقدر تسجن البوتات");
        }

        if (member.id === message.author.id) {
            return message.reply("❌ ما تقدر تسجن نفسك");
        }

        if (member.id === BOT_OWNER_ID) {
            return message.reply("بدري عليك تسجن رماد يا حمار 😎");
        }

        if (member.id === message.guild.ownerId) {
            return message.reply("من جدك انت ؟ ");
        }

        if (member.roles.cache.has(OWNER_ROLE_ID)) {
            return message.reply("تسوقها؟ ذا Owner اقلب وجهك 😂");
        }

        const isOwner = message.author.id === message.guild.ownerId;
        const isTargetAdmin = member.permissions.has("Administrator");

        if (!isOwner) {
            if (isTargetAdmin) {
                return message.reply("❌ لا يمكنك سجن هذا الشخص لأنه إداري!");
            }
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

        if (!jailRole) {
            return message.reply("❌ ما لقيت رتبة السجن، تأكد من الـID");
        }

        if (member.roles.cache.has(JAIL_ROLE_ID)) {
            return message.reply("❌ هذا الشخص مسجون بالفعل");
        }

        if (!member.manageable) {
            return message.reply("❌ ما أقدر أعدل رتب هذا الشخص، تأكد أن رتبة البوت أعلى منه");
        }

        if (jailRole.position >= message.guild.members.me.roles.highest.position) {
            return message.reply("❌ رتبة السجن أعلى من رتبة البوت");
        }

        const jailData = loadJailData();

        const oldRoles = member.roles.cache
            .filter(role => role.id !== message.guild.id)
            .filter(role => role.id !== JAIL_ROLE_ID)
            .filter(role => !role.managed)
            .map(role => role.id);

        jailData[member.id] = {
            roles: oldRoles,
            jailedBy: message.author.id,
            jailedAt: Date.now()
        };
        saveJailData(jailData);

        const processingMessage = await message.reply("⏳ ...جاري سجن العضو");

        try {
            const rolesToRemove = member.roles.cache.filter(role => 
                role.id !== message.guild.id && 
                !role.managed
            );
            await member.roles.remove(rolesToRemove);
            await member.roles.add(jailRole);

            await processingMessage.edit(`✅ تم سجن العضو ${member}`);

        } catch (error) {
            console.error("خطأ أثناء السجن:", error);

            try {
                await member.roles.add(oldRoles);
                delete jailData[member.id];
                saveJailData(jailData);
            } catch (restoreError) {
                console.error("❌ فشل استرجاع الرتب:", restoreError);
            }

            await processingMessage.edit("❌ صار خطأ أثناء السجن وتمت محاولة استرجاع رتب العضو");
        }
    }

    // ========================================
    // أمر فك السجن
    // ========================================

    if (message.content.startsWith("حرية") || message.content.startsWith("حريه")) {

        if (!canUseJail(message.member)) return;

        const member = await getTargetMember(message);

        if (!member) {
            return message.reply("❌ منشن الشخص أو حط ID صحيح للعضو");
        }

        if (member.user.bot) {
            return message.reply("❌ نظام السجن مخصص للأعضاء فقط");
        }

        const jailRole = message.guild.roles.cache.get(JAIL_ROLE_ID);

        if (!jailRole) {
            return message.reply("❌ ما لقيت رتبة السجن");
        }

        if (!member.roles.cache.has(JAIL_ROLE_ID)) {
            return message.reply("❌ هذا الشخص مو مسجون");
        }

        if (!member.manageable) {
            return message.reply("❌ ما أقدر أعدل رتب هذا الشخص");
        }

        const jailData = loadJailData();
        const savedData = jailData[member.id];

        if (!savedData || !savedData.roles) {
            return message.reply("❌ ما لقيت الرتب المحفوظة لهذا الشخص");
        }

        const processingMessage = await message.reply("⏳ جاري فك السجن واسترجاع الرتب...");

        try {
            await member.roles.remove([jailRole, JAIL_ROLE_ID]).catch(() => {});

            const validRolesToAdd = savedData.roles
                .map(roleId => message.guild.roles.cache.get(roleId))
                .filter(role => role && !role.managed && role.id !== JAIL_ROLE_ID && role.position < message.guild.members.me.roles.highest.position)
                .map(role => role.id);
            
            if (validRolesToAdd.length > 0) {
                await member.roles.add(validRolesToAdd);
            }

            delete jailData[member.id];
            saveJailData(jailData);

            await processingMessage.edit(`تم تحرير ${member}\nاضحك كليوم`);

        } catch (error) {
            console.error("❌ خطأ أثناء فك السجن:", error);
            await processingMessage.edit("❌ صار خطأ أثناء فك السجن");
        }
    }

});

// ========================================
// تسجيل الدخول
// ========================================

client.login(process.env.TOKEN);