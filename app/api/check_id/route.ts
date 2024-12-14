import { MongoClient } from "mongodb";
import i18n from "@/app/i18n.json";

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    let clientLang = !isNaN(Number(request.headers.get('X-Lang') || undefined)) ? Number(request.headers.get('X-Lang')) : request.headers.get('Accept-Language')?.startsWith("en") ? 1 : 0;
    if (clientLang !== 0 && clientLang !== 1) clientLang = request.headers.get('Accept-Language')?.startsWith("en") ? 1 : 0;
    const url = new URL(request.url);
    const id = url.searchParams.get('id');

    if (!id) {
        return new Response(JSON.stringify({ code: 1, msg: i18n.noID[clientLang] }), { status: 400 });
    }
    if (id.length < 4 || id.length > 20) {
        return new Response(JSON.stringify({ code: 1, msg: i18n.IDLimit[clientLang] }), { status: 400 });
    }

    const client = new MongoClient(process.env.MONGO!);
    await client.connect();
    const db = client.db(process.env.DB_NAME);
    const collection = db.collection('users');
    const user = await collection.findOne({ id });
    client.close();
    if (!user) {
        return new Response(JSON.stringify({ code: 1, msg: i18n.nonExistentID[clientLang] }), { status: 404 });
    } else {
        return new Response(JSON.stringify({ code: 0, id: user.id, lang: user.lang }), { status: 200 });
    }
}