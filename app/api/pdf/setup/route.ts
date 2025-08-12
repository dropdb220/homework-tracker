import fetch from 'node-fetch';
import { NextResponse } from 'next/server';
import { MongoClient } from 'mongodb';
import i18n from '@/app/i18n.json';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
    let clientLang = !isNaN(Number(request.headers.get('X-Lang') || undefined)) ? Number(request.headers.get('X-Lang')) : request.headers.get('Accept-Language')?.startsWith("en") ? 1 : 0;
    if (clientLang !== 0 && clientLang !== 1) clientLang = request.headers.get('Accept-Language')?.startsWith("en") ? 1 : 0;
    const token = request.headers.get('Authorization');
    if (!token) {
        return new Response(JSON.stringify({ code: 1, msg: i18n.loginRequired[clientLang] }), { status: 401 });
    }

    const client = new MongoClient(process.env.MONGO!);
    await client.connect();
    const db = client.db(process.env.DB_NAME);
    const tokenCollection = db.collection('tokens');
    const tokenData = await tokenCollection.findOne({ token });
    if (!tokenData) {
        client.close();
        return new Response(JSON.stringify({ code: 1, msg: i18n.nonExistentToken[clientLang] }), { status: 401 });
    }
    const usersCollection = db.collection('users');
    const userData = await usersCollection.findOne({ id: tokenData.id });
    if (!userData) {
        client.close();
        return new Response(JSON.stringify({ code: 1, msg: i18n.invalidUser[clientLang] }), { status: 401 });
    }
    clientLang = userData.lang;
    if (!userData.accepted) {
        client.close();
        return new Response(JSON.stringify({ code: 1, msg: i18n.notApproved[clientLang] }), { status: 403 });
    }
    if (userData.enc && userData.iv) {
        client.close();
        return new Response(JSON.stringify({ code: 1, msg: i18n.alreadyHasEnc[clientLang] }), { status: 400 });
    }
    const body = await request.json();
    if (!body.passcode || body.passcode.length !== 6 || isNaN(Number(body.passcode))) {
        return new Response(JSON.stringify({ code: 1, msg: i18n.invalidPasscode[clientLang] }), { status: 400 });
    }
    if (!body.userID || !body.userPassword || !body.userPasscode || body.userPasscode.length !== 6 || isNaN(Number(body.userPasscode))) {
        return new Response(JSON.stringify({ code: 1, msg: i18n.setupEnc[clientLang] }), { status: 400 });
    }
    const prevUser = await usersCollection.findOne({ id: body.userID });
    if (!prevUser) {
        client.close();
        return new Response(JSON.stringify({ code: 1, msg: i18n.invalidUser[clientLang] }), { status: 400 });
    }
    const salt = prevUser.salt;
    const firstHash = await globalThis.crypto.subtle.digest('SHA-512', new TextEncoder().encode(body.userPassword + salt));
    const secondHash = await globalThis.crypto.subtle.digest('SHA-512', new TextEncoder().encode(Array.from(new Uint8Array(firstHash)).map((b) => b.toString(16).padStart(2, "0")).join("") + salt));
    const shaHash = Array.from(new Uint8Array(secondHash)).map((b) => b.toString(16).padStart(2, "0")).join("");
    const pbkdf2Key = await globalThis.crypto.subtle.importKey('raw', new TextEncoder().encode(shaHash), 'PBKDF2', false, ['deriveBits']);
    const rawHash = await globalThis.crypto.subtle.deriveBits({ name: 'PBKDF2', salt: new TextEncoder().encode(salt), iterations: 1000000, hash: 'SHA-512' }, pbkdf2Key, 512);
    const hash = Array.prototype.map.call(new Uint8Array(rawHash), x => x.toString(16).padStart(2, '0')).join('');
    if (hash !== prevUser.pwd) {
        client.close();
        return new Response(JSON.stringify({ code: 1, msg: i18n.PWMismatch[clientLang] }), { status: 403 });
    }
    if (!prevUser.enc || !prevUser.iv) {
        client.close();
        return new Response(JSON.stringify({ code: 1, msg: i18n.setupEnc[clientLang] }), { status: 400 });
    }
    if (prevUser.lockout) {
        if (Date.now() > userData.retry && userData.retry !== -1) {
            await usersCollection.updateOne({ id: body.userID }, { $set: { lockout: false } });
        } else {
            client.close();
            return new Response(JSON.stringify({ code: 1, msg: i18n.lockout[clientLang] }), { status: 403 });
        }
    }
    const key1 = await crypto.subtle.importKey('raw', new TextEncoder().encode(body.userPasscode), { name: 'PBKDF2' }, false, ['deriveKey']);
    const key2 = await crypto.subtle.deriveKey(
        {
            name: 'PBKDF2',
            salt: new TextEncoder().encode(prevUser.salt2),
            iterations: 1000000,
            hash: 'SHA-256'
        },
        key1,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
    );
    let decryptedData: any;
    try {
        decryptedData = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: new TextEncoder().encode(prevUser.iv) }, key2, Buffer.from(prevUser.enc, 'base64'));
    } catch (e) {
        await usersCollection.updateOne({ id: body.userID }, { $inc: { incorrect: 1 } }, { upsert: true });
        if (prevUser.incorrect >= 9) {
            await usersCollection.updateOne({ id: body.userID }, { $set: { lockout: true, retry: -1 } });
            await usersCollection.updateOne({ id: body.userID }, { $unset: { enc: "", iv: "" } });
            client.close();
            return new Response(JSON.stringify({ code: 1, msg: i18n.lockout[clientLang] }), { status: 403 });
        } else if (prevUser.incorrect >= 3) {
            const delay = [0, 0, 0, 1, 5, 15, 60, 180, 480].map(x => x * 60 * 1000);
            const retryTime = Date.now() + delay[prevUser.incorrect];
            await usersCollection.updateOne({ id: body.userID }, { $set: { lockout: true, retry: retryTime } });
            client.close();
            return new Response(JSON.stringify({ code: 1, msg: i18n.lockout[clientLang] }), { status: 403 });
        } else {
            client.close();
            return new Response(JSON.stringify({ code: 1, msg: i18n.incorrectPasscode[clientLang] }), { status: 403 });
        }
    }
    const salt2 = crypto.randomUUID().replace(/-/g, '').slice(0, 16);
    const iv = crypto.randomUUID().split('-').reverse()[0];
    const key3 = await crypto.subtle.importKey('raw', new TextEncoder().encode(body.passcode), { name: 'PBKDF2' }, false, ['deriveKey']);
    const key4 = await crypto.subtle.deriveKey(
        {
            name: 'PBKDF2',
            salt: new TextEncoder().encode(salt2),
            iterations: 1000000,
            hash: 'SHA-256'
        },
        key3,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
    );
    const enc = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: new TextEncoder().encode(iv) }, key4, decryptedData);
    await usersCollection.updateOne({ id: tokenData.id }, {
        $set: {
            enc: Buffer.from(enc).toString('base64'),
            iv,
            salt2,
            incorrect: 0,
            lockout: false,
            retry: 0
        }
    });
    client.close();
    return NextResponse.json({ code: 0 });
}