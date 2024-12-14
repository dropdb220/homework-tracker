import { MongoClient } from "mongodb";
import { generateRegistrationOptions } from '@simplewebauthn/server';
import type { PasskeySerialized } from "@/app/types";
import i18n from "@/app/i18n.json";

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
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
    const registeredPasskeys: PasskeySerialized[] = user.passkeys;
    const options = await generateRegistrationOptions({
        rpName: process.env.NEXT_PUBLIC_TITLE || '숙제 트래커',
        rpID: new URL('/', process.env.NEXT_PUBLIC_URL || 'http://localhost:3000').hostname,
        userName: id,
        userDisplayName: id,
        attestationType: 'none',
        excludeCredentials: registeredPasskeys.map(passkey => ({
            id: passkey.credentialID,
            // @ts-ignore
            type: 'public-key',
            transports: passkey.transports,
        })),
        authenticatorSelection: {
            residentKey: 'preferred',
            userVerification: 'required',
            requireResidentKey: true
        }
    });

    await usersCollection.updateOne({ id }, { $set: { currentChallenge: options.challenge } });
    client.close();
    return new Response(JSON.stringify({ code: 0, id, options }), { status: 200 });
}