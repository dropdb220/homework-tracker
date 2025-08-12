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
    if (!userData.enc || !userData.iv) {
        client.close();
        return new Response(JSON.stringify({ code: 1, msg: i18n.setupEnc[clientLang] }), { status: 400 });
    }
    const body = await request.json();
    if (!body.passcode || body.passcode.length !== 6 || isNaN(Number(body.passcode))) {
        return new Response(JSON.stringify({ code: 1, msg: i18n.invalidPasscode[clientLang] }), { status: 400 });
    }
    if (!body.newPasscode || body.newPasscode.length !== 6 || isNaN(Number(body.newPasscode))) {
        return new Response(JSON.stringify({ code: 1, msg: i18n.invalidPasscode[clientLang] }), { status: 400 });
    }
    if (!userData.enc || !userData.iv) {
        client.close();
        return new Response(JSON.stringify({ code: 1, msg: i18n.setupEnc[clientLang] }), { status: 400 });
    }
    if (userData.lockout) {
        if (Date.now() > userData.retry && userData.retry !== -1) {
            await usersCollection.updateOne({ id: userData.id }, { $set: { lockout: false } });
        } else {
            client.close();
            return new Response(JSON.stringify({ code: 1, msg: i18n.lockout[clientLang] }), { status: 403 });
        }
    }
    const key1 = await crypto.subtle.importKey('raw', new TextEncoder().encode(body.passcode), { name: 'PBKDF2' }, false, ['deriveKey']);
    const key2 = await crypto.subtle.deriveKey(
        {
            name: 'PBKDF2',
            salt: new TextEncoder().encode(userData.salt2),
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
        decryptedData = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: new TextEncoder().encode(userData.iv) }, key2, Buffer.from(userData.enc, 'base64'));
    } catch (e) {
        await usersCollection.updateOne({ id: userData.id }, { $inc: { incorrect: 1 } }, { upsert: true });
        if (userData.incorrect >= 9) {
            await usersCollection.updateOne({ id: userData.id }, { $set: { lockout: true, retry: -1 } });
            await usersCollection.updateOne({ id: userData.id }, { $unset: { enc: "", iv: "" } });
            client.close();
            return new Response(JSON.stringify({ code: 1, msg: i18n.lockout[clientLang] }), { status: 403 });
        } else if (userData.incorrect >= 3) {
            const delay = [0, 0, 0, 1, 5, 15, 60, 180, 480].map(x => x * 60 * 1000);
            const retryTime = Date.now() + delay[userData.incorrect];
            await usersCollection.updateOne({ id: userData.id }, { $set: { lockout: true, retry: retryTime } });
            client.close();
            return new Response(JSON.stringify({ code: 1, msg: i18n.lockout[clientLang] }), { status: 403 });
        } else {
            client.close();
            return new Response(JSON.stringify({ code: 1, msg: i18n.incorrectPasscode[clientLang] }), { status: 403 });
        }
    }
    const salt2 = crypto.randomUUID().replace(/-/g, '').slice(0, 16);
    const iv = crypto.randomUUID().split('-').reverse()[0];
    const key3 = await crypto.subtle.importKey('raw', new TextEncoder().encode(body.newPasscode), { name: 'PBKDF2' }, false, ['deriveKey']);
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
    await usersCollection.updateOne({ id: userData.id }, {
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