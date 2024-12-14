import { MongoClient } from "mongodb";
import { sendNotification, setVapidDetails } from "web-push";
import { postType, postTypeEn } from "@/app/types";
import i18n from "@/app/i18n.json";

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
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
    let posts = await postsCollection.find().toArray();
    await Promise.all(posts.filter(post => post.deadline && (new Date(post.deadline) as unknown as number <= (new Date() as unknown as number) - 1000 * 60 * 60 * 15)).map(async post => {
        return postsCollection.deleteOne({ count: post.count });
    }));
    const examsCollection = db.collection('exams');
    let exams = await examsCollection.find().toArray();
    await Promise.all(exams.filter(exam => new Date(exam.subjects.slice(-1)[0].date) as unknown as number <= (new Date() as unknown as number) - 1000 * 60 * 60 * 24).map(async exam => {
        return examsCollection.deleteOne({ year: exam.year, semester: exam.semester, idx: exam.idx });
    }));
    const csatCollection = db.collection('csat');
    let csat = await csatCollection.find().toArray();
    await Promise.all(csat.filter(csat => new Date(csat.date) as unknown as number <= (new Date() as unknown as number) - 1000 * 60 * 60 * 24).map(async csat => {
        return csatCollection.deleteOne({ date: csat.date });
    }));
    client.close();
    posts = posts.filter(post => !post.deadline || (new Date(post.deadline) as unknown as number > (new Date() as unknown as number) - 1000 * 60 * 60 * 15)).reverse();
    const sortedPosts = posts.filter(post => post.type === 0).filter(post => post.deadline != null).sort((a, b) => (new Date(a.deadline) as unknown as number) - (new Date(b.deadline) as unknown as number))
        .concat(posts.filter(post => post.type === 0).filter(post => post.deadline == null))
        .concat(posts.filter(post => post.type > 0).filter(post => post.deadline != null).sort((a, b) => a.deadline === b.deadline ? a.type - b.type : (new Date(a.deadline) as unknown as number) - (new Date(b.deadline) as unknown as number)))
        .concat(posts.filter(post => post.type > 0).filter(post => post.deadline == null).sort((a, b) => a.type - b.type));
    const currentExam = exams.filter(exam => new Date(exam.subjects.slice(-1)[0].date) as unknown as number > (new Date() as unknown as number) - 1000 * 60 * 60 * 24).sort((a, b) => (new Date(a.subjects[0].date) as unknown as number) - (new Date(b.subjects[0].date) as unknown as number))[0];
    const currentCsat = csat.filter(csat => new Date(csat.date) as unknown as number > (new Date() as unknown as number) - 1000 * 60 * 60 * 24).sort((a, b) => (new Date(a.date) as unknown as number) - (new Date(b.date) as unknown as number))[0];
    return new Response(JSON.stringify({ posts: sortedPosts.map(x => { return { count: x.count, title: userData.lang == 1 ? (x.title_en ?? x.title) : x.title, type: x.type, deadline: x.deadline }; }), exam: currentExam, csat: currentCsat ? { ...currentCsat, type: userData.lang == 1 ? (currentCsat.type_en ?? currentCsat.type) : currentCsat.type } : null }), { status: 200 });
}

export async function POST(request: Request) {
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
    const data = await request.json();
    if (!data.title || data.type == null || !data.content) {
        client.close();
        return new Response(JSON.stringify({ code: 1, msg: i18n.postMissingFields[clientLang] }), { status: 400 });
    }
    if (typeof data.title !== 'string' || (data.title_en != null && typeof data.title_en !== 'string') || typeof data.type !== 'number' || typeof data.content !== 'string' || (data.content_en != null && typeof data.content_en !== 'string') || (data.deadline && (typeof data.deadline !== 'string' || new Date(data.deadline).toString() === 'Invalid Date'))) {
        client.close();
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
    const postsCollection = db.collection('posts');
    const count = (await postsCollection.find().toArray()).map(x => x.count).reduce((a: number, b: number) => Math.max(a, b), 0) + 1;
    await postsCollection.insertOne({ count, title: data.title, title_en: data.title_en, type: data.type, content: data.content, content_en: data.content_en, deadline: data.deadline ? new Date(data.deadline) : null, author: userData.id, created: new Date() });
    const userList = await usersCollection.find({ id: { $ne: userData.id } }).toArray();
    setVapidDetails(`mailto:${process.env.VAPID_EMAIL!}`, process.env.NEXT_PUBLIC_VAPID_PUBKEY!, process.env.VAPID_PRIVKEY!);
    userList.forEach(user => {
        user.subscriptions.forEach(async (sub: any) => {
            sendNotification(sub, JSON.stringify([{
                title: user.lang == 1 ? `${postTypeEn[data.type]} Announcement Posted` : `${postType[data.type]} 공지 등록됨`,
                body: user.lang == 1 ? `${data.title_en === "" ? data.title : data.title_en} was posted just now.` : `${data.title}이(가) 등록되었습니다.`,
                tag: count.toString()
            }])).catch(() => { })
        });
    });
    client.close();
    return new Response(JSON.stringify({ code: 0, count }), { status: 200 });
}
