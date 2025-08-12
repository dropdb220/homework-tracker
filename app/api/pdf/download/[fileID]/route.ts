import fetch from 'node-fetch';
import { NextResponse } from 'next/server';
import { MongoClient } from 'mongodb';
import i18n from '@/app/i18n.json';

export const dynamic = 'force-dynamic';

export async function POST(request: Request, { params: params_ }: { params: Promise<{ fileID: string }> }) {
    const params = await params_;
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
    if (!params.fileID || params.fileID.length !== 12 || !/^[a-zA-Z0-9]+$/.test(params.fileID)) {
        client.close();
        return new Response(JSON.stringify({ code: 1, msg: i18n.nonExistentFile[clientLang] }), { status: 404 });
    }
    const oneDrvTokenRequest = await fetch(`https://login.microsoftonline.com/${process.env.ONEDRIVE_TENANT}/oauth2/v2.0/token`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
            client_id: process.env.ONEDRIVE_CLIENT_ID || '',
            scope: 'https://graph.microsoft.com/.default',
            grant_type: 'refresh_token',
            refresh_token: process.env.ONEDRIVE_REFRESH_TOKEN || '',
            client_secret: process.env.ONEDRIVE_CLIENT_SECRET || ''
        })
    }).then((response) => response.json()) as any;
    if (!oneDrvTokenRequest.access_token) {
        return new Response(JSON.stringify({ code: 1, msg: i18n.oneDriveError[clientLang] }), { status: 500 });
    }
    const onedrvFile = await fetch(`https://graph.microsoft.com/v1.0/me/drive/root:/enc/${params.fileID}`, {
        headers: {
            Authorization: `Bearer ${oneDrvTokenRequest.access_token}`
        }
    }).then((response) => response.json()) as any;
    if (!onedrvFile['@microsoft.graph.downloadUrl']) {
        return new Response(JSON.stringify({ code: 1, msg: i18n.nonExistentFile[clientLang] }), { status: 404 });
    }
    return NextResponse.json({
        code: 0,
        url: onedrvFile['@microsoft.graph.downloadUrl']
    });
}