import { NextRequest } from "next/server";
import { MongoClient } from "mongodb";
import { sendNotification, setVapidDetails } from "web-push";
import i18n from "@/app/i18n.json";
import { AccountFlag, PrintStatus } from "@/app/types";

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
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
    const tokenToUser = await tokensCollection.findOne({ token });
    if (!tokenToUser) {
        client.close();
        return new Response(JSON.stringify({ code: 1, msg: i18n.nonExistentToken[clientLang] }), { status: 401 });
    }
    const user = tokenToUser.id;
    const usersCollection = db.collection('users');
    const userData = await usersCollection.findOne({ id: user });
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
    const prints = (((userData.flags & AccountFlag.printer) || userData.perm === 0) ? (await printsCollection.find().toArray()) : (await printsCollection.find({ user }).toArray())).sort((a, b) => b.created.getTime() - a.created.getTime()).map((x: any) => { return { ...x, title: userData.lang == 1 ? (x.title_en === "" ? x.title : x.title_en) : x.title } })
    client.close();
    return new Response(JSON.stringify({ prints: prints }), { status: 200 });
}

export async function POST(request: Request) {
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
    const tokenToUser = await tokensCollection.findOne({ token });
    if (!tokenToUser) {
        client.close();
        return new Response(JSON.stringify({ code: 1, msg: i18n.nonExistentToken[clientLang] }), { status: 401 });
    }
    const user = tokenToUser.id;
    const usersCollection = db.collection('users');
    const userData = await usersCollection.findOne({ id: user });
    if (!userData) {
        client.close();
        return new Response(JSON.stringify({ code: 1, msg: i18n.invalidUser[clientLang] }), { status: 401 });
    }
    clientLang = userData.lang;
    if (!userData.accepted) {
        client.close();
        return new Response(JSON.stringify({ code: 1, msg: i18n.notApproved[clientLang] }), { status: 403 });
    }
    const data = await request.json();
    const printsCollection = db.collection('prints');
    const prevPrints = await printsCollection.find().toArray();
    const print = {
        idx: prevPrints.length === 0 ? 1 : prevPrints.sort((a, b) => b.idx - a.idx)[0].idx + 1,
        user,
        title: data.title,
        title_en: data.title_en,
        comment: data.comment,
        comment_en: data.comment_en,
        status: PrintStatus.pending,
        created: new Date()
    };
    await printsCollection.insertOne(print);
    client.close();
    setVapidDetails(`mailto:${process.env.VAPID_EMAIL!}`, process.env.NEXT_PUBLIC_VAPID_PUBKEY!, process.env.VAPID_PRIVKEY!);
    const printers = await usersCollection.find({ flag: { $bitsAllSet: 2 } }).toArray();
    printers.forEach(async (printer) => {
        printer.subscriptions.forEach(async (sub: any) => {
            sendNotification(sub, JSON.stringify([{
                title: printer.lang == 1 ? 'New Print Request' : '인쇄 요청 등록됨',
                body: printer.lang == 1 ? `A new print request ${print.title_en === "" ? print.title : print.title_en} was created just now.` : `${print.title}이(가) 등록되었습니다.`,
                tag: print.idx.toString(),
                url: `/print/${print.idx}`
            }])).catch(() => { });
        });
    });
    return new Response(JSON.stringify({ code: 0, idx: print.idx }), { status: 200 });
}