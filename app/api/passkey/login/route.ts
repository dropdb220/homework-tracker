import { verifyAuthenticationResponse } from '@simplewebauthn/server';
import { MongoClient, Binary } from 'mongodb';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
    const client = new MongoClient(process.env.MONGO!);
    await client.connect();
    const db = client.db(process.env.DB_NAME);
    const sessionsCollection = db.collection('loginSessions');
    const data = await request.json();
    const response = data.response;
    if (!response) {
        client.close();
        return new Response(JSON.stringify({ code: 1, msg: '패스키 정보가 필요합니다.' }), { status: 400 });
    }
    if (!data.session || typeof data.session !== 'string') {
        client.close();
        return new Response(JSON.stringify({ code: 1, msg: '세션 정보가 필요합니다.' }), { status: 400 });
    }
    const sessionData = await sessionsCollection.findOne({ session: data.session });
    if (!sessionData) {
        client.close();
        return new Response(JSON.stringify({ code: 1, msg: '유효하지 않은 세션입니다.' }), { status: 400 });
    }
    await sessionsCollection.deleteOne({ session: data.session });
    const usersCollection = db.collection('users');
    try {
        const passkey = await usersCollection.findOne({ "passkeys.credentialID": response.id });
        if (!passkey) {
            client.close();
            return new Response(JSON.stringify({ code: 1, msg: '유효하지 않은 패스키입니다.' }), { status: 401 });
        }
        const authenticator = passkey.passkeys.find((x: any) => x.credentialID.replace(/\=/gi, '').replace(/\+/gi, '-').replace(/\//gi, '_') === response.id);
        authenticator.credentialPublicKey = new Uint8Array(Buffer.from(authenticator.credentialPublicKey.toString('base64'), 'base64'));
        const verification = await verifyAuthenticationResponse({
            response,
            expectedChallenge: sessionData.challenge,
            expectedOrigin: process.env.NEXT_PUBLIC_URL || 'http://localhost:3000',
            expectedRPID: new URL('/', process.env.NEXT_PUBLIC_URL || 'http://localhost:3000').hostname,
            authenticator,
            requireUserVerification: false
        });
        const { verified } = verification;
        if (!verified) {
            client.close();
            return new Response(JSON.stringify({ code: 1, msg: '유효하지 않은 패스키입니다.' }), { status: 401 });
        }
        let token = '';
        for (let i = 0; i < 64; i++) {
            token += Math.floor(Math.random() * 16).toString(16);
        }
        const tokenCollection = db.collection('tokens');
        await tokenCollection.insertOne({ id: passkey.id, token });
        await usersCollection.updateOne({ id: passkey.id }, { $set: { passkeys: passkey.passkeys.map((x: any) => x.credentialID.replace(/\=/gi, '').replace(/\+/gi, '-').replace(/\//gi, '_') === response.id ? { ...x, counter: verification.authenticationInfo.newCounter } : x) } });
        client.close();
        return new Response(JSON.stringify({ code: 0, id: passkey.id, token }), { status: 200 });
    } catch (e: any) {
        client.close();
        return new Response(JSON.stringify({ code: 1, msg: '유효하지 않은 패스키입니다.' }), { status: 400 });
    }
}