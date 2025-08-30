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
    if (!userData.encv2) {
        client.close();
        return new Response(JSON.stringify({ code: 2, msg: i18n.setupEnc[clientLang] }), { status: 400 });
    }
    if (!tokenData.encv2) {
        client.close();
        return new Response(JSON.stringify({ code: 2, msg: i18n.setupEncOnDevice[clientLang] }), { status: 400 });
    }

    const body = await request.json();
    if (!body.enc) {
        client.close();
        return new Response(JSON.stringify({ code: 1, msg: i18n.invalidAccess[clientLang] }), { status: 400 });
    }
    await tokenCollection.updateOne({ token }, { $set: { encv2: body.enc, prf: true } });
    return NextResponse.json({ code: 0 });
}