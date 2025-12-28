import { MongoClient } from "mongodb";
import i18n from "@/app/i18n.json";

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    let clientLang = !isNaN(Number(request.headers.get('X-Lang') || undefined)) ? Number(request.headers.get('X-Lang')) : request.headers.get('Accept-Language')?.startsWith("en") ? 1 : 0;
    if (clientLang !== 0 && clientLang !== 1) clientLang = request.headers.get('Accept-Language')?.startsWith("en") ? 1 : 0;
    const token = request.headers.get('Authorization');

    if (!token) {
        return new Response(JSON.stringify({ code: 1, msg: i18n.noToken[clientLang] }), { status: 400 });
    }
    if (token.length !== 64) {
        return new Response(JSON.stringify({ code: 1, msg: i18n.malformedToken[clientLang] }), { status: 400 });
    }

    const client = new MongoClient(process.env.MONGO!);
    await client.connect();
    const db = client.db(process.env.DB_NAME);
    const collection = db.collection('tokens');
    const user = await collection.findOne({ token });
    client.close();
    if (!user) {
        return new Response(JSON.stringify({ code: 1, msg: i18n.nonExistentToken[clientLang] }), { status: 404 });
    } else {
        const UAString = request.headers.get('User-Agent') || '';
        let device = 0;
        if (UAString.includes('Windows')) device = 1;
        else if (UAString.includes('Macintosh')) {
            if (request.headers.get('X-Is-Mobile') === '1') device = 5;
            else device = 2;
        }
        else if (UAString.includes('Linux')) device = 3;
        else if (UAString.includes('iPhone')) device = 4;
        else if (UAString.includes('iPad')) device = 5;
        else if (UAString.includes('Android')) device = 6;
        let browser = 0;
        if (UAString.includes('Edg')) browser = 4
        else if (UAString.includes('SamsungBrowser')) browser = 5
        else if (UAString.includes('Chrome') || UAString.includes('CriOS')) browser = 1
        else if (UAString.includes('Firefox')) browser = 2
        else if (UAString.includes('Safari')) browser = 3
        collection.updateOne({ token }, { $set: { lastAccess: new Date(), device, browser } });
        return new Response(JSON.stringify({ code: 0, id: user.id }), { status: 200 });
    }
}