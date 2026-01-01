import { MongoClient, ObjectId } from "mongodb";
import _i18n from "@/app/i18n.json";
import { NextRequest } from "next/server";
const i18n: { [key: string]: string | string[] } = _i18n;

export const dynamic = 'force-dynamic';

export async function GET(request: Request, props: { params: Promise<{ idx: string }> }) {
    const params = await props.params;
    let clientLang = !isNaN(Number(request.headers.get('X-Lang') || undefined)) ? Number(request.headers.get('X-Lang')) : request.headers.get('Accept-Language')?.startsWith("en") ? 1 : 0;
    if (clientLang !== 0 && clientLang !== 1) clientLang = request.headers.get('Accept-Language')?.startsWith("en") ? 1 : 0;
    const client = new MongoClient(process.env.MONGO!);
    await client.connect();
    const db = client.db(process.env.DB_NAME);
    const tokensCollection = db.collection('tokens');
    const token = request.headers.get('Authorization');
    if (!token) {
        client.close();
        return new Response(JSON.stringify({ code: 1, msg: i18n.loginRequired[clientLang] }), { status: 401 });
    }
    const tokenData = await tokensCollection.findOne({ token });
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
    const sessions = await tokensCollection.find({ id: tokenData.id }).toArray();
    client.close();
    return new Response(JSON.stringify({
        code: 0, data: sessions.map(session => {
            return {
                deviceID: session._id.toString(),
                issuedAt: session.issuedAt,
                lastAccess: session.lastAccess,
                device: i18n[`device${session.device == null ? 0 : session.device}`]![clientLang],
                browser: i18n[`browser${session.browser == null ? 0 : session.browser}`]![clientLang],
                isMySession: session.token === token
            }
        })
    }), { status: 200 });
}

export async function DELETE(request: NextRequest) {
    let clientLang = !isNaN(Number(request.headers.get('X-Lang') || undefined)) ? Number(request.headers.get('X-Lang')) : request.headers.get('Accept-Language')?.startsWith("en") ? 1 : 0;
    if (clientLang !== 0 && clientLang !== 1) clientLang = request.headers.get('Accept-Language')?.startsWith("en") ? 1 : 0;
    const client = new MongoClient(process.env.MONGO!);
    await client.connect();
    const db = client.db(process.env.DB_NAME);
    const tokensCollection = db.collection('tokens');
    const token = request.headers.get('Authorization');
    if (!token) {
        client.close();
        return new Response(JSON.stringify({ code: 1, msg: i18n.loginRequired[clientLang] }), { status: 401 });
    }
    const tokenData = await tokensCollection.findOne({ token });
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
    const deviceID = request.nextUrl.searchParams.get('device_id');
    if (!deviceID || deviceID === '') {
        return new Response(JSON.stringify({ code: 1, msg: i18n.noDevice[clientLang] }), { status: 400 });
    }
    const device = await tokensCollection.findOne({ id: tokenData.id, _id: new ObjectId(deviceID) });
    if (!device) {
        client.close();
        return new Response(JSON.stringify({ code: 1, msg: i18n.nonExistentDevice[clientLang] }), { status: 404 });
    }
    await tokensCollection.deleteOne({ id: tokenData.id, _id: new ObjectId(deviceID) });
    client.close();
    return new Response(JSON.stringify({ code: 0 }), { status: 200 });
}
