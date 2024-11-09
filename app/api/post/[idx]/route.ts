import { MongoClient } from "mongodb";
import { sendNotification, setVapidDetails } from "web-push";
import { postType, postTypeEn } from "@/app/types";

export const dynamic = 'force-dynamic';

export async function GET(request: Request, { params }: { params: { idx: string } }) {
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
    const postsCollection = db.collection('posts');
    const post = await postsCollection.findOne({ count: Number(params.idx) });
    if (!post) {
        client.close();
        return new Response(JSON.stringify({ code: 1, msg: '존재하지 않는 글입니다.' }), { status: 404 });
    }
    const user = await usersCollection.findOne({ id: post.author });
    client.close();
    return new Response(JSON.stringify({ ...post, title: userData.lang == 1 ? (post.title_en ?? post.title) : post.title, content: userData.lang == 1 ? (post.content_en ?? post.content) : post.content, title_ko: post.title, content_ko: post.content, author: { id: post.author, firstName: user?.firstName, lastName: user?.lastName } }), { status: 200 });
}

export async function PUT(request: Request, { params }: { params: { idx: string } }) {
    const token = request.headers.get('Authorization');
    if (!token) {
        return new Response(JSON.stringify({ code: 1, msg: '로그인이 필요합니다.' }), { status: 401 });
    }
    const client = new MongoClient(process.env.MONGO!);
    await client.connect();
    const db = client.db(process.env.DB_NAME);
    const tokenCollection = db.collection('tokens');
    const tokenData = await tokenCollection.findOne({ token });
    if (!tokenData) {
        client.close();
        return new Response(JSON.stringify({ code: 1, msg: '로그인이 필요합니다.' }), { status: 401 });
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
    const postsCollection = db.collection('posts');
    const post = await postsCollection.findOne({ count: Number(params.idx) });
    if (!post) {
        client.close();
        return new Response(JSON.stringify({ code: 1, msg: '존재하지 않는 글입니다.' }), { status: 404 });
    }
    if (userData.perm > 1 && post.author !== userData.id) {
        client.close();
        return new Response(JSON.stringify({ code: 1, msg: '다른 사람의 글을 수정하려면 관리자 권한이 필요합니다.' }), { status: 403 });
    }
    const data = await request.json();
    if (!data.title || data.type == null || !data.content) {
        return new Response(JSON.stringify({ code: 1, msg: '제목, 타입, 내용을 입력하세요.' }), { status: 400 });
    }
    if (typeof data.title !== 'string' || (data.title_en != null && typeof data.title_en !== 'string') || typeof data.type !== 'number' || typeof data.content !== 'string' || (data.content_en != null && typeof data.content_en !== 'string') || (data.deadline && (typeof data.deadline !== 'string' || new Date(data.deadline).toString() === 'Invalid Date'))) {
        return new Response(JSON.stringify({ code: 1, msg: '제목, 내용은 문자열, 유형은 숫자, 마감 기한은 유효한 날짜여야 합니다.' }), { status: 400 });
    }
    if (data.type < 0 || data.type >= (postType as Array<string>).length - 1) {
        client.close();
        return new Response(JSON.stringify({ code: 1, msg: '유효하지 않은 유형입니다.' }), { status: 400 });
    }
    if (data.type === 0 && userData.perm > 1) {
        client.close();
        return new Response(JSON.stringify({ code: 1, msg: '중요 공지는 관리자만 등록할 수 있습니다.' }), { status: 403 });
    }
    await postsCollection.updateOne({ count: parseInt(params.idx) }, { $set: { title: data.title, title_en: data.title_en, type: data.type, content: data.content, content_en: data.content_en, deadline: data.deadline ? new Date(data.deadline) : null, author: userData.id, created: new Date() } });
    const userList = await usersCollection.find({ id: { $ne: userData.id } }).toArray();
    setVapidDetails(`mailto:${process.env.VAPID_EMAIL!}`, process.env.NEXT_PUBLIC_VAPID_PUBKEY!, process.env.VAPID_PRIVKEY!);
    userList.forEach(user => {
        user.subscriptions.forEach(async (sub: any) => {
            sendNotification(sub, JSON.stringify([{
                title: user.lang == 1 ? `${postTypeEn[data.type]} Announcement Edited` : `${postType[data.type]} 공지 수정됨`,
                body: user.lang == 1 ? `${data.title_en ?? data.title} was edited just now.` : `${data.title}이(가) 수정되었습니다.`,
                tag: params.idx
            }])).catch(() => { });
        });
    });
    client.close();
    return new Response(JSON.stringify({ code: 0 }), { status: 200 });
}

export async function DELETE(request: Request, { params }: { params: { idx: string } }) {
    if (!params.idx || params.idx === '' || isNaN(Number(params.idx))) {
        return new Response(JSON.stringify({ code: 1, msg: '글 번호를 입력하세요.' }), { status: 400 });
    }
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
    const postsCollection = db.collection('posts');
    const post = await postsCollection.findOne({ count: Number(params.idx) });
    if (!post) {
        client.close();
        return new Response(JSON.stringify({ code: 1, msg: '존재하지 않는 글입니다.' }), { status: 404 });
    }
    if (post.author !== userData.id && userData.perm > 1) {
        client.close();
        return new Response(JSON.stringify({ code: 1, msg: '작성자와 관리자만 삭제할 수 있습니다.' }), { status: 403 });
    }
    await postsCollection.deleteOne({ count: Number(params.idx) });
    client.close();
    return new Response(JSON.stringify({ code: 0 }), { status: 200 });
}
