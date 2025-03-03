import { MongoClient } from "mongodb";
import { setVapidDetails, sendNotification } from "web-push";
import i18n from "@/app/i18n.json";
import { AccountFlag, PrintStatus } from "@/app/types";

export const dynamic = 'force-dynamic';

export async function POST(request: Request, props: { params: Promise<{ idx: string }> }) {
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
    if (!userData.accepted) {
        client.close();
        return new Response(JSON.stringify({ code: 1, msg: i18n.notApproved[clientLang] }), { status: 403 });
    }
    const printsCollection = db.collection('prints');
    const print = await printsCollection.findOne({ idx: Number(params.idx) });
    if (!print || (!(userData.flag & AccountFlag.printer) && print.user !== userData.id)) {
        client.close();
        return new Response(JSON.stringify({ code: 1, msg: i18n.nonExistentPost[clientLang] }), { status: 404 });
    }
    if (!(userData.flag & AccountFlag.printer) && userData.perm >= 1) {
        client.close();
        return new Response(JSON.stringify({ code: 1, msg: i18n.notPrinterAccept[clientLang] }), { status: 403 });
    }
    await printsCollection.updateOne({ idx: Number(params.idx) }, { $set: { status: PrintStatus.completed } });
    client.close();
    setVapidDetails(`mailto:${process.env.VAPID_EMAIL!}`, process.env.NEXT_PUBLIC_VAPID_PUBKEY!, process.env.VAPID_PRIVKEY!);
    const user = await usersCollection.findOne({ id: print.user });
    if (user) user.subscriptions.forEach(async (sub: any) => {
        sendNotification(sub, JSON.stringify([{
            title: user.lang == 1 ? 'Print Completed' : '인쇄 완료',
            body: user.lang == 1 ? `Your print request ${print.title_en === "" ? print.title : print.title_en} was accepted and printing was completed just now.` : `${print.title}이 수락되어 인쇄가 완료되었습니다.`,
            tag: print.idx.toString(),
            url: `/print/${print.idx}`
        }])).catch(() => { });
    });
    return new Response(JSON.stringify({ code: 0 }), { status: 200 });
}