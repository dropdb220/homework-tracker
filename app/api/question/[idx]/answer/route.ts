import { MongoClient } from "mongodb";
import { setVapidDetails, sendNotification } from "web-push";

export const dynamic = 'force-dynamic';

export async function POST(request: Request, { params }: { params: { idx: string } }) {
    const client = new MongoClient(process.env.MONGO!);
    await client.connect();
    const db = client.db(process.env.DB_NAME);
    const tokensCollection = db.collection('tokens');
    const token = request.headers.get('Authorization');
    if (!token) {
        client.close();
        return new Response(JSON.stringify({ code: 1, msg: '로그인이 필요합니다.' }), { status: 401 });
    }
    const tokenData = await tokensCollection.findOne({ token });
    if (!tokenData) {
        client.close();
        return new Response(JSON.stringify({ code: 1, msg: '유효하지 않은 토큰입니다.' }), { status: 401 });
    }
    const usersCollection = db.collection('users');
    const userData = await usersCollection.findOne({ id: tokenData.id });
    if (!userData) {
        client.close();
        return new Response(JSON.stringify({ code: 1, msg: '유효하지 않은 사용자입니다.' }), { status: 401 });
    }
    if (!userData.accepted) {
        client.close();
        return new Response(JSON.stringify({ code: 1, msg: '승인 대기 중입니다.' }), { status: 403 });
    }
    const questionsCollection = db.collection('questions');
    const question = await questionsCollection.findOne({ idx: Number(params.idx) });
    if (!question || (!userData.answerer && !question.public && question.user !== userData.id)) {
        client.close();
        return new Response(JSON.stringify({ code: 1, msg: '존재하지 않는 글입니다.' }), { status: 404 });
    }
    const data = await request.json();
    if (!userData.answerer && userData.perm >= 1) {
        client.close();
        return new Response(JSON.stringify({ code: 1, msg: '지정된 답변자만 답변할 수 있습니다.' }), { status: 403 });
    }
    await questionsCollection.updateOne({ idx: Number(params.idx) }, { $set: { answer: data.answer, answer_en: data.answer_en, solved: true } });
    client.close();
    setVapidDetails(`mailto:${process.env.VAPID_EMAIL!}`, process.env.NEXT_PUBLIC_VAPID_PUBKEY!, process.env.VAPID_PRIVKEY!);
    const user = await usersCollection.findOne({ id: question.user });
    if (user) user.subscriptions.forEach(async (sub: any) => {
        sendNotification(sub, JSON.stringify([{
            title: user.lang == 1 ? 'Question answered' : '답변 등록됨',
            body: user.lang == 1 ? `Your question ${question.title_en ?? question.title} was answered just now.` : `${question.title}에 답변이 등록되었습니다.`,
            tag: question.idx.toString()
        }])).catch(() => { });
    });
    return new Response(JSON.stringify({ code: 0 }), { status: 200 });
}

export async function PUT(request: Request, { params }: { params: { idx: string } }) {
    const client = new MongoClient(process.env.MONGO!);
    await client.connect();
    const db = client.db(process.env.DB_NAME);
    const tokensCollection = db.collection('tokens');
    const token = request.headers.get('Authorization');
    if (!token) {
        client.close();
        return new Response(JSON.stringify({ code: 1, msg: '로그인이 필요합니다.' }), { status: 401 });
    }
    const tokenData = await tokensCollection.findOne({ token });
    if (!tokenData) {
        client.close();
        return new Response(JSON.stringify({ code: 1, msg: '유효하지 않은 토큰입니다.' }), { status: 401 });
    }
    const usersCollection = db.collection('users');
    const userData = await usersCollection.findOne({ id: tokenData.id });
    if (!userData) {
        client.close();
        return new Response(JSON.stringify({ code: 1, msg: '유효하지 않은 사용자입니다.' }), { status: 401 });
    }
    if (!userData.accepted) {
        client.close();
        return new Response(JSON.stringify({ code: 1, msg: '승인 대기 중입니다.' }), { status: 403 });
    }
    const questionsCollection = db.collection('questions');
    const question = await questionsCollection.findOne({ idx: Number(params.idx) });
    if (!question || (!userData.answerer && !question.public && question.user !== userData.id)) {
        client.close();
        return new Response(JSON.stringify({ code: 1, msg: '존재하지 않는 글입니다.' }), { status: 404 });
    }
    const data = await request.json();
    if (!userData.answerer && userData.perm >= 1) {
        client.close();
        return new Response(JSON.stringify({ code: 1, msg: '지정된 답변자만 답변을 수정할 수 있습니다.' }), { status: 403 });
    }
    await questionsCollection.updateOne({ idx: Number(params.idx) }, { $set: { answer: data.answer, answer_en: data.answer_en } });
    client.close();
    setVapidDetails(`mailto:${process.env.VAPID_EMAIL!}`, process.env.NEXT_PUBLIC_VAPID_PUBKEY!, process.env.VAPID_PRIVKEY!);
    const user = await usersCollection.findOne({ id: question.user });
    if (user) user.subscriptions.forEach(async (sub: any) => {
        sendNotification(sub, JSON.stringify([{
            title: user.lang == 1 ? 'Answer Edited' : '답변 수정됨',
            body: user.lang == 1 ? `The answer to your question ${question.title_en || question.title} was edited just now.` : `${question.title}에 대한 답변이 수정되었습니다.`,
            tag: question.idx.toString()
        }])).catch(() => { });
    });
    return new Response(JSON.stringify({ code: 0 }), { status: 200 });
}

export async function DELETE(request: Request, { params }: { params: { idx: string } }) {
    const client = new MongoClient(process.env.MONGO!);
    await client.connect();
    const db = client.db(process.env.DB_NAME);
    const tokensCollection = db.collection('tokens');
    const token = request.headers.get('Authorization');
    if (!token) {
        client.close();
        return new Response(JSON.stringify({ code: 1, msg: '로그인이 필요합니다.' }), { status: 401 });
    }
    const tokenData = await tokensCollection.findOne({ token });
    if (!tokenData) {
        client.close();
        return new Response(JSON.stringify({ code: 1, msg: '유효하지 않은 토큰입니다.' }), { status: 401 });
    }
    const usersCollection = db.collection('users');
    const userData = await usersCollection.findOne({ id: tokenData.id });
    if (!userData) {
        client.close();
        return new Response(JSON.stringify({ code: 1, msg: '유효하지 않은 사용자입니다.' }), { status: 401 });
    }
    if (!userData.accepted) {
        client.close();
        return new Response(JSON.stringify({ code: 1, msg: '승인 대기 중입니다.' }), { status: 403 });
    }
    const questionsCollection = db.collection('questions');
    const question = await questionsCollection.findOne({ idx: Number(params.idx) });
    if (!question || (!userData.answerer && !question.public && question.user !== userData.id)) {
        client.close();
        return new Response(JSON.stringify({ code: 1, msg: '존재하지 않는 글입니다.' }), { status: 404 });
    }
    if (userData.perm >= 1 && !userData.answerer) {
        client.close();
        return new Response(JSON.stringify({ code: 1, msg: '지정된 답변자만 답변을 삭제할 수 있습니다.' }), { status: 403 });
    }
    await questionsCollection.updateOne({ idx: Number(params.idx) }, { $unset: { answer: '' }, $set: { solved: false } });
    client.close();
    return new Response(JSON.stringify({ code: 0 }), { status: 200 });
}