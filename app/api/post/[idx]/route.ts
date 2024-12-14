import { MongoClient } from "mongodb";
import { sendNotification, setVapidDetails } from "web-push";
import { postType, postTypeEn } from "@/app/types";
import i18n from "@/app/i18n.json";

export const dynamic = 'force-dynamic';

export async function GET(request: Request, { params }: { params: { idx: string } }) {
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
    const postsCollection = db.collection('posts');
    const post = await postsCollection.findOne({ count: Number(params.idx) });
    if (!post) {
        client.close();
        return new Response(JSON.stringify({ code: 1, msg: i18n.nonExistentPost[clientLang] }), { status: 404 });
    }
    const user = await usersCollection.findOne({ id: post.author });
    client.close();
    return new Response(JSON.stringify({ ...post, title: userData.lang == 1 ? (post.title_en === "" ? post.title : post.title_en) : post.title, content: userData.lang == 1 ? (post.content_en === "" ? post.content : post.content_en) : post.content, title_ko: post.title, content_ko: post.content, author: { id: post.author, firstName: user?.firstName, lastName: user?.lastName } }), { status: 200 });
}

export async function PUT(request: Request, { params }: { params: { idx: string } }) {
    let clientLang = !isNaN(Number(request.headers.get('X-Lang') || undefined)) ? Number(request.headers.get('X-Lang')) : request.headers.get('Accept-Language')?.startsWith("en") ? 1 : 0;
    if (clientLang !== 0 && clientLang !== 1) clientLang = request.headers.get('Accept-Language')?.startsWith("en") ? 1 : 0;
    const token = request.headers.get('Authorization');
    if (!token) {
        return new Response(JSON.stringify({ code: 1, msg: i18n.loginRequired[clientLang] }), { status: 401 });
    }
    const client = new MongoClient(process.env.MONGO!);
    await client.connect();
    const db = client.db(process.env.DB_NAME);
    const tokenCollection = db.collection('tokens');
    const tokenData = await tokenCollection.findOne({ token });
    if (!tokenData) {
        client.close();
        return new Response(JSON.stringify({ code: 1, msg: i18n.invalidLogin[clientLang] }), { status: 401 });
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
    const postsCollection = db.collection('posts');
    const post = await postsCollection.findOne({ count: Number(params.idx) });
    if (!post) {
        client.close();
        return new Response(JSON.stringify({ code: 1, msg: i18n.nonExistentPost[clientLang] }), { status: 404 });
    }
    if (userData.perm > 1 && post.author !== userData.id) {
        client.close();
        return new Response(JSON.stringify({ code: 1, msg: i18n.editOthersPost[clientLang] }), { status: 403 });
    }
    const data = await request.json();
    if (!data.title || data.type == null || !data.content) {
        return new Response(JSON.stringify({ code: 1, msg: i18n.postMissingFields[clientLang] }), { status: 400 });
    }
    if (typeof data.title !== 'string' || (data.title_en != null && typeof data.title_en !== 'string') || typeof data.type !== 'number' || typeof data.content !== 'string' || (data.content_en != null && typeof data.content_en !== 'string') || (data.deadline && (typeof data.deadline !== 'string' || new Date(data.deadline).toString() === 'Invalid Date'))) {
        return new Response(JSON.stringify({ code: 1, msg: i18n.postMalformedFields[clientLang] }), { status: 400 });
    }
    if (data.type < 0 || data.type >= (postType as Array<string>).length - 1) {
        client.close();
        return new Response(JSON.stringify({ code: 1, msg: i18n.postTypeMalformed[clientLang] }), { status: 400 });
    }
    if (data.type === 0 && userData.perm > 1) {
        client.close();
        return new Response(JSON.stringify({ code: 1, msg: i18n.importantType[clientLang] }), { status: 403 });
    }
    await postsCollection.updateOne({ count: parseInt(params.idx) }, { $set: { title: data.title, title_en: data.title_en, type: data.type, content: data.content, content_en: data.content_en, deadline: data.deadline ? new Date(data.deadline) : null, author: userData.id, created: new Date() } });
    const userList = await usersCollection.find({ id: { $ne: userData.id } }).toArray();
    setVapidDetails(`mailto:${process.env.VAPID_EMAIL!}`, process.env.NEXT_PUBLIC_VAPID_PUBKEY!, process.env.VAPID_PRIVKEY!);
    userList.forEach(user => {
        user.subscriptions.forEach(async (sub: any) => {
            sendNotification(sub, JSON.stringify([{
                title: user.lang == 1 ? `${postTypeEn[data.type]} Announcement Edited` : `${postType[data.type]} 공지 수정됨`,
                body: user.lang == 1 ? `${data.title_en === "" ? data.title : data.title_en} was edited just now.` : `${data.title}이(가) 수정되었습니다.`,
                tag: params.idx
            }])).catch(() => { });
        });
    });
    client.close();
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
    if (!params.idx || params.idx === '' || isNaN(Number(params.idx))) {
        return new Response(JSON.stringify({ code: 1, msg: i18n.noIdx[clientLang] }), { status: 400 });
    }
    const postsCollection = db.collection('posts');
    const post = await postsCollection.findOne({ count: Number(params.idx) });
    if (!post) {
        client.close();
        return new Response(JSON.stringify({ code: 1, msg: i18n.nonExistentPost[clientLang] }), { status: 404 });
    }
    if (post.author !== userData.id && userData.perm > 1) {
        client.close();
        return new Response(JSON.stringify({ code: 1, msg: i18n.cantDelete[clientLang] }), { status: 403 });
    }
    await postsCollection.deleteOne({ count: Number(params.idx) });
    client.close();
    return new Response(JSON.stringify({ code: 0 }), { status: 200 });
}
