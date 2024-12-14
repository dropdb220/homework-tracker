import { MongoClient } from "mongodb";
import i18n from "@/app/i18n.json";

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
    let clientLang = !isNaN(Number(request.headers.get('X-Lang') || undefined)) ? Number(request.headers.get('X-Lang')) : request.headers.get('Accept-Language')?.startsWith("en") ? 1 : 0;
    if (clientLang !== 0 && clientLang !== 1) clientLang = request.headers.get('Accept-Language')?.startsWith("en") ? 1 : 0;
    const { id, pwd: rawPwd } = await request.json();
    if (!id || !rawPwd) {
        return new Response(JSON.stringify({ code: 1, msg: i18n.noIDorPW[clientLang] }), { status: 400 });
    }
    if (typeof id !== 'string' || typeof rawPwd !== 'string') {
        return new Response(JSON.stringify({ code: 1, msg: i18n.malformed[clientLang] }), { status: 400 });
    }

    const client = new MongoClient(process.env.MONGO!);
    await client.connect();
    const db = client.db(process.env.DB_NAME);
    const usersCollection = db.collection('users');
    const user = await usersCollection.findOne({ id });

    if (!user) {
        client.close();
        return new Response(JSON.stringify({ code: 1, msg: i18n.nonExistentID[clientLang] }), { status: 404 });
    } else {
        clientLang = user.lang;
        const salt = user.salt;
        const firstHash = await globalThis.crypto.subtle.digest('SHA-512', new TextEncoder().encode(rawPwd + salt));
        const secondHash = await globalThis.crypto.subtle.digest('SHA-512', new TextEncoder().encode(Array.from(new Uint8Array(firstHash)).map((b) => b.toString(16).padStart(2, "0")).join("") + salt));
        const shaHash = Array.from(new Uint8Array(secondHash)).map((b) => b.toString(16).padStart(2, "0")).join("");
        const pbkdf2Key = await globalThis.crypto.subtle.importKey('raw', new TextEncoder().encode(shaHash), 'PBKDF2', false, ['deriveBits']);
        const rawHash = await globalThis.crypto.subtle.deriveBits({ name: 'PBKDF2', salt: new TextEncoder().encode(salt), iterations: 1000000, hash: 'SHA-512' }, pbkdf2Key, 512);
        const hash = Array.prototype.map.call(new Uint8Array(rawHash), x => x.toString(16).padStart(2, '0')).join('');

        if (hash !== user.pwd) {
            client.close();
            return new Response(JSON.stringify({ code: 1, msg: i18n.PWMismatch[clientLang] }), { status: 401 });
        } else {
            let token = '';
            for (let i = 0; i < 64; i++) {
                token += Math.floor(Math.random() * 16).toString(16);
            }
            const tokenCollection = db.collection('tokens');
            await tokenCollection.insertOne({ id: user.id, token });
            client.close();
            return new Response(JSON.stringify({ code: 0, id, token }), { status: 200 });
        }
    }
}