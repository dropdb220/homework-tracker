import { MongoClient } from "mongodb";
import { setVapidDetails, sendNotification } from "web-push";
import i18n from "@/app/i18n.json";

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
    const questionsCollection = db.collection('questions');
    const question = await questionsCollection.findOne({ idx: Number(params.idx) });
    if (!question || (!userData.answerer && !question.public && question.user !== userData.id)) {
        client.close();
        return new Response(JSON.stringify({ code: 1, msg: i18n.nonExistentPost[clientLang] }), { status: 404 });
    }
    const user = await usersCollection.findOne({ id: question.user });
    client.close();
    return new Response(JSON.stringify({ ...question,
        title: userData.lang == 1 ? (question.title_en === "" ? question.title : question.title_en) : question.title, title_ko: question.title,
        question: userData.lang == 1 ? (question.question_en == "" ? question.question : question.question_en) : question.question, question_ko: question.question,
        answer: userData.lang == 1 ? (question.answer_en === "" ? question.answer : question.answer_en) : question.answer, answer_ko: question.answer,
        user: { id: question.user, firstName: user?.firstName, lastName: user?.lastName } }), { status: 200 });
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
    const questionsCollection = db.collection('questions');
    const question = await questionsCollection.findOne({ idx: Number(params.idx) });
    if (!question || (!userData.answerer && !question.public && question.user !== userData.id)) {
        client.close();
        return new Response(JSON.stringify({ code: 1, msg: i18n.nonExistentPost[clientLang] }), { status: 404 });
    }
    const data = await request.json();
    if (userData.perm >= 1 && question.user !== userData.id) {
        client.close();
        return new Response(JSON.stringify({ code: 1, msg: i18n.editOthersPost[clientLang] }), { status: 403 });
    }
    const updateList = { $set: {} };
    if (data.title && typeof data.title === 'string') Object.assign(updateList.$set, { title: data.title });
    if (data.title_en && typeof data.title_en === 'string') Object.assign(updateList.$set, { title_en: data.title_en });
    if (data.question && typeof data.question === 'string') Object.assign(updateList.$set, { question: data.question });
    if (data.question_en && typeof data.question_en === 'string') Object.assign(updateList.$set, { question_en: data.question_en });
    if (data.public != null && typeof data.public === 'boolean') Object.assign(updateList.$set, { public: data.public });
    await questionsCollection.updateOne({ idx: Number(params.idx) }, updateList);
    client.close();
    setVapidDetails(`mailto:${process.env.VAPID_EMAIL!}`, process.env.NEXT_PUBLIC_VAPID_PUBKEY!, process.env.VAPID_PRIVKEY!);
    const answerers = await usersCollection.find({ answerer: true }).toArray();
    answerers.forEach(async (answerer) => {
        answerer.subscriptions.forEach(async (sub: any) => {
            sendNotification(sub, JSON.stringify([{
                title: answerer.lang == 1 ? 'Question Edited' : '질문 수정됨',
                body: answerer.lang == 1 ? `Question ${question.title_en === "" ? question.title : question.title_en} was edited just now.` : `${question.title}이(가) 수정되었습니다.`,
                tag: question.idx.toString()
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
    const questionsCollection = db.collection('questions');
    const question = await questionsCollection.findOne({ idx: Number(params.idx) });
    if (!question || (!userData.answerer && !question.public && question.user !== userData.id)) {
        client.close();
        return new Response(JSON.stringify({ code: 1, msg: i18n.nonExistentPost[clientLang] }), { status: 404 });
    }
    if (userData.perm >= 1 && question.user !== userData.id) {
        client.close();
        return new Response(JSON.stringify({ code: 1, msg: i18n.cantDelete[clientLang] }), { status: 403 });
    }
    await questionsCollection.deleteOne({ idx: Number(params.idx) });
    client.close();
    return new Response(JSON.stringify({ code: 0 }), { status: 200 });
}