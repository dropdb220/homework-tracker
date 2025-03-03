import { MongoClient } from "mongodb";
import { setVapidDetails, sendNotification } from "web-push";
import i18n from "@/app/i18n.json";
import { AccountFlag } from "@/app/types";

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
    const user = await usersCollection.findOne({ id: print.user });
    client.close();
    return new Response(JSON.stringify({ ...print,
        title: userData.lang == 1 ? (print.title_en === "" ? print.title : print.title_en) : print.title, title_ko: print.title,
        comment: userData.lang == 1 ? (print.comment_en == "" ? print.comment : print.comment_en) : print.comment, comment_ko: print.comment,
        rejectReason: userData.lang == 1 ? (print.rejectReason_en === "" ? print.rejectReason_ko : print.rejectReason_en) : print.rejectReason_ko,
        user: { id: print.user, firstName: user?.firstName, lastName: user?.lastName } }), { status: 200 });
}

export async function PUT(request: Request, props: { params: Promise<{ idx: string }> }) {
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
    const data = await request.json();
    if (userData.perm >= 1 && print.user !== userData.id) {
        client.close();
        return new Response(JSON.stringify({ code: 1, msg: i18n.editOthersPost[clientLang] }), { status: 403 });
    }
    const updateList = { $set: {} };
    if (data.title && typeof data.title === 'string') Object.assign(updateList.$set, { title: data.title });
    if (data.title_en && typeof data.title_en === 'string') Object.assign(updateList.$set, { title_en: data.title_en });
    if (data.comment && typeof data.comment === 'string') Object.assign(updateList.$set, { comment: data.comment });
    if (data.comment_en && typeof data.comment_en === 'string') Object.assign(updateList.$set, { comment_en: data.comment_en });
    await printsCollection.updateOne({ idx: Number(params.idx) }, updateList);
    client.close();
    setVapidDetails(`mailto:${process.env.VAPID_EMAIL!}`, process.env.NEXT_PUBLIC_VAPID_PUBKEY!, process.env.VAPID_PRIVKEY!);
    const printers = await usersCollection.find({ flag: { $bitsAllSet: 2 } }).toArray();
    printers.forEach(async (printer) => {
        printer.subscriptions.forEach(async (sub: any) => {
            sendNotification(sub, JSON.stringify([{
                title: printer.lang == 1 ? 'Print Request Edited' : '인쇄 요청 수정됨',
                body: printer.lang == 1 ? `Print Request ${print.title_en === "" ? print.title : print.title_en} was edited just now.` : `${print.title}이(가) 수정되었습니다.`,
                tag: print.idx.toString(),
                url: `/print/${print.idx}`
            }])).catch(() => { });
        });
    });
    return new Response(JSON.stringify({ code: 0 }), { status: 200 });
}

export async function DELETE(request: Request, props: { params: Promise<{ idx: string }> }) {
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
    if (userData.perm >= 1 && print.user !== userData.id) {
        client.close();
        return new Response(JSON.stringify({ code: 1, msg: i18n.cantDelete[clientLang] }), { status: 403 });
    }
    await printsCollection.deleteOne({ idx: Number(params.idx) });
    client.close();
    return new Response(JSON.stringify({ code: 0 }), { status: 200 });
}