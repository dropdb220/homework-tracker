import { verifyRegistrationResponse } from '@simplewebauthn/server';
import { MongoClient } from 'mongodb';

import type { Passkey } from '@/app/types';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
    const token = request.headers.get('Authorization');
    if (!token) {
        return new Response(JSON.stringify({ code: 1, msg: '로그인이 필요합니다.' }), { status: 401 });
    }
    const client = new MongoClient(process.env.MONGO!);
    await client.connect();
    const db = client.db(process.env.DB_NAME);
    const tokensCollection = db.collection('tokens');
    const tokenData = await tokensCollection.findOne({ token });
    if (!tokenData) {
        client.close();
        return new Response(JSON.stringify({ code: 1, msg: '유효하지 않은 토큰입니다.' }), { status: 401 });
    }

    const id = tokenData.id;
    const usersCollection = db.collection('users');
    const user = await usersCollection.findOne({ id });
    if (!user) {
        client.close();
        return new Response(JSON.stringify({ code: 1, msg: '유효하지 않은 ID입니다.' }), { status: 404 });
    }
    if (!user.currentChallenge) {
        client.close();
        return new Response(JSON.stringify({ code: 1, msg: '유효하지 않은 접근입니다.' }), { status: 400 });
    }

    const credential = await request.json();
    if (!credential) {
        client.close();
        return new Response(JSON.stringify({ code: 1, msg: '패스키 정보가 필요합니다.' }), { status: 400 });
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
        return new Response(JSON.stringify({ code: 1, msg: '패스키 등록에 실패했습니다.' }), { status: 500 });
    }
    const { registrationInfo } = verification;
    const {
        credentialPublicKey,
        credentialID,
        counter,
        credentialDeviceType,
        credentialBackedUp
    } = registrationInfo!;

    const newAuthenticator: Passkey = {
        credentialID,
        credentialPublicKey,
        counter,
        credentialDeviceType,
        credentialBackedUp,
        transports: credential.response.transports,
    };
    const passkeysCollection = db.collection('users');
    // @ts-ignore
    await passkeysCollection.updateOne({ id }, { $push: { passkeys: newAuthenticator } });
    client.close();
    return new Response(JSON.stringify({ code: 0 }), { status: 200 });
}