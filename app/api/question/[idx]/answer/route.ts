import { MongoClient } from "mongodb";
import { setVapidDetails, sendNotification } from "web-push";
import i18n from "@/app/i18n.json";

export const dynamic = 'force-dynamic';

export async function POST(request: Request, { params }: { params: { idx: string } }) {
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
    const questionsCollection = db.collection('questions');
    const question = await questionsCollection.findOne({ idx: Number(params.idx) });
    if (!question || (!userData.answerer && !question.public && question.user !== userData.id)) {
        client.close();
        return new Response(JSON.stringify({ code: 1, msg: i18n.nonExistentPost[clientLang] }), { status: 404 });
    }
    const data = await request.json();
    if (!userData.answerer && userData.perm >= 1) {
        client.close();
        return new Response(JSON.stringify({ code: 1, msg: i18n.notAnswerer[clientLang] }), { status: 403 });
    }
    await questionsCollection.updateOne({ idx: Number(params.idx) }, { $set: { answer: data.answer, answer_en: data.answer_en, solved: true } });
    client.close();
    setVapidDetails(`mailto:${process.env.VAPID_EMAIL!}`, process.env.NEXT_PUBLIC_VAPID_PUBKEY!, process.env.VAPID_PRIVKEY!);
    const user = await usersCollection.findOne({ id: question.user });
    if (user) user.subscriptions.forEach(async (sub: any) => {
        sendNotification(sub, JSON.stringify([{
            title: user.lang == 1 ? 'Question answered' : '답변 등록됨',
            body: user.lang == 1 ? `Your question ${question.title_en === "" ? question.title : question.title_en} was answered just now.` : `${question.title}에 답변이 등록되었습니다.`,
            tag: question.idx.toString()
        }])).catch(() => { });
    });
    return new Response(JSON.stringify({ code: 0 }), { status: 200 });
}

export async function PUT(request: Request, { params }: { params: { idx: string } }) {
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
    const questionsCollection = db.collection('questions');
    const question = await questionsCollection.findOne({ idx: Number(params.idx) });
    if (!question || (!userData.answerer && !question.public && question.user !== userData.id)) {
        client.close();
        return new Response(JSON.stringify({ code: 1, msg: i18n.nonExistentPost[clientLang] }), { status: 404 });
    }
    const data = await request.json();
    if (!userData.answerer && userData.perm >= 1) {
        client.close();
        return new Response(JSON.stringify({ code: 1, msg: i18n.notAnswererEdit[clientLang] }), { status: 403 });
    }
    await questionsCollection.updateOne({ idx: Number(params.idx) }, { $set: { answer: data.answer, answer_en: data.answer_en } });
    client.close();
    setVapidDetails(`mailto:${process.env.VAPID_EMAIL!}`, process.env.NEXT_PUBLIC_VAPID_PUBKEY!, process.env.VAPID_PRIVKEY!);
    const user = await usersCollection.findOne({ id: question.user });
    if (user) user.subscriptions.forEach(async (sub: any) => {
        sendNotification(sub, JSON.stringify([{
            title: user.lang == 1 ? 'Answer Edited' : '답변 수정됨',
            body: user.lang == 1 ? `The answer to your question ${question.title_en === "" ? question.title : question.title_en} was edited just now.` : `${question.title}에 대한 답변이 수정되었습니다.`,
            tag: question.idx.toString()
        }])).catch(() => { });
    });
    return new Response(JSON.stringify({ code: 0 }), { status: 200 });
}

export async function DELETE(request: Request, { params }: { params: { idx: string } }) {
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
    const questionsCollection = db.collection('questions');
    const question = await questionsCollection.findOne({ idx: Number(params.idx) });
    if (!question || (!userData.answerer && !question.public && question.user !== userData.id)) {
        client.close();
        return new Response(JSON.stringify({ code: 1, msg: i18n.nonExistentPost[clientLang] }), { status: 404 });
    }
    if (userData.perm >= 1 && !userData.answerer) {
        client.close();
        return new Response(JSON.stringify({ code: 1, msg: i18n.notAnswererDelete[clientLang] }), { status: 403 });
    }
    await questionsCollection.updateOne({ idx: Number(params.idx) }, { $unset: { answer: '' }, $set: { solved: false } });
    client.close();
    return new Response(JSON.stringify({ code: 0 }), { status: 200 });
}