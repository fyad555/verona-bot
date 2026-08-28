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

    // أولًا: محاولة أخذ العضو من المنشن
    const mentionedMember = message.mentions.members.first();

    if (mentionedMember) {
        return mentionedMember;
    }

    // استخراج الكلام بعد الأمر
    const args = message.content.trim().split(/\s+/);

    // الأمر هو أول كلمة
    // الهدف هو ثاني كلمة
    const targetId = args[1];

    if (!targetId) {
        return null;
    }

    // التأكد أن الـID أرقام فقط
    if (!/^\d{17,20}$/.test(targetId)) {
        return null;
    }

    try {

        // جلب العضو من السيرفر
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

    // 1. جلب العضو المراد سجنه من الرسالة
    const targetMember = await getTargetMember(message);

    if (targetMember) {
        // 2. حماية صاحب السيرفر (لا أحد يستطيع سجنه نهائياً)
        if (targetMember.id === message.guild.ownerId) {
            return message.reply("❌ لا يمكنك سجن صاحب السيرفر!");
        }

        const isOwner = message.author.id === message.guild.ownerId;
        const isTargetAdmin = targetMember.permissions.has("Administrator");

        // 3. تطبيق القيود إذا لم يكن المنفّذ هو Owner السيرفر
        if (!isOwner) {
            if (isTargetAdmin) {
                return message.reply("❌ لا يمكنك سجن هذا الشخص لأنه إداري!");
            }
            if (targetMember.roles.highest.position >= message.member.roles.highest.position) {
                return message.reply("❌ لا يمكنك سجن شخص رتبته أعلى منك أو تساؤيك!");
            }
        }
    }
    // ========================================
    // أمر السجن
    // سجن @الشخص
    // سجن ID
    // ========================================

    if (message.content.startsWith("سجن")) {

        // ========================================
        // التحقق من الصلاحية
        // ========================================

        if (!canUseJail(message.member)) {
            return message.reply(
                "❌ ما عندك صلاحية استخدام أمر السجن"
            );
        }

        // ========================================
        // الحصول على العضو
        // ========================================

        const member = await getTargetMember(message);

        if (!member) {
            return message.reply(
                "❌ منشن الشخص أو حط ID صحيح للعضو"
            );
        }

        // ========================================
        // حماية البوتات
        // ========================================

        if (member.user.bot) {
            return message.reply(
                "❌ ما تقدر تسجن البوتات"
            );
        }

        // ========================================
        // منع سجن النفس
        // ========================================

        if (member.id === message.author.id) {
            return message.reply(
                "❌ ما تقدر تسجن نفسك"
            );
        }

        // ========================================
        // حماية صاحب البوت
        // ========================================

      if (member.id === BOT_OWNER_ID) {
    return message.reply(
        "بدري عليك تسجن رماد يا حمار 😎"
    );
}

        // ========================================
        // حماية Owner
        // ========================================

       if (member.roles.cache.has(OWNER_ROLE_ID)) {
    return message.reply(
        "تسوقها؟ ذا Owner اقلب وجهك 😂"
    );
}

        // ========================================
        // مقارنة الصلاحيات
        // ========================================

        const executorPower = getPowerLevel(message.member);
        const targetPower = getPowerLevel(member);

        // Staff لا يقدر يسجن Staff أو أعلى
        if (
            executorPower === 1 &&
            targetPower >= 1
        ) {
            return message.reply(
                "❌ ما تقدر تسجن شخص عنده نفس رتبتك أو أعلى منك"
            );
        }

        // ========================================
        // رتبة السجن
        // ========================================

        const jailRole = message.guild.roles.cache.get(
            JAIL_ROLE_ID
        );

        if (!jailRole) {
            return message.reply(
                "❌ ما لقيت رتبة السجن، تأكد من الـID"
            );
        }

        // ========================================
        // التأكد أنه غير مسجون
        // ========================================

        if (member.roles.cache.has(JAIL_ROLE_ID)) {
            return message.reply(
                "❌ هذا الشخص مسجون بالفعل"
            );
        }

        // ========================================
        // التأكد أن البوت يستطيع تعديل العضو
        // ========================================

        if (!member.manageable) {
            return message.reply(
                "❌ ما أقدر أعدل رتب هذا الشخص، تأكد أن رتبة البوت أعلى منه"
            );
        }

        // ========================================
        // التأكد من رتبة البوت
        // ========================================

        if (
            jailRole.position >=
            message.guild.members.me.roles.highest.position
        ) {
            return message.reply(
                "❌ رتبة السجن أعلى من رتبة البوت"
            );
        }

        // ========================================
        // تحميل البيانات
        // ========================================

        const jailData = loadJailData();

        // ========================================
        // حفظ الرتب القديمة
        // ========================================

        const oldRoles = member.roles.cache
            .filter(role => role.id !== message.guild.id)
            .filter(role => role.id !== JAIL_ROLE_ID)
            .map(role => role.id);

        jailData[member.id] = {
            roles: oldRoles,
            jailedBy: message.author.id,
            jailedAt: Date.now()
        };

        saveJailData(jailData);

        // ========================================
        // استجابة مباشرة
        // ========================================

        const processingMessage = await message.reply(
            "⏳ جاري سجن العضو..."
        );

        try {

            // ========================================
            // حذف الرتب وإعطاء رتبة السجن
            // ========================================

            await member.roles.set([JAIL_ROLE_ID]);

            // ========================================
            // النتيجة
            // ========================================

           await processingMessage.edit(
    `تم سجن العضو ${member}`
);
        } catch (error) {

            console.error(
                "❌ خطأ أثناء السجن:",
                error
            );

            // ========================================
            // محاولة استرجاع الرتب
            // ========================================

            try {

                await member.roles.set(oldRoles);

                delete jailData[member.id];

                saveJailData(jailData);

            } catch (restoreError) {

                console.error(
                    "❌ فشل استرجاع الرتب:",
                    restoreError
                );
            }

            await processingMessage.edit(
                "❌ صار خطأ أثناء السجن وتمت محاولة استرجاع رتب العضو"
            );
        }
    }

    // ========================================
    // فك السجن
    // حرية @الشخص
    // حريه @الشخص
    // حرية ID
    // حريه ID
    // ========================================

    if (
        message.content.startsWith("حرية") ||
        message.content.startsWith("حريه")
    ) {

        // ========================================
        // التحقق من الصلاحية
        // ========================================

        if (!canUseJail(message.member)) {
            return message.reply(
                "❌ ما عندك صلاحية استخدام أمر فك السجن"
            );
        }

        // ========================================
        // الحصول على العضو
        // ========================================

        const member = await getTargetMember(message);

        if (!member) {
            return message.reply(
                "❌ منشن الشخص أو حط ID صحيح للعضو"
            );
        }

        // ========================================
        // منع البوتات
        // ========================================

        if (member.user.bot) {
            return message.reply(
                "❌ نظام السجن مخصص للأعضاء فقط"
            );
        }

        // ========================================
        // رتبة السجن
        // ========================================

        const jailRole = message.guild.roles.cache.get(
            JAIL_ROLE_ID
        );

        if (!jailRole) {
            return message.reply(
                "❌ ما لقيت رتبة السجن"
            );
        }

        // ========================================
        // التأكد أنه مسجون
        // ========================================

        if (!member.roles.cache.has(JAIL_ROLE_ID)) {
            return message.reply(
                "❌ هذا الشخص مو مسجون"
            );
        }

        // ========================================
        // التأكد أن البوت يستطيع تعديل العضو
        // ========================================

        if (!member.manageable) {
            return message.reply(
                "❌ ما أقدر أعدل رتب هذا الشخص"
            );
        }

        // ========================================
        // تحميل بيانات السجن
        // ========================================

        const jailData = loadJailData();
        const savedData = jailData[member.id];

        if (!savedData || !savedData.roles) {
            return message.reply(
                "❌ ما لقيت الرتب المحفوظة لهذا الشخص"
            );
        }

        // ========================================
        // استجابة مباشرة
        // ========================================

        const processingMessage = await message.reply(
            "⏳ جاري فك السجن واسترجاع الرتب..."
        );

        try {

            // ========================================
            // التحقق من الرتب الموجودة
            // ========================================

            const validRoles = savedData.roles
                .map(roleId =>
                    message.guild.roles.cache.get(roleId)
                )
                .filter(role => role)
                .filter(role =>
                    role.position <
                    message.guild.members.me.roles.highest.position
                )
                .map(role => role.id);

            // ========================================
            // استرجاع الرتب دفعة واحدة
            // ========================================

            await member.roles.set(validRoles);

            // ========================================
            // حذف بيانات السجن
            // ========================================

            delete jailData[member.id];

            saveJailData(jailData);

            // ========================================
            // النتيجة
            // ========================================

await processingMessage.edit(
    `تم تحرير ${member}\nاضحك كليوم`
);
        } catch (error) {

            console.error(
                "❌ خطأ أثناء فك السجن:",
                error
            );

            await processingMessage.edit(
                "❌ صار خطأ أثناء فك السجن"
            );
        }
    }
});

// ========================================
// تسجيل الدخول
// ========================================

client.login(process.env.TOKEN);