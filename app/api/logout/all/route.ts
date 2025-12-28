import { MongoClient } from "mongodb";
import i18n from "@/app/i18n.json";

export const dynamic = 'force-dynamic';

export async function DELETE(request: Request) {
    let clientLang = !isNaN(Number(request.headers.get('X-Lang') || undefined)) ? Number(request.headers.get('X-Lang')) : request.headers.get('Accept-Language')?.startsWith("en") ? 1 : 0;
    if (clientLang !== 0 && clientLang !== 1) clientLang = request.headers.get('Accept-Language')?.startsWith("en") ? 1 : 0;
    const token = request.headers.get('Authorization');
    if (!token) {
        return new Response(JSON.stringify({ code: 1, msg: i18n.alreadyLoggedOut[clientLang] }), { status: 400 });
    }

    const client = new MongoClient(process.env.MONGO!);
    await client.connect();
    const db = client.db(process.env.DB_NAME);
    const collection = db.collection('tokens');
    const user = await collection.findOne({ token });

    if (!user) {
        client.close();
        return new Response(JSON.stringify({ code: 1, msg: i18n.nonExistentID[clientLang] }), { status: 404 });
    } else {
        await collection.deleteMany({ id: user.id });
        client.close();
        return new Response(JSON.stringify({ code: 0 }), { status: 200 });
    }
}