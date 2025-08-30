import { verifyRegistrationResponse } from '@simplewebauthn/server';
import { MongoClient } from 'mongodb';
import i18n from '@/app/i18n.json';

import type { Passkey } from '@/app/types';

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
    const tokensCollection = db.collection('tokens');
    const tokenData = await tokensCollection.findOne({ token });
    if (!tokenData) {
        client.close();
        return new Response(JSON.stringify({ code: 1, msg: i18n.nonExistentToken[clientLang] }), { status: 401 });
    }

    const id = tokenData.id;
    const usersCollection = db.collection('users');
    const user = await usersCollection.findOne({ id });
    if (!user) {
        client.close();
        return new Response(JSON.stringify({ code: 1, msg: i18n.nonExistentID[clientLang] }), { status: 404 });
    }
    clientLang = user.lang;
    if (!user.currentChallenge) {
        client.close();
        return new Response(JSON.stringify({ code: 1, msg: i18n.invalidAccess[clientLang] }), { status: 400 });
    }

    const credential = await request.json();
    if (!credential) {
        client.close();
        return new Response(JSON.stringify({ code: 1, msg: i18n.noPasskey[clientLang] }), { status: 400 });
    }

    let verification;
    try {
        verification = await verifyRegistrationResponse({
            response: credential,
            expectedChallenge: user.currentChallenge,
            expectedOrigin: process.env.NEXT_PUBLIC_URL || 'http://localhost:3000',
            expectedRPID: new URL('/', process.env.NEXT_PUBLIC_URL || 'http://localhost:3000').hostname,
            requireUserVerification: false
        });
    } catch (e: any) {
        client.close();
        return new Response(JSON.stringify({ code: 1, msg: e.message }), { status: 400 });
    }

    const { verified } = verification;
    if (!verified) {
        client.close();
        return new Response(JSON.stringify({ code: 1, msg: i18n.registerPKFailed[clientLang] }), { status: 500 });
    }
    const { registrationInfo } = verification;
    const { id: credentialID, publicKey: credentialPublicKey, counter, transports } = registrationInfo!.credential;
    const {
        credentialDeviceType,
        credentialBackedUp
    } = registrationInfo!;

    const newAuthenticator: Passkey = {
        credentialID,
        credentialPublicKey,
        counter,
        credentialDeviceType,
        credentialBackedUp,
        transports
    };
    const passkeysCollection = db.collection('users');
    // @ts-ignore
    await passkeysCollection.updateOne({ id }, { $push: { passkeys: newAuthenticator } });
    client.close();
    return new Response(JSON.stringify({ code: 0 }), { status: 200 });
}